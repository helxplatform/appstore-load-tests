/**
 * Normalizes a string for use in metric keys.
 * @param {string} name
 * @returns {string}
 */
function normalizeMetricName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Base class for all steps. Each step represents a discrete unit of work
 * in the user flow.
 *
 * Subclasses must implement:
 * - name: Human-readable name for logging/metrics
 * - run(ctx): Core step logic
 *
 * Subclasses may optionally implement:
 * - before(ctx): Verify preconditions (expected page state)
 */
class Step {
    /** @type {string} Human-readable name for logging and metrics */
    name = 'Unnamed Step';

    /**
     * Verify preconditions before running.
     * Override to check that the page is in the expected state.
     * Throw an error if preconditions are not met.
     *
     * @param {StepContext} ctx
     */
    async before(ctx) {}

    /**
     * Core step logic. Must be implemented by subclasses.
     *
     * @param {StepContext} ctx
     */
    async run(ctx) {
        throw new Error(`${this.constructor.name}.run() must be implemented`);
    }
}

/**
 * @typedef {Object} StepContext
 * @property {import('playwright').Page} page - Playwright page object
 * @property {Object} vars - Artillery variables (username, password, deployment, etc.)
 * @property {Object} events - Artillery events object for emitting metrics
 * @property {Object} state - Mutable state passed between steps
 */

/**
 * Executes steps with automatic timing, logging, and metrics.
 */
class StepRunner {
    /**
     * @param {StepContext} ctx - Shared execution context
     */
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * Executes a single step with timing and metrics.
     *
     * Execution order:
     * 1. before() - verify preconditions
     * 2. run() - execute step logic
     *
     * @param {Step} step - Step instance to execute
     */
    async run(step) {
        const metricName = `step.${normalizeMetricName(step.name)}`;
        const startTime = Date.now();

        const stepId = `${step.name}:${this.ctx.vars.username}`

        console.log(`[${stepId}] Starting...`);

        try {
            await step.before(this.ctx);
            await step.run(this.ctx);
        } catch (error) {
            const elapsed = Date.now() - startTime;
            console.error(`[${stepId}] Failed after ${Math.round(elapsed / 1000)}s: ${error.message}`);

            if (this.ctx.events) {
                this.ctx.events.emit('counter', `${metricName}.failed`, 1);
            }

            throw error;
        }

        const elapsed = Date.now() - startTime;
        console.log(`[${stepId}] Completed (${Math.round(elapsed / 1000)}s)`);

        if (this.ctx.events) {
            this.ctx.events.emit('histogram', `${metricName}.duration`, elapsed);
        }
    }

    /**
     * Executes an array of steps sequentially.
     *
     * @param {Step[]} steps - Array of step instances to execute
     */
    async runAll(steps) {
        for (const step of steps) {
            await this.run(step);
        }
    }
}

/**
 * Creates a step context from Artillery parameters.
 *
 * @param {import('playwright').Page} page
 * @param {Object} vuContext - Artillery virtual user context
 * @param {Object} events - Artillery events object
 * @returns {StepContext}
 */
function createStepContext(page, vuContext, events) {
    return {
        page,
        vars: vuContext.vars,
        events,
        state: {},
        error: null,
    };
}

module.exports = {
    Step,
    StepRunner,
    createStepContext,
    normalizeMetricName,
};
