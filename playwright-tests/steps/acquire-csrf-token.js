const { Step } = require('../lib/steps');
const { SecurityPage } = require('../pages/security-page')

/**
 * Acquires a CSRF token by visiting the Django admin login page
 * (CSRF token does not get set until Django serves a backend page,
 * doesn't have to be admin. Only important when using form login).
 *
 * Preconditions: None (first step in flow)
 * Postconditions: CSRF token cookie is set in browser context
 */
class AcquireCsrfTokenStep extends Step {
    name = 'Acquire CSRF Token';

    async run(ctx) {
        const { page, vars } = ctx;
        const target = vars.target || process.env.ARTILLERY_TARGET;

        const csrfPage = new SecurityPage(page);

        await csrfPage.navigateToAdmin();
        await csrfPage.verifyCSRFTokenAcquired();
    }
}

module.exports = AcquireCsrfTokenStep;
