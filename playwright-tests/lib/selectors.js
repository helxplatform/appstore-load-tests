/**
 * Shared selectors and timeouts for Playwright tests.
 */

const SELECTORS = {
    navbar: {
        workspaces: "text=Workspaces",
    },
    login: {
        form: "div.login-form",
        username: "input#username",
        password: "input#password",
        submitButton: 'button:has(span:text("Log in"))',
        errorMessage: ".ant-form-item-explain-error, .ant-alert-error, .error",
    },
    admin: {
        loginHeader: "text=Django administration",
        username: "input#id_username",
        password: "input#id_password",
        submitButton: 'input[value="Log in"]',
    },
    workspaces: {
        layout: "main.ant-layout-content div.routing-container section.ant-layout",
        appGrid: "main.ant-layout-content div.routing-container section.ant-layout div.grid",
        appCardTitle: "div.ant-card-meta-title",
        appCard: ".ant-card",
        launchButton: 'button span:text("Launch")',
        tabsNavbar: "section.ant-layout div.ant-tabs-nav",
        tab: ".ant-tabs-tab",
        tabSelected: ".ant-tabs-tab-active",
        activeTable: "section.ant-layout div.ant-table-wrapper",
        noInstancesText: "text=No instances running. Redirecting to apps...",
        stopAllButton: 'button span:text("Stop All")',
    },
    activeApps: {
        statusLoading: "div.ant-progress-status-normal",
        statusReady: "div.ant-progress-status-success",
        statusFailed: "div.ant-progress-status-exception .anticon-exclamation",
        connectButton: "button span.anticon-right-circle",
        deleteButton: "button span.anticon-delete",
    },
    modal: {
        container: ".ant-modal",
        stopAllTitle: '.ant-modal-title:text-is("Stop All Instances")',
        stopSingleTitle: '.ant-modal-title:text-is("Stop Instance")',
        stopButton: 'button span:text("Stop")',
    },
};

const TIMEOUTS = {
    veryShort: 250,
    short: 1000,
    medium: 2500,
    long: 5000,
    veryLong: 10000,
    superLong: 20000,
};

module.exports = {
    SELECTORS,
    TIMEOUTS,
};
