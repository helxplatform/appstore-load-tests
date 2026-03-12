/**
 * Basic workflow - verifies the app launched successfully.
 */
async function basic(_page, context) {
    console.log(`[Jupyter:basic] Starting workflow`);
    console.log(`[Jupyter:basic] App context: ${JSON.stringify(context)}`);
    console.log(`[Jupyter:basic] Workflow completed`);
}

module.exports = basic;
