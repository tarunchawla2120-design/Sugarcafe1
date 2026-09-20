const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  printKOT: (order) => ipcRenderer.invoke("print-kot", order),
});
