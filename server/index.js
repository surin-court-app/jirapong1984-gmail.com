const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// เชื่อมต่อฐานข้อมูล Turso Cloud Database
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

(async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        fullName TEXT,
        position TEXT,
        role TEXT
      )
    `);

    await db.execute(`
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
        village TEXT,
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

    try {
      await db.execute(`ALTER TABLE warrants ADD COLUMN village TEXT`);
    } catch (e) {}

    await db.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        username TEXT,
        fullName TEXT,
        user TEXT,
        action TEXT,
        details TEXT
      )
    `);

    try {
      await db.execute(`ALTER TABLE audit_logs ADD COLUMN user TEXT`);
    } catch (e) {}

    const adminExists = await db.execute({
      sql: 'SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?)',
      args: ['admin']
    });
    if (adminExists.rows.length === 0) {
      await db.execute({
        sql: 'INSERT INTO users (username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?)',
        args: ['admin', 'admin1234', 'ต้อมครับ', 'ตะพุ่นหญ้าช้าง', 'admin']
      });
    }

    const userExists = await db.execute({
      sql: 'SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?)',
      args: ['tomsound']
    });
    if (userExists.rows.length === 0) {
      await db.execute({
        sql: 'INSERT INTO users (username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?)',
        args: ['tomsound', 'Jira.man1984', 'นายจิรพงษ์ มณีปรุ', 'พนักงานคอมพิวเตอร์', 'admin']
      });
    }
  } catch (err) {
    console.error("Database Init Error:", err);
  }
})();

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const cleanUser = (username || '').trim();
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(?) AND password = ?',
      args: [cleanUser, password]
    });
    if (result.rows.length > 0) res.json({ success: true, user: result.rows[0] });
    else res.json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await db.execute('SELECT id, username, fullName, position, role FROM users');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, fullName, position, role } = req.body;
  try {
    await db.execute({
      sql: 'INSERT INTO users (username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?)',
      args: [(username || '').trim().toLowerCase(), password, fullName, position, role]
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: 'Username นี้มีในระบบแล้ว' }); }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, fullName, position, role } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE users SET username = ?, password = ?, fullName = ?, position = ?, role = ? WHERE id = ?',
      args: [(username || '').trim().toLowerCase(), password, fullName, position, role, id]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ✅ ค้นหาหมายศาล ค้นหาแบบกว้างป้องกันชื่อพิมพ์เล็ก-ใหญ่ดึงไม่ขึ้น
app.get('/api/warrants/:username', async (req, res) => {
  try {
    const targetUsername = (req.params.username || '').trim().toLowerCase();
    const result = await db.execute({
      sql: 'SELECT * FROM warrants WHERE LOWER(TRIM(ownerUsername)) = ? OR ownerUsername = ?',
      args: [targetUsername, req.params.username]
    });
    
    const parsed = result.rows.map(w => ({
      ...w,
      isSaved: Number(w.isSaved) === 1 || w.isSaved === true || w.isSaved === "1",
      photos: JSON.parse(w.photos || '[]')
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ บันทึกคดีและรูปถ่ายอย่างปลอดภัย
app.post('/api/warrants/batch', async (req, res) => {
  try {
    const { username, records } = req.body;
    if (!username || !Array.isArray(records) || records.length === 0) {
      return res.json({ success: true });
    }

    const cleanUsername = (username || '').trim().toLowerCase();

    for (const rec of records) {
      const photosJson = JSON.stringify(rec.photos || []);
      const isSavedVal = (rec.isSaved === true || rec.isSaved === 1 || rec.isSaved === "1") ? 1 : 0;

      await db.execute({
        sql: `INSERT INTO warrants (
          id, ownerUsername, blackNo, redNo, payer, warrantType, targetName,
          sendDate, sendTime, address, village, subdistrict, district,
          province, zipcode, warrantResult, price, gps, photos, isSaved
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          ownerUsername=excluded.ownerUsername,
          blackNo=excluded.blackNo,
          redNo=excluded.redNo,
          payer=excluded.payer,
          warrantType=excluded.warrantType,
          targetName=excluded.targetName,
          sendDate=excluded.sendDate,
          sendTime=excluded.sendTime,
          address=excluded.address,
          village=excluded.village,
          subdistrict=excluded.subdistrict,
          district=excluded.district,
          province=excluded.province,
          zipcode=excluded.zipcode,
          warrantResult=excluded.warrantResult,
          price=excluded.price,
          gps=excluded.gps,
          photos=excluded.photos,
          isSaved=excluded.isSaved`,
        args: [
          rec.id,
          cleanUsername,
          rec.blackNo || '',
          rec.redNo || '',
          rec.payer || '',
          rec.warrantType || '',
          rec.targetName || '',
          rec.sendDate || '',
          rec.sendTime || '',
          rec.address || '',
          rec.village || '',
          rec.subdistrict || '',
          rec.district || '',
          rec.province || 'สุรินทร์',
          rec.zipcode || '',
          rec.warrantResult || '',
          rec.price || '0.00',
          rec.gps || '',
          photosJson,
          isSavedVal
        ]
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Batch Import Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/warrants/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM warrants WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.delete('/api/warrants/owner/:username', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM warrants WHERE LOWER(TRIM(ownerUsername)) = LOWER(?)',
      args: [(req.params.username || '').trim()]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM audit_logs ORDER BY timestamp DESC');
    const mappedLogs = result.rows.map(log => ({
      ...log,
      user: log.fullName || log.user || log.username || 'ผู้ใช้งานระบบ',
      fullName: log.fullName || log.user || log.username || 'ผู้ใช้งานระบบ'
    }));
    res.json(mappedLogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-logs', async (req, res) => {
  const { id, timestamp, username, fullName, user, action, details } = req.body;
  const nameToSave = fullName || user || username || '';
  try {
    await db.execute({
      sql: 'INSERT INTO audit_logs (id, timestamp, username, fullName, user, action, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, timestamp, (username || '').trim().toLowerCase(), nameToSave, nameToSave, action, details]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// เสิร์ฟไฟล์ Static ของ React
app.use(express.static(path.join(__dirname, '../dist')));

// บังคับ Route SPA หน้า React ทุกหน้า
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});