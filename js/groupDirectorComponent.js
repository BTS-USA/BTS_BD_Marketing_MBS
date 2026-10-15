
define(['jquery', 'Q', 'wizer-api', 'wizletBase', 'doT'], function ($, Q, WizerApi, WizletBase, doT) {

    var GroupDirectorComponent = function () {
        this.type = 'GroupDirectorComponent';
        this.level = 1;
    };
    var updateGroupDirectorStatusInterval;
    GroupDirectorComponent.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
        this.wizletInfo = wizletInfo;
        this.wizletContext = wizletContext;
        this.wizerApi = wizerApi;
        this.pageContext = unused;

        this.templateDefer = Q.defer();
        var self = this;
        var requirements = [];
        requirements.push(WizletBase.loadTemplate(wizletInfo, 'groupDirectorComponent.dot'));

        if (wizletInfo.css) {
            requirements.push(WizletBase.loadCss(wizletInfo));
        }
        require(requirements, function (doTTemplate, css) {
            self.templateDefer.resolve(doTTemplate);
        });

        return WizletBase.loadHandler({ wizlet: this, render: this.render });
    };

    GroupDirectorComponent.prototype.unloadHandler = function () {
        //unload wizletbase
        clearInterval(updateGroupDirectorStatusInterval);
        WizletBase.unloadHandler({ wizlet: this });
    };

    GroupDirectorComponent.prototype.render = function (options) {
        var self = this;
        return self.templateDefer.promise.then(function (template) {
            var rendering = new Q.defer();

            //validate
            return self.validate().then(function (result) {
                if (result) {
                    //initialize 
                    self.initialize(self.commentquestionId, self.wizletInfo.qandcVoteLimit, self.trackQuestionId, self.refreshIntervalInSeconds);

                    //find the type of options
                    $.each(options.wizletInfo.menuOptions, function (index, option) {
                        if (option.section) {
                            option.type = 'Action';
                            option.tooltip = option.section;
                        }
                        else if (option.command) {
                            option.type = 'Command';
                            if (option.options && option.options.actionXML)
                                option.tooltip = option.options.actionXML;
                            if (option.options && option.options.section)
                                option.tooltip = option.options.section;
                        }
                        else if (option.control) {
                            option.type = 'Control';
                        }
                        else if (option.clear) {
                            option.type = 'Clear';
                        }
                        else if (option.embed) {
                            option.type = 'Embed';
                            if (option.options && option.options.actionXML)
                                option.tooltip = option.options.actionXML;
                        }
                        else {
                            option.type = 'Undefined';
                        }
                    });

                    var fragment = template(options.wizletInfo);
                    options.context.html(fragment);
                    
                    // On refresh Check of Current Action
                    self.checkCurrentActionOnRefresh();
                    
                    //Bind Events
                    options.context.find('[data-groupdirectormainoption]').unbind("click").bind("click", function () {
                        self.executeAction(this);
                        //to save current Action in question
                        if(self.wizletInfo.storeCurrentAction){
                            self.saveCurrentAction(this);
                        }
                    });

                }
                rendering.resolve(true);
                return rendering.promise;
            });
        })
            .fail(this.wizerApi.showError);
    };
    GroupDirectorComponent.prototype.checkCurrentActionOnRefresh = function () {
        var self = this;
        if(self.wizletInfo.storeCurrentAction && self.wizletInfo.storeCurrentAction.allow){
            var currentAction, currentActionQuestion = self.wizletInfo.storeCurrentAction.question;
            self.wizerApi.getMyVotesByQuestionName([currentActionQuestion]).then(function(response){
                if(response.questionMap[currentActionQuestion].value && response.questionMap[currentActionQuestion].value !== undefined){
                    currentAction = response.questionMap[currentActionQuestion].value;
                    var ele = self.wizletContext.find('[title="' + currentAction +'"]');
                    self.handleClasses(ele[0], null);
                }
            });
        }
    };
    GroupDirectorComponent.prototype.saveCurrentAction = function (elem) {
        var self = this;
        var index = $(elem).data("index");
        var menuItem = self.wizletInfo.menuOptions[index];
        if(self.wizletInfo.storeCurrentAction.allow){
            var currentActionQuestionQuetionId;
            currentActionQuestionQuetionId = self.wizerApi.getQuestionIdByName(self.wizletInfo.storeCurrentAction.question);
            self.wizerApi.addVote(currentActionQuestionQuetionId, menuItem.section);
        }
    };
    GroupDirectorComponent.prototype.validate = function () {
        var self = this;
        var validating = new Q.defer();
        if (!(self.wizletInfo.refreshIntervalInSeconds)) {
            self.refreshIntervalInSeconds = 5;
        }
        else {
            self.refreshIntervalInSeconds = self.wizletInfo.refreshIntervalInSeconds;
        }
        // trackQuestion is mandatory
        if (self.wizletInfo.trackQuestion) {
            //qandcVoteLimit attribute is mandatory
            if (self.wizletInfo.qandcVoteLimit) {
                //"COMMENTS" question is mandatory
                var commentsQuestionID = self.wizerApi.getQuestionIdByName("COMMENTS");
                if (commentsQuestionID) {
                    self.commentquestionId = commentsQuestionID;

                    var trackQuestionId = self.wizerApi.getQuestionIdByName(self.wizletInfo.trackQuestion);
                    var isDelivery = self.wizletInfo.isDelivery;
                    if (trackQuestionId) {
                        self.trackQuestionId = trackQuestionId;
                        //vote on trackQuestion is mandatory
                        var myvote = self.wizerApi.getMyVotes([trackQuestionId]);
                        myvote.then(function (response) {
                            if (response && response.votes && response.votes[trackQuestionId]) {
                                self.myTrackValue = response.votes[trackQuestionId][0];
                                //logged in user should be foreman
                                self.wizerApi.getForemanId(trackQuestionId, isDelivery).then(function (foremanId) {
                                    if (foremanId == Wizer.ParticipationId) {
                                        validating.resolve(true);
                                    }
                                    else {
                                        self.wizerApi.showError("Logged in user is not a foreman of the track mentioned");
                                        validating.resolve(false);
                                    }
                                });
                            }
                            else {
                                self.wizerApi.showError("missing vote on trackQuestion by groupDirector");
                                validating.resolve(false);
                            }
                        });
                    }
                    else {
                        self.wizerApi.showError("Invalid trackQuestion");
                        validating.resolve(false);
                    }
                }
                else {
                    self.wizerApi.showError("missing 'COMMENTS' quuestion in the component config");
                    validating.resolve(false);
                }
            }
            else {
                self.wizerApi.showError("missing qandcVoteLimit in the component config");
                validating.resolve(false);
            }
        }
        else {
            self.wizerApi.showError("missing trackQuestion in the component config");
            validating.resolve(false);
        }

        return validating.promise;
    };

    GroupDirectorComponent.prototype.executeAction = function (elem) {
        var self = this;
        var type = $(elem).data("type");
        var index = $(elem).data("index");
        if (self.wizletInfo.trackQuestion) {
            var trackQuestionId = self.trackQuestionId;
            var menuItem = self.wizletInfo.menuOptions[index];
            if (type == "Action") {
                self.setGroupCurrentAction(elem, type, trackQuestionId, menuItem.section);
            }
            else if (type == "Command") {
                self.sendClientCommandToGroup(elem, type, trackQuestionId, menuItem.command, (menuItem.options ? menuItem.options : {}));
            }
            else if (type == "Control") {
                self.changeActionControl(elem, type, trackQuestionId, menuItem.control);
            }
            else if (type == "Clear") {
                var qIdtsring = "";// join all question Ids comma separated
                self.clear(elem, type, menuItem.type, trackQuestionId, qIdtsring);
            }
            else if (type == "Embed") {
                self.embed(elem, type, (menuItem.options ? menuItem.options : {}), index);
            }
            else {
                self.wizerApi.showError("Type of menu Item is " + type);
            }
        }
        else {
            self.wizerApi.showError("missing attribute trackQuestion of GroupDirector component config");
        }
    };

    GroupDirectorComponent.prototype.setGroupCurrentAction = function (elem, type, trackQuestionId, sectionName) {
        var self = this;
        var waitForActionId = self.wizerApi.lookingUpActionIdIfNotNumeric(sectionName);
        return waitForActionId.then(function (actionId) {
            return AjaxGetJson('Vote', 'SetGroupCurrentActionId', 'trackQuestionId=' + trackQuestionId + '&actionId=' + actionId, function (result) {
                if (result.actionId) {
                    self.handleClasses(elem, type);
                }
            });
        });

    };

    GroupDirectorComponent.prototype.sendClientCommandToGroup = function (elem, type, trackQuestionId, cmd, options) {
        var self = this;
        if (cmd == 'EmbedClose' || cmd == 'SwitchEvent' || options.actionXML) {
            options.actionName = options.actionXML;
            return AjaxGetJson('Vote', 'SendClientCommandToGroup', 'trackQuestionId=' + trackQuestionId + '&cmd=' + cmd + '&options=' + JSON.stringify(options), function (result) {
                if (result.success) {
                    self.handleClasses(elem, type);
                }
            });
        }
        if (cmd == "ResetVotes") {
            var confirm = self.wizletContext.find('[data-confresetevent]');
            confirm.addClass('cl-modal--in');
            confirm.find('[data-btn="ok"]').on('click', function () {
                self.resetVotesAndSendToSection(elem, type, trackQuestionId, options);
                confirm.removeClass('cl-modal--in');
            });
            confirm.find('[data-btn="cancel"]').off('click').on('click', function () {
                confirm.removeClass('cl-modal--in');
            });
        }
        if (cmd == "ResetEvent") {

            var confirm = self.wizletContext.find('[data-confresetevent]');
            confirm.addClass('cl-modal--in');
            confirm.find('[data-btn="ok"]').on('click', function () {
                self.resetEvent(elem, type, trackQuestionId, options);
                confirm.removeClass('cl-modal--in');
            });
            confirm.find('[data-btn="cancel"]').off('click').on('click', function () {
                confirm.removeClass('cl-modal--in');
            });
        }

        if (cmd == "ExportData" || options.ExportName) {

            AjaxGetJson('DataExport', 'GetExportDataByName', 'exportName=' + options.ExportName + '&eventId=' + Wizer.EventId + "&trackQuestionId=" + trackQuestionId, function (dataexport) {
                var exportdata = JSON.parse(dataexport);

                AjaxGetJson('DataExport', 'ExportDataByName', 'eventId=' + Wizer.EventId + '&exportName=' + options.ExportName + "&reportType=export&trackQuestionId=" + trackQuestionId, function (result) {
                    if (result.success) {
                        window.location = '/Wizer/DataExport/DownloadFile?fileName=' + result.fileName;
                        self.handleClasses(elem, type);
                    }
                    else {
                        self.wizerApi.showError(result.message);
                    }
                });
                if (exportdata.ideaHunt.action.value !== null) {
                    AjaxGetJson('DataExport', 'ExportDataByName', 'eventId=' + Wizer.EventId + '&exportName=' + options.ExportName + "&reportType=IdeaHuntEntry&trackQuestionId=" + trackQuestionId, function (result) {
                        if (result.success) {

                            window.location = '/Wizer/DataExport/DownloadFile?fileName=' + result.fileName + '&ideaHunt=true';
                            self.handleClasses(elem, type);
                        }
                        else {
                            self.wizerApi.showError(result.message);
                        }
                    });
                }

                if (exportdata.videoHunt.action.value !== null) {
                    AjaxGetJson('DataExport', 'ExportDataByName', 'eventId=' + Wizer.EventId + '&exportName=' + options.ExportName + "&reportType=Videohunt&trackQuestionId=" + trackQuestionId, function (result) {
                        if (result.success) {
                            window.location = '/Wizer/DataExport/DownloadFile?fileName=' + result.fileName + '&videoHunt=true';
                            self.handleClasses(elem, type);
                        }
                        else {
                            self.wizerApi.showError(result.message);
                        }
                    });
                }

                if (exportdata.videoHunt.exportVideos.value === true) {
                    AjaxGetJson('DataExport', 'ExportDataByName', 'eventId=' + Wizer.EventId + '&exportName=' + options.ExportName + "&reportType=Exportvideos", function (result) {
                        if (result.success) {
                            window.location = '/Wizer/DataExport/DownloadZip?fileName=' + result.fileName + '&videoHunt=true';
                            self.handleClasses(elem, type);
                        }
                        else {
                            self.wizerApi.showError(result.message);
                        }
                    });
                }

            }, null, null, 'Get');
        }
    };
    GroupDirectorComponent.prototype.resetVotesAndSendToSection = function (elem, type, trackQuestionId, options) {
        var self = this;
        var GD_trackQid;
        var participantIds = [];
        var index = $(elem).data("index");
        var menuItem = self.wizletInfo.menuOptions[index];
        GD_trackQid = self.wizerApi.getQuestionIdByName(self.wizletInfo.trackQuestion);
        self.wizerApi.getTrackParticipants(GD_trackQid).then(function (response){              
            for (var i = 0; i < Object.keys(response.participants).length; i++) {
                var pId = parseInt(Object.keys(response.participants)[i]);
                if(Wizer.ParticipationId!= pId){
                    participantIds.push(pId);
                }
            }
            return AjaxGetJson('EventAdmin', 'ResetEvent', 'eventId=' + Wizer.EventId + 
            '&resetLanguage=true&trackQuestionId=' + trackQuestionId, function (result) {
                if(result.Success){
                    self.handleClasses(elem, type);
                    if(menuItem.sendToSection){
                        self.setGroupCurrentAction(elem, type, GD_trackQid, menuItem.sendToSection);
                    }
                }
            });
        });
    };
    GroupDirectorComponent.prototype.resetEvent = function (elem, type, trackQuestionId, options) {
        var self = this;
        return AjaxGetJson('EventAdmin', 'ResetEvent', 'eventId=' + Wizer.EventId + 
        '&resetLanguage=true&trackQuestionId=' + trackQuestionId, function (result) {
            if (result.Success) {
                self.handleClasses(elem, type);

            }
        });
    }

    /* Scenario under construction*/
    GroupDirectorComponent.prototype.clearVotes = function (elem, type, trackQuestionId, questionIds) {
        self.wizerApi.showError('Clear Votes not implemented');
        var self = this;
        if (questionIds == '') {
            self.wizerApi.showError('no questions found for clearing votes');
        }
        else {
            AjaxGetJson('VoteApi', 'ClearVotes', { questionIds: questionIds, trackQuestionId: trackQuestionId }, function (result) {
                if (result.success) {
                    if (result.success) {
                        self.handleClasses(elem, type);
                    }
                }
            });
        }
    };

    /* Scenario under construction*/
    GroupDirectorComponent.prototype.clearRanks = function (elem, type, trackQuestionId, questionIds) {
        self.wizerApi.showError('Clear Ranks not implemented');
        var self = this;
        if (questionIds == '') {
            self.wizerApi.showError('no questions found for clearing ranks');
        }
        else {
            AjaxGetJson('VoteApi', 'ClearRanks', { questionIds: questionIds, trackQuestionId: trackQuestionId }, function (result) {
                if (result.success) {
                    self.handleClasses(elem, type);
                }
            });
        }
    };

    /* Scenario under construction*/
    GroupDirectorComponent.prototype.changeActionControl = function (elem, type, trackQuestionId, newActionControl) {
        self.wizerApi.showError('Change Action Control not implemented');
        var self = this;
        AjaxGetJson('VoteApi', 'SetCurrentActionControl', 'currentActionControl=' + newActionControl + '&trackQuestionId=' + trackQuestionId, function (result) {
            if (result.success) {
                self.handleClasses(elem, type);
            }
        });
    };

    GroupDirectorComponent.prototype.embed = function (elem, type, options, index) {
        var self = this;
        var embedding = require('wizletEmbedding');
        if (options.actionXML) {
            var actionScriptName = options.actionXML;
            embedding.unembedWizletExcept('MenuComponent');
            options.selector = '#embedding-' + index;
            options.noscroll = true;
            embedding.embedWizlet({
                context: $(document),
                actionScriptName: actionScriptName,
                options: options
            });
            self.handleClasses(elem, type);
        }
        else {
            self.wizerApi.showError('actionXML attribute missing from options');
        }
    };

    /* Scenario under construction*/
    GroupDirectorComponent.prototype.nextGroupCurrentAction = function (elem, type) {
        self.wizerApi.showError('Next Group Current Action not implemented');
        var currentItem = $(".currentAction");
        if (currentItem.length > 0) {
            nextItem = currentItem.next(".jumpMenuItem");
            if (nextItem.length > 0) {
                nextItem = nextItem[0]; // goto next
            } else {
                nextItem = currentItem[0]; // stay on last
            }
        } else {
            nextItem = $(".jumpMenuItem")[0]; // start on first
        }
        $(nextItem).click();
    };

    GroupDirectorComponent.prototype.updateGroupDirectorStatus = function (qandcQuestionId, qandcVoteLimit, trackQuestionId, refreshIntervalInSeconds) {
        var self = this;
        AjaxGetJson('Vote', 'GetGroupDirectorStatus', { trackQuestionId: trackQuestionId }, function (result) {
            self.wizletContext.find("[data-groupdirectorvotecount]").text(result.voteCount);
            AjaxGetJson('Vote', 'GetNewestVotes', { questionId: qandcQuestionId, trackQuestionId: trackQuestionId, maxVotes: qandcVoteLimit }, function (result) {
                self.wizletContext.find("[data-groupdirectorqnc]").html('');
                if (result.success) {
                    var qncFormat = self.wizletContext.find("[data-qncformat]");
                    var votes = result.votes;
                    for (var i = 0; i < votes.length; ++i) {
                        var vote = votes[i];
                        var participantName = vote.ParticipantName;
                        var responseText = vote.ResponseText;
                        var newRow = qncFormat.clone();
                        $(newRow).find('[data-participantname]').html(participantName);
                        $(newRow).find('[data-response]').html(responseText);
                        self.wizletContext.find("[data-groupdirectorqnc]").append(newRow);
                    }
                }
                // setTimeout(function () { self.updateGroupDirectorStatus(qandcQuestionId, qandcVoteLimit, trackQuestionId, refreshIntervalInSeconds); }, refreshIntervalInSeconds * 1000);
            });
        });
    };

    GroupDirectorComponent.prototype.initWhenReady = function (qandcQuestionId, qandcVoteLimit, trackQuestionId, refreshIntervalInSeconds) {
        var self = this;
        setTimeout(function () {
            $('#embeddedWizletContainer', window.parent.document).hide();  // we don't want to embed wizlets for the groupdirector himself, so hide it
        }, 100);

        if (refreshIntervalInSeconds) {
            refreshIntervalInSeconds = refreshIntervalInSeconds * 1000;
        } else {
            refreshIntervalInSeconds = 5000;
        }

        updateGroupDirectorStatusInterval = setInterval(function () {
            //wizletsReady(); // Note: to decorate any buttons
            self.updateGroupDirectorStatus(qandcQuestionId, qandcVoteLimit, trackQuestionId, refreshIntervalInSeconds);
        }, refreshIntervalInSeconds);
    };


    GroupDirectorComponent.prototype.initialize = function (qandcQuestionId, qandcVoteLimit, trackQuestionId, refreshIntervalInSeconds) {
        var self = this;
        if (self.wizletInfo.showClientStatus) {
            var clientStatus = self.wizletContext.find("[data-clientstatus]");
            if (clientStatus) {
                clientStatus.html('<iframe id="clientStatusFrame" src="/Wizer/Vote/ClientStatus?trackQuestionId=' + trackQuestionId + '&refreshIntervalInSeconds=' + refreshIntervalInSeconds + '" height="380" width="420" marginheight="0" marginwidth="0" frameborder="0" scrolling="auto"  background-color="transparent"></iframe>');
            }
        }
        self.initWhenReady(qandcQuestionId, qandcVoteLimit, trackQuestionId, refreshIntervalInSeconds);
    };

    GroupDirectorComponent.prototype.handleClasses = function (elem, type) {
        var self = this;
        
            $(elem).addClass("Visited");   
        
        self.wizletContext.find('[data-type="' + type + '"]').removeClass("currentAction" + type);
        $(elem).addClass("currentAction" + type);
    };

    GroupDirectorComponent.getRegistration = function () {
        return new GroupDirectorComponent();
    };

    return GroupDirectorComponent;

});
