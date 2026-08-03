const { app, BrowserWindow, shell, dialog } = require("electron");
const net = require("net");
const http = require("http");
const path = require("path");

const DEV_URL = process.env.INVOICEFLOW_DEV_URL || "http://localhost:3000";

let mainWindow = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function isUp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isUp(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function startBundledServer() {
  const port = await getFreePort();
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  require(path.join(process.resourcesPath, "standalone", "server.js"));
  const url = `http://127.0.0.1:${port}`;
  if (await waitForServer(url)) return url;
  throw new Error(`Next.js server did not start at ${url}`);
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 700,
    title: "InvoiceFlow",
    backgroundColor: "#0a0a12",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(url);
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  let url = DEV_URL;
  if (app.isPackaged) {
    try {
      url = await startBundledServer();
    } catch (err) {
      dialog.showErrorBox("InvoiceFlow could not start", String(err));
      app.quit();
      return;
    }
  }
  createWindow(url);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
