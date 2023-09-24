'use strict';

angular.module('bahmni.reports')
    .controller('ReportsController', ['$scope', 'appService', 'reportService', 'FileUploader', 'messagingService', 'spinner', '$rootScope', 'auditLogService', function ($scope, appService, reportService, FileUploader, messagingService, spinner, $rootScope, auditLogService) {
        const format = _.values(reportService.getAvailableFormats());
        const dateRange = _.values(reportService.getAvailableDateRange());

        $scope.uploader = new FileUploader({
            url: Bahmni.Common.Constants.uploadReportTemplateUrl,
            removeAfterUpload: true,
            autoUpload: true
        });
        $scope.uploader.onSuccessItem = function (fileItem, response) {
            fileItem.report.reportTemplateLocation = response;
        };

        $rootScope.default = _.isUndefined($rootScope.default) ? {
            reportsRequiringDateRange: {
                responseType: format[1],
                dateRangeType: dateRange[0],
                startDate: dateRange[0],
                stopDate: dateRange[0],
                report: {
                    responseType: format[1]
                }
            },
            reportsNotRequiringDateRange: {}
        } : $rootScope.default;
        $scope.reportsDefined = true;
        $scope.enableReportQueue = appService.getAppDescriptor().getConfigValue("enableReportQueue");
        $scope.setDefault = function (item, header) {
            var setToChange = header === 'reportsRequiringDateRange' ? $rootScope.reportsRequiringDateRange : $rootScope.reportsNotRequiringDateRange;
            setToChange.forEach(function (report) {
                if (item == 'dateRangeType') {
                    $rootScope.default.reportsRequiringDateRange.startDate = $rootScope.default[header][item];
                    $rootScope.default.reportsRequiringDateRange.stopDate = isPreviousMonth($rootScope.default[header][item]) ? getPreviousMonthEndDate() : dateRange[0];
                    report['startDate'] = $rootScope.default[header][item];
                    report['stopDate'] = isPreviousMonth($rootScope.default[header][item]) ? getPreviousMonthEndDate() : dateRange[0];
                }
                else if ($rootScope.default[header][item] === undefined) {
                    $rootScope.reportsRequiringDateRange.forEach(function (report) {
                        report.startDate = dateRange[0];
                        report.stopDate = isPreviousMonth(dateRange[0]) ? getPreviousMonthEndDate() : dateRange[0];
                        report.responseType = format[1];
                    });
                }
                else {
                    report[item] = $rootScope.default[header][item];
                }
            });
        };

        var isPreviousMonth = function (date) {
            return (new Date(date).getMonth() === new Date().getMonth() - 1 && new Date(date).getFullYear() === new Date().getFullYear())
                || (new Date(date).getMonth() === 11 && new Date(date).getFullYear() === new Date().getFullYear() - 1);
        };

        var getPreviousMonthEndDate = function () {
            return new Date(new Date().getFullYear(), new Date().getMonth(), 0);
        };

        var isDateRangeRequiredFor = function (report) {
            return _.find($rootScope.reportsRequiringDateRange, { name: report.name });
        };

        var validateReport = function (report) {
            if (!report.responseType) {
                messagingService.showMessage("error", "Select format for the report: " + report.name);
                return false;
            }
            if (report.responseType === 'application/vnd.ms-excel-custom' && !report.reportTemplateLocation) {
                if (!report.config.macroTemplatePath) {
                    messagingService.showMessage("error", "Workbook template should be selected for generating report: " + report.name);
                    return false;
                }
                report.reportTemplateLocation = report.config.macroTemplatePath;
            }
            report.startDate = Bahmni.Common.Util.DateUtil.getDateWithoutTime(report.startDate);
            report.stopDate = Bahmni.Common.Util.DateUtil.getDateWithoutTime(report.stopDate);
            if (isDateRangeRequiredFor(report) && (!report.startDate || !report.stopDate)) {
                var msg = [];
                if (!report.startDate) {
                    msg.push("start date");
                }
                if (!report.stopDate) {
                    msg.push("end date");
                }
                messagingService.showMessage("error", "Please select the " + msg.join(" and "));
                return false;
            }
            if (report.type == 'concatenated' && report.responseType == reportService.getMimeTypeForFormat('CSV')) {
                messagingService.showMessage('error', 'CSV format is not supported for concatenated reports');
                return false;
            }
            return true;
        };

        $scope.downloadReport = function (report) {
            if (validateReport(report)) {
                reportService.generateReport(report);
                if (report.responseType === 'application/vnd.ms-excel-custom') {
                    report.reportTemplateLocation = undefined;
                    report.responseType = _.values($scope.formats)[0];
                }
                log(report.name);
            }
        };

        var log = function (reportName) {
            auditLogService.log(undefined, 'RUN_REPORT', { reportName: reportName }, "MODULE_LABEL_REPORTS_KEY");
        };

        $scope.scheduleReport = function (report) {
            if (validateReport(report)) {
                spinner.forPromise(reportService.scheduleReport(report)).then(function () {
                    messagingService.showMessage("info", report.name + " added to My Reports");
                }, function () {
                    messagingService.showMessage("error", "Error in scheduling report");
                });
                if (report.responseType === 'application/vnd.ms-excel-custom') {
                    report.reportTemplateLocation = undefined;
                    report.responseType = _.values($scope.formats)[0];
                }
                log(report.name);
            }
        };

        var initializeFormats = function () {
            var supportedFormats = appService.getAppDescriptor().getConfigValue("supportedFormats") || _.keys(reportService.getAvailableFormats());
            supportedFormats = _.map(supportedFormats, function (format) {
                return format.toUpperCase();
            });
            $scope.formats = _.pick(reportService.getAvailableFormats(), supportedFormats);
        };

        var initializeDateRange = function () {
            var supportedDateRange = appService.getAppDescriptor().getConfigValue("supportedDateRange") || _.keys(reportService.getAvailableDateRange());
            $scope.dateRange = _.pick(reportService.getAvailableDateRange(), supportedDateRange);
        };

        var initialization = function () {
            var reportList = appService.getAppDescriptor().getConfigForPage("reports");
            $rootScope.reportsRequiringDateRange = _.isUndefined($rootScope.reportsRequiringDateRange) ? _.values(reportList).filter(function (report) {
                return !(report.config && report.config.dateRangeRequired === false);
            }) : $rootScope.reportsRequiringDateRange;
            $rootScope.reportsNotRequiringDateRange = _.isUndefined($rootScope.reportsNotRequiringDateRange) ? _.values(reportList).filter(function (report) {
                return (report.config && report.config.dateRangeRequired === false);
            }) : $rootScope.reportsNotRequiringDateRange;
            $scope.reportsDefined = _.values(reportList).length > 0;

            initializeFormats();
            initializeDateRange();
        };

        initialization();
    }]);
