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

    // ป้องกันกรณีโครงสร้างตารางเดิมไม่มีคอลัมน์ village
    try {
      await db.execute(`ALTER TABLE warrants ADD COLUMN village TEXT`);
    } catch (e) {
      // ข้ามถ้ามีอยู่แล้ว
    }

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
  } catch (err) {
    console.error("Database Init Error:", err);
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
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/warrants/batch', async (req, res) => {
  try {
    const { username, records } = req.body;
    for (const rec of records) {
      const existing = await db.execute({
        sql: 'SELECT id FROM warrants WHERE id = ?',
        args: [rec.id]
      });

      const params = [
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
        JSON.stringify(rec.photos || []),
        rec.isSaved ? 1 : 0
      ];

      if (existing.rows.length > 0) {
        await db.execute({
          sql: `UPDATE warrants SET 
            blackNo = ?, redNo = ?, payer = ?, warrantType = ?, targetName = ?,
            sendDate = ?, sendTime = ?, address = ?, village = ?, subdistrict = ?, district = ?,
            province = ?, zipcode = ?, warrantResult = ?, price = ?, gps = ?,
            photos = ?, isSaved = ?
            WHERE id = ?`,
          args: [...params, rec.id]
        });
      } else {
        await db.execute({
          sql: `INSERT INTO warrants (
            blackNo, redNo, payer, warrantType, targetName,
            sendDate, sendTime, address, village, subdistrict, district,
            province, zipcode, warrantResult, price, gps,
            photos, isSaved, id, ownerUsername
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [...params, rec.id, username]
        });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Batch Error:", err);
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