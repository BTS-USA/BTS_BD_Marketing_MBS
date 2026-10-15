/* 
    "Plain gaugedisplay" wizlet that takes a template and some data as the only input
    and renders the template with functionality from wizletBase, and nothing else.
*/

define(['jquery', 'Q', 'wizer-api', 'wizletBase', 'doT'], function ($, Q, WizerApi, WizletBase, doT) {

    var gaugedisplay = function () {
        this.type = 'gaugedisplay';
        this.level = 1;
    };

    gaugedisplay.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
        this.wizletInfo = wizletInfo;
        this.wizletContext = wizletContext;
        this.wizerApi = wizerApi;

        this.templateDefer = Q.defer();
        var self = this;
        var requirements = [];
        //this.extApi = wizerApiExt.getRegistration(wizerApi);

        if (wizletInfo.templateInEvent) {
            requirements.push('doT!' + 'events/' + wizerApi.eventName() + '/' + wizletInfo.templateInEvent);
        }
        else {// either 1 from templateInEvent or template should be present
            if (wizletInfo.template.toLowerCase().indexOf(wizerApi.eventName().toLowerCase() + "/") == -1 && wizletInfo.template.toLowerCase().indexOf("/wizer/content/wizard/") == -1 && wizletInfo.template.toLowerCase().indexOf('gaugedisplay/test') == -1) {
                // if template is defined in core, load it from theme folder
                var templateName = wizletInfo.template.split("/").pop();
                requirements.push('doT!' + wizletInfo.templatePath + templateName);
            } else {
                requirements.push('doT!' + wizletInfo.template);
            }

        }
        if (wizletInfo.css) {
            requirements.push('css!' + wizletInfo.css);
        }
        require(requirements, function (doTTemplate, css) {
            self.templateDefer.resolve(doTTemplate);
        });

        return WizletBase.loadHandler({ wizlet: this, render: this.render });
    };

    gaugedisplay.prototype.unloadHandler = function () {
        //unload wizletbase
        WizletBase.unloadHandler({ wizlet: this });
        //$(document).off("wizer:model:change", this.reRender);
        $(document).off("wizer:Wizletbase-databinder-refresh");
    };

    gaugedisplay.prototype.render = function (options) {
        var self = this;
        return self.templateDefer.promise.then(function (template) {
            var fragment = template(options.wizletInfo);
            options.context.html(fragment);
            var qustnIds = [];
            var impactQuestions = [];
            var resValue = [];
            var count = 1;
			
				$(".gauge-icon").off("click").on("click",function(){
					$(".gauges").toggleClass("open");
                });
                
                self.wizletInfo.labels.forEach(function(label) {
                    if(label.metricBinding){
                        var qsnId =  self.wizerApi.getQuestionIdByName(label.metricBinding);
                        qustnIds.push(qsnId);
                        impactQuestions.push(label.metricBinding);
                    }
                });                

                if(impactQuestions.length > 0){
                    var getForman = new Q.defer();
                    if(self.wizletInfo.trackQuestion){
                        var trackQId = self.wizerApi.getQuestionIdByName(self.wizletInfo.trackQuestion);
                        getForman = self.wizerApi.getForemanId(trackQId);
                    }else{
                        var tempDefer = getForman;
                        getForman = getForman.promise;
                        tempDefer.resolve(true);
                    }
                    getForman.then(function (result) {
                        if(self.wizletInfo.trackQuestion){
                            var foremanId = result;
                            return self.wizerApi.getMyVotesByQuestionName(impactQuestions, foremanId);
                        }else{
                            return self.wizerApi.getMyVotesByQuestionName(impactQuestions);
                        }
                    })
                    .then(function (res) {
                        for( var i=0; i<self.wizletInfo.labels.length; i++){
                            var val = res.questionMap[impactQuestions[i]].value;
                            if(val > 0){
                                options.context.find('.scenario-metric' + i).addClass('positive').html(val);
                            }
                            else if(val < 0){
                                options.context.find('.scenario-metric' + i).addClass('negative');
                                val = val.replace('-','');
                                options.context.find('.scenario-metric' + i).html(val);
                            }
                            else if(val == 0){
                                options.context.find('.scenario-metric' + i).addClass('neutral').html(val);
                            }
                        }
                    });
                }
                // $(document).off("wizer:Wizletbase-databinder-refresh").on("wizer:Wizletbase-databinder-refresh", function (e, value) {

                //     for( var i=0; i<self.wizletInfo.labels.length; i++){
                //         var qsnId =  self.wizerApi.getQuestionIdByName(self.wizletInfo.labels[i].binding);
                //         qustnIds.push(qsnId);
                //         qName.push(self.wizletInfo.labels[i].binding);
                //     }
                    
                //     self.wizerApi.getMyVotes(qustnIds).then(function (qsn) {
                //         var votes = qsn.votes;

                //         for( var i=0; i<self.wizletInfo.labels.length; i++){
                //             resValue.push(qsn.responses[qustnIds[i]][0].responseText);
                //             options.context.find('[data-binding="' + qName[i] + '"]').find("span").html(resValue[i]);
                //         }
                //     });
                // });
            return true;
        })
        .fail(this.wizerApi.showError)
    };
    gaugedisplay.prototype.reRender = function(ev){
        var self = ev.data.self;
        self.templateDefer.promise.then(function(template) {
            //self.getValues(self).then(function(){
                var fragment = template(self.wizletInfo);
                self.wizletContext.html(fragment);
            //})
            
        });
    };

    gaugedisplay.getRegistration = function () {
        return new gaugedisplay();
    };

    return gaugedisplay;

});
