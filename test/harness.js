'use strict';
// يحمّل main.js بدون Electron حقيقي (mock) علشان نختبر المنطق في Node عادي.
const Module = require('module');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.WZ_TEST = '1';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wz-test-'));

const noop = () => {};
const chain = () => new Proxy(noop, { get: (_t, k) => (k === 'then' ? undefined : chain()), apply: () => chain() });
const app = new Proxy({
  getPath: () => tmp, getVersion: () => '0.0.0-test', isPackaged: false,
  requestSingleInstanceLock: () => true, whenReady: () => new Promise(noop),
  commandLine: { appendSwitch: noop }, on: noop, once: noop, quit: noop, setLoginItemSettings: noop,
}, { get: (t, k) => (k in t ? t[k] : noop) });
const electron = new Proxy({ app, screen: { on: noop }, powerMonitor: { on: noop }, Menu: { buildFromTemplate: t => t }, dialog: { showMessageBox: () => Promise.resolve({ response: 1 }), showErrorBox: noop } }, {
  get: (t, k) => (k in t ? t[k] : (k === 'ipcMain' ? { on: noop, handle: noop } : chain())),
});

const mocks = {
  electron,
  'uiohook-napi': { uIOhook: { on: noop, start: noop, stop: noop, removeListener: noop, removeAllListeners: noop }, UiohookKey: {} },
  'electron-updater': { autoUpdater: { on: noop } },
};
const origLoad = Module._load;
Module._load = function (request, ...rest) { return request in mocks ? mocks[request] : origLoad.call(this, request, ...rest); };

const main = require(path.join(__dirname, '..', 'main.js'));
main.__uio = mocks['uiohook-napi'].uIOhook;   // الاختبارات بتخلّي start() يفشل منه
module.exports = main;
