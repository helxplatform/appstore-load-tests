const { Step } = require('../lib/steps');
const { normalizeMetricName } = require('../lib/steps');

/**
 * Runs the selected test for the app.
 *
 * Preconditions:
 *   - App is ready and has been connected to
 *   - ctx.state.appPage is set
 *   - ctx.state.selectedApp is set
 *   - ctx.state.selectedAppBaseURL is set
 *   - ctx.state.selectedWorkflow is set (with name and fn)
 * Postconditions:
 *   - Test has completed
 */
class RunWorkflowStep extends Step {
    name = 'Run Workflow';

    async before(ctx) {
        if (!ctx.state.appPage) {
            throw new Error('Precondition failed: ctx.state.appPage not set');
        }
        if (!ctx.state.selectedApp) {
            throw new Error('Precondition failed: ctx.state.selectedApp not set');
        }
        if (!ctx.state.selectedAppBaseURL) {
            throw new Error('Precondition failed: ctx.state.selectedAppBaseURL not set');
        }
        if (!ctx.state.selectedWorkflow) {
            throw new Error('Precondition failed: ctx.state.selectedWorkflow not set');
        }
    }

    async run(ctx) {
        const { vars, events } = ctx;
        const appName = ctx.state.selectedApp;
        const appBaseURL = ctx.state.selectedAppBaseURL;
        const workflow = ctx.state.selectedWorkflow;

        const appMetricName = normalizeMetricName(appName);
        const testMetricName = normalizeMetricName(workflow.name);
        const startTime = Date.now();

        // Context passed to test functions
        const context = {
            vars,
            appName,
            testName: workflow.name,
            baseURL: appBaseURL,
            username: vars.username
        };

        try {
            await workflow.fn(ctx.state.appPage, context);

            const elapsed = Date.now() - startTime;
            if (events) {
                events.emit('histogram', `workflow.${appMetricName}.${testMetricName}.duration`, elapsed);
            }
        } catch (error) {
            if (events) {
                events.emit('counter', `workflow.${appMetricName}.${testMetricName}.failed`, 1);
            }
            throw error;
        }
    }
}

module.exports = RunWorkflowStep;
