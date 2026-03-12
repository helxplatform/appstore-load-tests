const { Step } = require('../lib/steps');
const { normalizeMetricName } = require('../lib/steps');

/**
 * Retrieves the base URL for the selected app from the API.
 *
 * Preconditions:
 *   - App has been launched (but not necessarily ready)
 *   - ctx.state.selectedApp is set
 * Postconditions:
 *   - ctx.state.selectedAppBaseURL is set
 */
class GetAppBaseURLStep extends Step {
    name = 'Get App Base URL';

    async before(ctx) {
        if (!ctx.state.selectedApp) {
            throw new Error('Precondition failed: ctx.state.selectedApp not set');
        }
    }

    async run(ctx) {
        const { page, events } = ctx;
        const appName = ctx.state.selectedApp;
        const appMetricName = normalizeMetricName(appName);

        let appBaseURL;
        try {
            const res = await page.request.get(`/api/v1/instances/`);
            const appData = await res.json();
            const launchedApp = appData.find((app) => app.name === appName);
            appBaseURL = launchedApp.url;
        } catch (error) {
            if (events) {
                events.emit('counter', `app.${appMetricName}.resolve_base_url_failed`, 1);
            }
            throw new Error(`Failed to retrieve base URL for app ${appName}: ${error.message}`);
        }

        if (!appBaseURL) {
            if (events) {
                events.emit('counter', `app.${appMetricName}.resolve_base_url_failed`, 1);
            }
            throw new Error(`No base URL returned for app ${appName}`);
        }

        ctx.state.selectedAppBaseURL = appBaseURL;
    }
}

module.exports = GetAppBaseURLStep;
