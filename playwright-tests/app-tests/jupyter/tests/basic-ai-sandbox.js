const { expect } = require("@playwright/test");
const { TIMEOUTS } = require("../selectors");
const { JupyterLabPage } = require("../page");

async function basicAiSandbox(page, context) {
    const name = `Jupyter:${context.username}:basic-ai-sandbox`;

    console.log(`[${name}] Starting workflow`);
    const jupyterPage = new JupyterLabPage(page, context.baseURL);
    console.log(`[Jupyter:basic-ai-sandbox] Waiting for JupyterLab UI to load...`);
    // await jupyterPage.navigateToRoot();
    await jupyterPage.waitUntilUIReady();
    console.log(`[${name}] JupyterLab UI loaded`);

    console.log(`[${name}] Closing all existing tabs...`);
    await jupyterPage.closeAllTabs();

    console.log(`[${name}] Creating new Python notebook...`);
    await jupyterPage.createNewNotebook();

    console.log(`[${name}] Creating new cell...`);
    const cellHandle = await jupyterPage.createCell();

    console.log(`[${name}] Editing cell...`);
    await cellHandle.setContent(`print("Hello, World!")`);

    console.log(`[${name}] Executing cell...`);
    const { output, duration } = await cellHandle.execute(TIMEOUTS.veryLong);

    console.log(`[${name}] Verifying cell output...`);
    await expect(output).toHaveText("Hello, World!", { timeout: TIMEOUTS.medium });
    console.log(`[${name}] Cell output expected value in ${ (duration/1000).toFixed(1) }s...`);

    console.log(`[${name}] Workflow completed`);
}

module.exports = basicAiSandbox;
