/* jshint jquery:true, strict: false */
/* global define: false */
define(function () {
    function textArea(options) {
        var textBox = options.el.find('textarea'),
            counter, clearButton, submitButton, value, placeholder,
            initLength = 0,
            reportView = options.renderOptions && options.renderOptions.reportView;
        var content = options.el.find('textarea');

        var updatePlaceHolder = function (textBox, placeholderOption) {
            if (!placeholderOption) return;

            //"<span class="editableText" data-key="Placeholder">Placeholder for text field</span>"

            var placeholder = placeholderOption.match("<span class=\"editableText[^>]*>(.*)</span>");
            if (placeholder && placeholder.length > 1) {
                textBox.attr('placeholder', placeholder[1])
            } else {
                textBox.attr('placeholder', placeholderOption);
            }
        }

        if (options.renderOptions && options.renderOptions.initText) { initLength = options.renderOptions.initText.length }
        else { initLength = 0; }

        if (textBox.length === 0) {
            var elem = reportView ? '<div>' : '<textarea>';
            if (options.renderOptions && options.renderOptions.class) {
                // Create the textarea element with class
                textBox = $(elem, {
                    class: options.renderOptions.class || "textAreaAD-textArea"
                });
            } else {
                textBox = $(elem, {
                    class: "textAreaAD-textArea"
                });
            }
            if (reportView) {
                textBox.addClass("report-view");
            }
            //options.el.append(textBox);

            textBox.on('keyup', function () {
                $(this).attr('data-value', textBox.val());

            });

            if (options.renderOptions) {
                // Set initial value if exists in xml
                if (options.renderOptions.initText) textBox.val(options.renderOptions.initText);

                // Set placeholder if no initial value
                if (!options.renderOptions.initText && options.renderOptions.placeholder) {
                    updatePlaceHolder(textBox, options.renderOptions.placeholder)
                };
                
                parentDiv = $('<div>', {
                    class: "ifc-textarea-wrapper"
                })
                options.el.prepend(parentDiv);

                parentDiv.prepend(textBox);

                //Create Title


                // Create remaining character section
                if (options.renderOptions.maxCharacters && !options.renderOptions.reportView) {
                    textBox.attr("maxlength", options.renderOptions.maxCharacters.maxValue);
                    counter = $('<div>', {
                        class: options.renderOptions.maxCharacters.class || "textAreaAD__messageLength",
                    }).prepend($('<span>', {
                        class: "textAreaAD__messageLength-counter",
                        text: options.renderOptions.maxCharacters.maxValue - initLength
                    })).append($('<span>', {
                        class: "textAreaAD__messageLength-counter-characters-remaining",
                        html: options.renderOptions.maxCharacters.text?options.renderOptions.maxCharacters.text.trim():"characters remaining"
                    }));
                    parentDiv.append(counter);

                    // Calculate remaining characters
                    function countRemainingCharacter() {
                        var limit = options.renderOptions.maxCharacters.maxValue,
                            currentNumber = textBox.val().length;
                        counter.find('span.textAreaAD__messageLength-counter').text(limit - currentNumber);
                    }
                    textBox.on('keyup', function () {
                        countRemainingCharacter();
                        if (textBox.val().length == 0 && textBox.val() === "" && options.renderOptions.placeholder) {
                            updatePlaceHolder(textBox, options.renderOptions.placeholder)
                        }
                    });
                    textBox.on('paste', function () {
                        countRemainingCharacter();
                        if (textBox.val().length == 0 && textBox.val() === "" && options.renderOptions.placeholder) {
                            updatePlaceHolder(textBox, options.renderOptions.placeholder)
                        }
                    });
                }

                if(options.renderOptions.title){
                    title = $('<div>', {
                        class: "ifc-label cl-label",
                        html: options.renderOptions.title
                    })
                    parentDiv.prepend(title);
                }
                // Create Time Stamp
                if (options.renderOptions.showTimeStamp || (options.valueInfo && options.valueInfo.response && options.valueInfo.response.assesseeId !== undefined) || (options.dataBinder && options.dataBinder.binders && options.dataBinder.binders.db && options.dataBinder.binders.db.wizletInfo && options.dataBinder.binders.db.wizletInfo.bindingParticipant !== undefined)) {
                    if ((options.valueInfo && options.valueInfo.response && options.valueInfo.response.timestamp) || (options.valueInfo && options.valueInfo.response && options.valueInfo.response.timeStamp)) {
                        if(options.renderOptions.maxCharacters && !options.renderOptions.reportView){
                            options.el.append($( "<div class='time-stamp time-stamp-msglength'>Last Modified: " + moment(options.valueInfo.response.timestamp || options.valueInfo.response.timeStamp).format('MMM Do h:mm:ss a') + "</div>" ));
                        }else{
                            options.el.append($( "<div class='time-stamp'>Last Modified: " + moment(options.valueInfo.response.timestamp || options.valueInfo.response.timeStamp).format('MMM Do h:mm:ss a') + "</div>" ));
                        }
                    }
                }

                //Create Title
                if (options.renderOptions.clearButton || options.renderOptions.submitButton) {
                    footer = $('<footer>', {
                        class: "ifc-footer cl-footer textAreaAD__controls"
                    });
                    options.el.append(footer);
                }

                // Create and Append Clear button to the footer
                if (options.renderOptions.clearButton) {
                    var wrapper = $('<div>', { class: "textAreaAD__button cl-buttons" });
                    clearButton = $('<div>', {
                        class: options.renderOptions.clearButton.class + " inputComponent__content-clear" || "textAreaAD__button-clear",
                        html: options.renderOptions.clearButton.text || "Clear"
                    });
                    wrapper.append(clearButton);
                    options.el.find('footer').append(wrapper);
                    // Clear textArea
                    clearButton.on('click', function () {
                        setValue(textBox, "", reportView);
                        countRemainingCharacter();
                        textBox.trigger('keyup');
                        var args = {};
                        args.binder = options.dataBinder;
                        args.bindString = options.dataBinder.dataBinderOptions._attributes.source;
                        args.value = textBox.val();
                        args.el = options.el;
                        args.deleteVote = true;
                        options.dataBinder.onViewItemChanged.call(textBox, args);
                    });
                    textBox.trigger('keyup');
                }
                // Create and Append Submit button to the footer
                if (options.renderOptions.submitButton) {
                    var wrapper = $('<div>', { class: "textAreaAD__button" });
                    submitButton = $('<div>', {
                        class: options.renderOptions.submitButton.class + " inputComponent__content-submit" || "textAreaAD__button-submit",
                        html: options.renderOptions.submitButton.text || "Submit"
                    });
                    submitButton.attr('data-pulsesubmitbutton', "");
                    wrapper.append(submitButton);
                    options.el.find('footer').append(wrapper);

                    textBox.on('keyup', function () {
                        if ($(this).val().trim() === "" ) {
                            submitButton.addClass('disabled');
                            if (submitButton.html() != options.renderOptions.submitButton.text) {
                                submitButton.html(options.renderOptions.submitButton.text);
                            }
                            if(options.renderOptions.clearButton){
                                clearButton.addClass('disabled');
                            }
                        } else {
                            submitButton.removeClass('disabled inputSavedMessage clicked-saved');
                            if(options.renderOptions.clearButton){
                                clearButton.removeClass('disabled');
                            }
                            if (submitButton.html() != options.renderOptions.submitButton.text) {
                                submitButton.html(options.renderOptions.submitButton.text);
                            }
                        }
                    }).trigger('keyup');
                    textBox.on("paste", function () {
                        var $this = $(this);
                        setTimeout(function () {
                            $this.trigger("keyup");
                        }, 0);
                    });

                    // Submit data
                    submitButton.on('click', function () {
                        if (textBox.val() !== '') {
                            var args = {};
                            args.binder = options.dataBinder;
                            args.bindString = options.dataBinder.dataBinderOptions._attributes.source;
                            args.value = textBox.val();
                            args.el = options.el;
                            options.dataBinder.onViewItemChanged.call(textBox, args);
                            voteHeatmapEnabled(options);

                            if (options.renderOptions.submitButton.message) {
                                $(this).addClass('inputSavedMessage clicked-saved').html(options.renderOptions.submitButton.message);
                            }

                            if (options.renderOptions.submitButton.clearText || options.renderOptions.submitButton.clearText === undefined) {
                                setValue(textBox, "", reportView);
                                countRemainingCharacter();
                                submitButton.addClass('disabled');
                                if(options.renderOptions.clearButton){
                                    clearButton.addClass('disabled');
                                }
                            }
                        }
                    });
                    submitButton.find('span.editableText').each(function (index, span) {
                        if (Wizer.editMode) { // to enable text editing, turn off submit
                            submitButton.off('click');
                        }
                    });
                } else if (options.renderOptions.submitOnBlur) {
                    textBox.on('blur', function () {
                        if (textBox.val() !== textBox.data('saved-value')) {
                            var args = {};
                            args.binder = options.dataBinder;
                            args.bindString = options.dataBinder.dataBinderOptions._attributes.source;
                            args.value = textBox.val();
                            args.el = options.el;
                            options.dataBinder.onViewItemChanged.call(textBox, args);
                        }
                    });
                }

                if (options.value !== "" && options.value !== undefined) {
                    // Set Initial value to textbox if clearText is false and the question binded to it has votes in db
                    var clearText;
                    if (options.renderOptions.submitButton) {
                        clearText = options.renderOptions.submitButton.clearText;
                        populateTextBoxWithSavedData(clearText, options, textBox, reportView);
                        if (options.renderOptions.maxCharacters && !options.renderOptions.reportView) {
                            countRemainingCharacter();
                        }
                        textBox.trigger('keyup');
                    }
                    else if (options.renderOptions.clearText !== undefined && !options.renderOptions.clearText) {
                        clearText = options.renderOptions.clearText;
                        populateTextBoxWithSavedData(clearText, options, textBox, reportView);
                        if (!clearText && clearText !== undefined) {
                            if (options.renderOptions.maxCharacters && !options.renderOptions.reportView) {
                                countRemainingCharacter();
                            }
                        }
                    }
                }
            }
        }
    }

    function voteHeatmapEnabled(options) {
        var db = options.dataBinder && options.dataBinder.binders && options.dataBinder.binders.db;
        if (!db || !db.api || !db.wizletInfo || !db.wizletInfo.bindings) return;
        var questionName = "";
        var bindings = db.wizletInfo.bindings;
        for (var key in bindings) {
            if (bindings.hasOwnProperty(key) && bindings[key] && bindings[key].heatmap_enabled) {
                questionName = bindings[key].heatmap_enabled;
                break;
            }
        }
        if (!questionName) return;
        var questionId = db.api.getQuestionIdByName(questionName);
        if (!questionId) return;
        db.api.addVotes({
            votes: [{
                questionId: questionId,
                responseText: "111"
            }]
        });
    }

    function setValue(textBox, value, reportView) {
        if (reportView) {
            textBox.html(value.replace(/(?:\r\n|\r|\n)/g, '<br>'));
        } else {
            textBox.val(value);
        }
        textBox.data('saved-value', value);
    }

    function populateTextBoxWithSavedData(clearText, options, textBox, reportView) {
        if (clearText || clearText === undefined) {
            setValue(textBox, "", reportView);
        }
        else {
            var votes = options.value;
            if (votes === '' || votes === undefined) {
                setValue(textBox, "", reportView);
            }
            else {
                if (typeof votes === "string") {
                    setValue(textBox, votes, reportView);
                }
                else {
                    setValue(textBox, votes[votes.length - 1], reportView);
                }
            }
        }
    }

    textArea.destroy = function (element) {
        var textBox = element.find('textArea');
        textBox.unbind();
        textBox.off();
    }

    return textArea;
});


