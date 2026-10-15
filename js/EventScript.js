define(['jquery', 'Q', 'WizerModel'], function ($, Q, WizerModel) {
    var teamNameQuestion = "Team_Name";
    var teamName;

    // If all participants add team name
   
    $(document).bind("wizer:action:init", function (e, currentAction) {
        if (teamName) return;
        var $participantDiv = document.getElementById("menuParticipantName");
        self.wizerApi.getMyVotesByQuestionName([teamNameQuestion]).then(function (res) {
            if (res.success) {
                teamName = res.questionMap[teamNameQuestion].value;
                var originalName = res.participantName || "";
                if ($participantDiv && teamName) $participantDiv.innerHTML = originalName ? (originalName + ": " + teamName) : teamName;
            }
        });
    });

    // If need to add foreman team name
    // var trackQuestion = "Team_Track";
    // $(document).bind("wizer:action:init", function (e, currentAction) {
    //     if (teamName) return;
        
    //     var trackQuestionId = self.wizerApi.getQuestionIdByName(trackQuestion);
    //     var $participantDiv = document.getElementById("menuParticipantName");
    //     var wizerModel = WizerModel.getInstance() || new WizerModel({ wizerApi: self.wizerApi });

    //     self.wizerApi.getForemanId(trackQuestionId).then(function (foremanId) {
    //         wizerModel.getMyVotesByQuestionName([teamNameQuestion], foremanId).then(function (res) {
    //             if (res.success) {
    //                 teamName = res.questionMap[teamNameQuestion].value;
    //                 copyVotesFromLeader(teamName);
    //                 if ($participantDiv && teamName) $participantDiv.innerHTML = teamName;
    //             }
    //         });
    //     });        
    // });

    function copyVotesFromLeader(name){
        if(!name) return;
        self.wizerApi.getMyVotesByQuestionName([teamNameQuestion]).then(function (res) {
            var q = res.questionMap[teamNameQuestion];
            var myTeamName = q.value;
            if(name != myTeamName){
                var votes = {votes:[{questionId:q.qid, responseText:name}]};
                self.wizerApi.addVotes(votes);
            }
        });

    }

});

