const { Step } = require('../lib/steps');
const { SELECTORS, TIMEOUTS } = require('../lib/selectors');
const { WorkspacesPage } = require('../pages/workspaces-page');

/**
 * Cleans up any dangling app instances from previous failed test runs.
 *
 * Preconditions: User is logged in
 * Postconditions: No app instances running, back on Available apps tab
 */
class CleanupDanglingAppsStep extends Step {
    name = 'Cleanup Dangling Apps';

    async run(ctx) {
        const { page, vars } = ctx;

        const workspacesPage = new WorkspacesPage(page);
        
        await workspacesPage.selectActiveTab();
        await workspacesPage.verifyActiveTabLoaded();
        
        const noActiveApps = await workspacesPage.isActiveTabEmpty();
        if (noActiveApps) {
            console.log("No dangling apps found.");
        } else {
            await workspacesPage.stopAllApps(vars.appTeardownTimeout);
            console.log("Dangling apps cleaned up.");
        }

        await workspacesPage.selectAvailableTab();
        await workspacesPage.verifyAvailableTabLoaded();
    }
}

module.exports = CleanupDanglingAppsStep;
