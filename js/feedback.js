/* 
    "Plain Feedback" wizlet that takes a template and some data as the only input
    and renders the template with functionality from wizletBase, and nothing else.
*/

define(['jquery', 'Q', 'wizer-api', 'logger', 'wizletBase', 'doT', 'WizerModel'], function ($, Q, WizerApi, log, WizletBase, doT, WizerModel) {

    var Feedback = function () {
        this.type = 'Feedback';
        this.level = 1;
    };

    Feedback.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
        this.wizletInfo = wizletInfo;
        this.wizletContext = wizletContext;
        this.wizerApi = wizerApi;
        this.wizerModel = WizerModel.getInstance() || new WizerModel({ wizerApi: this.wizerApi });
        this.templateDefer = Q.defer();
        var self = this;
        var requirements = [];

        requirements.push(WizletBase.loadTemplate(wizletInfo, 'info_a.dot'));
       
        if (wizletInfo.css) {
            requirements.push('css!' + wizletInfo.css);
        }
        require(requirements, function (doTTemplate, css) {
            self.templateDefer.resolve(doTTemplate);
        });

        return WizletBase.loadHandler({ wizlet: this, render: this.render });
    };

    Feedback.prototype.unloadHandler = function () {
        //unload wizletbase
        WizletBase.unloadHandler({ wizlet: this });
    };

    Feedback.prototype.render = function (options) {
        var self = this;
        var waiting = new Q.defer();
        return self.templateDefer.promise.then(function (template) {
            var qustnIds = [], questions = [], metricQIds = [], metricQNames = [], youSelectedOpns = {};
			
            self.wizletInfo.questions.forEach(function(question) {
                var qsnId =  self.wizerApi.getQuestionIdByName(question.binding);
                qustnIds.push(qsnId);
                questions.push(question.binding);
                youSelectedOpns[qsnId] = question.feedback;
            });

            if(self.wizletInfo.metrics){
                self.wizletInfo.metrics.forEach(function (metricObj) {
                    if(metricObj.question){
                        var qsnId = self.wizerApi.getQuestionIdByName(metricObj.question);
                        metricQNames.push(metricObj.question);
                        questions.push(metricObj.question);
                        metricQIds.push(qsnId);
                    }
                });
            }

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
                    return self.wizerApi.getMyVotesByQuestionName(questions, foremanId);
                }else{
                    return self.wizerApi.getMyVotesByQuestionName(questions);
                }
            })
            .then(function (res) {

                for(var i=0; i < options.wizletInfo.questions.length; i++){
                    if(res.questionMap[questions[i]].value != undefined && res.questionMap[questions[i]].value != 0){
                        options.wizletInfo.questions[i].selected = true;
                    }
                    else{
                        options.wizletInfo.questions[i].selected = false;
                    }
                }
                
                options.wizletInfo.scoreArray = [];
                options.wizletInfo.labelArray = [];
                if (self.wizletInfo.metrics && self.wizletInfo.metrics.length) {
                    self.wizletInfo.metrics.forEach(function (metricObj, ind) {
                        options.wizletInfo.labelArray.push(metricObj.label);
                        if (metricQNames.length > 0 && res.questionMap[metricObj.question] && res.questionMap[metricObj.question].value) {
                            options.wizletInfo.scoreArray.push(res.questionMap[metricObj.question].value);
                        } else {
                            options.wizletInfo.scoreArray.push(metricObj.metricValue);
                        }
                    });
                }

                var fragment = template(options.wizletInfo);
                options.context.html(fragment);

                if (self.wizletInfo.metrics && self.wizletInfo.metrics.length) {
                    self.scorecheck(options);
                }
            });
        })
        .fail(this.wizerApi.showError)
    };

    Feedback.prototype.scorecheck = function(options){
        if (!options.wizletInfo.metrics || !options.wizletInfo.metrics.length) return;
        var scoreval= [];
        for(var i=1; i<=options.wizletInfo.metrics.length; i++){
            var scoretext = options.context.find('.metric_score-' + i).text();
            scoretext = scoretext.trim();
            scoreval.push(scoretext);
            if(scoretext > 0){
                options.context.find('.metric_score-' + i).addClass('positiveVal');
                options.context.find('.metric_score-' + i).html(scoretext);
            }
            else if(scoretext < 0){
                options.context.find('.metric_score-' + i).addClass('negativeVal');
                scoretext = scoretext.replace('-','');
                options.context.find('.metric_score-' + i).html(scoretext);
            }
            else if(scoretext == 0){
                options.context.find('.metric_score-' + i).addClass('zero');
            }

        }
        // options.wizletInfo.metrics.forEach(function (metricObj, ind){
        //     if(metricObj.class)
        //     {
                
        //         ind= ind + 1;
              
        //         console.log(ind,metricObj.class);
        //         if(scoreval[ind-1] > 0){
        //             options.context.find('.metric_score-' + ind).addClass('negativeCost');
        //             options.context.find('.metric_score-' + ind).removeClass('positiveVal');
        //         }
        //         else if(scoreval[ind-1] < 0){
        //             options.context.find('.metric_score-' + ind).addClass('positiveCost');
        //             scoreval[ind-1] = scoreval[ind-1].replace('-','');
        //             options.context.find('.metric_score-' + ind).html(scoreval[ind-1]);  
        //             options.context.find('.metric_score-' + ind).removeClass('negativeVal');
        //         }
        //         else if(scoreval[ind-1] == 0){
        //             options.context.find('.metric_score-' + ind).removeClass('negativeCost');
        //             options.context.find('.metric_score-' + ind).addClass('zero');
        //         }
            
        //     }
        // });
    };

    Feedback.getRegistration = function () {
        return new Feedback();
    };

    return Feedback;

});