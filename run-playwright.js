#!/usr/bin/env node
/**
 * Playwright test runner.
 *
 * Loads deployment config from deployments/<name>.yaml and runs Artillery
 * with the appropriate environment variables.
 *
 * Usage:
 *   node run-playwright.js [deployment] [environment] [-- ...artillery-args]
 *
 * Examples:
 *   node run-playwright.js                         # default, smoke
 *   node run-playwright.js ai-sandbox              # ai-sandbox, smoke
 *   node run-playwright.js ai-sandbox load         # ai-sandbox, load test
 *   node run-playwright.js default smoke -- --quiet
 */

const { spawn } = require('child_process');
const { DeploymentConfig } = require('./playwright-tests/lib/deployment-config');

// Parse args: [deployment] [environment] [-- ...artillery-args]
const args = process.argv.slice(2);
const separatorIndex = args.indexOf('--');

let positionalArgs, artilleryArgs;
if (separatorIndex >= 0) {
    positionalArgs = args.slice(0, separatorIndex);
    artilleryArgs = args.slice(separatorIndex + 1);
} else {
    positionalArgs = args;
    artilleryArgs = [];
}

const deploymentName = positionalArgs[0] || 'default';
const environment = positionalArgs[1] || 'smoke';

const config = new DeploymentConfig(deploymentName);

console.log(`Deployment: ${config.name}`);
console.log(`Target: ${config.target}`);
console.log(`Environment: ${environment}`);
console.log('');

const env = {
    ...process.env,
    ARTILLERY_TARGET: process.env.ARTILLERY_TARGET || config.target,
    ARTILLERY_DURATION: process.env.ARTILLERY_DURATION || String(config.load.duration),
    ARTILLERY_ARRIVAL_COUNT: process.env.ARTILLERY_ARRIVAL_COUNT || String(config.load.arrivalCount),
    DEPLOYMENT_NAME: config.name,
};

const child = spawn('npx', [
    'artillery', 'run',
    'tests/playwright.yaml',
    '--environment', environment,
    ...artilleryArgs,
], {
    env,
    stdio: 'inherit',
    shell: true,
});

child.on('close', (code) => process.exit(code));
