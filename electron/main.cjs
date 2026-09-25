const { app, BrowserWindow, shell, ipcMain } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PROJECT_DIR = path.join(__dirname, "..");

const DEV_HOST = "127.0.0.1";
const DEV_PORT = 5173;
const DEV_URL = `http://${DEV_HOST}:${DEV_PORT}`;

let server = null;
let productionServer = null;

const isPackaged = app.isPackaged;

const DIST_DIR = isPackaged
  ? path.join(process.resourcesPath, "dist")
  : path.join(PROJECT_DIR, "dist");


/* =========================================================
   WAIT FOR SERVER
========================================================= */

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();

        if (
          res.statusCode &&
          res.statusCode < 500
        ) {
          resolve();
          return;
        }

        retry();
      });

      req.on("error", retry);

      req.setTimeout(1500, () => {
        req.destroy();
      });
    };

    const retry = () => {
      if (Date.now() - started >= timeout) {
        reject(
          new Error(
            `Server did not start within ${
              timeout / 1000
            } seconds`
          )
        );
        return;
      }

      setTimeout(check, 300);
    };

    check();
  });
}


/* =========================================================
   DEVELOPMENT VITE SERVER
========================================================= */

function startDevServer() {
  const command =
    process.platform === "win32"
      ? "npm.cmd"
      : "npm";

  server = spawn(
    command,
    [
      "run",
      "dev",
      "--",
      "--host",
      DEV_HOST,
      "--port",
      String(DEV_PORT),
      "--strictPort",
    ],
    {
      cwd: PROJECT_DIR,
      stdio: "inherit",
      shell: true,
      windowsHide: true,
    }
  );

  server.on("error", (error) => {
    console.error(
      "Failed to start Vite server:",
      error
    );
  });

  server.on("exit", (code) => {
    console.log(
      "Vite server stopped:",
      code
    );
  });
}


/* =========================================================
   MIME TYPES
========================================================= */

function getMimeType(filePath) {
  const ext = path
    .extname(filePath)
    .toLowerCase();

  const types = {
    ".html": "text/html; charset=UTF-8",
    ".js": "text/javascript; charset=UTF-8",
    ".mjs": "text/javascript; charset=UTF-8",
    ".css": "text/css; charset=UTF-8",
    ".json": "application/json; charset=UTF-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
  };

  return (
    types[ext] ||
    "application/octet-stream"
  );
}


/* =========================================================
   PRODUCTION STATIC SERVER
   This serves the packaged React DIST folder.
========================================================= */

function startProductionServer() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DIST_DIR)) {
      reject(
        new Error(
          `DIST folder not found:\n${DIST_DIR}`
        )
      );
      return;
    }

    productionServer = http.createServer(
      (req, res) => {
        try {
          let requestPath = decodeURIComponent(
            req.url.split("?")[0]
          );

          if (
            !requestPath ||
            requestPath === "/"
          ) {
            requestPath = "/index.html";
          }

          // Prevent path traversal
          const safePath = path
            .normalize(requestPath)
            .replace(/^(\.\.[\\/])+/, "");

          let filePath = path.join(
            DIST_DIR,
            safePath
          );

          // React Router support:
          // /admin-login, /admin etc. should load index.html
          if (
            !fs.existsSync(filePath) ||
            !fs.statSync(filePath).isFile()
          ) {
            filePath = path.join(
              DIST_DIR,
              "index.html"
            );
          }

          if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end("SugarCafe Dashboard not found");
            return;
          }

          const contentType =
            getMimeType(filePath);

          res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control":
              "no-cache",
          });

          fs.createReadStream(filePath).pipe(
            res
          );
        } catch (error) {
          console.error(
            "Production server error:",
            error
          );

          res.writeHead(500);
          res.end("Internal server error");
        }
      }
    );

    productionServer.on(
      "error",
      reject
    );

    // Random free local port
    productionServer.listen(
      0,
      "127.0.0.1",
      () => {
        const address =
          productionServer.address();

        const port =
          typeof address === "object" &&
          address
            ? address.port
            : null;

        if (!port) {
          reject(
            new Error(
              "Could not determine production server port."
            )
          );
          return;
        }

        const url =
          `http://127.0.0.1:${port}`;

        console.log(
          "SugarCafe packaged dashboard server:",
          url
        );

        resolve(url);
      }
    );
  });
}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================================================
   DATE / TIME
========================================================= */

function formatDateTime(value) {
  const ms = value?.seconds
    ? value.seconds * 1000
    : typeof value === "number"
      ? value
      : Date.parse(value || "");

  const d = Number.isFinite(ms)
    ? new Date(ms)
    : new Date();

  const dd = String(
    d.getDate()
  ).padStart(2, "0");

  const mm = String(
    d.getMonth() + 1
  ).padStart(2, "0");

  const yy = String(
    d.getFullYear()
  ).slice(-2);

  const hh = String(
    d.getHours()
  ).padStart(2, "0");

  const min = String(
    d.getMinutes()
  ).padStart(2, "0");

  const sec = String(
    d.getSeconds()
  ).padStart(2, "0");

  return {
    date: `${dd}/${mm}/${yy}`,
    time: `${hh}:${min}`,
    full: `${d.getFullYear()}-${mm}-${dd} ${hh}:${min}:${sec}`,
  };
}


/* =========================================================
   CODE 128
========================================================= */

const CODE128_PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];

function code128Svg(value) {
  const text =
    String(value || "0")
      .replace(/[^\x20-\x7E]/g, "-")
      .slice(0, 24) || "0";

  const codes = [104];

  for (const ch of text) {
    codes.push(
      ch.charCodeAt(0) - 32
    );
  }

  let checksum = 104;

  for (
    let i = 1;
    i < codes.length;
    i++
  ) {
    checksum += codes[i] * i;
  }

  codes.push(
    checksum % 103,
    106
  );

  let x = 2;
  const scale = 1.45;
  let rects = "";

  for (const code of codes) {
    const pattern =
      CODE128_PATTERNS[code];

    let black = true;

    for (
      const width of pattern
        .split("")
        .map(Number)
    ) {
      const w = width * scale;

      if (black) {
        rects += `
          <rect
            x="${x.toFixed(2)}"
            y="0"
            width="${w.toFixed(2)}"
            height="44"
            fill="#111"
          />
        `;
      }

      x += w;
      black = !black;
    }
  }

  const width = x + 2;

  return `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${width.toFixed(0)}"
      height="44"
      viewBox="0 0 ${width.toFixed(0)} 44"
      preserveAspectRatio="none"
      aria-label="barcode"
    >
      ${rects}
    </svg>
  `;
}


/* =========================================================
   KOT HTML
========================================================= */

function buildKOTHtml(order) {
  const dt = formatDateTime(
    order?.createdAt
  );

  const items = Array.isArray(
    order?.items
  )
    ? order.items
    : Array.isArray(order?.cart)
      ? order.cart
      : [];

  const kotNo =
    order?.kotNumber ||
    order?.kotNo ||
    order?.kot ||
    order?.orderNumber ||
    order?.id
      ?.slice(-4)
      .toUpperCase() ||
    "—";

  const platform =
    order?.platform ||
    order?.source ||
    order?.orderSource ||
    order?.channel ||
    "SugarCafe";

  const platformNo =
    order?.platformOrderNumber ||
    order?.zomatoOrderNumber ||
    order?.zomatoOrderId ||
    order?.externalOrderId ||
    order?.orderNumber ||
    "—";

  const otp =
    order?.otp ||
    order?.deliveryOtp ||
    order?.OTP ||
    order?.deliveryOTP ||
    "—";

  const type =
    order?.orderType ||
    "Delivery";

  const notes =
    order?.instructions ||
    order?.customerNotes ||
    order?.notes ||
    "";

  const payment =
    order?.paymentStatus === "Paid"
      ? "Online Paid"
      : order?.paymentStatus ||
        "Pending";

  const prepareBy =
    order?.preparationEndAt ||
    order?.prepareBy ||
    "";

  const prepareText = prepareBy
    ? formatDateTime(prepareBy).full
    : "—";

  const barcodeValue = String(
    order?.zomatoOrderNumber ||
      order?.platformOrderNumber ||
      order?.orderNumber ||
      order?.id ||
      "000000"
  );

  const total = Number(
    order?.total || 0
  ).toLocaleString("en-IN");

  const customerName =
    order?.customerName ||
    order?.name ||
    "Customer";

  const phone =
    order?.phone ||
    order?.mobile ||
    order?.customerPhone ||
    "—";

  const addressObj =
    order?.address;

  const address =
    typeof addressObj === "string"
      ? addressObj
      : addressObj?.fullAddress ||
        addressObj?.address ||
        order?.deliveryAddress ||
        order?.customerAddress ||
        "—";

  const landmark =
    typeof addressObj === "object"
      ? addressObj?.landmark ||
        addressObj?.area ||
        ""
      : order?.landmark || "";

  const itemRows = items.length
    ? items
        .map((item) => {
          const qty = Number(
            item?.qty ||
              item?.quantity ||
              1
          );

          return `
            <div class="item">
              <span>
                ${escapeHtml(
                  item?.name ||
                    "Food Item"
                )}

                ${
                  item?.variant
                    ? `
                      <small>
                        ${escapeHtml(
                          item.variant
                        )}
                      </small>
                    `
                    : ""
                }
              </span>

              <b>${qty}</b>
            </div>
          `;
        })
        .join("")
    : `
        <div class="item">
          <span>No items found</span>
          <b>1</b>
        </div>
      `;

  const barcode =
    code128Svg(barcodeValue);

  return `
<!doctype html>

<html>

<head>

<meta charset="utf-8">

<style>

@page {
  size: 80mm auto;
  margin: 0;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #111;
  font-family:
    Arial,
    Helvetica,
    sans-serif;
}

body {
  width: 80mm;
}

.ticket {
  width: 80mm;
  padding:
    5mm
    4mm
    7mm;

  font-size: 12px;

  break-after: page;
  page-break-after: always;
}

.ticket:last-child {
  break-after: auto;
  page-break-after: auto;
}

.center {
  text-align: center;
}

.brand {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 1px;
}

.title {
  font-size: 12px;
  font-weight: 800;
  margin-top: 2px;
}

.meta {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.55;
}

.meta strong {
  font-size: 14px;
}

.rule {
  border-top:
    1px dashed #111;

  margin: 8px 0;
}

.type {
  font-weight: 900;
  font-size: 15px;
  text-transform: uppercase;
  margin:
    3px
    0
    6px;
}

.items-head,
.item {
  display: grid;
  grid-template-columns:
    1fr
    36px;

  gap: 8px;
}

.items-head {
  font-weight: 700;
  font-size: 12px;
  margin-bottom: 3px;
}

.item {
  padding: 5px 0;
  border-top:
    1px dashed #aaa;

  font-size: 14px;
}

.item b {
  text-align: right;
}

.item small {
  display: block;
  font-size: 10px;
  color: #555;
  margin-top: 2px;
}

.notes {
  font-size: 13px;
  font-weight: 700;
  margin: 8px 0;
}

.line {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 5px 0;
}

.strong {
  font-weight: 800;
}

.prepare {
  margin-top: 8px;
  font-size: 12px;
}

.barcode {
  margin:
    10px
    0
    3px;

  width: 100%;
  height: 44px;
}

.barcode svg {
  display: block;
  width: 100%;
  height: 44px;
}

.barcode-label {
  text-align: center;
  font-family: monospace;
  font-size: 12px;
  letter-spacing: 2px;
}

.pickup {
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  margin-top: 8px;
}

.small {
  font-size: 10px;
  color: #333;
}

.handover-title {
  font-size: 14px;
  font-weight: 900;
  letter-spacing: .5px;
}

.address {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  margin-top: 7px;
}

.handover-box {
  border:
    1px solid #111;

  padding: 8px;
  margin-top: 8px;
}

.handover-box .line {
  font-size: 13px;
}

.big-otp {
  font-size: 22px;
  font-weight: 900;
  text-align: center;
  margin: 10px 0;
}

.handover-note {
  text-align: center;
  font-size: 12px;
  font-weight: 800;
  margin-top: 8px;
}

</style>

</head>

<body>

<!-- KITCHEN COPY -->

<div class="ticket">

  <div class="center brand">
    SUGAR CAFE
  </div>

  <div class="center title">
    KITCHEN ORDER TICKET
  </div>

  <div class="center meta">

    <strong>
      ${escapeHtml(dt.date)}
      ${escapeHtml(dt.time)}
    </strong>

    <br>

    <strong>
      KOT - ${escapeHtml(kotNo)}
    </strong>

    <br>

    <strong>
      ${escapeHtml(platform)}
      :
      ${escapeHtml(platformNo)}
    </strong>

    <br>

    <strong>
      OTP : ${escapeHtml(otp)}
    </strong>

  </div>

  <div class="center type">
    ${escapeHtml(type)}
  </div>

  <div class="rule"></div>

  <div class="items-head">
    <span>Item</span>

    <span style="text-align:right">
      Qty.
    </span>
  </div>

  ${itemRows}

  ${
    notes
      ? `
        <div class="notes">
          Customer Notes:
          ${escapeHtml(notes)}
        </div>
      `
      : ""
  }

  <div class="rule"></div>

  <div class="line">

    <span class="strong">
      Payment Status :
    </span>

    <span>
      ${escapeHtml(payment)}
    </span>

  </div>

  <div class="line prepare">

    <span class="strong">
      Prepare By :
    </span>

    <span>
      ${escapeHtml(prepareText)}
    </span>

  </div>

  <div
    class="center small"
    style="margin-top:8px"
  >
    Scan to Mark food ready
  </div>

  <div class="barcode">
    ${barcode}
  </div>

  <div class="barcode-label">
    ${escapeHtml(barcodeValue)}
  </div>

  <div class="pickup">
    Pickup barcode for
    ${escapeHtml(platform)}
    delivery partner
  </div>

  <div
    class="center small"
    style="margin-top:8px"
  >
    Kitchen Copy
  </div>

</div>


<!-- DELIVERY HANDOVER COPY -->

<div class="ticket">

  <div class="center brand">
    SUGAR CAFE
  </div>

  <div class="center handover-title">
    DELIVERY HANDOVER SLIP
  </div>

  <div class="center meta">

    <strong>
      ${escapeHtml(dt.date)}
      ${escapeHtml(dt.time)}
    </strong>

    <br>

    <strong>
      KOT - ${escapeHtml(kotNo)}
    </strong>

    <br>

    <strong>
      ${escapeHtml(platform)}
      :
      ${escapeHtml(platformNo)}
    </strong>

  </div>

  <div class="center type">
    ${escapeHtml(type)}
  </div>

  <div class="rule"></div>

  <div class="handover-box">

    <div class="line">

      <span class="strong">
        Customer
      </span>

      <span>
        ${escapeHtml(customerName)}
      </span>

    </div>

    <div class="line">

      <span class="strong">
        Phone
      </span>

      <span>
        ${escapeHtml(phone)}
      </span>

    </div>

    <div class="line">

      <span class="strong">
        Payment
      </span>

      <span>
        ${escapeHtml(payment)}
      </span>

    </div>

    <div class="line">

      <span class="strong">
        Amount
      </span>

      <span>
        ₹${escapeHtml(total)}
      </span>

    </div>

  </div>

  <div class="rule"></div>

  <div class="strong">
    DELIVERY ADDRESS
  </div>

  <div class="address">

    ${escapeHtml(address)}

    ${
      landmark
        ? `
          <br>
          Landmark:
          ${escapeHtml(
            landmark
          )}
        `
        : ""
    }

  </div>

  <div class="big-otp">
    OTP: ${escapeHtml(otp)}
  </div>

  <div class="center small">
    Show/confirm OTP at handover
  </div>

  <div class="barcode">
    ${barcode}
  </div>

  <div class="barcode-label">
    ${escapeHtml(barcodeValue)}
  </div>

  <div class="handover-note">
    DELIVERY BOY / PARTNER COPY
  </div>

  <div
    class="center small"
    style="margin-top:8px"
  >
    Customer details & delivery address —
    hand over this copy to delivery partner.
  </div>

</div>

</body>

</html>
`;
}


/* =========================================================
   SILENT KOT PRINTING
========================================================= */

ipcMain.handle(
  "print-kot",
  async (_event, order) => {
    const printWin =
      new BrowserWindow({
        show: false,
        width: 420,
        height: 900,

        webPreferences: {
          sandbox: true,
        },
      });

    try {
      await printWin.loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent(
            buildKOTHtml(order)
          )
      );

      await new Promise(
        (resolve) =>
          setTimeout(resolve, 250)
      );

      const printers =
        await printWin.webContents.getPrintersAsync();

      console.log(
        "SugarCafe printers:",
        printers.map((p) => ({
          name: p.name,
          isDefault: p.isDefault,
        }))
      );

      const preferred =
        printers.find((p) => {
          const name = String(
            p.name || ""
          )
            .toLowerCase()
            .replace(
              /[^a-z0-9]/g,
              ""
            );

          return (
            name.includes(
              "tvserp3230"
            ) ||
            name.includes(
              "rp3230"
            )
          );
        });

      const defaultPrinter =
        printers.find(
          (p) => p.isDefault
        );

      const selectedPrinter =
        preferred ||
        defaultPrinter;

      const options = {
        silent: true,
        printBackground: true,
        margins: {
          marginType: "none",
        },
      };

      if (
        selectedPrinter?.name
      ) {
        options.deviceName =
          selectedPrinter.name;
      }

      return await new Promise(
        (resolve) => {
          printWin.webContents.print(
            options,
            (
              success,
              failureReason
            ) => {
              resolve({
                success,
                failureReason:
                  failureReason ||
                  "",
              });

              setTimeout(() => {
                if (
                  !printWin.isDestroyed()
                ) {
                  printWin.close();
                }
              }, 500);
            }
          );
        }
      );
    } catch (error) {
      if (
        !printWin.isDestroyed()
      ) {
        printWin.close();
      }

      return {
        success: false,
        failureReason:
          error?.message ||
          "KOT print failed",
      };
    }
  }
);


/* =========================================================
   DASHBOARD WINDOW - DEVELOPMENT
========================================================= */

function createWindow() {
  const win =
    new BrowserWindow({
      width: 1440,
      height: 900,

      minWidth: 1100,
      minHeight: 700,

      title:
        "SugarCafe Professional Dashboard",

      autoHideMenuBar: true,

      backgroundColor:
        "#f7f3ef",

      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,

        preload: path.join(
          __dirname,
          "preload.cjs"
        ),
      },
    });

  // ONLY ADMIN DASHBOARD LOGIN
  win.loadURL(
    `${DEV_URL}/admin-login`
  );

  win.webContents.setWindowOpenHandler(
    ({ url }) => {
      shell.openExternal(url);

      return {
        action: "deny",
      };
    }
  );
}


/* =========================================================
   DASHBOARD WINDOW - PRODUCTION
========================================================= */

async function createWindowProduction() {
  const dashboardUrl =
    await startProductionServer();

  const win =
    new BrowserWindow({
      width: 1440,
      height: 900,

      minWidth: 1100,
      minHeight: 700,

      title:
        "SugarCafe Professional Dashboard",

      autoHideMenuBar: true,

      backgroundColor:
        "#f7f3ef",

      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,

        preload: path.join(
          __dirname,
          "preload.cjs"
        ),
      },
    });

  // ONLY ADMIN DASHBOARD
  await win.loadURL(
    `${dashboardUrl}/admin-login`
  );

  win.webContents.setWindowOpenHandler(
    ({ url }) => {
      shell.openExternal(url);

      return {
        action: "deny",
      };
    }
  );

  win.on("closed", () => {
    if (
      productionServer
    ) {
      productionServer.close();
      productionServer = null;
    }
  });
}


/* =========================================================
   ELECTRON START
========================================================= */

app.whenReady().then(
  async () => {
    try {
      if (isPackaged) {
        console.log(
          "Starting SugarCafe packaged Dashboard..."
        );

        await createWindowProduction();
      } else {
        console.log(
          "Starting SugarCafe development Dashboard..."
        );

        startDevServer();

        await waitForServer(
          DEV_URL
        );

        createWindow();
      }
    } catch (error) {
      console.error(
        "SugarCafe could not start:",
        error
      );

      app.quit();
      return;
    }

    app.on(
      "activate",
      async () => {
        if (
          BrowserWindow.getAllWindows()
            .length === 0
        ) {
          if (isPackaged) {
            await createWindowProduction();
          } else {
            createWindow();
          }
        }
      }
    );
  }
);


/* =========================================================
   CLOSE
========================================================= */

app.on(
  "window-all-closed",
  () => {
    if (server) {
      server.kill();
      server = null;
    }

    if (productionServer) {
      productionServer.close();
      productionServer = null;
    }

    if (
      process.platform !==
      "darwin"
    ) {
      app.quit();
    }
  }
);
