const { Step } = require('../lib/steps');
const { SELECTORS, TIMEOUTS } = require('../lib/selectors');
const { WorkspacesPage } = require('../pages/workspaces-page');

/**
 * Retrieves the list of available apps from the workspaces grid.
 *
 */
class GetAvailableAppsStep extends Step {
    name = 'Get Available Apps';

    async run(ctx) {
        const { page } = ctx;

        const workspacesPage = new WorkspacesPage(page);

        const appNames = await workspacesPage.getAvailableAppNames();

        ctx.state.availableApps = appNames;
    }
}

module.exports = GetAvailableAppsStep;
