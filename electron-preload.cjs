const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('kboDesktop', {
  platform: process.platform,
  isElectron: true
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('is-electron');
  document.documentElement.dataset.platform = process.platform;
});
