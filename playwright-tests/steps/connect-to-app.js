const { Step } = require('../lib/steps');
const { SELECTORS, TIMEOUTS } = require('../lib/selectors');
const { normalizeMetricName } = require('../lib/steps');

/**
 * Connects to app once it has become ready to use.
 *
 * Preconditions:
 *   - App has been launched and is ready
 *   - ctx.state.appRow is set
 *   - ctx.state.selectedApp is set
 *   - ctx.state.selectedAppBaseURL is set
 * Postconditions:
 *   - App URL matches expected format
 *   - ctx.state.appPage is set to new tab
 */
class ConnectToAppStep extends Step {
    name = 'Connect To App';

    async before(ctx) {
        if (!ctx.state.appRow) {
            throw new Error('Precondition failed: ctx.state.appRow not set');
        }
        if (!ctx.state.selectedApp) {
            throw new Error('Precondition failed: ctx.state.selectedApp not set');
        }
        if (!ctx.state.selectedAppBaseURL) {
            throw new Error('Precondition failed: ctx.state.selectedAppBaseURL not set');
        }
    }

    async run(ctx) {
        const { page, vars, events } = ctx;
        const appRow = ctx.state.appRow;
        const appName = ctx.state.selectedApp;
        const appMetricName = normalizeMetricName(appName);
        const startTime = Date.now();

        // Setup for waiting for new app tab to be created
        const browserContext = page.context();
        const pagePromise = browserContext.waitForEvent('page');

        await appRow.locator(SELECTORS.activeApps.connectButton).click();

        const appPage = await pagePromise;
        await appPage.bringToFront();

        try {
            await appPage.waitForURL(/\/private\//, {
                timeout: vars.appReadyTimeout,
                waitUntil: 'domcontentloaded'
            });
        } catch (error) {
            if (events) {
                events.emit('counter', `app.${appMetricName}.connect_failed`, 1);
            }
            await appPage.screenshot({ path: 'screenshots/failedconnect.png' });
            throw new Error(`Failed to connect to app ${appName}: ${error.message}`);
        }

        const elapsed = Date.now() - startTime;
        if (events) {
            events.emit('histogram', `app.${appMetricName}.connect_time`, elapsed);
        }

        ctx.state.appPage = appPage;

        console.log(`Successfully connected to ${appName} in ${elapsed}ms`);
    }
}

module.exports = ConnectToAppStep;
