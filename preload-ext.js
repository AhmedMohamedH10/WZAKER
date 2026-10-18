/**
 * WZAKER — preload إضافي (التنبيهات المخصصة)
 *
 * بيتحمّل جنب preload.js الأصلي (main.js بيسجّله عبر session.setPreloads) علشان preload.js ما يتعدّلش.
 * بيعرّض window.wzx فقط، وكل الأوامر بيرفضها الـ main لو مش جاية من نافذة الإعدادات.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wzx', {
  getAlerts: () => ipcRenderer.invoke('alerts:list'),
  saveAlert: draft => ipcRenderer.invoke('alerts:save', draft),
  deleteAlert: id => ipcRenderer.invoke('alerts:delete', String(id)),
  toggleAlert: (id, on) => ipcRenderer.invoke('alerts:toggle', String(id), !!on),
  testAz: k => ipcRenderer.send('az:test', String(k)),
  copyMin: () => ipcRenderer.send('min:copy'),
  pickSound: () => ipcRenderer.invoke('alerts:pick'),
  previewAlert: draft => ipcRenderer.send('alerts:preview', draft),
  onAlerts: cb => { ipcRenderer.on('alerts:update', (_e, list) => cb(list)); },
  // النسخ الاحتياطي + الختمة
  backupList: () => ipcRenderer.invoke('backup:list'),
  backupNow: () => ipcRenderer.invoke('backup:now'),
  backupPath: () => ipcRenderer.invoke('backup:path'),
  backupOpenDir: () => ipcRenderer.invoke('backup:open-dir'),
  backupCopyPath: () => ipcRenderer.invoke('backup:copy-path'),
  backupRestore: name => ipcRenderer.invoke('backup:restore', String(name), true),   // التأكيد بيتم جوه البرنامج قبل النداء ده
  backupExport: () => ipcRenderer.invoke('backup:export'),
  backupImport: () => ipcRenderer.invoke('backup:import'),
  backupImportApply: () => ipcRenderer.invoke('backup:import-apply'),
  backupImportCancel: () => ipcRenderer.send('backup:import-cancel'),
  backupQuran: s => ipcRenderer.send('backup:quran', String(s)),
  takePendingQuran: () => ipcRenderer.sendSync('backup:pendingQuran'),
  khatmaPage: p => ipcRenderer.send('khatma:page', Number(p) | 0),
  khatmaNew: d => ipcRenderer.send('khatma:new', Number(d) | 0)
});
