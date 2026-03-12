const { expect } = require('@playwright/test');

class SecurityPage {
    constructor(page) {
        this.page = page;
    }

    async navigateToAdmin() {
        await this.page.goto("/admin/login/");
        await expect(
            this.page,
            "Failed to navigate to admin login page"
        ).toHaveURL(/.*admin\/login/);
    }

    async verifyCSRFTokenAcquired() {
        const cookies = await this.page.context().cookies();
        const csrfCookie = cookies.find((c) => c.name === "csrftoken");

        expect(
            csrfCookie,
            "CSRF token cookie was not set after visiting admin login page"
        ).toBeDefined();
    }
}

module.exports = { SecurityPage };
