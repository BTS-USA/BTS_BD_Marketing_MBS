define(['jquery', 'Q', 'wizer-api', 'logger', 'wizletBase', 'doT'], function ($, Q, WizerApi, log, WizletBase, doT) {


    var BarChartComponent = function () {
        this.type = 'BarChartComponent';
        this.level = 1;
    };

    BarChartComponent.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
        this.wizletInfo = wizletInfo;
        this.wizletContext = wizletContext;
        this.wizerApi = wizerApi;
        // deffault values
        wizletInfo.type = wizletInfo.type || "Barchart"; // default is barchart
        wizletInfo.display = wizletInfo.display || "percent";
        this.maxFilters = wizletInfo.maxFilters || 2; // supported in version 2
        this.displayType = wizletInfo.display;
        this.myVoteonTrack = null;
        this.template;
        this.hasFilters = false;
        this.currentFilter;
        this.filterQuestion = "";
        this.selectedFilters = [];

        this.templateDefer = Q.defer();
        var self = this;
        var requirements = [];
        requirements.push(WizletBase.loadTemplate(wizletInfo, 'barChartComponent.dot'));

        if (wizletInfo.css) {
            requirements.push(WizletBase.loadCss(wizletInfo));
        }

        // remove this when we support track Question with filters
        if (wizletInfo.trackQuestion && wizletInfo.filterQuestions) {
            Wizer.Api.showError("BarChartComponent can have only filterQuestions or trackQuestion and not both");
        }

        if (wizletInfo.type.toUpperCase() === "RANKING" && wizletInfo.filterQuestions) {
            Wizer.Api.showError("BarChartComponent does not support filterQuestions with type Ranking");
        }

        // we do not support maxFilters in version 1
        if (self.maxFilters && Number(self.wizletInfo.version) > 2) {
            self.maxFilters = 2;
            Wizer.Api.showError("BarChartComponent does not support maxFilters property > 2  in version 1");
        }

        require(requirements, function (doTTemplate, css) {
            self.templateDefer.resolve(doTTemplate);
        });

        return WizletBase.loadHandler({
            wizlet: this,
            render: this.render
        }).then(function () {


        });
    };

    BarChartComponent.prototype.unloadHandler = function () {
        //unload wizletbase
        WizletBase.unloadHandler({
            wizlet: this
        });
    };

    BarChartComponent.prototype.getNumberOfDecimals = function () {
        var decimals = this.wizletInfo.numberOfDecimals;
        if (decimals === undefined || decimals === null || decimals === "") {
            decimals = this.wizletInfo.decimalDigitsForDisplayPercent;
        }
        return (decimals !== undefined && decimals !== null && decimals !== "") ? Number(decimals) : 1;
    };

    BarChartComponent.prototype.render = function (options) {

        var self = this;
        // options.wizletInfo.type can be one of Barchart/Ranking/Sumchart
        return self.templateDefer.promise.then(function (template) {
            self.template = template;
            var trackDiffer = new Q.defer();

            if (self.wizletInfo.trackQuestion) {
                //fetch the trackQuestionId and my vote on that trackQuestion. This then becomes the new filterQuestionId and filterText
                var trackQuestionId = self.wizerApi.getQuestionIdByName(self.wizletInfo.trackQuestion);
                var gettingMyVoteOnTrack = self.wizerApi.getMyVotes([trackQuestionId]);
                gettingMyVoteOnTrack.then(function (votes) {
                    self.myVoteonTrack = votes.votes[trackQuestionId];
                    if (self.myVoteonTrack) {
                        trackDiffer.resolve(true);
                    }
                    else {
                        trackDiffer.resolve(true);
                        Wizer.Api.showError("No Votes of this user on trackQuestion: " + self.wizletInfo.trackQuestion);
                    }
                });

            }
            else {
                trackDiffer.resolve(true);
            }
            var filterValue = 0;
            var filterText = "";
            if (options.wizletInfo.type.toUpperCase() === "BARCHART" && typeof options.wizletInfo.filterQuestions !== 'undefined') {
                if (options.wizletInfo.filterQuestions[0]) {
                    self.filterQuestion = options.wizletInfo.filterQuestions[0].binding;
                    self.hasFilters = true;
                    self.currentFilter = options.wizletInfo.filterQuestions[0].options[0];
                    self.currentFilter.selected = true;
                    filterValue = self.currentFilter.value;
                    filterText = self.currentFilter.description;
                    self.selectedFilters.push(self.currentFilter);
                }
            }

            trackDiffer.promise.then(function () {
                //fetch all votes from api & calculate avg
                var questionName = options.wizletInfo.questions[0].binding;
                var calculating = self.getAverage(questionName, options.wizletInfo.type, self.hasFilters, self.filterQuestion, filterValue);
                return calculating.then(function (response) {
                    var voteArray = response.votes;
                    //Appending response options in wizletInfo
                    var responseOptions = self.wizletInfo.responseOptions = [];
                    if (self.wizletInfo.type.toUpperCase() === "RANKING") {
                        voteArray.forEach(function (options) {
                            responseOptions.push({
                                "description": options.text,
                                optionId: options.optionId,
                                barCharts: [],
                                charts: []
                            });
                        });
                    } else {
                        voteArray.forEach(function (options) {
                            responseOptions.push({
                                "description": options.responseText ? options.responseText.replace(/\\"/g, '"') : null,
                                optionId: options.optionId,
                                barCharts: [],
                                charts: []
                            });
                        });
                    }

                    self.generateData(voteArray, filterValue, filterText);

                    if (self.wizletInfo.type.toUpperCase() !== "RANKING") {
                        if (self.wizletInfo.votesAmount) self.wizletInfo.votesAmount.val = response.totalVote;
                        if (self.wizletInfo.average) self.wizletInfo.average.val = (response.avg).toFixed(self.getNumberOfDecimals());
                    }

                    self.addListeners();

                    if (self.wizletInfo.sortingEnabled) {
                        self.sortByVotes(responseOptions);
                    }

                    if (options.wizletInfo.animation) {
                        self.getAnnimationEffect(options);
                    }

                    var fragment = template(options.wizletInfo);
                    options.context.html(fragment);

                    if (self.hasFilters) {
                        options.context.find("[data-filter=" + filterValue + "]").find('input[type="checkbox"]').prop('checked', true);
                        self.addListeners(options);
                    }

                });



            });

        })
            .fail(this.wizerApi.showError);
    };

    BarChartComponent.prototype.addListeners = function () {
        var self = this;
        var componentVersion = Number(self.wizletInfo.version) || 1;
        var selectedFilter;
        var checked = false;
        if (componentVersion === 1) {
            self.wizletContext.find('[data-barChartComponentFilter]').find('[data-barChartComponentFilterCheck]').off('click').on('click', function () {
                selectedFilter = $(this).data('filter');
                checked = $(this).find('input[type="checkbox"]').is(':checked');
                self.selectFilter(selectedFilter, checked);
                //self.clickedOnFilter(options, self, this, initialFilter, selectedFilterArray, responseOptions, questionName, false);
            });
        }
        else {
            self.wizletContext.find('[data-barChartComponentFilter]').find('[data-bcccheckbox]').off('change').on('change', function () {
                selectedFilter = $($(this).parent()[0]).data('filter');
                checked = $(this).is(':checked');
                self.selectFilter(selectedFilter, checked);
                //self.clickedOnFilter(options, self, $(this).parent()[0], initialFilter, selectedFilterArray, responseOptions, questionName, false);
            });
        }
    };

    BarChartComponent.prototype.updateFilters = function () {
        var self = this;
        var allowSelection = self.selectedFilters.length < self.maxFilters;
        self.wizletInfo.filterQuestions[0].options.forEach(function (filter) {
            self.wizletContext.find("[data-filter=" + filter.value + "]").find('input[type="checkbox"]').prop('checked', filter.selected);
            if (!allowSelection && !filter.selected) {
                self.wizletContext.find("[data-filter=" + filter.value + "]").find('input[type="checkbox"]').attr("disabled", "disabled");
            }
        });
    }

    BarChartComponent.prototype.selectFilter = function (value, checked) {
        var self = this;
        var filterObj = null;
        var componentVersion = Number(self.wizletInfo.version) || 1;

        self.wizletInfo.filterQuestions[0].options.forEach(function (filter) {
            if (filter.value === value) {
                filterObj = filter;
            }
        });

        if (checked) {
            //get filter data
            if (self.selectedFilters.length >= self.maxFilters || filterObj.selected) {
                return;
            }
            self.currentFilter = filterObj;
            self.currentFilter.selected = true;
            self.selectedFilters.push(filterObj);
            var calculating = self.getAverage(self.wizletInfo.questions[0].binding, self.wizletInfo.type, self.hasFilters, self.filterQuestion, filterObj.value);
            return calculating.then(function (response) {
                var voteArray = response.votes;
                self.generateData(voteArray, filterObj.value, filterObj.description);

                //if (self.wizletInfo.type.toUpperCase() !== "RANKING") {
                    //if (self.wizletInfo.votesAmount) self.wizletInfo.votesAmount.val = response.totalVote;
                    //if (self.wizletInfo.average) self.wizletInfo.average.val = (response.avg).toFixed(1);
                //}

                var fragment = self.template(self.wizletInfo);
                self.wizletContext.html(fragment);

                if (componentVersion === 1 && value > 0) {
                    self.wizletContext.find('[data-barChartComponentAnswer]').each(function () {
                        var chartBar = $(this).find('[data-barChartComponentHorizontalBarChartInner]')[1];
                        $("<div class='barChartComponentFilterName'>" + filterObj.description + "</div>").insertAfter($(chartBar));
                    });
                };

                self.updateFilters();
                self.addListeners();

            });
        } else {
            if (self.selectedFilters.length <= 1 ||
                (componentVersion === 1 && filterObj.value === 0)) {
                self.wizletContext.find("[data-filter=" + filterObj.value + "]").find('input[type="checkbox"]').prop('checked', true);
                return;
            }
            // remove filter data
            filterObj.selected = false;
            var indx = -1;
            self.wizletInfo.responseOptions.forEach(function (responseOption) {
                indx = -1;
                responseOption.charts.forEach(function (chart, i) {
                    if (chart.filterValue == filterObj.value) {
                        indx = i;
                    }
                });
                if (indx >= 0) {
                    responseOption.charts.splice(indx, 1);
                    responseOption.barCharts.splice(indx, 1);
                }
            });

            indx = self.selectedFilters.indexOf(filterObj);
            if (indx > -1) {
                self.selectedFilters.splice(indx, 1);
            }

            self.wizletInfo.filterQuestions[0].options.forEach(function (filter) {
                if (filter.value === self.selectedFilters[0].value) {
                    filterObj = filter;
                }
            });

            var calculating = self.getAverage(self.wizletInfo.questions[0].binding, self.wizletInfo.type, self.hasFilters, self.filterQuestion, filterObj.value);
            return calculating.then(function (response) {

                var fragment = self.template(self.wizletInfo);
                self.wizletContext.html(fragment);

                self.updateFilters();
                self.addListeners();

            });
        }
    };


    BarChartComponent.prototype.generateData = function (voteArray, filterValue, filterText) {
        var self = this;
        var componentVersion = self.wizletInfo.version || 1;
        if ((componentVersion <= 1 && filterValue === 0) ||
            (filterValue === null || filterValue < 0)) {
            filterText = "&nbsp;";
        }

        var responseOptions = self.wizletInfo.responseOptions;
        var numberOfDecimals = self.getNumberOfDecimals();

        var percent, text;
        if (self.wizletInfo.type.toUpperCase() == "RANKING") {
            responseOptions.forEach(function (responseOption) {
                voteArray.forEach(function (vote) {
                    if (vote.optionId === responseOption.optionId) {
                        percent = (vote.RankingValue).toFixed(numberOfDecimals);
                        text = (vote.Ranking).toFixed(numberOfDecimals);
                        responseOption.barCharts.push(percent);
                        responseOption.ranking = text;

                        responseOption.charts.push({ percent: percent, text: text, filterText: filterText, filterValue: filterValue });
                    }
                });
            });
        } else {
            if (self.wizletInfo.display.toUpperCase() === 'VOTE') {
                responseOptions.forEach(function (responseOption) {
                    voteArray.forEach(function (vote) {
                        if (vote.optionId === responseOption.optionId) {
                            percent = (vote.voteCountPercentage).toFixed(numberOfDecimals);
                            text = (vote.totalVote).toFixed(numberOfDecimals);
                            responseOption.barCharts.push(text);

                            responseOption.charts.push({ percent: percent, text: text, filterText: filterText, filterValue: filterValue });
                        }
                    });
                });
            } else {
                // default is percent
                responseOptions.forEach(function (responseOption) {
                    voteArray.forEach(function (vote) {
                        if (vote.optionId === responseOption.optionId) {
                            percent = (vote.voteCountPercentage).toFixed(numberOfDecimals);
                            responseOption.barCharts.push(percent);
                            text = percent;

                            if (self.wizletInfo.bubbleValueSuffix) {
                                text = text + self.wizletInfo.bubbleValueSuffix;
                            }
                            responseOption.charts.push({ percent: percent, text: text, filterText: filterText, filterValue: filterValue });
                        }
                    });
                });
            }
        }
    };

    BarChartComponent.getRegistration = function () {
        return new BarChartComponent();
    };

    BarChartComponent.prototype.getAnnimationEffect = function (options) {
        // get version of HTML
        var componentVersion = options.wizletInfo.version;
        var numberOfDecimals = this.getNumberOfDecimals();
        $('[data-barChartComponentHorizontalBarChartInner]').each(function () {

            // set position of bubble
            if (componentVersion == 2) {
                // var bubble = $(this).find('[data-barChartComponentBublePercentage]'),
                //     bubbleWidth = Math.round($(bubble).outerWidth()/2);
                //     $(bubble).css({'margin-left': -bubbleWidth})
            }

            if (componentVersion < 2) {
                var self = $(this);
                self.children().hide();
                var f = $(this).width();
                var pw = $(this).parent().width();
                var rate = (f / pw * 100).toFixed(numberOfDecimals) + '%';
                $(this).width('0px');
                $(this).animate({
                    width: rate
                }, 1000, function () {
                    self.children().show("fast");
                });
            }
        });

    }


    BarChartComponent.prototype.sortByVotes = function (voteArray) {
        var self = this;
        voteArray.sort(function (a, b) {
            if (self.wizletInfo.display == "vote" || self.wizletInfo.display == "percent") {
                if (self.wizletInfo.sortingOrder == "ASC")
                    return a.barCharts - b.barCharts;
                else
                    return b.barCharts - a.barCharts;
            }

        });

    }

    BarChartComponent.prototype.getAverage = function (questionName, type, callFilterApi, filterQuestionName, filterText) {
        var self = this;
        var defer = Q.defer();
        var averageVotesDefer = new Q.defer();
        var filterQuestionId = '';
        var filterTextValue = '';
        var isDelivery = self.wizletInfo.isDelivery;
        var componentVersion = Number(self.wizletInfo.version) || 1;
        if ((componentVersion <= 1 && filterText === 0) ||
            (filterText === null || filterText < 0)) {
            callFilterApi = false;
        }
        if (callFilterApi) {
            filterQuestionId = self.wizerApi.getQuestionIdByName(filterQuestionName);
            filterTextValue = filterText;
        }
        if (self.wizletInfo.trackQuestion) {
            //fetch the trackQuestionId and my vote on that trackQuestion. This then becomes the new filterQuestionId and filterText
            var trackQuestionId = self.wizerApi.getQuestionIdByName(self.wizletInfo.trackQuestion);
            filterTextValue = self.myVoteonTrack[0];
            self.filterText = filterTextValue;
            filterQuestionId = trackQuestionId;
            averageVotesDefer.resolve(true);
        }
        else {
            averageVotesDefer.resolve(true);
        }

        return averageVotesDefer.promise.then(function () {
            var sN = questionName;
            var args = {
                shortNames: sN,
                filterQuestionId: filterQuestionId,
                filterText: filterTextValue,
                showAverage: true,
                showVoteCount: true,
                seed: Math.random().toString().replace(".", ""),
                isDelivery: isDelivery
            };

            var rankingQuestionId = self.wizerApi.getQuestionIdByName(questionName);
            var rankingArgs = {
                questionId: rankingQuestionId,
                responseFilterQuestionId: self.wizletInfo.trackQuestion ? filterQuestionId : -1,
                responseFilterValue: self.wizletInfo.trackQuestion ? self.filterText : '',
                rankFilterQuestionId: -1,
                rankFilterValue: '',
                isDelivery: isDelivery
            }
            var waiting;
            if (type == "Ranking") {
                var waiting = self.wizerApi.getRankingResults(rankingArgs);
                waiting.then(function (result) {
                    var vote = {};
                    var votes = [];
                    result.list.forEach(function (li) {
                        var avgRank = (li.value / result.list.length) * 100
                        votes.push({
                            "optionId": li.id,
                            "text": li.text,
                            "RankingValue": avgRank,
                            "Ranking": li.value
                        });
                    });
                    vote.votes = votes;
                    defer.resolve(vote);
                })
            } else {
                var waiting = self.wizerApi.getAverageVotes(args);
                waiting.then(function (result) {

                    var vote = {};
                    var votes = [];
                    result.questionResults[0].list.forEach(function (list) {
                        votes.push({
                            "optionId": list.id,
                            "voteCountPercentage": list.value,
                            "keypadNumber": list.keypadNumber,
                            "responseText": list.responseText,
                            "totalVote": list.totalVotes
                        })
                    });
                    vote.votes = votes;
                    vote.avg = result.questionResults[0].average;
                    vote.totalVote = result.questionResults[0].count;

                    if (self.wizletInfo.votesAmount) self.wizletInfo.votesAmount.val = vote.totalVote;
                    if (self.wizletInfo.average) self.wizletInfo.average.val = (vote.avg).toFixed(self.getNumberOfDecimals());

                    defer.resolve(vote);
                });
            }
            return defer.promise;
        });
    }
    return BarChartComponent;
});