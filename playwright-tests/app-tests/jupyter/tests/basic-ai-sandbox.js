const { expect } = require("@playwright/test");
const { TIMEOUTS } = require("../selectors");
const { JupyterLabPage } = require("../page");

async function basicAiSandbox(page, context) {
    const name = `Jupyter:${context.username}:basic-ai-sandbox`;

    console.log(`[${name}] Starting workflow`);
    const jupyterPage = new JupyterLabPage(page, context.baseURL);

    console.log(`[${name}] Navigating to new workspace...`);
    await jupyterPage.navigateToNewWorkspace();

    console.log(`[${name}] Waiting for JupyterLab UI to load...`);
    // await jupyterPage.navigateToRoot();
    await jupyterPage.waitUntilUIReady();
    console.log(`[${name}] JupyterLab UI loaded`);
    
    // Verify launcher is active in new workspace
    await jupyterPage.assertLauncherActive(TIMEOUTS.veryLong);

    // console.log(`[${name}] Closing all existing tabs...`);
    // await jupyterPage.closeAllTabs();

    console.log(`[${name}] Creating new Python notebook...`);
    await jupyterPage.createNewNotebook();

    console.log(`[${name}] Creating new cell...`);
    const cellHandle = await jupyterPage.createCell();

    console.log(`[${name}] Editing cell...`);
    await cellHandle.setContent(`
from openai import OpenAI
client = OpenAI()
completion = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Solve: If 2x + 3 = 7, what is x? Output only the number."}],
    temperature=0
)
print(completion.choices[0].message.content)
`);

    console.log(`[${name}] Executing cell...`);
    const { output, duration } = await cellHandle.execute(TIMEOUTS.superLong);

    console.log(`[${name}] Verifying cell output...`);
    await expect(output).toHaveText("2", { timeout: TIMEOUTS.medium });
    console.log(`[${name}] Cell output expected value in ${ (duration/1000).toFixed(1) }s...`);

    await jupyterPage.destroy();
    console.log(`[${name}] Workflow completed`);
}

module.exports = basicAiSandbox;
