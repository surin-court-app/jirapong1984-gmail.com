import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycby29-gTlv7mAORr0RBPDVpui3wmP7PlVk1x-U2aNz2UW4F68T0uJFG9qTMTQe4SEgAE/exec';
const JWT_SECRET = process.env.JWT_SECRET || 'srnc-court-warrant-secure-key-2026';

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const dbUrl = process.env.TURSO_DATABASE_URL || "file:surin_court.db";
const dbAuthToken = process.env.TURSO_AUTH_TOKEN || "";

const db = createClient({
  url: dbUrl,
  authToken: dbAuthToken
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

// Rate Limiting
const loginAttempts = new Map();

const rateLimiter = (req, res, next) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const attempt = loginAttempts.get(clientIp);

  if (attempt && attempt.lockUntil > now) {
    const remainingMinutes = Math.ceil((attempt.lockUntil - now) / 60000);
    return res.status(429).json({
      success: false,
      message: `คุณพยายามเข้าสู่ระบบผิดเกินกำหนด กรุณารออีก ${remainingMinutes} นาที`
    });
  }

  next();
};

const recordFailedAttempt = (ip) => {
  const now = Date.now();
  const attempt = loginAttempts.get(ip) || { count: 0, lockUntil: 0 };
  attempt.count += 1;
  if (attempt.count >= 5) {
    attempt.lockUntil = now + 15 * 60 * 1000;
    attempt.count = 0;
  }
  loginAttempts.set(ip, attempt);
};

const clearFailedAttempt = (ip) => {
  loginAttempts.delete(ip);
};

// Token
function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ success: false, message: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
  }

  req.user = decoded;
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' });
  }
  next();
};

async function forwardToGoogleScript(payload) {
  try {
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    const response = await fetchFn(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (err) {
    console.error("Backend forwardToGoogleScript Error:", err);
    return false;
  }
}

// กำหนดโครงสร้างฐานข้อมูล
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

    // ตรวจสอบและเพิ่ม Admin เริ่มต้นโดยใช้เฉพาะคอลัมน์มาตรฐาน
    const defaultPassword = '123456';
    const defaultHashedPassword = hashPassword(defaultPassword);

    await db.execute({
      sql: `INSERT OR IGNORE INTO users (id, username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['admin_default', 'tomsound', defaultHashedPassword, 'นายจิรพงษ์ มณีปรุ', 'เจ้าพนักงานเดินหมาย', 'admin']
    });

    console.log("Database initialized successfully without schema conflicts");
  } catch (err) {
    console.error("Database Init Error:", err);
  }
};

initDb();

// -------------------------------------------------------------
// Auth & Users API
// -------------------------------------------------------------

app.post('/api/login', rateLimiter, async (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = (username || '').trim();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE LOWER(username) = LOWER(?)",
      args: [cleanUsername]
    });

    if (result.rows.length === 0) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }

    const user = result.rows[0];
    const incomingHashed = hashPassword(password);
    let isMatch = (user.password === incomingHashed) || (user.password === password);

    if (isMatch && user.password === password) {
      await db.execute({
        sql: "UPDATE users SET password = ? WHERE id = ?",
        args: [incomingHashed, user.id]
      });
    }

    if (isMatch) {
      clearFailedAttempt(clientIp);

      // หากรหัสผ่านที่ส่งมายังเป็น 123456 จะแจ้งเตือนให้เปลี่ยนรหัสทันที
      const isDefaultPassword = (password === '123456');

      const safeUser = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        position: user.position,
        role: user.role,
        mustChangePassword: isDefaultPassword
      };
      const token = generateToken(safeUser);
      res.json({ success: true, user: safeUser, token });
    } else {
      recordFailedAttempt(clientIp);
      res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร' });
  }

  const cleanOld = String(oldPassword || '').trim();
  const cleanNew = String(newPassword || '').trim();
  const userIdentifier = req.user?.username ? req.user.username.trim().toLowerCase() : '';

  try {
    // ค้นหาจาก username หรือ id เพื่อความแม่นยำ 100%
    const result = await db.execute({
      sql: "SELECT id, password FROM users WHERE LOWER(username) = LOWER(?) OR id = ?",
      args: [userIdentifier, req.user?.id || '']
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' });
    }

    const user = result.rows[0];
    const currentHash = String(user.password || '');
    const oldHashed = hashPassword(cleanOld);

    // ตรวจสอบทั้งกรณีที่ในฐานข้อมูลเป็น SHA-256 หรือเป็น Plain text เดิม
    const isMatch = (currentHash === oldHashed) || (currentHash === cleanOld);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }

    const newHashed = hashPassword(cleanNew);
    await db.execute({
      sql: "UPDATE users SET password = ? WHERE id = ?",
      args: [newHashed, user.id]
    });

    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute("SELECT id, username, fullName, position, role FROM users");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, fullName, position, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' });
  }

  const newId = `user_${Date.now()}`;
  try {
    const secureHashedPassword = hashPassword(password);
    await db.execute({
      sql: `INSERT INTO users (id, username, password, fullName, position, role) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [newId, (username || '').trim().toLowerCase(), secureHashedPassword, fullName, position, role || 'user']
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Username นี้มีในระบบแล้ว หรือเกิดข้อผิดพลาด' });
  }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, fullName, position, role } = req.body;
  try {
    if (password && password.trim() !== '') {
      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' });
      }
      const secureHashedPassword = hashPassword(password);
      await db.execute({
        sql: `UPDATE users SET username = ?, password = ?, fullName = ?, position = ?, role = ? WHERE id = ?`,
        args: [(username || '').trim().toLowerCase(), secureHashedPassword, fullName, position, role, req.params.id]
      });
    } else {
      await db.execute({
        sql: `UPDATE users SET username = ?, fullName = ?, position = ?, role = ? WHERE id = ?`,
        args: [(username || '').trim().toLowerCase(), fullName, position, role, req.params.id]
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// -------------------------------------------------------------
// Warrants & Proxy API
// -------------------------------------------------------------

app.post('/api/sync-google-sheet', authenticateToken, async (req, res) => {
  try {
    const success = await forwardToGoogleScript(req.body);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/warrants/:username', authenticateToken, async (req, res) => {
  const cleanUsername = (req.params.username || '').trim().toLowerCase();
  
  if (req.user.role !== 'admin' && req.user.username.toLowerCase() !== cleanUsername) {
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลของบัญชีอื่น' });
  }

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

app.post('/api/warrants/batch', authenticateToken, async (req, res) => {
  const { username, records } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: "Invalid records format" });

  const cleanUsername = (username || '').trim().toLowerCase();
  if (req.user.role !== 'admin' && req.user.username.toLowerCase() !== cleanUsername) {
    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์บันทึกข้อมูลในบัญชีอื่น' });
  }

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
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/warrants/:id', authenticateToken, async (req, res) => {
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

// -------------------------------------------------------------
// Audit Logs API
// -------------------------------------------------------------

app.get('/api/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-logs', authenticateToken, async (req, res) => {
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

app.delete('/api/audit-logs/clear-old', authenticateToken, requireAdmin, async (req, res) => {
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
  console.log(`Hardened Secure Server running on port ${PORT}`);
});