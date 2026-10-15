define(['jquery', 'Q', 'wizer-api', 'wizletBase', 'doT', 'jsCalcLib/numberFormatting'],
    function ($, Q, WizerApi, WizletBase, doT, numberFormatting) {

        var HeatmapComponent = function () {
            this.type = 'HeatmapComponent';
            this.level = 1;
        };

        HeatmapComponent.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
            this.wizletInfo = wizletInfo;
            this.wizletContext = wizletContext;
            this.wizerApi = wizerApi;
            this.votesBeforeUpdate = [];
            //this.extApi = wizerApiExt.getRegistration(wizerApi);

            this.templateDefer = Q.defer();
            var self = this;
            var requirements = [];
            requirements.push(WizletBase.loadTemplate(wizletInfo, 'as_progressiveLeaderboard.dot'));

            if (wizletInfo.css) {
                requirements.push(WizletBase.loadCss(wizletInfo));
            }
            require(requirements, function (doTTemplate, css) {
                self.templateDefer.resolve(doTTemplate);
            });

            if (self.wizletInfo.liveUpdate) {
                $(document).on("wizer:action:latestVoteTimeChanged", { context: self }, self.reRenderOnLiveUpdate);
            }
            //VideoPlayer.onLoad(null, info, content, wizerApi);
            return WizletBase.loadHandler({
                wizlet: this,
                render: this.render
            });
        };

        HeatmapComponent.prototype.unloadHandler = function () {
            //unload wizletbase
            $(document).off("wizer:action:latestVoteTimeChanged", this.reRenderOnLiveUpdate);
            WizletBase.unloadHandler({
                wizlet: this
            });
        };


        HeatmapComponent.prototype.reRenderOnLiveUpdate = function (event) {
            var self = event.data.context;
            delete self.rendering;
            return self.render();
        };

        HeatmapComponent.prototype.render = function (options) {
            var self = this;
            self.rendering = new Q.defer();
            

            return self.templateDefer.promise.then(function (template) {

                if (self.wizletInfo.sorting) {
                    if (self.wizletInfo.sorting.question.indexOf("db:") > -1) {
                        self.wizletInfo.sorting.question = self.wizletInfo.sorting.question.split("db:").pop();
                    }
                }
                if (self.wizletInfo.teamName) {
                    if (self.wizletInfo.teamName.question.indexOf("db:") > -1) {
                        self.wizletInfo.teamName.question = self.wizletInfo.teamName.question.split("db:").pop();
                    }
                }

                var questions = [],
                    optionMap = {},
                    filterQuestionArray = [];

                self.wizletInfo.questions.forEach(function (q) {
                    questions.push(q.binding)
                });

                if (self.wizletInfo.teamName && self.wizletInfo.teamName.question) {
                    questions.push(self.wizletInfo.teamName.question);
                }

                if (self.wizletInfo.multiSort) {
                    var mulSortQuestions = Object.keys(self.wizletInfo.multiSort);
                    mulSortQuestions.forEach(function(mulsortkey){
                        if(questions.indexOf(mulsortkey) == -1){
                            questions.push(mulsortkey);
                        }
                    });
                }

                if (self.wizletInfo.filterQuestions) {
                    self.wizletInfo.filterQuestions.forEach(function (filterObj) {
                        questions.push(filterObj.filterQuestion)
                    })
                }

                self.wizletInfo.options.forEach(function (opt) {
                    var val = "opt_" + opt.val;
                    optionMap[val] = opt;
                    //console.log(optionMap);
                });

                self.isDelivery = self.wizletInfo.isDelivery || false;
                self.maxList = self.wizletInfo.maxList || 100;
                // get question votes
                self.wizerApi.getVotesByQuestionName(questions, self.wizletInfo.trackQuestion, self.wizletInfo.sorting, self.maxList, self.isDelivery).then(function (response) {
                    //console.log(response);

                    let participantList;
                    if (self.wizletInfo.filterQuestions) {
                        participantList = self.filterParticipants(response.participants, questions);
                        participantList.then(function (participants) {
                            if (self.wizletInfo.heatmapType == "OPTION") {
                                self.processOptionData(participants, optionMap);
                            } else {
                                if (self.wizletInfo.multiSort) {
                                    participants.keySort(self.wizletInfo.multiSort);
                                }
                                self.processQuestionData(participants, optionMap);
                            }
                            var fragment = template(self.wizletInfo);
                            self.wizletContext.html(fragment);
                            self.rendering.resolve(true);
                            self.processProgressiveLeaderBoardDetails(options);
                        })
                    } else {
                        participantList = response.participants
                        if (self.wizletInfo.heatmapType == "OPTION") {
                            self.processOptionData(participantList, optionMap);
                        } else {
                            if (self.wizletInfo.multiSort) {
                                participantList.keySort(self.wizletInfo.multiSort);
                            }
                            self.processQuestionData(participantList, optionMap);
                        }
                        var fragment = template(self.wizletInfo);
                        self.wizletContext.html(fragment);
                        self.rendering.resolve(true);
                        self.processProgressiveLeaderBoardDetails(options);
                    }
                });
            });

            
            return self.rendering.promise;
        };

        HeatmapComponent.prototype.processProgressiveLeaderBoardDetails = function(){
            var self = this;
            var userList = +self.wizletInfo.userList;
            var count = userList - 1;
            var max = userList - 1;
            var min = 0;
            var topText = self.wizletInfo.button.topText || self.wizletInfo.button.text || '';

            if (self.wizletInfo.button.topResultText) {
                self.wizletContext.find('.hmcp-button--text').html(topText + ' ' + (count + 1));
            }

            self.wizletContext.find('.hmcp-submit-button').off('click').on('click', function() {
            self.wizletContext.find('.hmcp-table_row' + count).removeClass('hide');

            if (self.wizletInfo.button.topResultText) {
                self.wizletContext.find('.hmcp-button--text').html(topText + ' ' + (count));
            }

            if (count <= 0) {
                self.wizletContext.find('.hmcp-submit-button').addClass('cl-button--hidden');
                self.wizletContext.find('.hmcp-reverse-button').removeClass('cl-button--hidden');
            } else {
                self.wizletContext.find('.hmcp-reverse-button').removeClass('cl-button--hidden');
                self.wizletContext.find('.hmcp-submit-button').removeClass('cl-button--hidden');
            }
            // console.log("AddBotton" + count);
             if(count >= 0) {
                count--;
            }
            // count != 0 ? count-- : 0;
            });

            self.wizletContext.find('.hmcp-reverse-button').off('click').on('click', function() {
            if(count < max) {
                count++;
            }
            self.wizletContext.find('.hmcp-table_row' + count).addClass('hide');

            if (self.wizletInfo.button.topResultText) {
                self.wizletContext.find('.hmcp-button--text').html(topText + ' ' + (count + 1));
            }

                        
            if (count >= max) {
                self.wizletContext.find('.hmcp-reverse-button').addClass('cl-button--hidden');
            self.wizletContext.find('.hmcp-submit-button').removeClass('cl-button--hidden');
            } else {
            self.wizletContext.find('.hmcp-submit-button').removeClass('cl-button--hidden');
            self.wizletContext.find('.hmcp-reverse-button').removeClass('cl-button--hidden');
            }
                        
            // console.log("RemoveBotton" + count);
            // count != max ? count++ : (max + 1);
            });
        }

        Array.prototype.keySort = function (keys) {

            keys = keys || {};

            var obLen = function (obj) {
                var size = 0,
                    key;
                for (key in obj) {
                    if (obj.hasOwnProperty(key))
                        size++;
                }
                return size;
            };

            // avoiding using Object.keys because i guess did it have IE8 issues?
            // else var obIx = fucntion(obj, ix){ return Object.keys(obj)[ix]; } or
            // whatever
            var obIx = function (obj, ix) {
                var size = 0,
                    key;
                for (key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        if (size == ix)
                            return key;
                        size++;
                    }
                }
                return false;
            };


            var keySort = function (a, b, d) {
                d = d !== null ? d : 1;
                // a = a.toLowerCase(); // this breaks numbers
                // b = b.toLowerCase();
                if (a == b)
                    return 0;
                return a > b ? 1 * d : -1 * d;
            };

            var KL = obLen(keys);

            if (!KL) return this.sort(keySort);

            for (var k in keys) {
                // normalize to -1 (desc), 0 (skip), or 1 (asc)
                keys[k] =
                    keys[k] == 'desc' || keys[k] == -1 ? -1 :
                    (keys[k] == 'skip' || keys[k] === 0 ? 0 :
                    (keys[k] == 'asc' || keys[k] == 1 ? 1 :
                        1)); // default to asc
            }

            this.sort(function (a, b) {
                var sorted = 0,
                    ix = 0;

                while (sorted === 0 && ix < KL) {
                    var k = obIx(keys, ix);
                    if (k) {
                        var dir = keys[k];
                        // Handle missing values - default to 0 if questionMap[k] doesn't exist or value is missing
                        var aValue = (a.questionMap[k] && a.questionMap[k].value !== undefined && a.questionMap[k].value !== null && a.questionMap[k].value !== "") 
                            ? a.questionMap[k].value : 0;
                        var bValue = (b.questionMap[k] && b.questionMap[k].value !== undefined && b.questionMap[k].value !== null && b.questionMap[k].value !== "") 
                            ? b.questionMap[k].value : 0;
                        // Convert to number for proper numeric sorting
                        aValue = isNaN(aValue) ? 0 : parseFloat(aValue);
                        bValue = isNaN(bValue) ? 0 : parseFloat(bValue);
                        sorted = keySort(aValue, bValue, dir);
                        ix++;
                    }
                }
                return sorted;
            });
            return this;
        };

        HeatmapComponent.prototype.getParticipantHeader = function (participant, appendByDefault) {
            var teamNameValue = "";
            var teamNameQuestion = this.wizletInfo.teamName && this.wizletInfo.teamName.question;

            if (teamNameQuestion &&
                participant.questionMap[teamNameQuestion] &&
                participant.questionMap[teamNameQuestion].value) {
                teamNameValue = participant.questionMap[teamNameQuestion].value;
            }

            if (!teamNameValue) {
                return participant.name;
            }

            var shouldAppendParticipantName = this.wizletInfo.appendTeamNumber;
            if (typeof shouldAppendParticipantName === "undefined") {
                shouldAppendParticipantName = appendByDefault;
            }

            if (!this.wizletInfo.donotAppendParticipantName &&
                shouldAppendParticipantName) {
                return participant.name + ": " + teamNameValue;
            }

            return teamNameValue;
        };
        
        /*
            process data for option display
        */
        HeatmapComponent.prototype.processOptionData = function (participants, optionMap) {
            var self = this;
            var columnHeaders = [self.wizletInfo.columnLabel];
            var rows = [];
            var qName, val, cls, rowHeader;
            if (self.wizletInfo.direction == "VERTICAL") {
                self.wizletInfo.options.forEach(function (option) {
                    columnHeaders.push(option.title);
                });

                participants.forEach(function (participant, index) {
                    rowHeader = self.getParticipantHeader(participant, true);
                    var rowObj = {
                        header: rowHeader,
                        data: []
                    };
                    rows.push(rowObj);

                    var question = self.wizletInfo.questions[0].binding;

                    self.wizletInfo.options.forEach(function (option) {
                        cls = "";
                        if (participant.questionMap[question] &&
                            participant.questionMap[question].value == option.val) {
                            val = participant.questionMap[question].value;
                            cls = option.class || "";
                        } else {
                            val = "";
                        }

                        rowObj.data.push({
                            value: val,
                            cls: cls
                        });
                    });
                });

            } else {
                participants.forEach(function (participant, index) {
                    columnHeaders.push(self.getParticipantHeader(participant, false));
                    //console.log(columnHeaders);
                });
                var question = self.wizletInfo.questions[0].binding;

                self.wizletInfo.options.forEach(function (option) {
                    var rowObj = {
                        header: option.title,
                        data: []
                    };
                    rows.push(rowObj);
                    participants.forEach(function (participant, index) {
                        cls = "";
                        if (participant.questionMap[question] &&
                            participant.questionMap[question].value == option.val) {
                            //val = participant.questionMap[question].value;
                            val = participant.questionMap[question].value;
                            cls = option.class || "";
                        } else {
                            val = "";
                        }
                        //cls = optionMap["opt_" + val] ? optionMap["opt_" + val].class : "";
                        rowObj.data.push({
                            value: val,
                            cls: cls
                        });
                        //console.log(rowObj);
                    });
                });
            }

            self.wizletInfo.heatmapData = {
                columnHeaders: columnHeaders,
                rows: rows
            };
        }

        /*
            process data for option display
        */
        HeatmapComponent.prototype.processQuestionData = function (participants, optionMap) {
            //console.log(participants, optionMap);
            var self = this;
            var columnHeaders = [];
            var rows = [];
            var qName, val, cls, rowHeader, prefix, suffix;
            var rank = 1;
            
            if (self.wizletInfo.direction == "VERTICAL") {

                if (self.wizletInfo.isShowRank == true) {
                    columnHeaders.push("Rank");
                }

                columnHeaders.push(self.wizletInfo.columnLabel);

                self.wizletInfo.questions.forEach(function (q) {
                    columnHeaders.push(q.title);
                });

                participants.forEach(function (participant, index) {
                    rowHeader = self.getParticipantHeader(participant, true);
                    var rowObj = {
                        header: rowHeader,
                        data: [],
                    };
                    if (parseInt(Wizer.ParticipationId) == participant.id) {
                        rowObj = {
                            header: rowHeader,
                            data: [],
                            myScore: 'myScore',
                        };
                    }

                    if (self.wizletInfo.isShowRank == true) {
                        rowObj.rank = rank;
                    }
                    rows.push(rowObj);

                    self.wizletInfo.questions.forEach(function (q) {
                        val = "";
                        cls = "";
                        if (participant.questionMap[q.binding] &&
                            participant.questionMap[q.binding].value !== undefined &&
                            participant.questionMap[q.binding].value !== null &&
                            participant.questionMap[q.binding].value !== "") {
                            var rawVal = participant.questionMap[q.binding].value;
                            if (!isNaN(rawVal)) {
                                var num = Number(rawVal);
                                var clsKey = String(num);
                                val = q.format
                                    ? numberFormatting.format(num, q.format, null)
                                    : clsKey;
                                cls = optionMap["opt_" + clsKey] ? optionMap["opt_" + clsKey].class : "";
                            } else {
                                val = rawVal;
                                cls = optionMap["opt_" + rawVal] ? optionMap["opt_" + rawVal].class : "";
                            }
                        } else {
                            var zeroKey = "0";
                            val = q.format
                                ? numberFormatting.format(0, q.format, null)
                                : zeroKey;
                            cls = optionMap["opt_" + zeroKey] ? optionMap["opt_" + zeroKey].class : "";
                        }
                        if(q.prefix){
                            prefix = q.prefix;
                        }else{
                            prefix = "";
                        }

                        if(q.suffix){
                            suffix = q.suffix;
                        }else{
                            suffix = "";
                        }
                        rowObj.data.push({
                            value: val,
                            cls: cls,
                            prefix: prefix,
                            suffix: suffix
                        });
                    });
                    rank++;
                });

            } else {
                if (self.wizletInfo.isShowRank == true) {
                    columnHeaders.push("Rank");
                }
                
                columnHeaders.push(self.wizletInfo.columnLabel);

                participants.forEach(function (participant, index) {
                    columnHeaders.push(self.getParticipantHeader(participant, false));
                    //console.log(columnHeaders);
                });

                self.wizletInfo.questions.forEach(function (q) {
                    var rowObj = {
                        header: q.title,
                        data: []
                    };
                    
                    if (self.wizletInfo.isShowRank == true) {
                        rowObj.rank = rank;
                    }

                    rows.push(rowObj);
                    participants.forEach(function (participant, index) {
                        val = "";
                        cls = "";
                        if (participant.questionMap[q.binding] &&
                            participant.questionMap[q.binding].value !== undefined &&
                            participant.questionMap[q.binding].value !== null &&
                            participant.questionMap[q.binding].value !== "") {
                            var rawVal = participant.questionMap[q.binding].value;
                            if (!isNaN(rawVal)) {
                                var num = Number(rawVal);
                                var clsKey = String(num);
                                val = q.format
                                    ? numberFormatting.format(num, q.format, null)
                                    : clsKey;
                                cls = optionMap["opt_" + clsKey] ? optionMap["opt_" + clsKey].class : "";
                            } else {
                                val = rawVal;
                                cls = optionMap["opt_" + rawVal] ? optionMap["opt_" + rawVal].class : "";
                            }
                        } else {
                            var zeroKey = "0";
                            val = q.format
                                ? numberFormatting.format(0, q.format, null)
                                : zeroKey;
                            cls = optionMap["opt_" + zeroKey] ? optionMap["opt_" + zeroKey].class : "";
                        }
                        rowObj.data.push({
                            value: val,
                            cls: cls
                        });
                    });
                    rank++;
                });
            }

            self.wizletInfo.heatmapData = {
                columnHeaders: columnHeaders,
                rows: rows
            };
        }

         HeatmapComponent.prototype.filterParticipants = function (participants, qns) {
            let self = this;
            var defer = Q.defer();

            participants = participants.filter(function (item) {
                var found = true;
                var filtered = true;
                if (self.wizletInfo.filterQuestions && self.wizletInfo.filterQuestions.length) {
                    self.wizletInfo.filterQuestions.forEach(function (filter) {
                        if (item.questionMap[filter.filterQuestion] ){
                            if(item.questionMap[filter.filterQuestion].value != filter.filterText){
                                found = false;
                                filtered = false;
                            }
                        }else{
                            found = false;
                        }
                    });
                }
                if(found){
                    found = false;
                    self.wizletInfo.questions.forEach(function (q) {
                        if (item.questionMap[q.binding] && item.questionMap[q.binding].value){
                            found = true;
                        }
                    });
                }
                if(filtered && self.wizletInfo.showAllTeams){
                    found = true;
                }
                return found;
                
            });
            // console.log("Filtered list: ", participants);
            defer.resolve(participants);
            return defer.promise;
        }

        HeatmapComponent.getRegistration = function () {
            return new HeatmapComponent();
        };

        return HeatmapComponent;

    });

