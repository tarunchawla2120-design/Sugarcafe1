
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Existing KOT printing — preserve
  printKOT: (order) =>
    ipcRenderer.invoke("print-kot", order),

  // Send a new order to the Electron main process
  notifyNewOrder: (order) =>
    ipcRenderer.send("background-new-order", order),

  // Respond to an order from the popup
  respondToOrder: (orderId, action) =>
    ipcRenderer.send("background-order-response", {
      orderId,
      action,
    }),

  // Receive Accept / Reject requests in the background monitor
  onBackgroundOrderAction: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, data) => {
      callback(data);
    };

    ipcRenderer.on("background-order-action", listener);

    return () => {
      ipcRenderer.removeListener(
        "background-order-action",
        listener
      );
    };
  },
});

