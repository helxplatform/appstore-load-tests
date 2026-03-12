const { Step } = require('../lib/steps');
const { SELECTORS, TIMEOUTS } = require('../lib/selectors');
const { normalizeMetricName } = require('../lib/steps');

/**
 * Closes the app tab and terminates the app instance.
 *
 * Preconditions:
 *   - ctx.state.appRow is set
 *   - ctx.state.appPage is set
 * Postconditions:
 *   - App termination is verified
 *   - ctx.state.appPage is closed and removed from state
 *   - ctx.state.appRow is removed from state
 *   - ctx.state.selectedApp is removed from state
 *   - ctx.state.selectedAppBaseURL is removed from state
 */
class TeardownAppStep extends Step {
    name = 'Teardown App';

    async before(ctx) {
        if (!ctx.state.appPage) {
            throw new Error('Precondition failed: ctx.state.appPage not set');
        }
        if (!ctx.state.appRow) {
            throw new Error('Precondition failed: ctx.state.appRow not set');
        }
    }

    async run(ctx) {
        const { page, vars, events } = ctx;
        const appRow = ctx.state.appRow;
        const appName = ctx.state.selectedApp;
        const appMetricName = normalizeMetricName(appName);
        const startTime = Date.now();

        try {
            await ctx.state.appPage.close();
            delete ctx.state.appPage;
        } catch (error) {
            throw new Error(`Failed to close tab for ${appName}: ${error.message}`);
        }

        await page.bringToFront();

        const deleteButton = appRow.locator(SELECTORS.activeApps.deleteButton);
        await deleteButton.click({ force: true });
        
        const modal = page.locator(SELECTORS.modal.container).filter({
            has: page.locator(SELECTORS.modal.stopSingleTitle)
        });
        await modal.waitFor({ state: 'visible', timeout: TIMEOUTS.long });
        
        const stopButton = modal.locator(SELECTORS.modal.stopButton);
        await stopButton.click({ force: true });

        await modal.waitFor({ state: 'hidden', timeout: TIMEOUTS.veryLong });

        try {
            await appRow.waitFor({ state: 'hidden', timeout: TIMEOUTS.short });
        } catch (error) {
            if (events) {
                events.emit('counter', `app.${appMetricName}.teardown_failed`, 1);
            }
            throw new Error(`Failed to confirm app deletion for ${appName}: Active app row was not removed.`);
        }

        delete ctx.state.appRow;
        delete ctx.state.selectedApp;
        delete ctx.state.selectedAppBaseURL;

        const elapsed = Date.now() - startTime;
        if (events) {
            events.emit('histogram', `app.${appMetricName}.teardown_time`, elapsed);
        }
        
        console.log(`Successfully closed and terminated ${appName}`);
    }
}

module.exports = TeardownAppStep;
