const { Step, normalizeMetricName } = require('../lib/steps');
const { WorkspacesPage } = require('../pages/workspaces-page');

/**
 * Closes the app tab and terminates the app instance.
 *
 * Preconditions:
 *   - ctx.state.appRow is set
 *   - ctx.state.appPage is set
 * Postconditions:
 *   - App termination is verified
 *   - ctx.state.appPage is closed and removed from state
 *   - ctx.state.appRow is removed from state
 *   - ctx.state.selectedApp is removed from state
 *   - ctx.state.selectedAppBaseURL is removed from state
 */
class TeardownAppStep extends Step {
    name = 'Teardown App';

    async run(ctx) {
        const { page, vars, events } = ctx;
        const appName = ctx.state.selectedApp;
        const appMetricName = normalizeMetricName(appName);
        const startTime = Date.now();

        try {
            await ctx.state.appPage.close();
            delete ctx.state.appPage;
        } catch (error) {
            throw new Error(`Failed to close tab for ${appName}: ${error.message}`);
        }

        await page.bringToFront();

        const workspacesPage = new WorkspacesPage(page);
        await workspacesPage.stopAllApps(vars.appTeardownTimeout);
        
        delete ctx.state.appRow;
        delete ctx.state.selectedApp;
        delete ctx.state.selectedAppBaseURL;

        const elapsed = Date.now() - startTime;
        if (events) {
            events.emit('histogram', `app.${appMetricName}.teardown_time`, elapsed);
        }
    }
}

module.exports = TeardownAppStep;
