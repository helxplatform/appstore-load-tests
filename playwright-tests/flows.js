const path = require("path");
const { StepRunner, createStepContext, normalizeMetricName } = require("./lib/steps");
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

const VIDEO_DIR = path.resolve(__dirname, "..", "videos");

/**
 * Delete recorded video for a page.
 */
async function deleteVideo(page) {
    try {
        await page.video()?.delete();
    } catch (_) {
        // No video to delete
    }
}

/**
 * Save a page's recorded video to a named file, then remove the original.
 * The page must already be closed before calling this.
 */
async function saveVideoAs(page, filename) {
    try {
        await page.video()?.saveAs(path.join(VIDEO_DIR, filename));
        // Delete old video file (remains on fs).
        await deleteVideo(page);
    } catch (_) {
        // No video to save
    }
}

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
    const username = vuContext.vars.username;

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
        await deleteVideo(page);
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

    /**
     * Phase 3: Launch app and run test
     * 
     * Video strategy: Retain videos of failed app page runs
     * Artillery playwright integration can record using contextOptions but it
     * names the videos with random ids and doesn't support `retain-on-failure`.
     */
    const appMetricName = normalizeMetricName(selectedAppConfig.appName);
    const testMetricName = normalizeMetricName(selectedTestConfig.name);
    const videoFilename = `${username}_${testMetricName}.webm`;
    const appVideoFilename = `${username}_${appMetricName}_${testMetricName}.webm`;

    let appPage = null;
    try {
        await runner.runAll([
            new LaunchAppStep(),
            new WaitForAppReadyStep(),
            new GetAppBaseURLStep(),
            new ConnectToAppStep(),
        ]);

        // Capture reference before workflow/teardown closes it
        appPage = ctx.state.appPage;

        await runner.runAll([
            new RunWorkflowStep(),
            new TeardownAppStep()
        ]);

        try { await page.close(); } catch (_) {}
        try { await appPage.close(); } catch (_) {}
        await deleteVideo(page);
        await deleteVideo(appPage);
    } catch (error) {
        if (appPage) {
            try { await page.close(); } catch (_) {}
            try { await appPage.close(); } catch (_) {}
            await saveVideoAs(page, videoFilename);
            await saveVideoAs(appPage, appVideoFilename);
        }
        throw error;
    }

    console.log("Test completed successfully");
}

module.exports = {
    fullUserFlow,
};
