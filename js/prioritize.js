/*define(['jquery', 'Q', 'wizer-api', 'wizletBase', 'doT', 'jquery.ui.touch-punch', 'jquery.tinysort', 'jquery-ui', 'logger'],
    function ($, Q, WizerApi, WizletBase, doT, ui, tinysort, ui2, log) {*/

define(['jquery', 'Q', 'WizerModel', 'wizer-api', 'wizletBase', 'doT'],
    function ($, Q, WizerModel, WizerApi, WizletBase, doT) {
        var Wizer = window.Wizer = window.Wizer || {};
        Wizer.Wizlet = Wizer.Wizlet || {};

        var Prioritize = function () {
            this.type = 'Prioritize';
            this.level = 1;
        };

        Prioritize.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
            this.wizletInfo = wizletInfo;
            this.wizletContext = wizletContext;
            this.wizerApi = wizerApi;
            this.wizerModel = WizerModel.getInstance() || new WizerModel({
                wizerApi: this.wizerApi
            });
            this.templateDefer = Q.defer();
            var self = this;
            self.componentVersion = self.wizletInfo.version || 1;
            var requirements = [];
            requirements.push(WizletBase.loadTemplate(wizletInfo, 'prioritize.dot'));

            if (wizletInfo.css) {
                requirements.push(WizletBase.loadCss(wizletInfo));
            }
            require(requirements, function (doTTemplate, css) {
                self.templateDefer.resolve(doTTemplate);
            });
            self.questions = $.extend(true, [], self.wizletInfo.questions);
            return WizletBase.loadHandler({
                wizlet: this,
                render: this.render
            });
        };

        //Wizer.Wizlet.Prioritize = function () { };
        Prioritize.prototype.init = function () {
            this.containerDom = $("[data-prioritizeComponentTableDiv]");
            this.makeSortable();
            this.addEventListeners();
            WizletBase.bindPulseActionSubmission(this.wizletContext, this.type);
        };

        Prioritize.prototype.addEventListeners = function () {
            var self = this;
            self.wizletContext.find("[data-submitButton]").bind("click", function (e) {
                // Note: when forced only send if changedByUser   
                self.submit(self.options);
            });
            self.wizletContext.find("[data-clearButton]").on("click", function () {
                var votes = [];
                self.wizletInfo.questions.forEach(function (q) {
                    votes.push({
                        questionId: self.wizerApi.getQuestionIdByName(q.binding)
                    });
                })
                if (self.wizletInfo.heatmap_enabled) {
                    votes.push({
                        questionId: self.wizerApi.getQuestionIdByName(self.wizletInfo.heatmap_enabled)
                    });
                }
                self.wizerApi.removeVotes({
                    votes: votes
                }).then(function (response) {
                    // console.log(response);
                })
                if (self.options.wizletInfo.type === "QUESTIONS") {
                    self.render(self.options, true);
                } else if (self.options.wizletInfo.type === "VOTES") {
                    //self.reset(self.options);
                    self.render(self.options, true);
                    self.options.context.find('[data-prioritizeButtons]').find('[data-submitButton]').removeClass('pc-savedmessage clicked-saved');
                }
                self.options.context.find('[data-prioritizeButtons]').find('[data-submitButton]').removeClass('clicked-saved');
                if (self.wizletInfo.buttons) {
                    if (self.wizletInfo.buttons[0].text) {
                        self.options.context.find('[data-prioritizeButtons]').find('[data-submitButton]').find('[data-prioritizeSubmitButtonText]').html(self.wizletInfo.buttons[0].text);
                    } else {
                        self.options.context.find('[data-prioritizeButtons]').find('[data-submitButton]').find('[data-prioritizeSubmitButtonText]').html('Submit');
                    }
                } else {
                    self.options.context.find('[data-prioritizeButtons]').find('[data-submitButton]').find('[data-prioritizeSubmitButtonText]').html('Submit');
                }

            });
        };

        Prioritize.prototype.checkForReadOnlyCondition = function () {
            var self = this;
            var readonly = false;
            if (self.wizletInfo.readOnlyCondition) {
                readonly = self.options.wizletInfo.type === "QUESTIONS" ? self.wizerModel.checkForReadOnlyCondition(self.wizletInfo, self.wizletInfo.questions) : self.wizerModel.checkForReadOnlyCondition(self.wizletInfo, self.wizletInfo.question);
                if (readonly) {
                    self.wizletContext.find('[data-prioritizebuttons]').hide();
                    self.wizletContext.find('[data-prioritizecomponenttablediv]').addClass('readonly');
                }
            }
            return readonly;
        }

        Prioritize.prototype.makeSortable = function () {
            var self = this;

            if (Wizer.editMode) {
                // sortable do not work under edit mode - changing the order of the option list
                return;
            }

            var elements = this.containerDom.find("[data-prioritizeOrderListRight]");
            elements.sortable({
                start: function (event, ui) {
                    ui.placeholder.height(ui.helper.height());
                    return true;
                },
                change: function (evt, ui) {
                    self.adjustHeight();
                    var submitText = (self.wizletInfo.buttons && self.wizletInfo.buttons[0] && self.wizletInfo.buttons[0].text) ? self.wizletInfo.buttons[0].text : "Submit";
                    self.options.context.find('[data-prioritizeButtons]').find('[data-submitButton]').removeClass('clicked-saved')
                        .find('[data-prioritizeSubmitButtonText]').removeClass('pc-savedmessage')
                        .html(submitText);
                }
            });

            this.containerDom.find("div").disableSelection();
        };

        Prioritize.prototype.adjustHeight = function () {
            var z = 0;
            $(".pc-rowitem").each(function (i, e) {
                if (!$(e).hasClass("ui-sortable-helper")) {
                    $(".pc-orderlistleftpanel").each(function (i2, e2) {
                        if (i2 == z) {
                            e2.style.height = e.clientHeight + "px";
                        }
                    });

                    z++;
                }
            });
        };

        Prioritize.prototype.unloadHandler = function () {
            //unload wizletbase
            WizletBase.unloadHandler({
                wizlet: this
            });
        };

        Prioritize.prototype.render = function (options, resetVotes) {
            var self = this;
            if (resetVotes === undefined)
                resetVotes = false;
            return self.templateDefer.promise.then(function (template) {
                    var fragment = template(options.wizletInfo);
                    options.context.html(fragment);
                    self.options = options;
                    if (self.wizletInfo.type === "VOTES") {
                        var qId = self.wizerApi.getQuestionIdByName(options.wizletInfo.question);
                        var gettingVotes = self.wizerApi.getVotes({
                            questionId: qId,
                            resetVotes: resetVotes
                        });
                        gettingVotes.then(function (result) {
                            if (self.componentVersion < 2) {
                                self.result = result;
                                var leftPanelDivsContainer = options.context.find('[data-prioritizeComponentTable]').find('[data-prioritizeOrderListLeft]');
                                var rightPanelDivsContainer = options.context.find('[data-prioritizeComponentTable]').find('[data-prioritizeOrderListRight]');
                                for (var i = 1; i <= result.votes.length; i++) {
                                    $(leftPanelDivsContainer).append('<div class="prioritizeOrderListleft' + i + ' prioritizeOrderListLeftPanel" data-orderlistleftpanel><span class="prioritizeOrderIndex">' + i + '</span></div>');
                                    $(rightPanelDivsContainer).append('<div class="prioritizeVotes' + i +
                                        ' prioritizeRowItem" id="prioritizeOrderList" data-rowitem><div class="prioritizeRowItem' + i +
                                        'RightPanel prioritizeRightPanel"><div class="prioritizeRowItem' + i +
                                        'DraggableContainer draggableContainer"><div class="prioritizeRowItem' + i +
                                        'DraggableSign draggableSign1"></div><div class="prioritizeRowItem' + i +
                                        'DraggableSign draggableSign2"></div><div class="prioritizeRowItem' + i +
                                        'DraggableSign draggableSign3"></div></div><div class="prioritizeRowItem' + i +
                                        'Text prioritizeComponentVotes" data-votes rel=' + result.votes[i - 1].universalId + '><p>' +
                                        result.votes[i - 1].responseText + '</p></div></div></div>');
                                }
                            } else {
                                options.wizletInfo.results = result.votes;
                                self.result = result;
                                var fragment = template(options.wizletInfo);
                                options.context.html(fragment);
                            }
                            self.setHeightAndCheckReadonly();
                        });

                    } else if (self.wizletInfo.type === "QUESTIONS") {
                        if (self.componentVersion < 2) {
                            var leftPanelDivsContainer = options.context.find('[data-prioritizeComponentTable]').find('[data-prioritizeOrderListLeft]');
                            var rightPanelDivsContainer = options.context.find('[data-prioritizeComponentTable]').find('[data-prioritizeOrderListRight]');
                            for (var i = 1; i <= options.wizletInfo.questions.length; i++) {
                                $(leftPanelDivsContainer).append('<div class="prioritizeOrderListleft' + i + ' prioritizeOrderListLeftPanel" data-orderlistleftpanel><span class="prioritizeOrderIndex">' + i + '</span></div>');
                                $(rightPanelDivsContainer).append('<div class="prioritizeVotes' + i +
                                    ' prioritizeRowItem" id="prioritizeOrderList" data-rowitem><div class="prioritizeRowItem' + i +
                                    'RightPanel prioritizeRightPanel"><div class="prioritizeRowItem' + i +
                                    'DraggableContainer draggableContainer"><div class="prioritizeRowItem' + i +
                                    'DraggableSign draggableSign1"></div><div class="prioritizeRowItem' + i +
                                    'DraggableSign draggableSign2"></div><div class="prioritizeRowItem' + i +
                                    'DraggableSign draggableSign3"></div></div><div class="prioritizeRowItem' + i +
                                    'Text prioritizeComponentVotes" data-votes rel="' + options.wizletInfo.questions[i - 1].binding + '"><p>' +
                                    options.wizletInfo.questions[i - 1].title + '</p></div></div>');

                            }
                            self.setHeightAndCheckReadonly();
                        } else {
                            if (!resetVotes) {
                                var questionIds = [];
                                var questionMap = {};
                                $.each(self.wizletInfo.questions, function (id, question) {
                                    var q = question.binding;
                                    var qid = self.wizerApi.getQuestionIdByName(q);
                                    question.qId = qid;
                                    questionMap["Q_" + qid] = question;
                                    questionIds.push(qid);
                                });
                                var trackQuestionId = self.wizerApi.getQuestionIdByName(self.wizletInfo.trackQuestion);
                                self.trackQuestionId = trackQuestionId;
                                votes = self.wizerApi.getForemanVotes(trackQuestionId, questionIds);
                                votes.then(function (response) {
                                    $.each(response.votes, function (id, vote) {
                                        var q = questionMap["Q_" + id];
                                        q.resposeText = vote[0];
                                    });

                                    self.wizletInfo.questions.sort(function (a, b) {
                                        if (b.resposeText == undefined || a.resposeText == undefined)
                                            return 0;
                                        else
                                            return b.resposeText - a.resposeText
                                    });
                                    options.wizletInfo.results = self.wizletInfo.questions;
                                    self.loadTemplate(options, template);
                                });
                            } else {
                                options.wizletInfo.results = self.questions;
                                self.loadTemplate(options, template);
                            }
                        }

                    }

                    $(window).on('resize', function (event) {
                        var win = $(this); //this = window
                        self.setHeight();
                    });
                    return true;
                })
                .fail(this.wizerApi.showError)
        };

        Prioritize.prototype.setHeightAndCheckReadonly = function () {
            var self = this;
            self.setHeight();
            if (!self.checkForReadOnlyCondition())
                self.init();
        };
        Prioritize.prototype.loadTemplate = function (options, template) {
            var self = this;
            var fragment = template(options.wizletInfo);
            options.context.html(fragment);
            self.setHeightAndCheckReadonly();
        };
        Prioritize.prototype.setHeight = function (result) {
            var self = this;
            var leftPanelDivsContainer = self.options.context.find('[data-prioritizeComponentTable]').find('[data-prioritizeOrderListLeft]');
            var rightPanelDivsContainer = self.options.context.find('[data-prioritizeComponentTable]').find('[data-prioritizeOrderListRight]');
            var leftPanelDivs = leftPanelDivsContainer.find('[data-orderlistleftpanel]');
            var rightPanelDivs = rightPanelDivsContainer.find('[data-rowitem]');
            if (self.wizletInfo.type === "VOTES") {
                for (var i = 1; i <= self.result.votes.length; i++) {
                    var height = $(rightPanelDivs[i - 1]).height();
                    $(leftPanelDivs[i - 1]).css('height', height + 'px');
                }
            } else if (self.wizletInfo.type === "QUESTIONS") {
                for (var i = 1; i <= self.options.wizletInfo.questions.length; i++) {
                    var height = $(rightPanelDivs[i - 1]).height();
                    $(leftPanelDivs[i - 1]).css('height', height + 'px');
                }
            }
        };

        Prioritize.prototype.submit = function (options) {
            var self = this;
            var rankItems = self.options.context.find("[data-prioritizeOrderListRight] div.[data-votes]");
            if (self.wizletInfo.type === "VOTES") {
                var res = "questionId=" + self.wizerApi.getQuestionIdByName(self.options.wizletInfo.question);
                for (var i = 0; i < rankItems.length; i++) {
                    var rankItemDom = $(rankItems[i]);
                    var universalId = rankItemDom.attr("rel");
                    res += "&ranks[" + i + "].id=" + universalId + "&ranks[" + i + "].rank=" + (rankItems.length - i);
                }
                AjaxGetJson('Vote', 'SetRanks', res, function (val) {
                    //callback: (eval(val) == true);

                }, function () {
                    //callback(false);
                });

            } else if (self.wizletInfo.type === "QUESTIONS") {
                var rankItemsText = self.options.context.find("[data-prioritizeOrderListRight] div.responseText");
                var votes = [];
                for (var i = 0; i < rankItems.length; i++) {
                    var rankItemDom = $(rankItems[i]);
                    var rankItemTextDom = $(rankItemsText[i]);
                    var qId = self.wizerApi.getQuestionIdByName(rankItemDom.attr("rel"));
                    var responseText = (rankItems.length + 1) - (i + 1);
                    votes.push({
                        questionId: qId,
                        responseText: responseText
                    });
                }
                if (self.wizletInfo.heatmap_enabled) {
                    votes.push({
                        questionId: self.wizerApi.getQuestionIdByName(self.wizletInfo.heatmap_enabled),
                        responseText: "111"
                    });
                }
                self.wizerApi.addVotes( // Uses VoteAPI.VoteManyQuestions
                    {
                        votes: votes
                    });

            }
            self.setCssClass();
        };

        Prioritize.prototype.setCssClass = function () {
            var self = this;
            var $submitButton = self.options.context.find('[data-prioritizeButtons]').find('[data-submitButton]');
            if (self.componentVersion < 2) {
                $submitButton.addClass('prioritizeSavedMessage');
            } else {
                $submitButton.find('[data-prioritizeSubmitButtonText]').addClass('pc-savedmessage');
            }
            $submitButton.addClass('clicked-saved');
            var confirmMsg = self.wizletInfo.confirmMsg;
            if (!confirmMsg) confirmMsg = "Saved";
            self.options.context.find('[data-prioritizeButtons]').find('[data-submitButton]').find('[data-prioritizeSubmitButtonText]').html(confirmMsg);
        };
        Prioritize.prototype.reset = function (options) {
            var self = this;
            var leftPanelDivs = options.context.find('[data-prioritizeComponentTable]').find('[data-orderlistleftpanel]');
            var rightPanelDivsContainer = options.context.find('[data-prioritizeComponentTable]').find('[data-prioritizeOrderListRight]');
            rightPanelDivsContainer.html('');
            if (self.componentVersion < 2) {
                for (var i = 1; i <= this.result.votes.length; i++) {
                    $(rightPanelDivsContainer).append('<div class="prioritizeVotes' + i + ' prioritizeRowItem" id="prioritizeOrderList" data-rowitem><div class="prioritizeRowItem' + i + 'RightPanel prioritizeRightPanel"><div class="prioritizeRowItem' + i + 'DraggableContainer draggableContainer"><div class="prioritizeRowItem' + i + 'DraggableSign draggableSign1"></div><div class="prioritizeRowItem' + i + 'DraggableSign draggableSign2"></div><div class="prioritizeRowItem' + i + 'DraggableSign draggableSign3"></div></div><div class="prioritizeRowItem' + i + 'Text prioritizeComponentVotes" rel=' + this.result.votes[i - 1].universalId + ' data-votes><p>' + this.result.votes[i - 1].responseText + '</p></div></div></div>');
                }
            } else {
                options.context.find('[data-prioritizeButtons]').find('[data-submitButton]').removeClass('clicked-saved')
                    .find('[data-prioritizeSubmitButtonText]').removeClass('pc-savedmessage');
                for (var i = 1; i <= this.result.votes.length; i++) {
                    $(rightPanelDivsContainer).append('<div class="prioritizeVotes' + i + ' pc-rowitem" id="prioritizeOrderList" data-rowitem><div class="prioritizeRowItem' + i + 'RightPanel pc-rightpanel"><div class="prioritizeRowItem' + i + 'DraggableContainer pc-draggablecontainer"><div class="prioritizeRowItem' + i + 'DraggableSign pc-draggablesign1"></div><div class="prioritizeRowItem' + i + 'DraggableSign pc-draggablesign2"></div><div class="prioritizeRowItem' + i + 'DraggableSign pc-draggablesign3"></div></div><div class="prioritizeRowItem' + i + 'Text pc-votes" rel=' + this.result.votes[i - 1].universalId + ' data-votes><p>' + this.result.votes[i - 1].responseText + '</p></div></div></div>');
                }
            }
            self.setHeight();
            self.init();
        };
        Prioritize.getRegistration = function () {
            return new Prioritize();
        };
        return Prioritize;
    });