/**
 * Registry for app test modules.
 *
 * Loads and manages test modules from app-tests/<app>/index.js.
 * Each module exports: { appName: string, tests: { [testName]: Function } }
 */

const fs = require('fs');
const path = require('path');

const APP_TESTS_DIR = path.join(__dirname, '../app-tests');

/**
 * Registry for app test modules.
 */
class AppTestRegistry {
    constructor() {
        /** @type {Map<string, Record<string, Function>>} */
        this._tests = new Map();
        this._load();
    }

    /**
     * Loads all app test modules from the app-tests directory.
     * @private
     */
    _load() {
        if (!fs.existsSync(APP_TESTS_DIR)) {
            return;
        }

        for (const entry of fs.readdirSync(APP_TESTS_DIR)) {
            const entryPath = path.join(APP_TESTS_DIR, entry);
            const stat = fs.statSync(entryPath);

            if (stat.isDirectory()) {
                const indexPath = path.join(entryPath, 'index.js');
                if (fs.existsSync(indexPath)) {
                    this._loadModule(indexPath);
                }
            }
        }
    }

    /**
     * Loads a single app test module.
     * @private
     * @param {string} modulePath
     */
    _loadModule(modulePath) {
        const module = require(modulePath);
        if (module.appName && module.tests) {
            this._tests.set(module.appName, module.tests);
        }
    }

    /**
     * Returns list of registered app names.
     * @returns {string[]}
     */
    getAppNames() {
        return Array.from(this._tests.keys());
    }

    /**
     * Checks if an app has a test module.
     * @param {string} appName
     * @returns {boolean}
     */
    hasApp(appName) {
        return this._tests.has(appName);
    }

    /**
     * Returns list of test names for an app.
     * @param {string} appName
     * @returns {string[]}
     */
    getTestNames(appName) {
        const tests = this._tests.get(appName);
        return tests ? Object.keys(tests) : [];
    }

    /**
     * Checks if an app has a specific test.
     * @param {string} appName
     * @param {string} testName
     * @returns {boolean}
     */
    hasTest(appName, testName) {
        const tests = this._tests.get(appName);
        return tests ? testName in tests : false;
    }

    /**
     * Gets a test function.
     * @param {string} appName
     * @param {string} testName
     * @returns {Function}
     * @throws {Error} If app or test not found
     */
    getTest(appName, testName) {
        const tests = this._tests.get(appName);
        if (!tests) {
            throw new Error(
                `App "${appName}" has no test module. ` +
                `Available: ${this.getAppNames().join(', ') || 'none'}`
            );
        }

        const testFn = tests[testName];
        if (!testFn) {
            throw new Error(
                `Test "${testName}" not found for app "${appName}". ` +
                `Available: ${this.getTestNames(appName).join(', ')}`
            );
        }

        return testFn;
    }

    /**
     * Validates that a deployment config has all required test modules.
     * @param {import('./deployment-config').DeploymentConfig} config
     * @throws {Error} If any app or test is missing
     */
    validateConfig(config) {
        for (const appConfig of config.apps) {
            if (!this.hasApp(appConfig.appName)) {
                throw new Error(
                    `[${config.name}] App "${appConfig.appName}" has no test module. ` +
                    `Available: ${this.getAppNames().join(', ') || 'none'}`
                );
            }

            for (const testConfig of appConfig.tests) {
                if (!this.hasTest(appConfig.appName, testConfig.name)) {
                    throw new Error(
                        `[${config.name}] Test "${testConfig.name}" not found for app "${appConfig.appName}". ` +
                        `Available: ${this.getTestNames(appConfig.appName).join(', ')}`
                    );
                }
            }
        }
    }
}

// Singleton instance
const registry = new AppTestRegistry();

module.exports = { AppTestRegistry, registry };
