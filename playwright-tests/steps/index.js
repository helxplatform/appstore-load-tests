module.exports = {
    AcquireCsrfTokenStep: require('./acquire-csrf-token'),
    LoginStep: require('./login'),
    GetAvailableAppsStep: require('./get-available-apps'),
    CleanupDanglingAppsStep: require('./cleanup-dangling-apps'),
    LaunchAppStep: require('./launch-app'),
    WaitForAppReadyStep: require('./wait-for-app-ready'),
    GetAppBaseURLStep: require('./get-app-base-url'),
    ConnectToAppStep: require('./connect-to-app'),
    RunWorkflowStep: require('./run-workflow'),
    TeardownAppStep: require('./teardown-app'),
};
