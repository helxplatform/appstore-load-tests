const { expect } = require("@playwright/test");
const { TIMEOUTS, SELECTORS, DIALOG_RULES } = require("./selectors");

// Zero-width space prefix makes markers visually unobtrusive and unlikely to collide
const MARKER_PREFIX = '# MARKER_';

/**
 * A handle to a Jupyter cell that remains valid across React re-renders.
 * Uses a unique marker comment embedded in the cell content for identification.
 *
 * Use CellHandle.create() to create a new handle - do not use constructor directly.
 */
class CellHandle {
  constructor(page, markerComment) {
    this.page = page;
    this.markerComment = markerComment;

    // Base locators
    this.cellLocator = this.page.locator(SELECTORS.cell, { hasText: this.markerComment });
    this.inputPrompt = this.cellLocator.locator(SELECTORS.cellInputPrompt);
    this.outputLocator = this.cellLocator.locator(SELECTORS.cellOutput);
  }

  /**
   * Create a CellHandle for a cell.
   * @param {Page} page - Playwright page
   * @param {Locator} rawLocator - Locator for the cell to attach to
   */
  static async create(page, rawLocator) {
    const markerId = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const markerComment = `${MARKER_PREFIX}${markerId}`;

    const handle = new CellHandle(page, markerComment);

    // Focus using raw locator since marker doesn't exist yet.
    await handle.focus(rawLocator);

    // Inject marker
    await page.keyboard.insertText(markerComment);

    // Let codemirror and jupyter state sync
    await page.waitForTimeout(1000);

    return handle;
  }

  /**
   * Focus this cell's editor.
   * @param {Locator} [fallbackLocator] - Optional locator to use instead of marker-based locator
   */
  async focus(fallbackLocator) {
    const cell = fallbackLocator ?? this.cellLocator;
    const codeMirror = cell.locator(SELECTORS.codeMirror);

    await codeMirror.focus();

    await expect(cell.locator(SELECTORS.codeMirrorFocus)).toBeVisible({ timeout: TIMEOUTS.medium });
    // Let codemirror and jupyter state sync
    await this.page.waitForTimeout(1000);
  }

  /**
   * Set the cell content (replaces existing content, preserves marker).
   */
  async setContent(code) {

    await this.focus();
    await this.page.keyboard.press("ControlOrMeta+A");
    await this.page.keyboard.press("Backspace");
    await this.page.keyboard.insertText(`${this.markerComment}\n${code}`);

    // Ensure the cell locator still matches, equivalent to ensuirng the marker was reinjected.
    // Don't want to verify all the code content is there since playwright/CodeMirror have issues
    // with newlines and whitespace.
    await expect(this.cellLocator).toBeVisible({ timeout: TIMEOUTS.short });

    // Let codemirror and jupyter state sync
    await this.page.waitForTimeout(1000);
  }

  /**
   * Execute this cell and return its output and execution time.
   * 
   * @param {number} timeout - Maximum permissible execution time for the cell.
   * @returns {Promise<{output: Locator|null, duration: number}>}
   */
  async execute(timeout = TIMEOUTS.veryLong) {
    await this.focus();

    const initialPromptText = await this.inputPrompt.innerText();
    const startTime = Date.now();
    await this.page.keyboard.press("Shift+Enter");

    await this.page.screenshot({ path: 'screenshots/beforeexecute.png' })
    try {
    // Wait for execution to complete (prompt changes to `[N]:`)
      await expect.poll(async () => {
        const currentPromptText = (await this.inputPrompt.innerText()).trim();
        const isNumber = /^\[\d+\]:$/.test(currentPromptText);
        const isNew = currentPromptText !== initialPromptText.trim();
        return isNumber && isNew;
      }, { timeout }).toBe(true);
    } catch (e) {
      await this.page.screenshot({ path: 'screenshots/executefail.png' })
      throw e
    }

    await this.page.screenshot({ path: 'screenshots/afterexecute.png' })
    
    const duration = Date.now() - startTime;

    const outLoc = (await this.outputLocator.count() > 0) ? this.outputLocator : null;
    return {
      output: outLoc,
      duration
    };
  }
}

/**
 * Background watcher that automatically dismisses JupyterLab dialogs as they appear.
 */
class DialogWatcher {
  constructor(page, { pollInterval = 500, fallbackAction = "reject", logPrefix = "JupyterDialogWatcher" } = {}) {
    this.page = page;
    this.pollInterval = pollInterval;
    this.fallbackAction = fallbackAction;
    this.logPrefix = logPrefix;

    this._running = false;
    this._loopPromise = null;

    // Pre-build locators
    this._dialogLocator = page.locator(SELECTORS.dialog);
    this._dialogContentLocator = page.locator(SELECTORS.dialogContent);
    this._acceptBtn = page.locator(SELECTORS.dialogAccept);
    this._rejectBtn = page.locator(SELECTORS.dialogReject);
  }

  /** Start the background polling loop. Safe to call multiple times. */
  start() {
    if (this._running) return;
    this._running = true;
    this._loopPromise = this._poll();
  }

  /** Stop the polling loop. Returns once the current iteration (if any) finishes. */
  async stop() {
    this._running = false;
    if (this._loopPromise) {
      await this._loopPromise;
      this._loopPromise = null;
    }
  }

  /** @private */
  async _poll() {
    while (this._running) {
      try {
        const visible = await this._dialogLocator.isVisible().catch(() => false);
        if (visible) {
          await this._handleDialog();
        }
      } catch {
        // Page may have been closed / navigated — silently ignore.
      }
      // Sleep before next check.
      await new Promise((r) => setTimeout(r, this.pollInterval));
    }
  }

  /** @private */
  async _handleDialog() {
    // Read the visible text of the dialog to match against rules.
    const dialogText = await this._dialogContentLocator.innerText().catch(() => "");

    // Find the first matching rule.
    const rule = DIALOG_RULES.find((r) => dialogText.includes(r.textMatch));
    const action = rule ? rule.action : this.fallbackAction;
    const ruleName = rule ? rule.name : "Unknown";

    console.log(`[${this.logPrefix}] Dialog detected — "${ruleName}" → ${action}`);

    const btn = action === "accept" ? this._acceptBtn : this._rejectBtn;

    // Click if the target button is present; some dialogs may only have one button.
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    } else {
      // If preferred button is missing, try the other one.
      const altBtn = action === "accept" ? this._rejectBtn : this._acceptBtn;
      if (await altBtn.isVisible().catch(() => false)) {
        console.log(`[${this.logPrefix}] Preferred button not found, using alternate`);
        await altBtn.click();
      }
    }

    // Wait briefly for the dialog to fully close before resuming the loop.
    await this._dialogLocator.waitFor({ state: "hidden", timeout: TIMEOUTS.medium }).catch(() => {});
  }
}

class JupyterLabPage {
  constructor(page, baseURL) {
    this.page = page;
    this.baseURL = baseURL;

    // --- Background Dialog Watcher ---
    this.dialogWatcher = new DialogWatcher(page);

    // --- Core Locators ---
    this.mainContainer = page.locator("#main");
    this.activeTab = page.locator(SELECTORS.activeTab);
    this.launcherTab = page.locator(`${SELECTORS.activeTab}:has-text("Launcher")`);
    this.tabCloseButtons = page.locator(SELECTORS.tabCloseButton);

    // --- Notebook & Cell Locators ---
    this.launcherPythonCard = page.locator(SELECTORS.launcherPythonNotebook).first();
    this.notebook = page.locator(SELECTORS.notebook);
    this.kernelIdle = page.locator(SELECTORS.kernelIdle);
    this.kernelPython = page.locator(SELECTORS.kernelPython);
    this.cells = page.locator(SELECTORS.cell);
    this.createCellBtn = page.locator(SELECTORS.notebookToolbar).locator(SELECTORS.createCellButton);
  }

  // ==========================================
  // Navigation & Lifecycle Methods
  // ==========================================

  async navigateToNewWorkspace() {
    await this.page.goto(`${this.baseURL}lab/workspaces/auto?reset`);
    await expect(this.mainContainer).toBeVisible({ timeout: TIMEOUTS.initialPageLoad });
  }

  async waitUntilUIReady() {
    // Lot's of the main components will mount slightly before the page is actually ready for use,
    // so judge by whether or not the dock panel tabs are available (there is always an active tab).
    try {
    await this.page.waitForSelector(SELECTORS.activeTab, { timeout: TIMEOUTS.initialPageLoad });
    } catch (e) {
      await this.page.screenshot({ path: "screenshots/uifailready.png" })
      throw e
    }

    // Start the background dialog watcher now that the UI is interactive.
    this.dialogWatcher.start();
  }

  /**
   * Stop background processes (dialog watcher). Call during test teardown.
   */
  async destroy() {
    await this.dialogWatcher.stop();
  }

  // ==========================================
  // Workspace Management Methods
  // ==========================================

  /**
   * Close all open Jupyter tabs. User will be left with a single launcher tab active.
   */
  async closeAllTabs() {
    const initialCount = await this.tabCloseButtons.count();
    for (let i=0; i<initialCount; i++) {
      const currentCount = await this.tabCloseButtons.count();
      await this.tabCloseButtons.first().click();

      // Verify tab count decrements
      // (if only 1 initial tab, a new one will be created immediately after closing it).
      if (initialCount > 1) {
        await expect(this.tabCloseButtons).toHaveCount(currentCount - 1, { timeout: TIMEOUTS.long });
      }
    }

    await this.page.screenshot({ path: "screenshots/closetabsend.png" });
    await this.assertLauncherActive(TIMEOUTS.veryLong);
  }

  // ==========================================
  // Notebook Operations
  // ==========================================

  /**
   * Create a new notebook from a launcher and ensures its kernel is ready.
   */
  async createNewNotebook() {
    await this.assertLauncherActive();

    await this.launcherPythonCard.click();

    // Verify we are in a new notebook
    await this.assertNotebookActive(TIMEOUTS.veryLong);

    // Ensure the initial cell is automatically created on the notebook (further indicates readiness).
    // The jupyter notebook may remain in loading state (spinner) for a little bit.
    await expect(this.cells.first()).toBeVisible({ timeout: TIMEOUTS.veryLong });

    // Any dialog (e.g. "Select Kernel") is handled by the background DialogWatcher.

    // Wait for Python kernel to become selected and idle.
    await expect(this.kernelPython).toBeVisible({ timeout: TIMEOUTS.veryLong });
    await expect(this.kernelIdle).toBeVisible({ timeout: TIMEOUTS.superLong });
  }

  /**
   * Create a new cell and return a persistent CellHandle.
   */
  async createCell() {
    await this.assertNotebookActive();

    const initialCount = await this.cells.count();
    await this.createCellBtn.click();

    // Verify cell is created
    await expect(this.cells).toHaveCount(initialCount + 1, { timeout: TIMEOUTS.long });

    const newCellRaw = this.cells.last();
    await expect(newCellRaw).toBeVisible({ timeout: TIMEOUTS.long });

    return await CellHandle.create(this.page, newCellRaw);
  }

  // ==========================================
  // Asserts (Publicly accessible if needed)
  // ==========================================

  /**
   * Ensure that the active tab is a launcher tab.
   */
  async assertLauncherActive(timeout=TIMEOUTS.short) {
    await expect(this.launcherTab).toBeVisible({ timeout });
  }

  /**
   * Ensure that the active tab is a notebook tab.
   */
  async assertNotebookActive(timeout=TIMEOUTS.short) {
    await expect(this.notebook).toBeVisible({ timeout });
  }
}

module.exports = {
  JupyterLabPage,
  CellHandle,
  DialogWatcher
};