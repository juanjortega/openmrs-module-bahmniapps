angular.module('opd.consultation')
.directive('observationSummary',function () {
    return {
        restrict:'E',
        scope:{
            observation:"=",
            patientUuid:"=",
            showTrends:"=",
            hideParentObsName:"@"
        },
        //not able to use templateUrl, because of recurssive use of directive. Not sure what the error is.
        template: '<ng-include src="\'../consultation/modules/consultation/views/observationSummaryTemplate.html\'" />',
        link: function(scope,element,attrs){
            if(scope.showTrends){
                scope.isNumeric = function(value){
                    return $.isNumeric(value);
                }
            }
            if(!scope.hideParentObsName) {
                scope.hideParentObsName = false;
            }
        }
    }
});