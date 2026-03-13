const { SELECTORS, TIMEOUTS } = require('../lib/selectors');
const { expect } = require('@playwright/test');

class LoginPage {
    constructor(page, baseURL) {
        this.page = page;
        this.baseURL = baseURL;

        this.navbarWorkspaces = page.locator(SELECTORS.navbar.workspaces);
        this.loginForm = page.locator(SELECTORS.login.form);
        this.usernameField = page.locator(SELECTORS.login.username);
        this.passwordField = page.locator(SELECTORS.login.password);
        this.submitButton = page.locator(SELECTORS.login.submitButton);
        this.errorMessage = page.locator(SELECTORS.login.errorMessage);
        
        this.adminLoginHeader = page.locator(SELECTORS.admin.loginHeader);
        this.adminUsernameField = page.locator(SELECTORS.admin.username);
        this.adminPasswordField = page.locator(SELECTORS.admin.password);
        this.adminSubmitButton = page.locator(SELECTORS.admin.submitButton);
    }

    async navigateToBaseURL() {
        await this.page.goto(this.baseURL);
        await expect(
            this.navbarWorkspaces,
            "Navbar workspaces tab did not load after navigating to base URL"
        ).toBeVisible();
    }

    async navigateToAdminURL() {
        await this.page.goto(`${this.baseURL}/admin`);
        await expect(
            this.adminLoginHeader,
            "Django login header not found after navigating to admin login"
        ).toBeVisible();
    }

    async goToLogin() {
        await this.navbarWorkspaces.click();
        await expect(
            this.loginForm,
            "Login form failed to appear after clicking Workspaces"
        ).toBeVisible({ timeout: TIMEOUTS.medium });
    }

    async formLogin(username, password) {
        await this.usernameField.fill(username);
        await this.passwordField.fill(password);
        await this.submitButton.click();
    }

    async adminLogin(username, password) {
        await this.adminUsernameField.fill(username);
        await this.adminPasswordField.fill(password);
        await this.adminSubmitButton.click();
    }

    async verifyLoginSuccess(timeout=TIMEOUTS.veryLong) {
        await expect(
            this.page.getByText("log out"),
            "Could not verify login success, log out button did not appear"
        ).toBeVisible({ timeout });
    }
}

module.exports = { LoginPage };
