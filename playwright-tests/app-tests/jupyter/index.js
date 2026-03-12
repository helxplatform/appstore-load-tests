/**
 * Jupyter app module.
 */

const basic = require('./tests/basic');
const basicAiSandbox = require('./tests/basic-ai-sandbox');

module.exports = {
    appName: 'Jupyter HeLx Tensorflow Notebook',

    tests: {
        'basic': basic,
        'basic-ai-sandbox': basicAiSandbox,
    },
};
