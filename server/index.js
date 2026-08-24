const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

let db;

(async () => {
  db = await open({
    filename: path.join(__dirname, 'surin_court.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      fullName TEXT,
      position TEXT,
      role TEXT
    )
  `);

  // สร้างตารางโดยยึด id เป็น Primary Key เดียวเท่านั้น
  await db.exec(`
    CREATE TABLE IF NOT EXISTS warrants (
      id TEXT PRIMARY KEY,
      ownerUsername TEXT,
      blackNo TEXT,
      redNo TEXT,
      payer TEXT,
      warrantType TEXT,
      targetName TEXT,
      sendDate TEXT,
      sendTime TEXT,
      address TEXT,
      subdistrict TEXT,
      district TEXT,
      province TEXT,
      zipcode TEXT,
      warrantResult TEXT,
      price TEXT,
      gps TEXT,
      photos TEXT,
      isSaved INTEGER DEFAULT 0
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      username TEXT,
      fullName TEXT,
      action TEXT,
      details TEXT
    )
  `);

  const adminExists = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    await db.run('INSERT INTO users (username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin1234', 'ต้อมครับ', 'ตะพุ่นหญ้าช้าง', 'admin']);
  }

  const userExists = await db.get('SELECT * FROM users WHERE username = ?', ['tomsound']);
  if (!userExists) {
    await db.run('INSERT INTO users (username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?)',
      ['tomsound', 'Jira.man1984', 'นายจิรพงษ์ มณีปรุ', 'พนักงานคอมพิวเตอร์', 'admin']);
  }
})();

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
  if (user) res.json({ success: true, user });
  else res.json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
});

app.get('/api/users', async (req, res) => {
  const users = await db.all('SELECT id, username, fullName, position, role FROM users');
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const { username, password, fullName, position, role } = req.body;
  try {
    await db.run('INSERT INTO users (username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?)',
      [username, password, fullName, position, role]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: 'Username นี้มีในระบบแล้ว' }); }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, fullName, position, role } = req.body;
  await db.run('UPDATE users SET username = ?, password = ?, fullName = ?, position = ?, role = ? WHERE id = ?',
    [username, password, fullName, position, role, id]);
  res.json({ success: true });
});

app.delete('/api/users/:id', async (req, res) => {
  await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/warrants/:username', async (req, res) => {
  const warrants = await db.all('SELECT * FROM warrants WHERE ownerUsername = ?', [req.params.username]);
  const parsed = warrants.map(w => ({
    ...w,
    isSaved: w.isSaved === 1,
    photos: JSON.parse(w.photos || '[]')
  }));
  res.json(parsed);
});

// บันทึก/อัปเดตเฉพาะรายการที่มี ID ตรงกันเท่านั้น (เด็ดขาด 100%)
app.post('/api/warrants/batch', async (req, res) => {
  try {
    const { username, records } = req.body;
    for (const rec of records) {
      const existing = await db.get('SELECT id FROM warrants WHERE id = ?', [rec.id]);
      if (existing) {
        await db.run(`
          UPDATE warrants SET 
            blackNo = ?, redNo = ?, payer = ?, warrantType = ?, targetName = ?,
            sendDate = ?, sendTime = ?, address = ?, subdistrict = ?, district = ?,
            province = ?, zipcode = ?, warrantResult = ?, price = ?, gps = ?,
            photos = ?, isSaved = ?
          WHERE id = ?
        `, [
          rec.blackNo, rec.redNo, rec.payer, rec.warrantType, rec.targetName,
          rec.sendDate, rec.sendTime, rec.address, rec.subdistrict, rec.district,
          rec.province, rec.zipcode, rec.warrantResult, rec.price, rec.gps,
          JSON.stringify(rec.photos || []), rec.isSaved ? 1 : 0, rec.id
        ]);
      } else {
        await db.run(`
          INSERT INTO warrants (
            id, ownerUsername, blackNo, redNo, payer, warrantType, targetName,
            sendDate, sendTime, address, subdistrict, district, province, zipcode,
            warrantResult, price, gps, photos, isSaved
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          rec.id, username, rec.blackNo, rec.redNo, rec.payer, rec.warrantType, rec.targetName,
          rec.sendDate, rec.sendTime, rec.address, rec.subdistrict, rec.district, rec.province, rec.zipcode,
          rec.warrantResult, rec.price, rec.gps, JSON.stringify(rec.photos || []), rec.isSaved ? 1 : 0
        ]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/warrants/:id', async (req, res) => {
  await db.run('DELETE FROM warrants WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.delete('/api/warrants/owner/:username', async (req, res) => {
  await db.run('DELETE FROM warrants WHERE ownerUsername = ?', [req.params.username]);
  res.json({ success: true });
});

app.get('/api/audit-logs', async (req, res) => {
  const logs = await db.all('SELECT * FROM audit_logs ORDER BY timestamp DESC');
  res.json(logs);
});

app.post('/api/audit-logs', async (req, res) => {
  const { id, timestamp, username, fullName, action, details } = req.body;
  await db.run('INSERT INTO audit_logs (id, timestamp, username, fullName, action, details) VALUES (?, ?, ?, ?, ?, ?)',
    [id, timestamp, username, fullName, action, details]);
  res.json({ success: true });
});

// Serve static files จาก Vite dist folder (กรณี Deploy ขึ้น Render)
app.use(express.static(path.join(__dirname, '../dist')));

// ส่ง index.html สำหรับทุก URL ที่ไม่ใช่ API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
