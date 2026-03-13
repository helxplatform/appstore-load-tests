const { TIMEOUTS } = require('../lib/selectors');
const { Step } = require('../lib/steps');
const { LoginPage } = require('../pages/login-page');
const { WorkspacesPage } = require('../pages/workspaces-page');

/**
 * Navigates to workspaces and logs in via the UI.
 *
 * Preconditions: CSRF token acquired
 * Postconditions: User is logged in, workspaces app grid is visible
 */
class LoginStep extends Step {
    name = 'Login';

    async run(ctx) {
        const { page, vars } = ctx;
        const target = vars.target || process.env.ARTILLERY_TARGET;
        const { username, password, useStaffLogin } = vars;

        const loginPage = new LoginPage(page, target);
        const workspacesPage = new WorkspacesPage(page);

        if (useStaffLogin) {
            await loginPage.navigateToAdminURL();
            await loginPage.adminLogin(username, password);
            await loginPage.verifyLoginSuccess();
            
            await loginPage.navigateToBaseURL();
            await workspacesPage.selectAvailableTab();
        } else {
            await loginPage.navigateToBaseURL();
            await loginPage.goToLogin();
            await loginPage.formLogin(username, password);
            await loginPage.verifyLoginSuccess();
            
            // Check that login has completed successfully.
            // Timeout should be extra generous to factor in login time.
            await workspacesPage.verifyAvailableTabLoaded(TIMEOUTS.superLong);
        }

    }
}

module.exports = LoginStep;
