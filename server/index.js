const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// เชื่อมต่อฐานข้อมูล Turso Cloud Database
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "libsql://surin-court-db-tomsound.aws-ap-northeast-1.turso.io",
  authToken: process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc4MjMwNzgsImlkIjoiMDFhMDQyOGQtODUwMS03MWEwLWE0N2ItZDViY2E4NzVhYWUxIiwia2lkIjoibVg3S2F0Sk1JYTZDRXBFcE1QYVk5YmN1aVFjTFFKQU91cmRCQkE3eEN6YyIsInJpZCI6IjQ3MjRjMDhlLTdiOTMtNDg5MS1iODAwLWYxNGEyNmUwNmFiMiJ9.fwARVakWZXmb5bIhvE2vnS7L1MyGGArounUUHYy30RL7Iy2Sv7VBRP1N96jih4Dbfgc2ZZcIxdtEymGIT6LIAw"
});

(async () => {
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      username TEXT,
      fullName TEXT,
      action TEXT,
      details TEXT
    )
  `);

  const adminExists = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: ['admin']
  });
  if (adminExists.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO users (username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?)',
      args: ['admin', 'admin1234', 'ต้อมครับ', 'ตะพุ่นหญ้าช้าง', 'admin']
    });
  }

  const userExists = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: ['tomsound']
  });
  if (userExists.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO users (username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?)',
      args: ['tomsound', 'Jira.man1984', 'นายจิรพงษ์ มณีปรุ', 'พนักงานคอมพิวเตอร์', 'admin']
    });
  }
})();

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ? AND password = ?',
    args: [username, password]
  });
  if (result.rows.length > 0) res.json({ success: true, user: result.rows[0] });
  else res.json({ success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
});

app.get('/api/users', async (req, res) => {
  const result = await db.execute('SELECT id, username, fullName, position, role FROM users');
  res.json(result.rows);
});

app.post('/api/users', async (req, res) => {
  const { username, password, fullName, position, role } = req.body;
  try {
    await db.execute({
      sql: 'INSERT INTO users (username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?)',
      args: [username, password, fullName, position, role]
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: 'Username นี้มีในระบบแล้ว' }); }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, fullName, position, role } = req.body;
  await db.execute({
    sql: 'UPDATE users SET username = ?, password = ?, fullName = ?, position = ?, role = ? WHERE id = ?',
    args: [username, password, fullName, position, role, id]
  });
  res.json({ success: true });
});

app.delete('/api/users/:id', async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [req.params.id]
  });
  res.json({ success: true });
});

app.get('/api/warrants/:username', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM warrants WHERE ownerUsername = ?',
    args: [req.params.username]
  });
  const parsed = result.rows.map(w => ({
    ...w,
    isSaved: w.isSaved === 1,
    photos: JSON.parse(w.photos || '[]')
  }));
  res.json(parsed);
});

app.post('/api/warrants/batch', async (req, res) => {
  try {
    const { username, records } = req.body;
    for (const rec of records) {
      const existing = await db.execute({
        sql: 'SELECT id FROM warrants WHERE id = ?',
        args: [rec.id]
      });
      if (existing.rows.length > 0) {
        await db.execute({
          sql: `UPDATE warrants SET 
            blackNo = ?, redNo = ?, payer = ?, warrantType = ?, targetName = ?,
            sendDate = ?, sendTime = ?, address = ?, subdistrict = ?, district = ?,
            province = ?, zipcode = ?, warrantResult = ?, price = ?, gps = ?,
            photos = ?, isSaved = ?
            WHERE id = ?`,
          args: [
            rec.blackNo, rec.redNo, rec.payer, rec.warrantType, rec.targetName,
            rec.sendDate, rec.sendTime, rec.address, rec.subdistrict, rec.district,
            rec.province, rec.zipcode, rec.warrantResult, rec.price, rec.gps,
            JSON.stringify(rec.photos || []), rec.isSaved ? 1 : 0, rec.id
          ]
        });
      } else {
        await db.execute({
          sql: `INSERT INTO warrants (
            id, ownerUsername, blackNo, redNo, payer, warrantType, targetName,
            sendDate, sendTime, address, subdistrict, district, province, zipcode,
            warrantResult, price, gps, photos, isSaved
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            rec.id, username, rec.blackNo, rec.redNo, rec.payer, rec.warrantType, rec.targetName,
            rec.sendDate, rec.sendTime, rec.address, rec.subdistrict, rec.district, rec.province, rec.zipcode,
            rec.warrantResult, rec.price, rec.gps, JSON.stringify(rec.photos || []), rec.isSaved ? 1 : 0
          ]
        });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/warrants/:id', async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM warrants WHERE id = ?',
    args: [req.params.id]
  });
  res.json({ success: true });
});

app.delete('/api/warrants/owner/:username', async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM warrants WHERE ownerUsername = ?',
    args: [req.params.username]
  });
  res.json({ success: true });
});

app.get('/api/audit-logs', async (req, res) => {
  const result = await db.execute('SELECT * FROM audit_logs ORDER BY timestamp DESC');
  res.json(result.rows);
});

app.post('/api/audit-logs', async (req, res) => {
  const { id, timestamp, username, fullName, action, details } = req.body;
  await db.execute({
    sql: 'INSERT INTO audit_logs (id, timestamp, username, fullName, action, details) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, timestamp, username, fullName, action, details]
  });
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, '../dist')));

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});