const { contextBridge, ipcRenderer } = require('electron');

const on = ch => cb => { const f = (_e, d) => cb(d); ipcRenderer.on(ch, f); return () => ipcRenderer.off(ch, f); };

contextBridge.exposeInMainWorld('launcher', {
  state: () => ipcRenderer.invoke('state'),
  act: (action, args = {}) => ipcRenderer.invoke('act', { action, ...args }),
  onState: on('state'),
  onTermOpen: on('term-open'),
  onTermData: on('term-data'),
  onTermExit: on('term-exit'),
  onAskPassword: on('ask-password'),
  termInput: (id, data) => ipcRenderer.send('term-input', { id, data }),
  termClose: id => ipcRenderer.send('term-close', { id }),
  password: (id, pw) => ipcRenderer.send('password', { id, pw }),
});
