define(['jquery', 'Q', 'wizer-api', 'wizletBase', 'doT', 'jsCalcLib/numberFormatting'],
    function ($, Q, WizerApi, WizletBase, doT, numberFormatting, wizerApiExt) {

        var HeatmapComponent = function () {
            this.type = 'HeatmapComponent';
            this.level = 1;
        };

        HeatmapComponent.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
            this.wizletInfo = wizletInfo;
            this.wizletContext = wizletContext;
            this.wizerApi = wizerApi;
            this.votesBeforeUpdate = [];

            this.templateDefer = Q.defer();
            var self = this;
            var requirements = [];
            requirements.push(WizletBase.loadTemplate(wizletInfo, 'heatmapComponent.dot'));

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

                if (self.wizletInfo.teamNumber) {
                    if (self.wizletInfo.teamNumber.question.indexOf("db:") > -1) {
                        self.wizletInfo.teamNumber.question = self.wizletInfo.teamNumber.question.split("db:").pop();
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

                if (self.wizletInfo.teamNumber && self.wizletInfo.teamNumber.question) {
                    questions.push(self.wizletInfo.teamNumber.question);
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
                            // console.log(participants);
                            
                            if (self.wizletInfo.heatmapType == "OPTION") {
                                self.processOptionData(participants, optionMap);
                            } else {
                                // MultiSorting
                                if(self.wizletInfo.sorting){
                                    self.multiSort(participants, self.wizletInfo.sorting);
                                }
                                self.processQuestionData(participants, optionMap);
                            }
                            var fragment = template(self.wizletInfo);
                            self.wizletContext.html(fragment);
                            self.rendering.resolve(true);
                        })
                    } else {
                        participantList = response.participants
                        if (self.wizletInfo.heatmapType == "OPTION") {
                            self.processOptionData(participantList, optionMap);
                        } else {
                            // MultiSorting
                            if(self.wizletInfo.sorting){
                                self.multiSort(participants, self.wizletInfo.sorting);
                             }
                            self.processQuestionData(participantList, optionMap);
                        }
                        var fragment = template(self.wizletInfo);
                        self.wizletContext.html(fragment);
                        self.rendering.resolve(true);
                    }

                })

            });
 
            return self.rendering.promise;
            //})
            //.fail(this.wizerApi.showError)
        };

        HeatmapComponent.prototype.sortRecursive = function (a, b, sorting) {
            var valA = 0;
            var valB = 0;
            var diff = 0;
            
            if(a.questionMap[sorting.question]){
              valA = Number(a.questionMap[sorting.question].value);
            }
            if(b.questionMap[sorting.question]){
              valB = Number(b.questionMap[sorting.question].value);
            }
        
            if (sorting.sortOrder === "ASC") {
              diff = valA - valB;
            }else{
              diff = valB - valA;
            }
        
            if(diff == 0 && sorting.sorting){
              return this.sortRecursive(a, b, sorting.sorting)
            }else{
              return diff;
            } 
            
        };
        
        
        
        HeatmapComponent.prototype.multiSort = function (participants, sorting) {
            
            participants.sort((a, b) => {
              return this.sortRecursive(a, b, sorting);
            });
        };
        

        HeatmapComponent.prototype.participantLabel = function (participant) {
            var self = this;
            var label = participant.name || "";
            var teamName = "";
            if (self.wizletInfo.teamName &&
                self.wizletInfo.teamName.question &&
                participant.questionMap[self.wizletInfo.teamName.question] &&
                participant.questionMap[self.wizletInfo.teamName.question].value) {
                teamName = participant.questionMap[self.wizletInfo.teamName.question].value;
            }
            if (teamName && (self.wizletInfo.appendParticipantName || self.wizletInfo.appendTeamNumber) && label) {
                return label + ": " + teamName;
            }
            if (teamName) {
                return teamName;
            }
            return label;
        };

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
                    rowHeader = self.participantLabel(participant);
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
                    columnHeaders.push(self.participantLabel(participant));
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
            var self = this;
            var columnHeaders = [];
            var rows = [];
            var qName, val, cls, rowHeader;
            var isAlpha;
            var allQuestions = self.wizletInfo.questions;
            
            columnHeaders.push(self.wizletInfo.columnLabel);
            if (self.wizletInfo.direction == "VERTICAL") {
                if(self.wizletInfo.teamNumber && self.wizletInfo.teamNumber.columnLabel){
                    columnHeaders.unshift(self.wizletInfo.teamNumber.columnLabel);
                }

                self.wizletInfo.questions.forEach(function (q) {
                    columnHeaders.push(q.title);
                });

                participants.forEach(function (participant, index) {
                    var teamNumber = 0;
                    rowHeader = self.participantLabel(participant);

                    if (self.wizletInfo.teamNumber &&
                        self.wizletInfo.teamNumber.question &&
                        participant.questionMap[self.wizletInfo.teamNumber.question] &&
                        participant.questionMap[self.wizletInfo.teamNumber.question].value) {
                        teamNumber = participant.questionMap[self.wizletInfo.teamNumber.question].value;
                    }

                    var rowObj = {
                        header: rowHeader,
                        data: [],
                        teamNumber: teamNumber
                    };
                    if (parseInt(Wizer.ParticipationId) == participant.id) {
                        rowObj = {
                            header: rowHeader,
                            data: [],
                            myScore: 'myScore',
                            teamNumber: teamNumber
                        };
                    }
                    rows.push(rowObj);

                    self.wizletInfo.questions.forEach(function (q) {
                        if (participant.questionMap[q.binding]) {
                            // for rounding off the Number and not the characters from the participants data
                            if (!isNaN(participant.questionMap[q.binding].value)) {
                                val = (Number(participant.questionMap[q.binding].value).toFixed(q.noOfDecimals ? q.noOfDecimals : 0));
                            } else {
                                val = participant.questionMap[q.binding].value;
                            }
                        } else {
                            val = "";
                        }

                        cls = optionMap["opt_" + val] ? optionMap["opt_" + val].class : "";
                        if (q.format) {

                            val = numberFormatting.format(val, q.format, null);
                        }
                        if(q.isAlphabet){
                            isAlpha = q.isAlphabet;
                        }else{  
                            isAlpha = false;
                        }
                        rowObj.data.push({
                            value: val,
                            cls: cls,
                            isAlphabet: isAlpha
                        });
                    });
                });

            } else {
                participants.forEach(function (participant, index) {
                    columnHeaders.push(self.participantLabel(participant));
                    //console.log(columnHeaders);
                });

                

                if(self.wizletInfo.teamNumber && self.wizletInfo.teamNumber.question && self.wizletInfo.teamNumber.columnLabel && self.wizletInfo.teamNumber.question != allQuestions[0].binding){
                    allQuestions.unshift({
                        title: self.wizletInfo.teamNumber.columnLabel,
                        binding: self.wizletInfo.teamNumber.question
                    })       
                }
                
                allQuestions.forEach(function (q) {
                    if(q.isAlphabet){
                        isAlpha = q.isAlphabet;
                        }else{  
                        isAlpha = false;
                    }
                    var rowObj = {
                        header: q.title,
                        data: []
                    };
                    rows.push(rowObj);
                    participants.forEach(function (participant, index) {
                        if (participant.questionMap[q.binding]) {
                            if (!isNaN(participant.questionMap[q.binding].value)) {
                                val = (Number(participant.questionMap[q.binding].value).toFixed(q.noOfDecimals ? q.noOfDecimals : 0));
                            }else {
                                val = participant.questionMap[q.binding].value;
                            }
                            //console.log(val);
                        } else {
                            val = "";
                        }
                        cls = optionMap["opt_" + val] ? optionMap["opt_" + val].class : "";
                        rowObj.data.push({
                            value: val,
                            cls: cls,
                            isAlphabet: isAlpha
                        });
                    });
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
            console.log("Filtered list: ", participants);
            defer.resolve(participants);
            return defer.promise;
        }

        HeatmapComponent.getRegistration = function () {
            return new HeatmapComponent();
        };

        return HeatmapComponent;

    });