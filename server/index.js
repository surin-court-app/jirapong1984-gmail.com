import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ ขยายลิมิตการรับข้อมูลเป็น 100MB ป้องกันปัญหา Payload Error เวลาส่งรูปภาพหลายรูป
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// เชื่อมต่อ Turso Cloud Database หรือ Local SQLite
const dbUrl = process.env.TURSO_DATABASE_URL || "file:surin_court.db";
const dbAuthToken = process.env.TURSO_AUTH_TOKEN || "";

const db = createClient({
  url: dbUrl,
  authToken: dbAuthToken
});

// สร้างตารางหากยังไม่มีในระบบ (รักษาข้อมูลผู้ใช้และข้อมูลหมายศาลถาวร)
const initDb = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS warrants (
        id TEXT PRIMARY KEY,
        batchId TEXT,
        ownerUsername TEXT,
        blackNo TEXT,
        redNo TEXT,
        warrantType TEXT,
        targetName TEXT,
        address TEXT,
        subdistrict TEXT,
        district TEXT,
        province TEXT,
        zipcode TEXT,
        price TEXT,
        warrantResult TEXT,
        gps TEXT,
        photos TEXT,
        sendDate TEXT,
        sendTime TEXT,
        isSaved INTEGER
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        fullName TEXT,
        position TEXT,
        role TEXT
      )
    `);

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

    // สร้าง Admin เริ่มต้น (ใช้ INSERT OR IGNORE เพื่อป้องกันการเขียนทับบัญชีที่มีอยู่แล้ว)
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (id, username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['admin_default', 'tomsound', '123456', 'นายจิรพงษ์ มณีปรุ', 'เจ้าพนักงานเดินหมาย', 'admin']
    });

    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database Init Error:", err);
  }
};

initDb();

// API Routes
app.get('/api/users', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, fullName, position, role } = req.body;
  const newId = `user_${Date.now()}`;
  try {
    await db.execute({
      sql: `INSERT INTO users (id, username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [newId, (username || '').trim().toLowerCase(), password, fullName, position, role || 'user']
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Username นี้มีในระบบแล้ว หรือเกิดข้อผิดพลาด' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { username, password, fullName, position, role } = req.body;
  try {
    await db.execute({
      sql: `UPDATE users SET username = ?, password = ?, fullName = ?, position = ?, role = ? WHERE id = ?`,
      args: [(username || '').trim().toLowerCase(), password, fullName, position, role, req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = (username || '').trim();
  try {
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password = ?",
      args: [cleanUsername, password]
    });
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ ดึงข้อมูลคดี (ตัดช่องว่างข้างหน้า/ข้างหลัง Username เพื่อความแม่นยำ 100%)
app.get('/api/warrants/:username', async (req, res) => {
  const cleanUsername = (req.params.username || '').trim();
  try {
    const result = await db.execute({
      sql: "SELECT * FROM warrants WHERE LOWER(ownerUsername) = LOWER(?) ORDER BY id DESC",
      args: [cleanUsername]
    });
    const records = result.rows.map(row => ({
      ...row,
      photos: row.photos ? JSON.parse(row.photos) : []
    }));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ บันทึกคดี (ตัดช่องว่าง Username อัตโนมัติ)
app.post('/api/warrants/batch', async (req, res) => {
  const { username, records } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: "Invalid records format" });

  const cleanUsername = (username || '').trim().toLowerCase();

  try {
    for (const rec of records) {
      const photosJson = JSON.stringify(rec.photos || []);
      const isSavedVal = rec.isSaved ? 1 : 0;

      await db.execute({
        sql: `INSERT INTO warrants (id, batchId, ownerUsername, blackNo, redNo, warrantType, targetName, address, subdistrict, district, province, zipcode, price, warrantResult, gps, photos, sendDate, sendTime, isSaved)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                blackNo=excluded.blackNo,
                redNo=excluded.redNo,
                warrantType=excluded.warrantType,
                targetName=excluded.targetName,
                address=excluded.address,
                subdistrict=excluded.subdistrict,
                district=excluded.district,
                province=excluded.province,
                zipcode=excluded.zipcode,
                price=excluded.price,
                warrantResult=excluded.warrantResult,
                gps=excluded.gps,
                photos=excluded.photos,
                sendDate=excluded.sendDate,
                sendTime=excluded.sendTime,
                isSaved=excluded.isSaved`,
        args: [
          rec.id, rec.batchId || '', cleanUsername, rec.blackNo || '', rec.redNo || '',
          rec.warrantType || '', rec.targetName || '', rec.address || '', rec.subdistrict || '',
          rec.district || '', rec.province || 'สุรินทร์', rec.zipcode || '32000', rec.price || '0.00',
          rec.warrantResult || 'ส่งได้โดยวิธีปิดหมาย', rec.gps || '', photosJson, rec.sendDate || '',
          rec.sendTime || '', isSavedVal
        ]
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Batch insert error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/warrants/:id', async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM warrants WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-logs', async (req, res) => {
  const { id, timestamp, username, fullName, user, action, details } = req.body;
  const nameToSave = fullName || user || username || '';
  try {
    await db.execute({
      sql: `INSERT INTO audit_logs (id, timestamp, username, fullName, user, action, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, timestamp, (username || '').trim().toLowerCase(), nameToSave, nameToSave, action, details]
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.delete('/api/audit-logs/clear-old', async (req, res) => {
  try {
    await db.execute("DELETE FROM audit_logs");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});