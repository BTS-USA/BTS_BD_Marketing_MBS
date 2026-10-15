/* 
    "Plain Vanilla" wizlet that takes a template and some data as the only input
    and renders the template with functionality from wizletBase, and nothing else.
*/

define(['jquery', 'Q', 'wizer-api', 'wizletBase', 'doT', 'WizerModel'], function ($, Q, WizerApi, WizletBase, doT, WizerModel) {

    var SingleSelect = function () {
        this.type = 'SingleSelect';
        this.level = 1;
    };

    SingleSelect.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
        this.wizletInfo = wizletInfo;
        this.wizletContext = wizletContext;
        this.wizerApi = wizerApi;
        this.wizerModel = WizerModel.getInstance() || new WizerModel({ wizerApi: this.wizerApi });
        this.templateDefer = Q.defer();
        var self = this;
        var requirements = [];
        requirements.push(WizletBase.loadTemplate(wizletInfo, 'singleSelect.dot'));

        if (wizletInfo.css) {
            requirements.push(WizletBase.loadCss(wizletInfo));
        }
        require(requirements, function (doTTemplate, css) {
            self.templateDefer.resolve(doTTemplate);
        });

        //VideoPlayer.onLoad(null, info, content, wizerApi);
        var loading = WizletBase.loadHandler({ wizlet: this, render: this.render });
        return loading.then(function () {
            self.dataBinderCallback().then(function () {
                if (self.wizletInfo.behavior && self.wizletInfo.behaviorKey) {
                    var editable = self.wizletContext.find(".editableText");
                    editable.data('field', 'behavior');
                    editable.data('behaviorfield', self.wizletInfo.behavior);
                    editable.data('behaviorkey', self.wizletInfo.behaviorKey);
                }
            });
        });
    };

    SingleSelect.prototype.unloadHandler = function () {
        //unload wizletbase
        this.wizletContext.off('valueUpdated');
        this.wizletContext.off('WIZER:CLEARVOTE:UNSELECT');
        WizletBase.unloadHandler({ wizlet: this });
    };

    SingleSelect.prototype.render = function (options) {
        var self = this;
        var rendering = new Q.defer();
        self.templateDefer.promise.then(function (template) {
            options.wizletInfo.version = self.findJsonVersion(options.wizletInfo);
            var fragment = template(options.wizletInfo);
            options.context.html(fragment);
            if (options.context.find('[data-clearAction]').attr("data-enabled") === "true") {
                options.context.find('[data-clearAction]').removeClass('buttonEnabled').addClass('buttonDisabled');
            }
            else {
                options.context.find('[data-clearAction]').removeClass('buttonDisabled').addClass('buttonEnabled');
            }

            options.context.find('[data-buttons]').on('click', function (event) {
                self.buttonClicked(event.currentTarget, options);
            });
            options.context.on('valueUpdated', function (e) {
                options.context.find('[data-clearAction]').removeClass('buttonDisabled').addClass('buttonEnabled');
                self.setSavedMessage(true);
                self.enableDisableButtons(options, true);

            });

            options.context.on('WIZER:CLEARVOTE:UNSELECT', function (e, questionName) {
                self.removeVotes(questionName);
                if (self.wizletContext.find('.ssc-row').find('[data-optioncontainer].clicked').length === 0) {
                    self.setSavedMessage(true);
                    self.wizletContext.find('[data-clearAction]').trigger('click');
                }
            });

            if (self.wizletInfo.readOnlyCondition) {
                self.checkForReadOnlyCondition();
            }
          
            if (!self.wizletInfo.DB[self.wizletInfo.questions[0].binding])
                self.enableDisableButtons(options, false);           

            rendering.resolve(true);
        })
        .fail(this.wizerApi.showError);
        return rendering.promise;
    };

    SingleSelect.prototype.checkForReadOnlyCondition = function () {
        var self = this;
        var readonly = self.wizerModel.checkForReadOnlyCondition(self.wizletInfo, self.wizletInfo.questions[0].options);

        if (readonly) {
            self.wizletContext.addClass('readonly');
            self.wizletContext.find('[data-buttons]').addClass('ssc-button--hide');
        }
    };

    SingleSelect.prototype.buttonClicked = function (button, options) {
        var self = this;
        if (button.id === "singleSelectclearButton") {
            self.enableDisableButtons(options, false);
            if ($(button).hasClass('buttonDisabled')) {
                return;
            }

            var $selectedOption = options.context.find('[data-singleSelectComponent]').find('[data-optionContainer].clicked');

            $selectedOption.find('[data-leftPanel]').animate({
                backgroundColor: '#fff'
            }, 500);

            $selectedOption.find('[data-leftPanel]').find('[data-leftPanelLabel]').animate({
                color: '#00aeef'
            }, 500);

            $selectedOption.find('[data-rightPanel]').animate({
                backgroundColor: '#dcdedd'
            }, 500);

            $selectedOption.find('[data-accordionContainer]').animate({
                backgroundColor: '#dcdedd'
            }, 500);
            $selectedOption.removeClass('clicked');
            $(button).removeClass('buttonEnabled').addClass('buttonDisabled').attr('data-enabled', "true");

            var questionName = $selectedOption.attr('question-name');
            self.removeVotes(questionName);
            self.setSavedMessage(true);

        } else if (button.id === "singleSelectsubmitButton") {
            self.setSavedMessage(false);
        }
    };
    
    SingleSelect.prototype.removeVotes = function (questionName) {
        var self = this;

        if (questionName.indexOf('calc:') === 0) {
            questionName = questionName.replace("calc:", "");
            self.binders.calcBinderInstance.setValue(questionName, 0);
        }
        else {
            questionName = questionName.replace("db:", "");
            if (questionName.indexOf('ASSESS.') === 0) {
                self.wizerApi.clearAssessment(questionName.replace('ASSESS.', ''), self.wizletInfo.bindingParticipantEmail ? self.wizletInfo.bindingParticipantEmail : null, self.wizletInfo.bindingParticipant);
            } else {
                var questionId = self.wizerApi.getQuestionIdByName(questionName);
                self.wizerApi.removeVotes({ votes: [{ questionId: questionId }] });
            }
        }
    };

    SingleSelect.prototype.setSavedMessage = function (clearMessage) {
        var self = this;
        var confirmMsg;
        var $submitButton = self.wizletContext.find('[data-sscbuttons]').find('[data-submitButton]');
        var $submitText = $submitButton.find('[data-sscSubmitbuttontext]');
        if ($submitText.length <= 0) return;
        if (clearMessage) {
            if (self.wizletInfo.buttons) {
                confirmMsg = self.wizletInfo.buttons[0].message;
            }
            if (!confirmMsg) confirmMsg = "Submit";
            if (self.componentVersion < 2) {
                // currently not implemented in version 1
            } else {
                $submitButton.removeClass('clicked-saved');
                $submitText.removeClass('ssc-savedmessage');
                $submitText.html(confirmMsg);
            }
        } else {
            if (self.wizletInfo.buttons) {
                confirmMsg = self.wizletInfo.buttons[0].message;
            }
            if (!confirmMsg) confirmMsg = "Saved";
            if (self.componentVersion < 2) {
                // currently not implemented in version 1
            } else {
                $submitButton.addClass('clicked-saved');
                $submitText.addClass('ssc-savedmessage');
                $submitText.html(confirmMsg);
            }
        }
    };

    SingleSelect.prototype.enableDisableButtons = function (options, optionClicked) {
        var submitButton = options.context.find('[data-submitbutton]');
        var clearButton = options.context.find('[data-clearaction]');
        if (optionClicked) {
            submitButton.removeClass('ssc-button--disabled');
            clearButton.removeClass('ssc-button--disabled');
        } else {
            submitButton.addClass('ssc-button--disabled');
            clearButton.addClass('ssc-button--disabled');
        }
    };

    SingleSelect.prototype.dataBinderCallback = function () {
        var loading = new Q.defer();
        this.renderOptionsAsPerVersion(this.wizletContext, this.wizletInfo);
        loading.resolve(true);
        return loading.promise;
    };

    SingleSelect.findBindingFromOption = function (wizletInfo, qNo, optionNo) {
        var binding = wizletInfo.questions[qNo].options[optionNo];
        if (wizletInfo.bindings[binding.value]) { // we prefer if bindings are made on the value, but it also works if on the name
            return wizletInfo.bindings[binding.value];
        } else {
            return wizletInfo.bindings[binding.name];
        }
    };

    SingleSelect.prototype.findJsonVersion = function (wizletInfo) {
        if (SingleSelect.findBindingFromOption(wizletInfo, 0, 0).renderOptions.label) {
            return 1;
        }
        else {//This is the first version created by us which cannot be edited in the authoring tool
            return 2;
        }
    };

    SingleSelect.prototype.renderOptionsAsPerVersion = function (context, wizletInfo) {
        var optionRow, leadRow, showLeadRow;
        context.find('*[data-binding]').each(function () {
            var renderContext = $(this);
            optionRow = renderContext.parent();
            var optionNo = Number(renderContext.attr('data-option'));
            var version = renderContext.attr('data-component-version');
            var desc = '';
            var title = '';
            var leadText = '';
            if (version == 1) {
                var binding = SingleSelect.findBindingFromOption(wizletInfo, 0, optionNo - 1);
                desc = binding.renderOptions.label;
                title = binding.renderOptions.title;
                leadText = binding.renderOptions.leadText;
            }
            else {
                desc = wizletInfo.questions[0].options[optionNo - 1].description;
                title = wizletInfo.questions[0].options[optionNo - 1].title;
                leadText = wizletInfo.questions[0].options[optionNo - 1].leadText;
            }
            renderContext.find('[data-leftPanel]').find('[data-leftPanelLabel]').html(desc);
            renderContext.find('[data-rightPanel]').find('[data-rightPanelLabel]').html(title);
            renderContext.find('[data-leadTextPanel]').find('[data-leadTextLabel]').html(leadText);
        });

		if(optionRow)
			optionRow.hide();
        setTimeout(function () {
            $(context.find('*[data-binding]')[0]).parent().show();
        }, 10);


        context.find('*[data-leadbinding]').each(function () {
            var renderContext = $(this);
            leadRow = renderContext.parent();
            var optionNo = Number(renderContext.attr('data-option'));
            var version = renderContext.attr('data-component-version');
            var leadText = '';
            if (version == 1) {
                var binding = SingleSelect.findBindingFromOption(wizletInfo, 0, optionNo - 1);
                leadText = binding.renderOptions.leadText;
            }
            else {
                leadText = wizletInfo.questions[0].options[optionNo - 1].leadText;
            }

            renderContext.find('[data-leadTextPanel]').find('[data-leadTextLabel]').html(leadText);

            if (leadText && leadText.length > 0)
                showLeadRow = true;
            else
                showLeadRow = false;
        });

        if (leadRow) {
            leadRow.hide();
            if (showLeadRow) {
                setTimeout(function () {
                    $(context.find('*[data-leadbinding]')[0]).parent().show();
                }, 10);
            }
        }

    }

    SingleSelect.getRegistration = function () {
        return new SingleSelect();
    };

    return SingleSelect;

});