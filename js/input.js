define(['jquery', 'Q', 'wizer-api', 'logger', 'wizletBase', 'doT', 'WizerModel'], function ($, Q, WizerApi, log, WizletBase, doT, WizerModel) {

    var Input = function () {
        this.type = 'Input';
        this.level = 1;
    };

    Input.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
        this.wizletInfo = wizletInfo;
        this.wizletContext = wizletContext;
        this.wizerApi = wizerApi;
        this.wizerModel = WizerModel.getInstance() || new WizerModel({ wizerApi: this.wizerApi });
        this.templateDefer = Q.defer();
        var self = this;
        var requirements = [];
        // this.wizletInfo.ideaID = "549";

        var votes = self.bindDyamicQuestionToTextlist(this.wizletInfo.ideaID);
        
        requirements.push(WizletBase.loadTemplate(wizletInfo, 'input.dot'));

            if (wizletInfo.css) {
                requirements.push(WizletBase.loadCss(wizletInfo));
            }
            require(requirements, function (doTTemplate, css) {
                self.templateDefer.resolve(doTTemplate);
            });
        
            return WizletBase.loadHandler({
                wizlet: this,
                render: this.render
            }).then(function () {
                if (self.readonly) {
                    self.wizletContext.find('.ifc-container').addClass('readonly');
                    self.wizletContext.find('.inputComponentMessageLength').addClass('ifc-message--hide');
                    self.wizletContext.find('.textAreaAD__controls').addClass('ifc-buttons--hide');
                }

            });
    
    };

    Input.prototype.unloadHandler = function () {
        //unload wizletbase
        WizletBase.unloadHandler({ wizlet: this });
    };


    Input.prototype.bindDyamicQuestionToTextlist = function (ideaID) {
        var self = this;
        var completed = new Q.defer();
        if (ideaID) {

            for (var i = 0; i < self.wizletInfo.scope.length; i++) {
                if (self.wizletInfo.scope[i].name) {
                    // scope question get change when call in action container
                    self.wizletInfo.scope[i].name = self.wizletInfo.scope[i].name + "_" + self.wizletInfo.ideaID;
                } else {
                    self.wizletInfo.scope[i] = self.wizletInfo.scope[i] + "_" + self.wizletInfo.ideaID;
                }

            }

            self.wizletInfo.header.title = self.wizletInfo.ideaText;


            for (var key in self.wizletInfo.bindings) {
                if (self.wizletInfo.bindings.hasOwnProperty(key)) {
                    self.wizletInfo.bindings[key].bind = self.wizletInfo.bindings[key].bind + "_" + self.wizletInfo.ideaID;
                }
            }
            completed.resolve(true);

        } else {

            completed.resolve(true);
        }
        return completed.promise;
    }


    Input.prototype.render = function (options) {
        var self = this;
        return self.templateDefer.promise.then(function (template) {
            var fragment = template(options.wizletInfo);

            options.context.html(fragment);

            if (self.wizletInfo.readOnlyCondition) {
                self.checkForReadOnlyCondition();
            }
            if (self.wizletInfo.ideaID) {
                options.context.find('[data-maincontainer]').removeClass("ifc-container cl-container").addClass("ifc-container cl-container inputTextareaAlignment");
            } else {
                options.context.find('[data-maincontainer]').removeClass("ifc-container cl-container inputTextareaAlignment").addClass("ifc-container cl-container");
            }
            
            return true;
        })
        .fail(this.wizerApi.showError)
    };

    Input.prototype.checkForReadOnlyCondition = function () {
        this.readonly = this.wizerModel.checkForReadOnlyCondition(this.wizletInfo, this.wizletInfo.questions);
    };

    Input.getRegistration = function () {
        return new Input();
    };

    return Input;

});