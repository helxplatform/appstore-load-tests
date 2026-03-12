const { Step } = require('../lib/steps');
const { SELECTORS, TIMEOUTS } = require('../lib/selectors');
const { WorkspacesPage } = require('../pages/workspaces-page');

/**
 * Launches the selected app by clicking its Launch button.
 *
 * Preconditions:
 *   - User is logged in, app grid visible
 *   - ctx.state.selectedApp is set
 * Postconditions:
 *   - App appears in Active tab table
 *   - ctx.state.appRow is set to the table row locator
 */
class LaunchAppStep extends Step {
    name = 'Launch App';

    async run(ctx) {
        const { page } = ctx;
        const appName = ctx.state.selectedApp;

        const workspacesPage = new WorkspacesPage(page);
        await workspacesPage.verifyAvailableTabLoaded();
        
        await workspacesPage.launchApp(appName);

        const appRow = await workspacesPage.getActiveAppRow(appName);

        ctx.state.appRow = appRow;
    }
}

module.exports = LaunchAppStep;
