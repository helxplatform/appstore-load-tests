const { expect } = require("@playwright/test");
const { TIMEOUTS, SELECTORS } = require("./selectors");

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
    await page.waitForTimeout(2500);

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
  }

  /**
   * Set the cell content (replaces existing content, preserves marker).
   */
  async setContent(code) {

    await this.focus();
    await this.page.keyboard.press("ControlOrMeta+A");
    await this.page.keyboard.press("Backspace");
    await this.page.keyboard.insertText(`${this.markerComment}\n${code}`);

    // await this.page.waitForTimeout(TIMEOUTS.short);
    await expect(this.cellLocator).toContainText(code, { timeout: TIMEOUTS.short });

    // Let codemirror and jupyter state sync
    await this.page.waitForTimeout(2500);
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
    // Wait for execution to complete (prompt changes to `[N]:`)
    await expect.poll(async () => {
      const currentPromptText = (await this.inputPrompt.innerText()).trim();
      const isNumber = /^\[\d+\]:$/.test(currentPromptText);
      const isNew = currentPromptText !== initialPromptText.trim();
      return isNumber && isNew;
    }, { timeout }).toBe(true);

    await this.page.screenshot({ path: 'screenshots/afterexecute.png' })
    
    const duration = Date.now() - startTime;

    const outLoc = (await this.outputLocator.count() > 0) ? this.outputLocator : null;
    return {
      output: outLoc,
      duration
    };
  }
}

class JupyterLabPage {
  constructor(page, baseURL) {
    this.page = page;
    this.baseURL = baseURL;

    // --- Core Locators ---
    this.mainContainer = page.locator("#main");
    this.activeTab = page.locator(SELECTORS.activeTab);
    this.launcherTab = page.locator(`${SELECTORS.activeTab}:has-text("Launcher")`);
    this.tabCloseButtons = page.locator(SELECTORS.tabCloseButton);
    
    // --- Dialog Locators ---
    this.dialog = page.locator(SELECTORS.dialog);
    this.saveDialog = page.locator(SELECTORS.dialogSaveNotebook);
    this.dontSaveBtn = this.saveDialog.locator(SELECTORS.dialogReject);
    this.kernelDialog = page.locator(SELECTORS.dialogSelectKernel);
    this.acceptKernelBtn = this.kernelDialog.locator(SELECTORS.dialogAccept);
    
    // --- Notebook & Cell Locators ---
    this.launcherPythonCard = page.locator(SELECTORS.launcherPythonNotebook).first();
    this.notebook = page.locator(SELECTORS.notebook);
    this.kernelIdle = page.locator(SELECTORS.kernelIdle);
    this.cells = page.locator(SELECTORS.cell);
    this.createCellBtn = page.locator(SELECTORS.notebookToolbar).locator(SELECTORS.createCellButton);
  }

  // ==========================================
  // Navigation & Lifecycle Methods
  // ==========================================

  async navigateToRoot() {
    await this.page.goto(this.baseURL);
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
      
      // Handle "Don't Save" dialog if it appears
      if (await this.dontSaveBtn.isVisible({ timeout: TIMEOUTS.short }).catch(() => false)) {
          await this.dontSaveBtn.click();
          // Verify dialog gone
          await expect(this.dialog).toBeHidden({ timeouts: TIMEOUTS.short });
      }
      // Verify tab count decrements
      await expect(this.tabCloseButtons).toHaveCount(currentCount - 1, { timeout: TIMEOUTS.long });
    }
    
    await this.page.screenshot({ path: "screenshots/closetabsend.png" });
    await this.assertLauncherActive(TIMEOUTS.long);
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
    await this.assertNotebookActive(TIMEOUTS.long);

    // Wait for kernel to become idle
    await expect(this.kernelIdle).toBeVisible({ timeout: TIMEOUTS.veryLong });

    // Handle "Select Kernel" dialog if it appears
    if (await this.acceptKernelBtn.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false)) {
        await this.acceptKernelBtn.click();
        // Verify dialog gone
        await expect(this.dialog).toBeHidden({ timeouts: TIMEOUTS.short });
    }
    
    // Ensure the initial cell is automatically created on the notebook (further indicates readiness).
    await expect(this.cells.first()).toBeVisible({ timeout: TIMEOUTS.long });
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
  CellHandle
};