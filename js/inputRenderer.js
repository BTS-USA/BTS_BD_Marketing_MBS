define(['jquery', 'Q', 'wizer-api', 'logger', 'wizletBase', 'doT'], function ($, Q, WizerApi, log, WizletBase, doT) {

    var InputRenderer = function () {

    }
    InputRenderer.prototype.init = function (question, context, wizerApi) {
        this.question = question;
        this.renderOptions = question.renderOptions;
        this.context = context;
        this.wizerApi = wizerApi;
        this.el = $(context);
        this.$textBox = this.el.find("[data-input]");
        this.$textBox.val(this.renderOptions.value || "");
        this.$counter = this.el.find("[data-input-counter]");
        this.$remaining = this.el.find("[data-input-remaining]");
        updatePlaceHolder(this.$textBox, this.renderOptions.placeholder);
        this.countRemainingCharacter();
        this.initListeners();
    }
    InputRenderer.prototype.initListeners = function () {
        var self = this;
        self.$textBox.change(function (event) {
            event.stopPropagation();
            self.renderOptions.value = self.$textBox.val();
            self.countRemainingCharacter();
            self.el.trigger("wizer-render-input-change",
                [{ question: self.question.question, input: self.$textBox, value: self.renderOptions.value }]);
        })
            .on('input', function (event) {
                event.stopPropagation();
                self.renderOptions.value = self.$textBox.val();
                self.countRemainingCharacter();
                self.el.trigger("wizer-render-input-update",
                    [{ question: self.question.question, input: self.$textBox, value: self.renderOptions.value }]);
            })
            .on("keyup", function (event) {
                // Number 13 is the "Enter" key on the keyboard
                if (event.keyCode === 13) {
                    // Cancel the default action, if needed
                    event.preventDefault();
                    event.stopPropagation();
                    self.renderOptions.value = self.$textBox.val();
                    self.el.trigger("wizer-render-input-enter",
                        [{ question: self.question.question, input: self.$textBox, value: self.renderOptions.value }]);
                }
            });

        if (self.renderOptions.pattern) {
            //Regex to validate special characters
            self.$textBox.on('keypress', function (event) {
                var regex = new RegExp(self.renderOptions.pattern);
                var key = String.fromCharCode(!event.charCode ? event.which : event.charCode);
                if (!regex.test(key)) {
                    event.preventDefault();
                    return false;
                }
            });
        }
    }
    InputRenderer.prototype.countRemainingCharacter = function () {
        var self = this;
        var limit = self.renderOptions.maxCharacters.maxValue,
            currentNumber = self.renderOptions.value.length;
        this.$counter.text(limit - currentNumber + "");
    }

    function updatePlaceHolder(textBox, placeholderOption) {
        if (!placeholderOption) return;
        var placeholder = placeholderOption.match("<span class=\"editableText[^>]*>(.*)</span>");
        if (placeholder && placeholder.length > 1) {
            textBox.attr('placeholder', placeholder[1]);
        } else {
            textBox.attr('placeholder', placeholderOption);
        }
    }

    return InputRenderer;

});