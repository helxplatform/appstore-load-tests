const { Step, normalizeMetricName } = require('../lib/steps');
const { WorkspacesPage } = require('../pages/workspaces-page');

/**
 * Waits for the launched app to become ready.
 * Polls the status column until ready, failed, or timeout.
 *
 * Preconditions:
 *   - App has been launched
 *   - ctx.state.selectedApp is set
 * Postconditions:
 *   - App status is "ready" (success)
 */
class WaitForAppReadyStep extends Step {
    name = 'Wait For App Ready';

    async run(ctx) {
        const { page, vars, events } = ctx;
        const appName = ctx.state.selectedApp;
        const appMetricName = normalizeMetricName(appName);

        const workspacesPage = new WorkspacesPage(page);

        try {
            const elapsed = await workspacesPage.waitForAppReady(appName, vars.appReadyTimeout);

            if (events) {
                events.emit('histogram', `app.${appMetricName}.startup_time`, elapsed);
            }
        } catch (error) {
            if (events) {
                if (error.message.includes('failed to start')) {
                    events.emit('counter', `app.${appMetricName}.launch_failed`, 1);
                } else if (error.message.includes('failed to become ready')) {
                    events.emit('counter', `app.${appMetricName}.startup_timeout`, 1);
                }
            }
            throw error;
        }
    }
}

module.exports = WaitForAppReadyStep;
