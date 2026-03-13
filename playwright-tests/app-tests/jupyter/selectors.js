const { TIMEOUTS: MAIN_TIMEOUTS } = require('../../lib/selectors');

const TIMEOUTS = {
  ...MAIN_TIMEOUTS,
  initialPageLoad: 60000,
}

const SELECTORS = {
  launcherPythonNotebook: '.jp-LauncherCard[data-category="Notebook"][title*="Python"]',
  activeTab: 'li.jp-mod-current',
  tabCloseButton: '.lm-TabBar-tabCloseIcon',

  // Notebook elements
  notebook: '.jp-Notebook',
  notebookToolbar: '.jp-NotebookPanel-toolbar',
  createCellButton: '.jp-ToolbarButtonComponent[data-command="notebook:insert-cell-below"]',
  kernelIdle: '[data-status="idle"]',
  kernelPython: '.jp-Toolbar-kernelName[aria-label="Python 3 (ipykernel)"]',
  // Cell
  cell: '.jp-Cell',
  cellInputPrompt: '.jp-InputPrompt',
  cellOutput: '.jp-OutputArea-output',
  // Codemirror
  codeMirror: '.cm-content',
  codeMirrorFocus: '.cm-focused',

  // Dialog elements
  dialog: '.jp-Dialog',
  dialogContent: '.jp-Dialog-content',
  dialogReject: '.jp-Dialog button.jp-mod-reject',
  dialogAccept: '.jp-Dialog button.jp-mod-accept',
}

const DIALOG_RULES = [
  { name: "Save your work",      textMatch: "Save your work",      action: "reject" },
  { name: "Select Kernel",       textMatch: "Select Kernel",       action: "accept" },
  { name: "Directory not found", textMatch: "Directory not found",  action: "reject" },
];

module.exports = {
  SELECTORS,
  TIMEOUTS,
  DIALOG_RULES,
};
