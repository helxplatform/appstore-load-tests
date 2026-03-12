const { expect } = require("@playwright/test");
const { SELECTORS, TIMEOUTS } = require("../lib/selectors");

class WorkspacesPage {
    constructor(page) {
        this.page = page;

        // General
        this.tabsNavbar = page.locator(SELECTORS.workspaces.tabsNavbar);
        this.navTabs = this.tabsNavbar.locator(SELECTORS.workspaces.tab);

        // Available
        this.appGrid = page.locator(SELECTORS.workspaces.appGrid);
        this.appCards = page.locator(SELECTORS.workspaces.appCard);
        this.appCardTitles = page.locator(SELECTORS.workspaces.appCardTitle);

        // Active
        this.activeTable = page.locator(SELECTORS.workspaces.activeTable);
        this.activeAppRows = page.locator("tr");
        this.activeAppDataCells = page.locator("td");
        this.noInstancesText = page.locator(SELECTORS.workspaces.noInstancesText);
        this.activeContent = this.activeTable.or(this.noInstancesText);
        this.stopAllButton = page.locator(SELECTORS.workspaces.stopAllButton);
        this.stopAllModal = page.locator(SELECTORS.modal.container).filter({
          has: page.locator(SELECTORS.modal.stopAllTitle)
        })
        this.stopAllConfirmButton = this.stopAllModal.locator(SELECTORS.modal.stopButton);
    }

    async selectTab(tabName) {
      const tab = this.navTabs.filter({ hasText: tabName });
      await tab.click();
      await this.verifyTabSelected(tabName);
    }

    async selectAvailableTab() {
      await this.selectTab("Available");
    }

    async selectActiveTab() {
      await this.selectTab("Active");
    }

    async verifyTabSelected(tabName, timeout=TIMEOUTS.MEDIUM) {
      try {
        await expect(
          this.tabsNavbar.locator(SELECTORS.workspaces.tabSelected), 
          `Expected "${tabName}" tab to be selected`
        ).toContainText(tabName, { timeout });
      } catch (e) {
        await this.page.screenshot({ path: `screenshots/wrongtab${tabName}.png` })
        throw e
      }
    }

    async verifyAvailableTabLoaded(timeout=TIMEOUTS.veryLong) {
        await this.verifyTabSelected("Available", timeout);
        await expect(
            this.appGrid,
            "Available apps grid is not visible"
        ).toBeVisible({ timeout });
    }

    async verifyActiveTabLoaded(timeout=TIMEOUTS.veryLong) {
        await this.verifyTabSelected("Active", timeout);
        await expect(
            this.activeContent,
            "Active tab content is not visible"
        ).toBeVisible({ timeout });
    }

    async isActiveTabEmpty() {
      await this.verifyTabSelected("Active");
      return await this.noInstancesText.isVisible();
    }

    async getAvailableAppNames() {
        await this.verifyAvailableTabLoaded();
        
        await expect(
            this.appCardTitles.first(),
            "No apps found in the Available tab"
        ).toBeVisible({ timeout: TIMEOUTS.veryLong });

        const names = await this.appCardTitles.allTextContents();
        return names.map((name) => name.trim());
    }

    async stopAllApps(timeout=TIMEOUTS.superLong) {
      await this.verifyActiveTabLoaded();
      
      const noApps = await this.isActiveTabEmpty();
      await expect(
        noApps,
        "Active tab has no running apps, cannot stop apps."
      ).toBe(false);

      await this.stopAllButton.click();

      await expect(
        this.stopAllModal,
        "Confirmation modal did not appear after clicking stop all instances",
      ).toBeVisible({ timeout: TIMEOUTS.short });
      await this.stopAllConfirmButton.click();

      await this.isActiveTabEmpty();
    }

    async launchApp(appName) {
      await this.verifyAvailableTabLoaded();

      const appCardTitle = this.appCardTitles.filter({ hasText: appName });
      const appCard = this.appCards.filter({ has: appCardTitle });
      const launchBtn = appCard.locator(SELECTORS.workspaces.launchButton);
      await launchBtn.click();

      // Verify we are redirect to active apps table after launch completes.
      await this.verifyActiveTabLoaded(TIMEOUTS.superLong);
    }

    async getActiveAppRow(appName) {
      await this.verifyActiveTabLoaded();

      const row = this.activeAppRows.filter({
        has: this.activeAppDataCells.filter({ hasText: appName })
      });

      await expect(
        row,
        `App ${appName} did not appear in the active apps table`
      ).toBeVisible({ timeout: TIMEOUTS.medium });

      return row;
    }

    /**
     * Returns the current status of an app in the active table.
     * @param {string} appName - The name of the app
     * @returns {Promise<'loading'|'ready'|'failed'>} - The app's current status
     */
    async getAppStatus(appName) {
      await this.verifyActiveTabLoaded();

      const row = await this.getActiveAppRow(appName);

      const readyLocator = row.locator(SELECTORS.activeApps.statusReady);
      const failedLocator = row.locator(SELECTORS.activeApps.statusFailed);

      const result = await Promise.race([
        readyLocator.waitFor({ state: 'visible', timeout: 0 }).then(() => 'ready').catch(() => null),
        failedLocator.waitFor({ state: 'visible', timeout: 0 }).then(() => 'failed').catch(() => null),
      ]);

      return result || 'loading';
    }

    async waitForAppReady(appName, timeout, pollInterval = 2000) {
      await this.verifyActiveTabLoaded();
      
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const status = await this.getAppStatus(appName);

        if (status === 'ready') {
          return Date.now() - startTime;
        }

        if (status === 'failed') {
          await this.page.screenshot({ path: "failedappstart.png" });
          throw new Error(`App ${appName} failed to start (status: exception)`);
        }

        await this.page.waitForTimeout(pollInterval);
      }

      throw new Error(`App ${appName} failed to become ready within ${Math.round(timeout / 1000)}s`);
    }
}

module.exports = { WorkspacesPage };
