const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }

  // รับคำสั่งสั่งพิมพ์
  ipcMain.on('print-document', (event) => {
    // สั่งเปิด Print Preview ผ่าน Window ของ Electron
    const focusedWin = BrowserWindow.getFocusedWindow();
    if (focusedWin) {
      focusedWin.webContents.print({
        silent: false,
        printBackground: true,
        color: true,
        pageSize: 'A4',
        landscape: true
      });
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});