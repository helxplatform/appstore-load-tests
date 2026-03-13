const { Step, normalizeMetricName } = require('../lib/steps');
const { WorkspacesPage } = require('../pages/workspaces-page');

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

    async run(ctx) {
        const { page, vars, events } = ctx;
        const appRow = ctx.state.appRow;
        const appName = ctx.state.selectedApp;
        const appMetricName = normalizeMetricName(appName);

        const workspacesPage = new WorkspacesPage(page);
        const startTime = Date.now();

        try {
            const appPage = await workspacesPage.connectToApp(appRow, vars.appReadyTimeout);

            const elapsed = Date.now() - startTime;
            if (events) {
                events.emit('histogram', `app.${appMetricName}.connect_time`, elapsed);
            }

            ctx.state.appPage = appPage;
        } catch (error) {
            if (events) {
                events.emit('counter', `app.${appMetricName}.connect_failed`, 1);
            }
            throw error;
        }
    }
}

module.exports = ConnectToAppStep;
