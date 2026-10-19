/* 
    "Plain Info" wizlet that takes a template and some data as the only input
    and renders the template with functionality from wizletBase, and nothing else.
*/

define(['jquery', 'Q', 'wizer-api', 'logger', 'wizletBase', 'doT'], function ($, Q, WizerApi, log, WizletBase, doT) {

    var Scorecard = function () {
        this.type = 'scorecard';
        this.level = 1;
    };

    Scorecard.prototype.loadHandler = function (unused, wizletInfo, wizletContext, wizerApi) {
        this.wizletInfo = wizletInfo;
        this.wizletContext = wizletContext;
        this.wizerApi = wizerApi;
        this.templateDefer = Q.defer();
        var self = this;
        var requirements = [];
        requirements.push(WizletBase.loadTemplate(wizletInfo, 'scorecard.dot'));

        if (wizletInfo.css) {
            requirements.push(WizletBase.loadCss(wizletInfo));
        }
        require(requirements, function (doTTemplate, css) {
            self.templateDefer.resolve(doTTemplate);
        });

        return WizletBase.loadHandler({ wizlet: this, render: this.render });
    };

    Scorecard.prototype.unloadHandler = function () {
        //unload wizletbase
        WizletBase.unloadHandler({ wizlet: this });
    };

    Scorecard.prototype.render = function (options) {
        var self = this;
        var waiting = new Q.defer();
        self.templateDefer.promise.then(function (template) {

            var fragment = template(options.wizletInfo);
            options.context.html(fragment);
            waiting.resolve(true);

            var trackQuestion = self.wizletInfo.trackQuestion;
            self.trackQuestionId = self.wizerApi.getQuestionIdByName(trackQuestion);

            self.wizerApi.getTrackParticipants(self.trackQuestionId).then(function (response) {
                self.verity_score = 0;
                var name = Wizer.ParticipantName;
                var email = (Wizer.ParticipantEmail.indexOf('@') > -1 ? Wizer.ParticipantEmail : Wizer.ParticipantEmail + '@bts.com').toLowerCase();
                var learderId = '';

                if (response && response.participants && response.foremanId != Wizer.ParticipationId) {
                    var leader = response.participants[response.foremanId];
                    if (leader) {
                        learderId = (leader.Email.indexOf('@') > -1 ? leader.Email : leader.Email + '@bts.com').toLowerCase();
                    }
                }

                var markHeatmapComplete = function () {
                    if (!self.wizletInfo.heatmapEnabled) {
                        return;
                    }
                    var qId = self.wizerApi.getQuestionIdByName(self.wizletInfo.heatmapEnabled);
                    if (qId) {
                        self.wizerApi.addVote(qId, '111');
                    }
                };

                // Followers: CocaCola-style observe URL (followerScreen) — no chat
                // Leaders: IsomerPulse chat via GetVerityUrlsV2
                if (learderId != '') {
                    self.wizerApi.getVerityUrl(email, name, learderId, Wizer.EventName).then(function (response) {
                        if (response.GetVerityUrlsResult && response.GetVerityUrlsResult.success) {
                            var verityLink;
                            // Match CocaCola: enableFollowerScreen false → followerScreen;
                            // enableFollowerScreen true (follower action) still uses followerScreen
                            // for IsomerPulse so followers mirror/observe and cannot chat.
                            if (self.wizletInfo.enableFollowerScreen === true) {
                                verityLink = response.GetVerityUrlsResult.followerScreen
                                    || response.GetVerityUrlsResult.scorecard1;
                            } else {
                                verityLink = response.GetVerityUrlsResult.followerScreen;
                            }
                            if (verityLink) {
                                self.wizletContext.find('[data-src]').attr('src', verityLink);
                                markHeatmapComplete();
                            }
                        }
                    });
                } else {
                    var environment = self.wizletInfo.environment ? self.wizletInfo.environment : "production";
                    var body = {
                        botId: self.wizletInfo.botId,
                        userId: Wizer.ParticipantEmail,
                        email: email,
                        name: name,
                        eventName: Wizer.EventName,
                        type: "IsomerPulse",
                        environment: environment,
                    };
                    self.getVerityUrl(body).then(function (data) {
                        var verityLink = data.GetVerityUrlsV2Result.chatUrl;
                        self.wizletContext.find('[data-src]').attr('src', verityLink);
                        markHeatmapComplete();
                    }).catch(function (err) {
                        console.log(err);
                    });
                }
            });

        })
            .fail(self.wizerApi.showError);
        return waiting.promise;
    };

    Scorecard.prototype.getParam = function (name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results == null) {
            return null;
        }
        else {
            return decodeURI(results[1]) || 0;
        }
    }

    Scorecard.prototype.getVerityUrl = function (obj) {
        var self = this;
        var url = '/PulseServices/Authenticate.svc/GetVerityUrlsV2';
        return new Promise(function (resolve, reject) {
            $.ajax({
                type: 'POST',
                url: url,
                contentType: 'application/json',
                data: JSON.stringify(obj),
                success: function (data) {
                    if (data) {
                        resolve(data)
                    } else {
                        resolve(false)
                    }
                }
            })
        });
    }

    Scorecard.getRegistration = function () {
        return new Scorecard();
    };

    return Scorecard;

});
