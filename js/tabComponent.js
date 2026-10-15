/* 
    "Plain TabComponent" wizlet that takes a template and some data as the only input
    and renders the template with functionality from wizletBase, and nothing else.
*/

define(['jquery', 'Q', 'wizer-api', 'wizletBase', 'doT', 'timerUtil', 'shield', 'votesite', 'jquery-ui'], function ($, Q, WizerApi, WizletBase, doT, TimerUtil, Shield) {

    var TabComponent = function () {
        this.type = 'TabComponent';
        this.level = 1;
        this.timerUtil = new TimerUtil('TabComponent');
        this.eventListeners = [];
    };

    TabComponent.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
        this.unsedContext = unused;
        this.wizletInfo = wizletInfo;
        this.wizletContext = wizletContext;
        this.wizerApi = wizerApi;
        this.templateDefer = Q.defer();
        this.componentVersion = this.wizletInfo.version || 1;
        var self = this;
        var requirements = [];
        this.loadingAction;

        requirements.push(WizletBase.loadTemplate(wizletInfo, 'tabComponent.dot'));
        if (wizletInfo.css) {
            requirements.push('css!' + wizletInfo.css);
        }
        require(requirements, function (doTTemplate, css) {
            self.templateDefer.resolve(doTTemplate);
        });

        return WizletBase.loadHandler({ wizlet: this, render: this.render });
    };

    TabComponent.prototype.unloadHandler = function () {
        // unload the current page
        var self = this;
        if (self.currentWizletModule && self.currentWizletModule.length > 0) {
            $.each(self.currentWizletModule, function (index, module) {
                if (module.wizletInstance && module.wizletInstance.unloadHandler) {
                    module.wizletInstance.unloadHandler();
                }
            });
        }
        $.each(self.eventListeners, function(index, cbPair) {
            var event = cbPair.event;
            var handlerRef = cbPair.handler;
            $(document).unbind(event, handlerRef);
        });
        //unload wizletbase
        WizletBase.unloadHandler({ wizlet: this });
    };

    TabComponent.prototype.populateConditionQuestionsAndAnswersArray = function (tabs) {
        for (var i = 0; i < tabs.length; i++) {
            var conditionQuestion = tabs[i].conditionQuestion;
            var conditionAnswer = tabs[i].conditionAnswer;
            if (!conditionQuestion && !conditionAnswer) {
                this.conditionQuestions.push("");
                this.conditionAnswers.push("");
                if (tabs[i].children) {
                    this.populateConditionQuestionsAndAnswersArray(tabs[i].children);
                }
            }
            else {
                this.conditionQuestions.push(conditionQuestion);
                this.conditionAnswers.push(conditionAnswer);
                if (tabs[i].children) {
                    this.populateConditionQuestionsAndAnswersArray(tabs[i].children);
                }
            }
        }
    }

    TabComponent.prototype.getMyVotesOnConditionQuestions = function () {
        this.questionIds = [];
        var qIds = [];
        var self = this;
        for (var i = 0; i < this.conditionQuestions.length; i++) {
            var qId = this.wizerApi.getQuestionIdByName(this.conditionQuestions[i]);
         if (this.conditionQuestions[i] !== "") {
                this.questionIds.push(qId);
                if (qIds.indexOf(qId) === -1) { // Note: avoid fetching the same qId more than once
                    qIds.push(qId);
                }
            }
        }

        // var myVotesOnQuestions = this.wizerApi.getMyVotes(qIds);
        var qId = this.wizerApi.getQuestionIdByName(this.conditionQuestions[i]);

        if(self.wizletInfo.trackQuestion){
            var tqid = self.wizerApi.getQuestionIdByName(self.wizletInfo.trackQuestion);
            return self.wizerApi.getForemanVotes(tqid,qIds).then(function (response) {
                self.votes = response;
                self.count = 0;
                self.addCreatePropertyToTabOptionsXML(self.wizletInfo.tabOptions);
            });
        }else{
            return self.wizerApi.getMyVotes(qIds).then(function (response) {
                self.votes = response;
                self.count = 0;
                self.addCreatePropertyToTabOptionsXML(self.wizletInfo.tabOptions);
    
            });
        }

       
    }

    TabComponent.prototype.addCreatePropertyToTabOptionsXML = function (tabs) {
        
        for (var i = 0; i < tabs.length; i++) {
            var conditionQuestion = tabs[i].conditionQuestion;
            var conditionAnswer = tabs[i].conditionAnswer;
            if (!conditionQuestion && !conditionAnswer) {
                tabs[i].create = true;
                tabs[i].loadActionXML = true;
                if (tabs[i].children) {
                    this.addCreatePropertyToTabOptionsXML(tabs[i].children);
                }
            }
                else {
                var voteVal = this.votes && this.votes.votes && this.questionIds[this.count] != null
                    ? this.votes.votes[this.questionIds[this.count]]
                    : null;
                var selected = voteVal && voteVal.length ? String(voteVal[0]) : null;
                if (selected !== null && String(conditionAnswer) === selected) {
                    tabs[i].loadActionXML = true;
                    tabs[i].open = true;
                    tabs[i].gaugedisplay = "true";
                    if (tabs[i].title && tabs[i].youraction) {
                        // Labeled feedback options: show tab + "You Selected"
                        tabs[i].create = true;
                        tabs[i].title = "<span class='text_highlight'>" + tabs[i].title + " - " + tabs[i].youraction + "</span>";
                    } else if (tabs[i].title) {
                        tabs[i].create = true;
                    } else {
                        // Untitled path routers (e.g. M6 Custom_Main_Tabs): load content, no tab chrome
                        tabs[i].create = false;
                    }
                }
                else {
                    if (tabs[i].title) {
                        // Labeled options: allow browsing non-selected feedback
                        tabs[i].create = true;
                        tabs[i].loadActionXML = true;
                    } else {
                        // Untitled path routers: do not create/load non-matching paths
                        tabs[i].create = false;
                        tabs[i].loadActionXML = false;
                    }
                    tabs[i].open = false;
                    tabs[i].gaugedisplay = "false";
                }
                this.count++;
                if (tabs[i].children) {
                    this.addCreatePropertyToTabOptionsXML(tabs[i].children);
                }
            }
        }
    }
    TabComponent.prototype.render = function (options) {
        var self = this;
        var rendering = new Q.defer();
        this.conditionQuestions = [];
        this.conditionAnswers = [];

        self.templateDefer.promise.then(function (template) {
            self.populateConditionQuestionsAndAnswersArray(self.wizletInfo.tabOptions);

            var promise = self.getMyVotesOnConditionQuestions();

            promise.then(function () {
                
                var fragment = template(options.wizletInfo);
                options.context.html(fragment);

                self.appendTabs(options);
                self.registerEventHandlers(options);
                self.loadDefault(options);

                options.context.find(".text_highlight").parents(".tc-bar__tab").addClass("selectedChoice");

                rendering.resolve(true);
            });
        })
        .fail(this.wizerApi.showError)
        return rendering.promise;
    };


    TabComponent.getRegistration = function () {
        return new TabComponent();
    };

    TabComponent.prototype.appendTabs = function (options) {

    };

    TabComponent.prototype.registerEventHandlers = function (options) {
        //$("#accordion").accordion();

        var self = this;
        var defaultType = 'tabs';
        var allTabs = null;
        var container = null;
        var actionXMLName;
        var gaugedisplay;
        self.expandedAccordions = [];

        if (options.wizletInfo.type && options.wizletInfo.type == 'accordion') {
            if (self.componentVersion < 2) {
                allTabs = options.context.find(".accordion .accordionItem");
                container = ".accordionPage";
            }
            else {
                allTabs = options.context.find(".tc-acc__item");
                container = ".tc-acc__page";
            }
            if (options.wizletInfo.expandCollapseAll) {
                options.context.find('[data-expandcollapsesign]').off('click').on('click', function () {
                    options.context.find('[data-expandcollapse]').trigger('click');
                });

                options.context.find('[data-expandcollapse]').off('click').on('click', function () {
                    if ($(this).hasClass('tc-expandCollapse__expand')) {
                        $.each(allTabs, function (index, tab) {
                            if ($(tab).find('.tc-acc__page--showcontent').length === 0) {
                                self.expandedAccordions.push($(tab).attr('id'));
                                $(tab).find('.tc-acc__label').trigger('click');
                            }
                        });
                        $(this).removeClass('tc-expandCollapse__expand').addClass('tc-expandCollapse__collapse').text(options.wizletInfo.expandCollapseAll.collapseText);
                        $(this).siblings('[data-expandcollapsesign]').removeClass('expand').addClass('collapse');
                    }
                    else {
                        $.each(allTabs, function (index, tab) {
                            $(tab).find('.tc-acc__label').trigger('click');
                        });
                        self.expandedAccordions = [];
                        $(this).removeClass('tc-expandCollapse__collapse').addClass('tc-expandCollapse__expand').text(options.wizletInfo.expandCollapseAll.expandText);
                        $(this).siblings('[data-expandcollapsesign]').removeClass('collapse').addClass('expand');
                    }
                });
            }
        }
        else {
            // version change
            if (self.componentVersion < 2) {
                allTabs = options.context.find(".tab");
                container = ".tabPage";
            }
            else {
                allTabs = options.context.find(".tc-bar__tab, .tc-acctab__tab");
                container = ".tc-page__page";
            }
            if (options.wizletInfo.showTabs !== undefined && options.wizletInfo.showTabs === false) {
                if (self.componentVersion < 2) {
                    $(allTabs).hide();
                }
                else {
                    // votestyle.css uses display:!important on .tc-bar; inline hide must win
                    options.context.find(".tc-bar, .tc-xs").attr("style", "display: none !important");
                    // Path routers leave an empty 27% sidebar otherwise — expand content full width
                    options.context.find(".tc-page__container").attr("style", "float: none; width: 100%;");
                }
            }
        }
        $.each(allTabs, function (index, tab) {
            var currentTab = tab;
            var tabContainer = null;
            if (options.wizletInfo.type && options.wizletInfo.type == 'accordion') {
                // version change
                if (self.componentVersion < 2) {
                    var accordionTitle = $(tab).find(".accordionTitle");
                    var wrapper = $(tab);
                    $(accordionTitle).unbind('click').bind('click', function () {
                        tabContainer = $(wrapper).find(container);
                        if ($(tabContainer).hasClass('showcontent')) {
                            $(tabContainer).removeClass('showcontent');
                            //change image to dropped
                            $(wrapper).find('.imageContainer').addClass('expanded');
                        }
                        else {
                            $(tabContainer).addClass('showcontent');
                            $(this).find('.imageContainer').removeClass('expanded');
                            return;
                        }
                        actionXMLName = $(this).find('.tabTitle').data('action');
                        self.toggleActive(this);
                        var accordionItem = $(this).parent('.accordionItem');
                        accordionItem.toggleClass('active');
                        var loading = self.loadPage(actionXMLName, options.context, self.unsedContext, tabContainer);
                    });
                }
                else {
                    var accordionTitle = $(tab).find('.tc-acc__label');
                    var wrapper = $(tab);
                    $(accordionTitle).unbind('click').bind('click', function (e) {
                        tabContainer = $(wrapper).find(container);

                        $(this).find('.tc-acc__ico--expanded').removeClass('tc-acc__ico--expanded');
                        if ($(tabContainer).hasClass('tc-acc__page--showcontent')) {
                            $(tabContainer).removeClass('tc-acc__page--showcontent');
                            if (options.wizletInfo.expandCollapseAll) {
                                options.context.find('.tc-expandCollapse').removeClass('tc-expandCollapse__collapse').addClass('tc-expandCollapse__expand').text(options.wizletInfo.expandCollapseAll.expandText);
                                options.context.find('[data-expandcollapsesign]').removeClass('collapse').addClass('expand');
                                var position = self.expandedAccordions.indexOf($(tab).attr("id"));
                                if (position !== -1) {
                                    self.expandedAccordions.splice(position, 1);
                                }
                            }
                            //change image to dropped
                        }
                        else {
                            // Close any other open accordion when only one may be open at a time
                            if (options.wizletInfo.allowMultiple === false) {
                                $.each(allTabs, function (i, otherTab) {
                                    if (otherTab === tab) {
                                        return;
                                    }
                                    var $otherTab = $(otherTab);
                                    $otherTab.find(container).removeClass('tc-acc__page--showcontent');
                                    $otherTab.find('.tc-acc__ico').removeClass('tc-acc__ico--expanded');
                                    $otherTab.find('.tc-acc__title').removeClass('tc-acc__title--active');
                                    if (options.wizletInfo.expandCollapseAll) {
                                        var otherPosition = self.expandedAccordions.indexOf($otherTab.attr("id"));
                                        if (otherPosition !== -1) {
                                            self.expandedAccordions.splice(otherPosition, 1);
                                        }
                                    }
                                });
                            }
                            $(tabContainer).addClass('tc-acc__page--showcontent');
                            $(wrapper).find('.tc-acc__ico').addClass('tc-acc__ico--expanded');
                            actionXMLName = $(this).data('action') || $(this).closest('.tc-acc__title').data('action') || $(this).find('.tc-acc__title').data('action');
                            var loading = self.loadPage(actionXMLName, options.context, self.unsedContext, tabContainer);

                            if (options.wizletInfo.expandCollapseAll) {
                                if (self.expandedAccordions.indexOf($(tab).attr("id")) === -1) {
                                    self.expandedAccordions.push($(tab).attr("id"));
                                }
                                if (self.expandedAccordions.length === options.wizletInfo.tabOptions.length) {
                                    options.context.find('.tc-expandCollapse').removeClass('tc-expandCollapse__expand').addClass('tc-expandCollapse__collapse').text(options.wizletInfo.expandCollapseAll.collapseText);
                                    options.context.find('[data-expandcollapsesign]').removeClass('expand').addClass('collapse');
                                }
                            }
                        }
                        
                        self.toggleActive(this);
                        
                    });
                }
            } else {
                // version change
                if (self.componentVersion < 2) {

                    tabContainer = options.context.find(container);
                    var tabMenu = options.context.find(".tabComponentTabsMenu");
                    var submenuItems = $(tabMenu).find(".subMenu");

                    actionXMLName = $(tab).find('.tabTitle').data('action');
                    var children = $(tab).find('.tabTitle').data('children');
                    if (children) {
                        if ($(tab).find(".arrow").length > 0) {
                            $(tab).addClass("withChild");
                        }
                        if (actionXMLName) {
                            $(tab).addClass("withLink");
                            
                        } else {
                        }
                        $(tab).find(".arrow").unbind('click').bind('click', function () {
                            var isActive = ($(this).hasClass("active"));
                            $(allTabs).find(".arrow").removeClass("active");
                            $(submenuItems).removeClass("active");
                            $(this).toggleClass("active", !isActive);
                            var menuid = $(tab).data('menuid');
                            var m = $(tabMenu).find("[data-menuid~='" + menuid + "']");
                            $(tabMenu).find("[data-menuid~='" + menuid + "']").toggleClass("active", !isActive);
                        });
                    }
                    $(tab).find('.tabTitle').unbind('click').bind('click', function () {

                        actionXMLName = $(this).data('action');
                        var children = $(this).data('children');
                        var timer = $(this).data('timer');

                        if (actionXMLName) {

                            $(allTabs).removeClass("active");
                            $(submenuItems).removeClass("active");
                            $(allTabs).find(".arrow").removeClass("active");
                            self.toggleActive(tab);
                            var loading = self.loadPage(actionXMLName, options.context, self.unsedContext, tabContainer);
                            self.actualTabHasTimer = false;
                            if (timer) {
                                self.addShieldAndBindTimers(actionXMLName);
                            }
                            else {
                                if (self.shield) {
                                    self.shield.removeShield(document);
                                }
                            }

                        }
                    });

                    $.each(submenuItems, function (index, submenu) {
                        $(submenu).data("parentTab", tab);
                        $(submenu).find(".subMenuArrow").unbind('click').bind('click', function () {
                            $(submenu).find("ul").toggleClass("active");
                            $(this).toggleClass("active");
                        });
                        $(submenu).find(".menuLabel").unbind('click').bind('click', function () {
                            if (self.shield) {
                                self.shield.removeShield(document);
                            }
                            actionXMLName = $(this).data('action');
                            if (actionXMLName) {
                                $(this).removeClass("active");
                                self.toggleActive(this);
                                $(submenuItems).removeClass("active");
                                $(allTabs).find(".arrow").removeClass("active");
                                $(allTabs).removeClass("active");
                                var menuid = $(submenu).data('menuid');
                                var cTab = $(self.wizletContext).find(".tab[data-menuid~='" + menuid + "']");
                                self.toggleActive(cTab);
                                var loading = self.loadPage(actionXMLName, options.context, self.unsedContext, tabContainer);
                            }

                        });
                    });
                }
                else {
                    tabContainer = options.context.find(container);
                    var tabMenu = options.context.find(".tc-menu");
                    

                    var submenuItems = $(tabMenu).find(".tc-submenu");
                    actionXMLName = $(tab).find('.tc-bar__title').data('action');
                    gaugedisplay = $(tab).find('.tc-bar__title').data('gaugedisplay');
                   
                    var children = $(tab).find('.tc-bar__title').data('children');
                    if (children) {
                        if ($(tab).find(".tc-bar__arrow").length > 0) {
                            $(tab).addClass("withChild");
                        }
                        if (actionXMLName) {
                            $(tab).addClass("withLink");
                        } else {
                        }
                        $(tab).find(".tc-bar__arrow").unbind('click').bind('click', function (event) {
                            event.stopPropagation();
                            var isActive = ($(this).hasClass("tc-bar__arrow--active"));
                            $(allTabs).find(".tc-bar__arrow--active").removeClass("tc-bar__arrow--active");
                            $(submenuItems).removeClass("tc-submenu--active");
                            $(this).toggleClass("tc-bar__arrow--active", !isActive);
                            var menuid = $(tab).data('menuid');
                            var m = $(tabMenu).find("[data-menuid~='" + menuid + "']");
                            $(tabMenu).find("[data-menuid~='" + menuid + "']").toggleClass("tc-submenu--active", !isActive);
                        });
                    }
                    var tabClass = $(tab).attr('class').replace("withChild", '').replace('withLink', '');
                    $(tab).unbind('click').bind('click', function (e) {
                        actionXMLName = $(this).find('.tc-bar__title').data('action');
                        gaugedisplay = $(this).find('.tc-bar__title').data('gaugedisplay');
                        
                        var children = $(this).find('.tc-bar__title').data('children');
                        var timer = $(this).find('.tc-bar__title').data('timer');

                        if (actionXMLName) {
                            if (options.wizletInfo.type && options.wizletInfo.type == 'accordion') {

                            }
                            else {
                                options.context.find(".tc-bar__tab--active").removeClass("tc-bar__tab--active");
                                options.context.find(".tc-bar__title--active").removeClass("tc-bar__title--active");
                                options.context.find(".tc-bar__arrow--on").removeClass("tc-bar__arrow--on");
                                $(tab).find('.tc-bar__arrow').addClass('tc-bar__arrow--on');
                                $(allTabs).removeClass("tc-bar__tab--active");
                                $(submenuItems).removeClass("tc-bar__tab--active").removeClass("tc-submenu--active");
                                $(allTabs).find(".tc-bar__arrow--active").removeClass("tc-bar__arrow--active");
                            }
                            self.toggleActive(tab);
                            var loading = self.loadPage(actionXMLName, options.context, self.unsedContext, tabContainer, gaugedisplay)                        
                            //.done(); this causes the shield to break and appear in pages.
                            self.actualTabHasTimer = false;
                            if (timer) {
                                self.addShieldAndBindTimers(actionXMLName);
                            }
                            else {
                                if (self.shield) {
                                    self.shield.removeShield(document);
                                }
                            }
                        }
                        else {
                            var isActive = ($(tab).find('.tc-bar__arrow').hasClass("tc-bar__arrow--active"));
                            $(allTabs).find(".tc-bar__arrow--active").removeClass("tc-bar__arrow--active");
                            $(submenuItems).removeClass("tc-submenu--active");
                            $(tab).find('.tc-bar__arrow').toggleClass("tc-bar__arrow--active", !isActive);
                            var menuid = $(tab).data('menuid');
                            $(tabMenu).find("[data-menuid~='" + menuid + "']").toggleClass("tc-submenu--active", !isActive);
                        }
                    });

                    $.each(submenuItems, function (index, submenu) {
                        $(submenu).find(".tc-submenu__arrow").unbind('click').bind('click', function (e) {
                            e.stopPropagation();
                            $(submenu).find(".tc-submenu--tri").toggleClass("tc-submenu--tri--active");

                            $(submenu).find(".tc-submenu__sub").toggleClass("tc-submenu__sub--active");
                            $(this).toggleClass("tc-submenu__arrow--active");
                        });

                        var subMenuOptions = {
                            subMenu: submenu,
                            options: options,
                            subMenuItems: submenuItems,
                            allTabs: allTabs,
                            tabContainer: tabContainer
                        };

                        $(submenu).unbind('click').bind('click', function (e) {
                            if ($(e.target).hasClass("tc-submenu__sub") || $(e.target).hasClass("tc-submenu__sublabel") || $(e.target).hasClass("tc-submenu--tri") || $(e.target).hasClass("tc-submenu__label--tri")) {
                                return;
                            }
                            self.subMenusClicked($(this), subMenuOptions);
                        });
                        $(submenu).find('.tc-submenu__sub, .tc-submenu--tri').unbind('click').bind('click', function (e) {
                            self.subMenusClicked($(this), subMenuOptions);
                        });
                    });
                }
            }
        });

        var selectedTabIndex = -1;

        if (options.wizletInfo.selectedTab) {
            selectedTabIndex = options.wizletInfo.selectedTab;
        }
        if (selectedTabIndex != 1) {
            $(allTabs[selectedTabIndex - 1]).click();
        }
    }

    TabComponent.prototype.subMenusClicked = function (elemClicked, subMenuOptions) {
        var self = this;
        var actionXMLName = elemClicked.find(".tc-submenu__label, .tc-submenu__label--tri, .tc-submenu__sublabel").data('action');

        if (actionXMLName && self.shield) {
            self.shield.removeShield(document);
        }
        
        if (actionXMLName) {
            elemClicked.find(".tc-submenu__label, .tc-submenu__label--tri, .tc-submenu__sublabel").removeClass("active");
            $(subMenuOptions.subMenuItems).removeClass("active");
            $(subMenuOptions.allTabs).find(".arrow").removeClass("active");
            $(subMenuOptions.allTabs).removeClass("active");
            var menuid = $(subMenuOptions.subMenu).data('menuid');
            $(self.wizletContext).find('.tc-submenu--active').removeClass('tc-submenu--active');
            $(self.wizletContext).find('.tc-bar__arrow--active').removeClass('tc-bar__arrow--active');
            var cTab = $(self.wizletContext).find(".tc-bar__tab[data-menuid~='" + menuid + "']");
            self.toggleActive(cTab);
            var loading = self.loadPage(actionXMLName, subMenuOptions.options.context, self.unsedContext, subMenuOptions.tabContainer);
        }
        else {
            $(elemClicked[0]).find(".tc-submenu--tri").toggleClass("tc-submenu--tri--active");
            $(elemClicked[0]).find(".tc-submenu__sub").toggleClass("tc-submenu__sub--active");
            $(elemClicked[0]).find('.tc-submenu__arrow').toggleClass("tc-submenu__arrow--active");
        }
    }

    TabComponent.prototype.toggleActive = function (e) {
        var self = this;
        // version change
        if (self.componentVersion < 2) {
            var titleElem = $(e).find('.tabTitle');
            $(e).toggleClass("active");
            titleElem.toggleClass("active");
        }
        else {
            if (self.wizletInfo.type && self.wizletInfo.type == 'accordion') {
                var titleElem = $(e).find('.tc-acc__title')
                titleElem.toggleClass("tc-acc__title--active");
            }
            else {
                var element = $(e);
                if (element.hasClass('tc-bar__tab')) {
                    self.wizletContext.find('.tc-bar__tab--active').removeClass('tc-bar__tab--active');
                    self.wizletContext.find('.tc-bar__title--active').removeClass('tc-bar__title--active');
                    var titleElem = $(e).find('.tc-bar__title');
                    $(e).toggleClass("tc-bar__tab--active");

                    self.wizletContext.find('.tc-bar__arrow--on').removeClass('tc-bar__arrow--on');
                    $(e).find('.tc-bar__arrow').addClass('tc-bar__arrow--on');

                    titleElem.toggleClass("tc-bar__title--active");

                }
                else {
                    var titleElem = $(e).find('.tc-acctab___label');
                    $(e).toggleClass("tc-acctab__tab--active");
                    titleElem.toggleClass("tc-acctab___label--active");
                }
            }
        }
    }
    TabComponent.prototype.loadDefault = function (options) {
        var actionXMLName;
        var gaugedisplay;
        var self = this;
        var l, i, accordionTitle, allTabs;
        if (options.wizletInfo.type && options.wizletInfo.type == 'accordion') {
            if (self.componentVersion < 2) {
                allTabs = options.context.find(".accordion .accordionItem");
                accordionTitle;
                l = options.wizletInfo.tabOptions.length;
                for (i = 0; i < l; i++) {
                    if (options.wizletInfo.tabOptions[i].open) {
                        accordionTitle = $(allTabs[i]).find(".accordionTitle");
                        $(accordionTitle).click();
                    }
                }
            } else {
                allTabs = options.context.find(".tc-acc__item");
                accordionTitle;
                l = options.wizletInfo.tabOptions.length;
                for (i = 0; i < l; i++) {
                    if (options.wizletInfo.tabOptions[i].open) {
                        accordionTitle = $(allTabs[i]).find(".tc-acc__title");
                        $(accordionTitle).click();
                    }
                }
            }
            

        } else {
            l = options.wizletInfo.tabOptions.length;
            var defaultIndex = -1;
            var defaultTab = -1;
            var gaugeContainer=options.context.parents('.appliedLayout').find('.FBSSG-gauges');

            for (i = 0; i < l; i++) {
                if (options.wizletInfo.tabOptions[i].open) {
                    if (options.wizletInfo.tabOptions[i].loadActionXML && options.wizletInfo.tabOptions[i].actionXML) {
                        defaultIndex = i;
                        active = i;

                        break;
                    }
                }

                else if (options.wizletInfo.tabOptions[i].loadActionXML){ 
                      
                    if (defaultTab === -1 && options.wizletInfo.tabOptions[i].actionXML) {
                        defaultTab = i;
                        
                    }
                }
                

                if (i === l - 1) {
                    defaultIndex = defaultTab;
                }
            }

            if (defaultIndex === -1) {
                return;
            }

            actionXMLName = options.wizletInfo.tabOptions[defaultIndex].actionXML;
            gaugedisplay=options.wizletInfo.tabOptions[defaultIndex].gaugedisplay; 

            // version change
            if (self.componentVersion < 2) {
                tabContainer = options.context.find(".tabPage");
                var index = defaultIndex;

                for (i = 0; i < defaultIndex; i++) {
                    if (!options.wizletInfo.tabOptions[i].create && !options.wizletInfo.tabOptions[i].loadActionXML) {
                        index--;
                    }
                }

                self.toggleActive(options.context.find(".tabComponentTabs").find(".tab")[index]);
                self.toggleActive(options.context.find(".tabComponentTabs-xs").find(".tab")[index]);
                this.actualTabHasTimer = false;
                if (options.wizletInfo.tabOptions[defaultIndex].hasTimer) {
                    this.addShieldAndBindTimers(actionXMLName);
                }

                var loading = self.loadPage(actionXMLName, options.context, self.unsedContext, tabContainer, gaugedisplay);
            }
            else {
                tabContainer = options.context.find(".tc-page__page");
                var index = defaultIndex;

                for (i = 0; i < defaultIndex; i++) {
                    if (!options.wizletInfo.tabOptions[i].create && !options.wizletInfo.tabOptions[i].loadActionXML) {
                        index--;
                    }
                }

                if (!options.context.find(".tc-xs").is(':visible')) {
                    var barTab = options.context.find(".tc-bar").find(".tc-bar__tab")[index];
                    if (barTab) self.toggleActive(barTab);
                }
                else {
                    var xsTab = options.context.find(".tc-xs").find(".tc-bar__tab")[index];
                    if (xsTab) self.toggleActive(xsTab);
                }

                var accTab = options.context.find(".tc-xs").find(".tc-acctab__tab")[index];
                if (accTab) self.toggleActive(accTab);

                this.actualTabHasTimer = false;
                if (options.wizletInfo.tabOptions[defaultIndex].hasTimer) {
                    this.addShieldAndBindTimers(actionXMLName);
                }
                var arrows = options.context.find('[class*="acctab__arrow"]')

                for (i = 0; i < arrows.length; i++) {
                    $(arrows[i]).bind('click', function (e) {
                        self.subMenuElementClick(e)
                    });
                }
                var loading = self.loadPage(actionXMLName, options.context, self.unsedContext, tabContainer, gaugedisplay);
            }
        }

    }

    TabComponent.prototype.addShieldAndBindTimers = function (actionXMLName) {
        var self = this;
        // version change
        if (self.componentVersion < 2) {
            var context = self.wizletContext.find('.tabpageContainer').get(0);
            var link = $(this.wizletContext).find(".tab").find("[data-action~='" + actionXMLName + "']")

            this.shield = new Shield(context);
            this.shield.addShield('tabPage', context, 0, 150);
            var self = this;
            if (this.timerUtil.isTimerRunning()) {
                var timerText = this.timerUtil.getTimerValue();
                link.html(timerText);
                this.startTimer('tabPage', link, context, self.shield);
            };
            //register for event
            var startTimerCB = function () {
                self.restartTimer('tabPage', link, context, self.shield);
            };
            $(document).unbind("wizer:wizlet:command:tabs:startTimer", startTimerCB).bind("wizer:wizlet:command:tabs:startTimer", startTimerCB);
            self.eventListeners.push({event: "wizer:wizlet:command:tabs:startTimer", handler: startTimerCB});

            var resetTimerCB = function () {
                self.resetTimer(link);
            };
            $(document).unbind("wizer:wizlet:command:countdowntimer:reset", resetTimerCB).bind("wizer:wizlet:command:countdowntimer:reset", resetTimerCB);
            self.eventListeners.push({event: "wizer:wizlet:command:countdowntimer:reset", handler: resetTimerCB});
        }
        else {
            var context = self.wizletContext.find('.tc-page__container').get(0);
            var link = $(this.wizletContext).find(".tc-bar__tab").find("[data-action~='" + actionXMLName + "']")

            this.shield = new Shield(context);
            this.shield.addShield('tc-page__page', context, 0, 150);
            var self = this;
            if (this.timerUtil.isTimerRunning()) {
                var timerText = this.timerUtil.getTimerValue();
                link.html(timerText);
                this.startTimer('tc-page__page', link, context, self.shield);
            };
            //register for event
            var startTimerCB = function () {
                self.restartTimer('tc-page__page', link, context, self.shield);
            };
            
            $(document).unbind("wizer:wizlet:command:tabs:startTimer", startTimerCB).bind("wizer:wizlet:command:tabs:startTimer", startTimerCB);
            self.eventListeners.push({event: "wizer:wizlet:command:tabs:startTimer", handler: startTimerCB});

            var resetTimerCB = function () {
                self.resetTimer(link);
            };

            $(document).unbind("wizer:wizlet:command:countdowntimer:reset", resetTimerCB).bind("wizer:wizlet:command:countdowntimer:reset", resetTimerCB);
            self.eventListeners.push({event: "wizer:wizlet:command:countdowntimer:reset", handler: resetTimerCB});
        }
    }

    TabComponent.prototype.resetTimer = function (link) {
        link.html(this.startTime);
    };

    TabComponent.prototype.restartTimer = function (id, link, context, shield) {
        this.timerUtil.clearSavedValueTimerValue();
        this.startTimer(id, link, context, shield);
    };

    TabComponent.prototype.startTimer = function (id, link, context, shield) {
        var self = this;
        self.actualTabHasTimer = true;
        shield.removeShield(context); //remove shield
        self.startTime = $(link[0]).text().trim();
        this.timerUtil.startTimer(link, {
            done: function () {
                if (self.actualTabHasTimer) {
                    shield.addShield(id, context, 0, 150);
                }
            },
            //updateTimer: noop,
            error: function () {
                shield.addShield(id, context);
            }
        })
    };
    TabComponent.prototype.getLayoutPath = function (currentAction) {
        var paths = [];
        if (currentAction.layout) {
            paths.push('doT!layout/' + currentAction.layout + '.dot');
            paths.push('css!layout/layout.css');
        } else {
            paths.push('doT!events/' + singletonWizerApi.eventName() + '/layout/' + currentAction.layoutInEvent + '.dot');
        }
        return paths;
    }

    TabComponent.prototype.loadPage = function (actionXMLName, context, unusedContext, tabContainer, gaugedisplay) {
        var self = this;
       
        // remove action class if availble and add new action class
        tabContainer.removeClass(function (index, css) {
            return (css.match(/(^|\s)tc-action-\S+/g) || []).join(' ');
        });
        tabContainer.addClass("tc-action-" + actionXMLName);

        //unload previous 
        var self = this;
        if (self.currentWizletModule && self.currentWizletModule.length > 0) {
            $.each(self.currentWizletModule, function (index, module) {
                if (module.wizletInstance.unloadHandler) {
                    module.wizletInstance.unloadHandler();
                }
            });
        }
        // version change
        if (self.componentVersion < 2) {
            var loading = self.wizerApi.loadActionInContainer(actionXMLName, context, unusedContext, tabContainer);
            loading.then(function (loads) {
                self.currentWizletModule = loads;
                $(document).trigger("wizer:action:init.TabPage", actionXMLName);
            });
        }
        else {
            if(self.loadingAction == actionXMLName)return;
            var extraWizletInfo = null;
            if (self.wizletInfo.bindingParticipantEmail) {
                extraWizletInfo = {
                    bindingParticipant: self.wizletInfo.bindingParticipant,
                    bindingParticipantEmail: self.wizletInfo.bindingParticipantEmail
                };
            }
            var loading = self.wizerApi.loadActionInContainer(actionXMLName, context, unusedContext, tabContainer, extraWizletInfo);
            self.loadingAction = actionXMLName;
            loading.then(function (loads) {
                self.loadingAction = null;
                if (!gaugedisplay) {
                    $("#gaugeMetrics").css("display","none");
                }
                self.updateGauge(gaugedisplay);
                self.currentWizletModule = loads;
                
                if (self.wizletInfo.type && self.wizletInfo.type == 'accordion') {
                    var page = "wizer:action:init.tc-acc__page";
                }
                else {
                    var page = "wizer:action:init.tc-page__page";
                }
                
                $(document).trigger(page, actionXMLName, gaugedisplay);
            });
        }
    };
    TabComponent.prototype.updateGauge = function(gaugedisplay){
        var self = this;
        var gaugeContainer=self.wizletContext.parents('.appliedLayout').find('.FBSSG-gauges');
         if(gaugedisplay)
        {
            gaugeContainer.addClass('activeGauge');
            gaugeContainer.removeClass('hideGauge');
        }
        else{
            gaugeContainer.removeClass('activeGauge');
            gaugeContainer.addClass('hideGauge');
        }
    };

    TabComponent.prototype.rootMenuElementClick = function (e) {
        $(e.target).find('.sub_ul').toggleClass("active");
        $(e.target).find('.sub_ul').toggleClass("hidden");
        $(e.target).toggleClass("active");
    }

    TabComponent.prototype.subMenuElementClick = function (e) {
        // version change
        if (self.componentVersion < 2) {
            $(e.target).find('.sub_ul').toggleClass("active");
            $(e.target).find('.sub_ul').toggleClass("hidden");
        }
        else {
            var $target = $(e.target);
            if ($target.hasClass('tc-acctab__arrow')) {
                var active = $target.attr('class');
                var tabIndex = $target.parent('.tc-acctab').data('menuid');
                var tabMenu = $('.tc-acctab__menu').eq(tabIndex).find('.tc-acctab__submenu--bi');
                var addRemove = $target.hasClass('tc-acctab__arrow--active');
                $target.toggleClass("tc-acctab__arrow--active", !addRemove);
                tabMenu.toggleClass("tc-acctab__submenu--active", !addRemove);
            }
            if ($target.hasClass('tc-acctab__arrow--bi')) {
                var active = $target.attr('class');
                var tabIndex = $target.parent('.tc-acctab__submenu--bi').data('menuid');
                var tabMenu = $target.siblings().find('.tc-acctab__submenu--tri');
                var addRemove = $target.hasClass('tc-acctab__arrow--bi--active');
                $target.toggleClass("tc-acctab__arrow--bi--active", !addRemove);
                tabMenu.toggleClass("tc-acctab__submenu--active", !addRemove);
            }
            var active = $target.attr('class');
            var tabIndex = $target.parent('.tc-acctab').data('menuid');
            var tabMenu = $('.tc-acctab__menu').eq(tabIndex);
        }

    }

    TabComponent.prototype.loadComponent = function () {
    }


    return TabComponent;

});
