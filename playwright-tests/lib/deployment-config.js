/**
 * Deployment configuration loader.
 *
 * Loads YAML deployment specs that define test configuration including
 * target URL, timeouts, load test parameters, and app/test weights.
 *
 * Inheritance chain:
 * 1. default.yaml values (base, required)
 * 2. Specific deployment spec values (override)
 * 3. Environment variables (final override for target, duration, arrivalCount)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const merge = require('lodash.merge');

const DEPLOYMENTS_DIR = path.join(__dirname, '../../deployments');

/**
 * Selects an item from a weighted list using random selection.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => number} getWeight
 * @returns {T}
 */
function weightedRandomSelect(items, getWeight) {
    const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
        random -= getWeight(item);
        if (random < 0) {
            return item;
        }
    }
    return items[0];
}

/**
 * Deployment configuration.
 */
class DeploymentConfig {
    /**
     * @param {string} name - Deployment name
     */
    constructor(name = 'default') {
        this.name = name;
        this._config = this._load();
    }

    /** @returns {string} */
    get target() {
        return this._config.target;
    }

    /** @returns {number} */
    get appReadyTimeout() {
        return this._config.appReadyTimeout;
    }

    /** @returns {number} */
    get appTeardownTimeout() {
        return this._config.appTeardownTimeout;
    }

    /** @returns {boolean} */
    get useStaffLogin() {
        return this._config.useStaffLogin;
    }

    /** @returns {{ duration: number, arrivalCount: number }} */
    get load() {
        return this._config.load;
    }

    /** @returns {Array<{ appName: string, weight: number, tests: Array<{ name: string, weight: number }> }>} */
    get apps() {
        return this._config.apps;
    }

    /**
     * Loads and merges configuration from YAML files.
     * @private
     */
    _load() {
        // Load default.yaml as base (required)
        const defaultConfig = this._loadRaw('default');
        if (!defaultConfig) {
            throw new Error('default.yaml is required but not found');
        }

        // Start with a deep copy of default config
        const config = JSON.parse(JSON.stringify(defaultConfig));

        // If requesting non-default, load and merge that config
        if (this.name !== 'default') {
            const specificConfig = this._loadRaw(this.name);
            if (specificConfig) {
                merge(config, specificConfig);
            } else {
                throw new Error(`Deployment "${this.name}" not found`);
            }
        }

        // Apply environment variable overrides
        this._applyEnvOverrides(config);

        // Validate final merged config
        this._validate(config);

        return config;
    }

    /**
     * Loads raw config from YAML file.
     * @private
     * @param {string} name
     * @returns {object | null}
     */
    _loadRaw(name) {
        const configPath = path.join(DEPLOYMENTS_DIR, `${name}.yaml`);
        if (!fs.existsSync(configPath)) {
            return null;
        }
        const content = fs.readFileSync(configPath, 'utf8');
        return yaml.load(content) || {};
    }

    /**
     * Applies environment variable overrides.
     * @private
     * @param {object} config
     */
    _applyEnvOverrides(config) {
        if (process.env.ARTILLERY_TARGET) {
            config.target = process.env.ARTILLERY_TARGET;
        }
        if (process.env.ARTILLERY_DURATION) {
            config.load.duration = parseInt(process.env.ARTILLERY_DURATION, 10);
        }
        if (process.env.ARTILLERY_ARRIVAL_COUNT) {
            config.load.arrivalCount = parseInt(process.env.ARTILLERY_ARRIVAL_COUNT, 10);
        }
    }

    /**
     * Validates config structure.
     * @private
     * @param {object} config
     */
    _validate(config) {
        const name = this.name;

        if (!config || typeof config !== 'object') {
            throw new Error(`[${name}] Invalid config: must be an object`);
        }

        if (typeof config.target !== 'string' || !config.target.trim()) {
            throw new Error(`[${name}] Invalid config: 'target' must be a non-empty string`);
        }

        if (typeof config.appReadyTimeout !== 'number' || config.appReadyTimeout < 0) {
            throw new Error(`[${name}] Invalid config: 'appReadyTimeout' must be a non-negative number`);
        }

        if (typeof config.appTeardownTimeout !== 'number' || config.appTeardownTimeout < 0) {
            throw new Error(`[${name}] Invalid config: 'appTeardownTimeout' must be a non-negative number`);
        }

        if (typeof config.useStaffLogin !== 'boolean') {
            throw new Error(`[${name}] Invalid config: 'useStaffLogin' must be a boolean`);
        }

        if (!config.load || typeof config.load !== 'object') {
            throw new Error(`[${name}] Invalid config: 'load' must be an object`);
        }

        if (typeof config.load.duration !== 'number' || config.load.duration < 0) {
            throw new Error(`[${name}] Invalid config: 'load.duration' must be a non-negative number`);
        }

        if (typeof config.load.arrivalCount !== 'number' || config.load.arrivalCount < 0) {
            throw new Error(`[${name}] Invalid config: 'load.arrivalCount' must be a non-negative number`);
        }

        if (!Array.isArray(config.apps)) {
            throw new Error(`[${name}] Invalid config: 'apps' must be an array`);
        }

        if (config.apps.length === 0) {
            throw new Error(`[${name}] Invalid config: 'apps' must not be empty`);
        }

        for (let i = 0; i < config.apps.length; i++) {
            this._validateApp(config.apps[i], i);
        }
    }

    /**
     * Validates an app config entry.
     * @private
     * @param {object} app
     * @param {number} index
     */
    _validateApp(app, index) {
        const prefix = `[${this.name}] apps[${index}]`;

        if (!app || typeof app !== 'object') {
            throw new Error(`${prefix}: must be an object`);
        }

        if (typeof app.appName !== 'string' || !app.appName.trim()) {
            throw new Error(`${prefix}: 'appName' must be a non-empty string`);
        }

        if (typeof app.weight !== 'number' || app.weight < 0) {
            throw new Error(`${prefix} (${app.appName}): 'weight' must be a non-negative number`);
        }

        if (!Array.isArray(app.tests)) {
            throw new Error(`${prefix} (${app.appName}): 'tests' must be an array`);
        }

        if (app.tests.length === 0) {
            throw new Error(`${prefix} (${app.appName}): 'tests' must not be empty`);
        }

        for (let j = 0; j < app.tests.length; j++) {
            this._validateTest(app.tests[j], app.appName, index, j);
        }
    }

    /**
     * Validates a test config entry.
     * @private
     * @param {object} test
     * @param {string} appName
     * @param {number} appIndex
     * @param {number} testIndex
     */
    _validateTest(test, appName, appIndex, testIndex) {
        const prefix = `[${this.name}] apps[${appIndex}] (${appName}) tests[${testIndex}]`;

        if (!test || typeof test !== 'object') {
            throw new Error(`${prefix}: must be an object`);
        }

        if (typeof test.name !== 'string' || !test.name.trim()) {
            throw new Error(`${prefix}: 'name' must be a non-empty string`);
        }

        if (typeof test.weight !== 'number' || test.weight < 0) {
            throw new Error(`${prefix} (${test.name}): 'weight' must be a non-negative number`);
        }
    }

    /**
     * Selects an app using weighted random selection.
     * Only considers apps that are both in the config and available in the UI.
     * Warns if any configured apps are not available.
     * @param {string[]} availableApps - Apps available in the UI
     * @returns {{ appName: string, weight: number, tests: Array } | null}
     */
    selectApp(availableApps) {
        const eligibleApps = [];
        const unavailableApps = [];

        for (const app of this.apps) {
            if (availableApps.includes(app.appName)) {
                eligibleApps.push(app);
            } else {
                unavailableApps.push(app.appName);
            }
        }

        if (unavailableApps.length > 0) {
            console.warn(
                `[WARNING] Apps in deployment "${this.name}" not available in UI: ${unavailableApps.join(', ')}`
            );
        }

        if (eligibleApps.length === 0) {
            return null;
        }

        return weightedRandomSelect(eligibleApps, app => app.weight);
    }

    /**
     * Selects a test from an app config using weighted random selection.
     * @param {{ tests: Array<{ name: string, weight: number }> }} appConfig
     * @returns {{ name: string, weight: number }}
     */
    selectTest(appConfig) {
        return weightedRandomSelect(appConfig.tests, test => test.weight);
    }
}

module.exports = { DeploymentConfig };
