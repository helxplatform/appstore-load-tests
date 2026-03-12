const { StepRunner, createStepContext } = require("./lib/steps");
const { DeploymentConfig } = require("./lib/deployment-config");
const { registry } = require("./lib/app-test-registry");
const {
    AcquireCsrfTokenStep,
    LoginStep,
    GetAvailableAppsStep,
    CleanupDanglingAppsStep,
    LaunchAppStep,
    WaitForAppReadyStep,
    ConnectToAppStep,
    RunWorkflowStep,
    TeardownAppStep,
    GetAppBaseURLStep,
} = require("./steps");

/**
 * Main test flow using step-based execution.
 *
 * Steps:
 * 1. Acquire CSRF Token
 * 2. Login
 * 3. Get Available Apps
 * 4. Cleanup Dangling Apps
 * 5. Launch App (selected via deployment config weights)
 * 6. Wait For App Ready
 * 7. Connect to App (new tab)
 * 8. Run Test (selected via deployment config weights)
 * 9. Teardown App
 */
async function fullUserFlow(page, vuContext, events, _test) {
    const ctx = createStepContext(page, vuContext, events);
    const runner = new StepRunner(ctx);
    const deploymentName = process.env.DEPLOYMENT_NAME || "default";

    // Load and validate deployment config
    const config = new DeploymentConfig(deploymentName);
    registry.validateConfig(config);

    // Set config values on context for steps to use
    ctx.vars.appReadyTimeout = config.appReadyTimeout;
    ctx.vars.appTeardownTimeout = config.appTeardownTimeout;
    ctx.vars.useStaffLogin = config.useStaffLogin;

    // Phase 1: Authentication and app discovery
    await runner.runAll([
        new AcquireCsrfTokenStep(),
        new LoginStep(),
        new GetAvailableAppsStep(),
    ]);

    // Select app from deployment config (filtered to those available in UI)
    const selectedAppConfig = config.selectApp(ctx.state.availableApps);

    if (!selectedAppConfig) {
        console.log(
            `[WARNING] No apps from deployment "${config.name}" are available in the UI. ` +
            `Config apps: ${config.apps.map(a => a.appName).join(", ")}. ` +
            `Available apps: ${ctx.state.availableApps.join(", ")}`
        );
        return;
    }

    // Select test and get the test function
    const selectedTestConfig = config.selectTest(selectedAppConfig);
    const testFn = registry.getTest(selectedAppConfig.appName, selectedTestConfig.name);

    ctx.state.selectedApp = selectedAppConfig.appName;
    ctx.state.selectedWorkflow = {
        name: selectedTestConfig.name,
        fn: testFn,
    };

    console.log(`Selected: ${selectedAppConfig.appName} -> ${selectedTestConfig.name}`);

    // Phase 2: Cleanup
    await runner.run(new CleanupDanglingAppsStep());

    // Phase 3: Launch app and run test
    await runner.runAll([
        new LaunchAppStep(),
        new WaitForAppReadyStep(),
        new GetAppBaseURLStep(),
        new ConnectToAppStep(),
        new RunWorkflowStep(),
        new TeardownAppStep()
    ]);

    console.log("Test completed successfully");
}

module.exports = {
    fullUserFlow,
};
