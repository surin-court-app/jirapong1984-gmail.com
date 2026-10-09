import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Printer, Plus, FileText, User, Landmark, Lock, LogOut, CheckCircle2, AlertCircle, Users, Trash2, UserPlus, ListOrdered, Download, FolderOpen, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:5000/api';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby20-gT1v7mAORr8RBPDVpu13wnP7P1VK1x-U2Anz2Uw4F68T0uJFG9qTMTQp45EgAE/exec';

// ฟังก์ชันส่งข้อมูลหา Google Apps Script ผ่าน Fetch
const sendToGoogleScript = async (payload) => {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    console.error("Fetch Error:", err);
    return false;
  }
};

export default function SurinCourtWarrantApp() {
  const getCurrentTimeStr = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const warrantResultOptions = [
    "ส่งได้โดยวิธีปิดหมาย",
    "ส่งได้โดยวิธีมีผู้รับแทน",
    "ส่งได้โดยวิธีรับด้วยตนเอง",
    "ส่งไม่ได้เนื่องจากย้าย/ไม่พบผู้รับตามจ่าหน้า",
    "ส่งไม่ได้เนื่องจากบ้านถูกรื้อถอน/เป็นที่ว่างเปล่า",
    "ส่งไม่ได้เนื่องจากจ่าหน้าไม่ชัดเจน/รหัสไปรษณีย์ไม่ถูกต้อง"
  ];

  const [currentUser, setCurrentUser] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [warrantRecords, setWarrantRecords] = useState([]);
  const [selectedWarrantId, setSelectedWarrantId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncingServer, setSyncingServer] = useState(false);

  // ฟอร์มเข้าสู่ระบบ
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // ฟอร์มจัดการผู้ใช้ (Admin)
  const [userForm, setUserForm] = useState({ username: '', password: '', fullName: '', position: '', role: 'user' });

  // ฟอร์มกรอกข้อมูลหมาย
  const [formData, setFormData] = useState({
    blackNo: '',
    redNo: '',
    warrantType: 'หมายนัด',
    price: '',
    targetName: '',
    sendDate: new Date().toISOString().split('T')[0],
    sendTime: getCurrentTimeStr(),
    address: '',
    subdistrict: '',
    district: 'เมืองสุรินทร์',
    province: 'สุรินทร์',
    zipcode: '32000',
    warrantResult: 'ส่งได้โดยวิธีปิดหมาย',
    gps: '',
    photos: []
  });

  // 1. โหลดข้อมูลผู้ใช้ที่เคยล็อกอินไว้
  useEffect(() => {
    const savedUser = localStorage.getItem('surin_court_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  // 2. โหลดรายชื่อผู้ใช้งานทั้งหมด (ถ้าเป็น Admin)
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser]);

  // 3. ✨ ดึงข้อมูลรายการคดีของ User ตนเองจาก Server อัตโนมัติเมื่อเปลี่ยนผู้ใช้/โหลดหน้าเว็บ
  useEffect(() => {
    if (currentUser?.username) {
      loadWarrantsFromServer(currentUser.username);
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    }
  };

  // ดึงข้อมูลรายการคดีผูกตาม User จากส่วนกลาง (Turso/SQLite Server)
  const loadWarrantsFromServer = async (username) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/warrants/${username}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setWarrantRecords(data);
        }
      }
    } catch (err) {
      console.error("Load warrants error:", err);
    } finally {
      setLoading(false);
    }
  };

  // บันทึกซิงก์ข้อมูลรายการคดีผูกตาม User ขึ้นส่วนกลางทันที
  const syncWarrantsToBackend = async (records, username) => {
    const targetUser = username || currentUser?.username;
    if (!targetUser || !Array.isArray(records)) return;

    try {
      const res = await fetch(`${API_URL}/warrants/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUser,
          records: records
        })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error("Sync to backend error:", err);
      return null;
    }
  };

  // เข้าสู่ระบบ
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('surin_court_user', JSON.stringify(data.user));
        loadWarrantsFromServer(data.user.username);
      } else {
        setLoginError(data.message || 'Username หรือ Password ไม่ถูกต้อง');
      }
    } catch (err) {
      setLoginError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  };

  // ออกจากระบบ
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('surin_court_user');
    setWarrantRecords([]);
  };

  // นำเข้าไฟล์ Excel บัญชีหมายศาล (ปรับ ID ป้องกันซ้ำ + ซิงก์ดึงข้อมูลจาก Server ทันที)
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        const nowTs = Date.now();
        const newRecords = rawData.map((row, index) => {
          const blackNoVal = row['เลขดำที่'] || row['หมายเลขคดีดำ'] || '';
          const targetNameVal = row['ชื่อจำเลย'] || row['หมายถึงใคร'] || '';
          // สร้าง ID เอกลักษณ์เฉพาะรายการ เพื่อป้องกัน ID ซ้ำกันใน Database
          const uniqueId = `warrant_${currentUser.username}_${nowTs}_${index}_${Math.random().toString(36).substr(2, 5)}`;

          return {
            id: uniqueId,
            blackNo: String(blackNoVal),
            redNo: String(row['เลขแดงที่'] || row['หมายเลขคดีแดง'] || ''),
            warrantType: String(row['ประเภทหมาย'] || row['หมายอะไร'] || 'หมายนัด'),
            targetName: String(targetNameVal),
            address: String(row['ที่อยู่'] || ''),
            subdistrict: String(row['ตำบล'] || ''),
            district: String(row['อำเภอ'] || 'เมืองสุรินทร์'),
            province: String(row['จังหวัด'] || 'สุรินทร์'),
            zipcode: String(row['รหัสไปรษณีย์'] || '32000'),
            price: String(row['ค่านำส่ง'] || row['ราคา'] || '0.00'),
            warrantResult: 'ส่งได้โดยวิธีปิดหมาย',
            gps: '',
            photos: [],
            sendDate: new Date().toISOString().split('T')[0],
            sendTime: getCurrentTimeStr(),
            isSaved: 0
          };
        });

        // 1. บันทึกขึ้นเซิร์ฟเวอร์กลางทันที
        await syncWarrantsToBackend(newRecords, currentUser.username);
        
        // 2. ดึงข้อมูลจริงจาก Server กลับมาอัปเดตหน้าจอทันที
        await loadWarrantsFromServer(currentUser.username);

        alert(`อัปโหลดและบันทึกคดีเรียบร้อยจำนวน ${newRecords.length} รายการ (เปิดดูได้จากทั้งคอมพิวเตอร์และมือถือทันที)`);
      } catch (err) {
        alert("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // เลือกรายการคดีมากรอกข้อมูล
  const handleSelectWarrant = (record) => {
    setSelectedWarrantId(record.id);
    setFormData({
      blackNo: record.blackNo || '',
      redNo: record.redNo || '',
      warrantType: record.warrantType || 'หมายนัด',
      price: record.price || '',
      targetName: record.targetName || '',
      sendDate: record.sendDate || new Date().toISOString().split('T')[0],
      sendTime: record.sendTime || getCurrentTimeStr(),
      address: record.address || '',
      subdistrict: record.subdistrict || '',
      district: record.district || 'เมืองสุรินทร์',
      province: record.province || 'สุรินทร์',
      zipcode: record.zipcode || '32000',
      warrantResult: record.warrantResult || 'ส่งได้โดยวิธีปิดหมาย',
      gps: record.gps || '',
      photos: record.photos || []
    });
  };

  // อัปโหลดและบีบอัดรูปภาพ
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          setFormData(prev => ({
            ...prev,
            photos: [...prev.photos, compressedBase64]
          }));
        };
      };
      reader.readAsDataURL(file);
    });
  };

  // บันทึกและซิงก์ข้อมูลส่ง Google Sheet / Drive และ Server
  const handleSaveAndSync = async () => {
    if (!selectedWarrantId) {
      alert("กรุณาเลือกรายการคดีที่ต้องการบันทึกข้อมูลก่อน");
      return;
    }

    setSyncingServer(true);
    try {
      const updatedRecord = {
        ...formData,
        id: selectedWarrantId,
        isSaved: 1
      };

      // 1. อัปเดตข้อมูลในสเตตหน้าจอ
      const updatedList = warrantRecords.map(item => item.id === selectedWarrantId ? updatedRecord : item);
      setWarrantRecords(updatedList);

      // 2. ส่งซิงก์ไป Google Apps Script (ลง Sheet + Drive)
      const payload = {
        warrant: updatedRecord,
        sender: currentUser
      };
      await sendToGoogleScript(payload);

      // 3. ซิงก์ขึ้น Server ส่วนกลาง (Turso/SQLite)
      await syncWarrantsToBackend([updatedRecord], currentUser.username);

      alert(`บันทึกรายงานผลส่งหมาย "${updatedRecord.targetName}" เรียบร้อยแล้ว! ข้อมูลและลิงก์รูปภาพซิงก์ลง Google Sheet, Google Drive และเซิร์ฟเวอร์กลางเรียบร้อยแล้ว`);
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึกซิงก์ข้อมูล");
    } finally {
      setSyncingServer(false);
    }
  };

  // ค้นหารายการคดี
  const filteredWarrants = warrantRecords.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      (item.blackNo && item.blackNo.toLowerCase().includes(term)) ||
      (item.redNo && item.redNo.toLowerCase().includes(term)) ||
      (item.targetName && item.targetName.toLowerCase().includes(term))
    );
  });

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 flex items-center justify-center p-4">
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl backdrop-blur-md">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 bg-amber-500/10 rounded-full border border-amber-500/20 mb-3">
              <Landmark className="w-12 h-12 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-amber-100">ศาลจังหวัดสุรินทร์</h1>
            <p className="text-xs text-amber-200/70 mt-1">ระบบงานบันทึกและติดตามการส่งหมายศาลอิเล็กทรอนิกส์ (Google Sheets Online)</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-amber-200/80 mb-1">USERNAME</label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="กรอกชื่อผู้ใช้งาน"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-200/80 mb-1">PASSWORD</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="กรอกรหัสผ่าน"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 rounded-lg transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>เข้าสู่ระบบ</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-12">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50 border-b border-amber-500/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Landmark className="w-8 h-8 text-amber-400" />
            <div>
              <h1 className="font-bold text-amber-100 text-base leading-tight">ศาลจังหวัดสุรินทร์</h1>
              <p className="text-xs text-slate-400">ระบบซิงก์ข้อมูลส่งหมายศาล</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => loadWarrantsFromServer(currentUser.username)}
              className="p-2 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
              title="ดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์กลาง"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-amber-200">{currentUser.fullName}</p>
              <p className="text-xs text-slate-400">{currentUser.position} ({currentUser.role})</p>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
              title="ออกจากระบบ"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        
        {/* Banner ข้อมูลผู้ใช้ */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-700">
              <ListOrdered className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">จัดการข้อมูลหมายคดี - บัญชี {currentUser.fullName} ({currentUser.username})</h2>
              <p className="text-xs text-slate-500">อัปโหลดไฟล์ Excel จากเครื่องใดก็ได้ ข้อมูลจะซิงก์ดึงมาแสดงทั้งคอมพิวเตอร์และมือถือตรงกัน 100%</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="flex-1 md:flex-none cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition shadow-sm flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              <span>เลือกไฟล์ Excel บัญชีหมายศาล</span>
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
            </label>
          </div>
        </div>

        {/* ค้นหาและรายการคดี */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <input
              type="text"
              placeholder="พิมพ์ค้นหาเลขดำ, เลขแดง, ชื่อจำเลย..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredWarrants.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              ยังไม่มีรายการคดีในบัญชีของ {currentUser.fullName} (กดนำเข้าไฟล์ Excel เพื่อเริ่มใช้งาน)
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
              {filteredWarrants.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectWarrant(item)}
                  className={`p-3 rounded-lg border text-sm cursor-pointer transition ${
                    selectedWarrantId === item.id
                      ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                      : item.isSaved
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span>ดำ: {item.blackNo || '-'}</span>
                    <span className="text-red-600">แดง: {item.redNo || '-'}</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 truncate">ถึง: {item.targetName}</div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                    <span>{item.warrantType}</span>
                    {item.isSaved ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> รายงานแล้ว
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium">รอดำเนินการ</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ฟอร์มกรอกข้อมูลส่งหมาย */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <span>1. ข้อมูลคดีและรายละเอียดหมาย</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">เลขดำที่</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50"
                value={formData.blackNo}
                onChange={(e) => setFormData({ ...formData, blackNo: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">เลขแดงที่</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50"
                value={formData.redNo}
                onChange={(e) => setFormData({ ...formData, redNo: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">หมายถึงใคร (จำเลย)</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50"
                value={formData.targetName}
                onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
              />
            </div>
          </div>

          <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2 pt-2">
            <User className="w-5 h-5 text-amber-600" />
            <span>2. รายละเอียดผลการส่งหมาย</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">วิธีการส่งหมาย</label>
              <select
                className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50"
                value={formData.warrantResult}
                onChange={(e) => setFormData({ ...formData, warrantResult: e.target.value })}
              >
                {warrantResultOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">แนบรูปถ่ายสถานที่ส่งหมาย</label>
              <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg p-2 flex items-center justify-center gap-2 text-slate-700 text-xs">
                <Camera className="w-4 h-4 text-amber-600" />
                <span>เลือกรูปถ่ายสถานที่ ({formData.photos.length} รูป)</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          {/* แสดงพรีวิวรูปถ่าย */}
          {formData.photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {formData.photos.map((imgSrc, idx) => (
                <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                  <img src={imgSrc} alt={`photo-${idx}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* ปุ่มบันทึกซิงก์ */}
          <div className="pt-4">
            <button
              onClick={handleSaveAndSync}
              disabled={syncingServer}
              className="w-full bg-amber-800 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-amber-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{syncingServer ? 'กำลังบันทึกและซิงก์ข้อมูล...' : 'บันทึกข้อมูลซิงก์ Server (srnccourtrider)'}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}