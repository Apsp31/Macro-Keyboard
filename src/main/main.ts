import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { DeviceService } from "./services/deviceService";
import { SettingsService } from "./services/settingsService";

const deviceService = new DeviceService();
const settingsService = new SettingsService();

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: "#10131a",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    if (process.env.MACRODECK_OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  ipcMain.handle("device:list-workspaces", async () => {
    return deviceService.listWorkspaces();
  });

  ipcMain.handle("device:refresh-workspaces", async () => {
    return deviceService.listWorkspaces();
  });

  ipcMain.handle("device:read-board", async () => {
    return deviceService.readBoardWorkspace();
  });

  ipcMain.handle("device:write-text", async (_event, request) => {
    return deviceService.writeTextToButton(request);
  });

  ipcMain.handle("device:write-binding", async (_event, request) => {
    return deviceService.writeBindingToButton(request);
  });

  ipcMain.handle("device:duplicate-layer", async (_event, request) => {
    return deviceService.duplicateLayer(request);
  });

  ipcMain.handle("settings:load", async () => {
    return settingsService.load();
  });

  ipcMain.handle("settings:save", async (_event, settings) => {
    return settingsService.save(settings);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
