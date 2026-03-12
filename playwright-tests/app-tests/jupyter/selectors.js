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
  // Cell
  cell: '.jp-Cell',
  cellInputPrompt: '.jp-InputPrompt',
  cellOutput: '.jp-OutputArea-output',
  // Codemirror
  codeMirror: '.cm-content',
  codeMirrorFocus: '.cm-focused',

  // Dialog elements
  dialog: '.jp-Dialog',
  dialogReject: '.jp-Dialog button.jp-mod-reject',
  dialogAccept: '.jp-Dialog button.jp-mod-accept',
  dialogSaveNotebook: '.jp-Dialog:has-text("Save your work")',
  dialogSelectKernel: '.jp-Dialog:has-text("Select Kernel")'
}

module.exports = {
  SELECTORS,
  TIMEOUTS
};
