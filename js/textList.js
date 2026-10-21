define(['jquery', 'Q', 'wizer-api', 'wizletBase', 'WizerModel', 'doT', 'logger'], function($, Q, WizerApi, WizletBase, WizerModel, doT, logger) {

    var TextList = function() {
        this.type = 'TextList';
        this.level = 1;
    };
    var totalCount = 0, yourCount = 0;
    TextList.prototype.loadHandler = function(unused, wizletInfo, wizletContext, wizerApi) {
        this.wizletInfo = wizletInfo;
        if (!this.wizletInfo.maxLists) this.wizletInfo.maxLists = Number.MAX_VALUE;
        if (!this.wizletInfo.filters) this.wizletInfo.filters = {
            "allVotes": "All",
            "showForeman": "My foreman's",
            "myVotes": "Mine",
            "myTrackParticipantVotes": "My group"
        };
        this.wizletContext = wizletContext;
        this.wizerApi = wizerApi;
        this.templateDefer = Q.defer();
        var self = this;
        self.isDelivery = this.wizletInfo.isDelivery;
        var requirements = [];
        requirements.push(WizletBase.loadTemplate(wizletInfo, 'textList.dot'));

        if (wizletInfo.css) {
            requirements.push(WizletBase.loadCss(wizletInfo));
        }

        require(requirements, function(doTTemplate, css) {
            self.templateDefer.resolve(doTTemplate);
        });

        //VideoPlayer.onLoad(null, info, content, wizerApi);
        return WizletBase.loadHandler({
            wizlet: this,
            render: this.render
        });
    };

    TextList.prototype.unloadHandler = function() {
        //unload wizletbase
        if (this.refreshVotesTimer) {
            clearTimeout(this.refreshVotesTimer);
            this.refreshVotesTimer = null;
        }
        if (this.refreshVotes) $(document).off("wizer:model:change", this.refreshVotes);
        WizletBase.unloadHandler({
            wizlet: this
        });
    };

    TextList.prototype.render = function(options) {
        var self = this;
        var voteValue, questionId, parentElement;
        var promises = [];
        //var rendering = new Q.defer();
        return self.templateDefer.promise.then(function(template) {
                var fragment = template(options.wizletInfo);
                options.context.html(fragment);
                var contextId = $(options.context).attr('id');
                var promises = [];
                document.addEventListener('click',function(e){
                    //console.log(e);
                    if(e.target && e.target.id == 'delete'){
                        parentElement = e.target.parentElement;
                        voteValue = $(parentElement).find('.tlc-vote')[0].innerText;
                        questionId = self.wizerApi.getQuestionIdByName(options.wizletInfo.questions[0].binding);  
                        self.wizerApi.getMyVotes([questionId]).then(function(response){
                                var getResponse = response.responses[questionId]
                                if(response.success){
                                for (var i = 0; i < getResponse.length; i++){
                                    if(voteValue == getResponse[i].responseText.trim()){
                                        promises.push(Q(AjaxGetJson("Vote", "RemoveVote", { responseId: getResponse[i].responseId })));
                                        parentElement.remove();
                                        //totalCount--;
                                    }
                                }}
                                if(promises.length > 0){
                                Q.all(promises).then(function(){
                                    // console.log('Promise resolved');
                                });
                            }
                        }); 
                    }
                 });
                options.context.find('[data-inputRadio]').each(function() {
                    var radioId = $(this).attr('id');
                    var radioName = $(this).attr('name');
                    var label = $(this).siblings('label');

                    var newRadioId = contextId + "-" + radioId;
                    var newRadioName = contextId + "-" + radioName;

                    $(this).attr('id', newRadioId);
                    $(this).attr('name', newRadioName);
                    label.attr('for', newRadioId);
                });

                options.context.find('[data-filterRestriction]').find('[data-inputRadio]').on('change', function(event) {
                    self.changeFilter(event, options);
                });
                options.context.find('[data-filterQuestion]').find('[data-inputRadio]').on('change', function(event) {
                    self.changeFilterQuestion(event, options);
                });

                if (options.wizletInfo.refresh) {
                    // bind wizer:model:change instead of latestVoteTimeChanged
                    $(document).on("wizer:model:change", {
                        context: self,
                        options: options
                    }, self.refreshVotes);
                }

                self.questionId = self.wizerApi.getQuestionIdByName(options.wizletInfo.questions[0].binding);
                if (options.wizletInfo.trackQuestion) {
                    self.trackQuestionId = self.wizerApi.getQuestionIdByName(options.wizletInfo.trackQuestion);
                    var trackDiffer = new Q.defer();
                    var gettingMyVoteOnTrack = self.wizerApi.getMyVotes([self.trackQuestionId]);
                    gettingMyVoteOnTrack.then(function(votes) {
                        self.myVoteonTrack = votes.votes[self.trackQuestionId];
                        if (self.myVoteonTrack) {
                            trackDiffer.resolve(true);
                        } else {
                            trackDiffer.resolve(true);
                            self.wizerApi.showError("No Votes of this user on trackQuestion: " + self.wizletInfo.trackQuestion);
                        }
                    }); 

                }

                if (options.wizletInfo.questions[0].binding.indexOf('ASSESS.') > -1) {
                    self.selectWhichTabToExplore('assessment', options)
                        .done();
                } else if (options.wizletInfo.restrictions && options.wizletInfo.restrictions.length > 0) {
                    var tabToExplore = options.wizletInfo.restrictions[0];
                    self.selectWhichTabToExplore(tabToExplore, options)
                        .done();
                } else {
                    if (options.wizletInfo.filterQuestions) {
                        var typeOfFilter = "1";
                        self.filterQuestionIndex = typeOfFilter;
                        self.currentTab = options.wizletInfo.filterQuestions[0].options[typeOfFilter - 1].name;
                        self.renderFilterQuestionVotes(typeOfFilter, options);
                        $(options.context.find('[data-filterQuestion]')[0]).find("input[type='radio']").attr("checked", true);
                    }
                }
                return true;
            })
            .fail(this.wizerApi.showError);
        //return rendering.promise;
    };

    //Called when a tab on the component is clicked
    TextList.prototype.changeFilter = function(event, options) {
        var typeOfFilter = $(event.currentTarget).parent().attr('data-key');
        this.selectWhichTabToExplore(typeOfFilter, options)
            .done();
    };

    //Calls functions to render votes inside vote containers according to the tab clicked
    TextList.prototype.selectWhichTabToExplore = function(tabToExplore, options) {
        var self = this;
        this.currentTab = tabToExplore;
        this.latestResponseId = null; // reset when changing tab
        var prework;
        switch (tabToExplore) {
            case "allVotes":
            case "myVotes":
                prework = Q(true);
                break;
            case "showForeman":
                prework = self.gettingForeman();
                break;
            case "myTrackParticipantVotes":
                prework = self.gettingTrackParticipantIds();
                break;
            case "assessment":
                prework = self.wizerApi.getMyNetworks([options.wizletInfo.questions[0].binding]);
                break;
        }
        return prework.then(function(preworkResult) {
                if (tabToExplore == "assessment") {
                    return self.parseMyAsssessorComments(preworkResult, options);
                } else {
                    return self.wizerApi.getVotes(self.makeQuestionObject(tabToExplore));
                }
            })
            .then(function(response) {
                return self.addVoteContainersDynamically(response, options).then(function() {
                if(self.wizletInfo.showLikeStatus){
                    return self.wizerApi.getResponseObjectComments(Wizer.EventId, Wizer.meetingFilters, self.myVoteonTrack == undefined ? '' : self.myVoteonTrack[0], options.wizletInfo.questions[0].binding, self.wizletInfo.isMeeting, self.wizletInfo.likeMaxCount, self.wizletInfo.markImportantMaxCount).then(function (result) {
                            self.checkLikeCompleteStatus(result.comments); 
                        if (result.exceedMaxLikeCount) {
                            self.enableDisableLike(false)
                        }
                    });
                }
            });
            });
    };

    TextList.prototype.makeQuestionObject = function(tabToExplore) {
        var self = this;
        self.questionObject = {
            questionIds: [self.questionId],
            latestResponseId: self.latestResponseId,
            maxVoteCount: self.wizletInfo.maxLists,
            isDelivery: self.isDelivery,
            meetingCode: self.myVoteonTrack ? self.myVoteonTrack[0] : ''
        };
        switch (tabToExplore) {
            case "allVotes":
                break;
            case "showForeman":
                self.questionObject.participantIds = [self.foremanId];
                break;
            case "myVotes":
                self.questionObject.participantIds = [Wizer.ParticipationId];
                break;
            case "myTrackParticipantVotes":
                self.questionObject.participantIds = self.trackParticipationIds;
                break;
        }
        return self.questionObject;
    };

    //Calls functions to render votes inside vote containers according to the tab clicked
    TextList.prototype.changeFilterQuestion = function(event, options) {
        var typeOfFilter = $(event.currentTarget).parent().data('key');
        var filterOption = $(event.currentTarget).parent().data('filteroption')
        this.latestResponseId = null; // reset when changing tab
        this.filterQuestionIndex = typeOfFilter;
        this.currentTab = options.wizletInfo.filterQuestions[0].options[filterOption - 1].name;
        this.renderFilterQuestionVotes(typeOfFilter, options);
    }

    TextList.prototype.renderFilterQuestionVotes = function(typeOfFilter, options) {
        var self = this;
        var filterQuestion = options.wizletInfo.filterQuestions[0].binding;
        self.filterQuestionId = this.wizerApi.getQuestionIdByName(filterQuestion);
        self.latestResponseId = null;
        self.questionObject = {
            questionIds: [this.questionId],
            filterQuestionId: self.filterQuestionId,
            filterText: typeOfFilter,
            isDelivery: self.isDelivery
        };

        return filterQuestionVotes = this.wizerApi.getVotes(self.questionObject).then(function(response) {
            self.addVoteContainersDynamically(response, options);
        });
    }

    TextList.prototype.checkLikeCompleteStatus = function (comments) {
        var self = this;
        if (self.wizletInfo.showLikeStatus || self.wizletInfo.showImportantStatus) {
            for (var i = 0; i < comments.length; i++) {
                if (comments[i].Status === "MarkedImportant") {
                    // comments
                    if (comments[i].ParticipationId === Wizer.ParticipationId) {
                        self.wizletContext.find('[vote="' + comments[i].AssociatedObjectId + '"]  [data-mark-important_' + comments[i].AssociatedObjectId + ']').addClass('tlc-markImportant--checked');
                    }

                } else if (comments[i].Status === "Liked") {
                    if (comments[i].ParticipationId === Wizer.ParticipationId) {
                        self.wizletContext.find('[vote="' + comments[i].AssociatedObjectId + '"] [data-like_' + comments[i].AssociatedObjectId + ']').addClass('tlc-likeIcon--checked');
                    }
                }

                if (comments[i].LikeCount > 0) {
                    if (comments[i].LikeCount == 0) {
                        self.wizletContext.find('[data-likecount_' + comments[i].AssociatedObjectId + ']').text('');
                    }
                    else {
                        self.wizletContext.find('[data-likecount_' + comments[i].AssociatedObjectId + ']').text(comments[i].LikeCount);
                    }
                }

                if (comments[i].LikeCount > 0 && !self.wizletInfo.showLikeStatus) {
                    self.wizletContext.find('[data-likecount_' + comments[i].AssociatedObjectId + ']').text('');
                }
            }
        }
    }

    TextList.prototype.gettingTrackParticipantIds = function() {
        var self = this;
        if (self.trackParticipationIds) {
            return Q(self.trackParticipationIds);
        }
        return self.wizerApi.getTrackParticipants(self.trackQuestionId).then(function(respParticipants) {
            self.trackParticipationIds = [];
            $.each(respParticipants.participants, function(indx, participant) {
                self.trackParticipationIds.push(participant.Id);
            });
            return self.trackParticipationIds;
        });

    };

    TextList.prototype.gettingForeman = function() {
        var self = this;
        if (self.foremanId) {
            return Q(self.foremanId);
        }
        return self.wizerApi.getForemanId(self.trackQuestionId, self.isDelivery).then(function(foremanId) {
            self.foremanId = foremanId;
            return self.foremanId;
        });
    };

    var myTeamVotes;

    //Function to add votes to the votescontainer for foreman anf my votes filters according to the number of votes received
    TextList.prototype.addVoteContainersDynamically = function(response, options, thisIsAnIncrement, allowMultiVotes) {
        var adding = new Q.defer();
        var addingComplete = new Q.defer();
        var self = this;
        if (self.wizletInfo.teamNameQuestion && !myTeamVotes) {
            // get my team votes on teamNameQuestion
            self.wizerApi.getVotesByQuestionName([self.wizletInfo.teamNameQuestion])
                .then(function(result) {
                    myTeamVotes = result.participants;
                    adding.resolve(true);
                });

        } else {
            adding.resolve(true);
        }
        adding.promise.then(function(result) {
            var votesContainer = options.context.find('[data-votesContainer]');
            if (!allowMultiVotes) {
                votesContainer.html('');
            }
            if (!thisIsAnIncrement) {
                votesContainer.html('');
            }
            var votes,
                votesToBeShown,
                maxLists = options.wizletInfo.maxLists;

            votes = response.votes.slice(0, maxLists).reverse();
            votesToBeShown = Math.min(votes.length, maxLists);
            if(self.wizletInfo.showCount.show){
            self.wizerApi.getMyVotesByQuestionName([options.wizletInfo.questions[0].binding]).then(function(response){
                var questionID = self.wizerApi.getQuestionIdByName(options.wizletInfo.questions[0].binding);
                yourCount = response.votes[questionID].length;
                options.context.find('[data-yourcount-value]').html(yourCount);
                });
            self.wizerApi.getVoteCount( self.wizerApi.getQuestionIdByName([options.wizletInfo.questions[0].binding])).then(function(response){ 
                totalCount = response.counts[(self.wizerApi.getQuestionIdByName([options.wizletInfo.questions[0].binding]))];
                options.context.find('[data-totalcount-value]').html(totalCount);
            });
            }
            for (var count = 0; count < votesToBeShown; count++) {
                var responseId = votes[count].responseId;
                var element = options.context.find('[data-votesContainer]').find('[vote="' + responseId + '"]');
                if (allowMultiVotes) {
                    if (element.length === 0) {
                        var domVote = self.voteHtml(votes[count], options);
                        options.context.find('[data-votesContainer]').prepend(domVote);
                        options.context.find('[data-like_' + responseId + ']').on('click', function (event) {
                            self.markLike(event);
                        });
                        //self.voteCount(votes[count], options);
                    }
                } else {
                    var domVote = self.voteHtml(votes[count], options);
                    options.context.find('[data-votesContainer]').prepend(domVote);
                    options.context.find('[data-like_' + responseId + ']').on('click', function (event) {
                        self.markLike(event);
                    });
                    //self.voteCount(votes[count], options);
                }

                if (self.wizletInfo.incremental !== false && !allowMultiVotes) {
                    self.latestResponseId = Math.max(self.latestResponseId || 0, votes[count].responseId);
                }
            }

            if (self.currentTab !== "allVotes" && self.currentTab !== "myTrackParticipantVotes" && self.currentTab.substring(0, 12) !== "filterOption") {
                options.context.find('[data-votesContainer] [data-voteAuthor]').addClass('noMargin');
            }
            addingComplete.resolve(true);
        });
        return addingComplete.promise;
    };

    //Creates div structure which represents a vote and appends it to the votescontainer
    //Why not .dot templates?
    TextList.prototype.voteHtml = function(vote, options) {
        // get version of HTML
        var componentVersion = options.wizletInfo.version || 0,
            str;

        // Preserve line breaks entered by the participant: newlines collapse to a
        // single space inside a <p>, so convert them to <br> for display.
        var voteText = (vote.responseText === undefined || vote.responseText === null)
            ? ''
            : String(vote.responseText).replace(/(?:\r\n|\r|\n)/g, '<br>');

        if (componentVersion == 2) {
            var pName = vote.participantName;
            if (this.wizletInfo.teamNameQuestion && myTeamVotes) {
                for (var ti = 0; ti < myTeamVotes.length; ti++) {
                    if (pName === myTeamVotes[ti].name) {
                        if (options.wizletInfo.appendTeamNumber || options.wizletInfo.appendParticipantName) {
                            pName = pName + ": " + myTeamVotes[ti].questionMap[options.wizletInfo.teamNameQuestion].value;
                        } else {
                            pName = myTeamVotes[ti].questionMap[options.wizletInfo.teamNameQuestion].value;
                        }
                    }
                }
            }
            str = '<article class="tlc-article" vote="' + vote.responseId + '" data-voteContainer>' +
                '<div class="tlc-vote" data-voteTextContainer>' +
                '<p class="tlc-vote__text cl-paragraph" data-voteTextIndex="' + vote.responseId + '" data-voteText>' + voteText + '</p></div>';

            if (this.currentTab !== "myVotes" && this.currentTab !== "allVotes" && this.currentTab !== "myTrackParticipantVotes" && this.currentTab.substring(0, 12) !== "filterOption") {
                if (options.wizletInfo.showAuthor) {

                    str += '<div class="tlc-author" data-voteSequenceAuthorContainer>';
                    str += '<p class="tlc-author__text cl-paragraph" data-voteAuthorIndex="' + vote.responseId + '" data-voteAuthor>' + pName + '</p></div>';
                }
            } else {
                str += '<div class="tlc-author" data-voteSequenceAuthorContainer>';
                if(options.wizletInfo.showLikeCount){
                    str += '<span class="tlc-iconCont"> <span class="tlc-likeCount" data-likecount_' + vote.responseId + '></span></span>';
                }
                if(options.wizletInfo.showLikeStatus){
                    str += '<span class="tlc-likeIcon cl-icon cl-icon--heart" data-voteAuthorIndex="' + vote.responseId + '" data-like_' + vote.responseId + '></span>';
                }
                str += '<p class="tlc-vote__number" data-voteSequenceNumber>' + vote.sequence + '</p>';
                if (options.wizletInfo.showAuthor) {
                    str += '<p class="tlc-author__text" data-voteAuthorIndex="' + vote.responseId + '" data-voteAuthor>' + pName + '</p></div>';
                }
            }
            str += '</article>';

        } else if (componentVersion < 2) {

            str = '<div class="textListComponentVote' + vote.responseId + 'Container textListComponentVoteContainer" vote="' + vote.responseId + '" data-voteContainer>' +
                '<div class="textListComponentVote' + vote.responseId + 'TextContainer textListComponentVoteTextContainer" data-voteTextContainer>' +
                '<p class="textListComponentVote' + vote.responseId + 'Text textListComponentVoteText" data-voteTextIndex="' + vote.responseId + '" data-voteText>' + voteText + '</p></div>';

            if (this.currentTab !== "allVotes" && this.currentTab !== "myTrackParticipantVotes" && this.currentTab.substring(0, 12) !== "filterOption") {
                if (options.wizletInfo.showAuthor) {
                    str += '<div class="textListComponentVote' + vote.responseId + 'SequenceAuthorContainer textListComponentVoteSequenceAuthorContainer" data-voteSequenceAuthorContainer>';
                    str += '<p class="textListComponentVote' + vote.responseId + 'Author textListComponentVoteAuthor" data-voteAuthorIndex="' + vote.responseId + '" data-voteAuthor>' + vote.participantName + '</p></div>';
                }
            } else {
                str += '<div class="textListComponentVote' + vote.responseId + 'SequenceAuthorContainer textListComponentVoteSequenceAuthorContainer" data-voteSequenceAuthorContainer>';
                str += '<p class="textListComponentVote' + vote.responseId + 'SequenceNumber textListComponentVoteSequenceNumber" data-voteSequenceNumber>' + vote.sequence + '</p>';
                if (options.wizletInfo.showAuthor) {
                    str += '<p class="textListComponentVote' + vote.responseId + 'Author textListComponentVoteAuthor" data-voteAuthorIndex="' + vote.responseId + '" data-voteAuthor>' + vote.participantName + '</p></div>';
                }
            }
            str += '</div>';
        }

        if (Wizer.ParticipationId == vote.participantId) {
            var str = str.replace('</article>', '<div class="delete" id="delete" data-delete-entry></div></article>');
            var value = str.replace('tlc-article', 'tlc-article myVote');
            
        } else {
            var value = str;
        }
        return value;
    };
    

    //Refreshes votes for the opened tab, i.e. add votes (complete div structure or increment) to the already existing component.
    // One submit updates the model several times; collapse those into a single rebuild.
    TextList.prototype.refreshVotes = function(event) {
        var self = event.data.context;
        var options = event.data.options;
        if (self.refreshVotesTimer) {
            clearTimeout(self.refreshVotesTimer);
        }
        self.refreshVotesTimer = setTimeout(function() {
            self.refreshVotesTimer = null;
            self.refreshVotesNow(options);
        }, 200);
    };

    TextList.prototype.refreshVotesNow = function(options) {
        var self = this;
        var questionId = self.questionId;
        var maxLists = options.wizletInfo.maxLists;
        var assessment = false;

        var question = self.wizerApi.getQuestion(questionId);

        if (self.wizletInfo.incremental !== false) {
            self.questionObject.latestResponseId = self.latestResponseId;
        }
        var votes;
        if (options.wizletInfo.questions[0].binding.indexOf('ASSESS.') > -1) {
            assessment = true;
            votes = self.wizerApi.getMyNetworks([options.wizletInfo.questions[0].binding]);
        } else {
            if (question.AllowMultiVotes) {
                votes = self.wizerApi.getVotes(self.questionObject);
            } else {
                self.questionObject.latestResponseId = null;
                votes = self.wizerApi.getVotes(self.questionObject);
            }

        }


        return votes.then(function(response) {
            if (assessment) {
                response = self.parseMyAsssessorComments(response, options);
            }
            var responseVotes = response.votes || [];
            var incoming = responseVotes.map(function(vote) {
                return String(vote.responseId) + ':' + (vote.responseText || '');
            }).sort().join('|');
            var current = [];
            options.context.find('[data-voteContainer]').each(function() {
                current.push($(this).attr('vote') + ':' + $(this).find('[data-voteText]').text());
            });
            if (incoming === current.sort().join('|')) {
                return;
            }

            if (self.wizletInfo.incremental !== false) { // incremental is default

                self.addVoteContainersDynamically(response, options, true, question.AllowMultiVotes);

                var voteContainers = options.context.find('[data-voteContainer]')
                if (maxLists && maxLists < voteContainers.length) {
                    for (var i = maxLists; i < voteContainers.length; i++) {
                        voteContainers[i].remove();
                    }
                }

            } else {
                // removed code that would reuse the html and only rewrite the data (vote, author, sequence) - but only if new responses where added?? Would that flicker less??

                self.addVoteContainersDynamically(response, options);

            }

            $(document).trigger("wizer:textlist-refresh", questionId);
        }).done();
    };

    TextList.prototype.parseMyAsssessorComments = function(result, options) {
        var response = {};
        response.votes = [];
        if (result.success) {
            //loop through my networks and find comments only for me
            $.each(result.results[0].theyconnected, function(idx, vote) {
                response.votes.push({
                    participantEmail: vote.connectedBy,
                    participantId: vote.participantId,
                    participantIsAdmin: vote.isadmin,
                    participantName: vote.connectedByName,
                    questionId: result.results.Id,
                    responseId: vote.id,
                    responseText: vote.text,
                    sequence: vote.sequence,
                    universalId: vote.uid
                });
            });
        } else {
            logger.log(true, "Error fetching my assessor votes", result.message);
            Q.reject("Error fetching my assessor votes" + result.message)
        }
        return response;
    }

    TextList.prototype.markLike = function (event) {
        var self = this;
        var responseId = $(event.currentTarget).data('voteauthorindex');
        var participantId = parseInt(Wizer.ParticipationId);
        if ($(event.currentTarget).hasClass('tlc-likeIcon--checked')) {
            this.wizerApi.saveResponseObjectComment(responseId, null, 'Dislike', participantId, self.wizletInfo.trackQuestion, self.wizletInfo.isMeeting, self.wizletInfo.likeMaxCount).then(function (response) {
                if (response.success) {
                    if (!response.exceedMaxCount) {
                        $(event.currentTarget).removeClass('tlc-likeIcon--checked');
                        self.enableDisableLike(true);
                    }
                }
            });

        } else {
            this.wizerApi.saveResponseObjectComment(responseId, null, 'Liked', participantId, self.wizletInfo.trackQuestion, self.wizletInfo.isMeeting, self.wizletInfo.likeMaxCount).then(function (response) {
                if (response.success) {
                    $(event.currentTarget).addClass('tlc-likeIcon--checked');
                    if (response.exceedMaxCount) {
                        self.enableDisableLike(false);
                    }
                }
            });
        }
    };

    TextList.prototype.enableDisableLike = function (enable) {
        if (enable) {
            $('.tlc-likeIcon').each(function (i, obj) {
                if (!$(this).hasClass('tlc-likeIcon--checked')) {
                    if ($(this).hasClass('tlc-likeIcon--disabled')) {
                        $(this).removeClass('tlc-likeIcon--disabled');
                    }
                }
            });
        } else {
            $('.tlc-likeIcon').each(function (i, obj) {
                if (!$(this).hasClass('tlc-likeIcon--checked')) {
                    if (!$(this).hasClass('tlc-likeIcon--disabled')) {
                        $(this).addClass('tlc-likeIcon--disabled');
                    }
                }
            });
        }
    };

    TextList.getRegistration = function() {
        return new TextList();
    };

    return TextList;

});