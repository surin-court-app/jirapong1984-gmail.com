import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Printer, Plus, FileText, User, Landmark, Lock, LogOut, CheckCircle2, AlertCircle, Users, Trash2, UserPlus, ListOrdered, Download, FolderOpen, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:5000/api';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby20-gT1v7mAORr8RBPDVpu13wnP7P1VK1x-U2Anz2Uw4F68T0uJFG9qTMTQp45EgAE/exec';

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

  const [activeTab, setActiveTab] = useState('form'); // 'form', 'audit', 'users'
  const [currentUser, setCurrentUser] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [warrantRecords, setWarrantRecords] = useState([]);
  const [selectedWarrantId, setSelectedWarrantId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncingServer, setSyncingServer] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

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

  // โหลดผู้ใช้
  useEffect(() => {
    const savedUser = localStorage.getItem('surin_court_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser]);

  // ดึงข้อมูลรายการคดีของ User ตนเองจาก Server อัตโนมัติเมื่อเปิดแอป
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

  const syncWarrantsToBackend = async (records, username) => {
    const targetUser = username || currentUser?.username;
    if (!targetUser || !Array.isArray(records)) return;

    try {
      await fetch(`${API_URL}/warrants/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUser,
          records: records
        })
      });
    } catch (err) {
      console.error("Sync to backend error:", err);
    }
  };

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

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('surin_court_user');
    setWarrantRecords([]);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("เพิ่มผู้ใช้งานสำเร็จ");
        setUserForm({ username: '', password: '', fullName: '', position: '', role: 'user' });
        fetchUsers();
      } else {
        alert(data.message || "เกิดข้อผิดพลาดในการเพิ่มผู้ใช้");
      }
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

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
          const uniqueId = `warrant_${currentUser.username}_${nowTs}_${index}_${Math.random().toString(36).substr(2, 5)}`;
          return {
            id: uniqueId,
            blackNo: String(row['เลขดำที่'] || row['หมายเลขคดีดำ'] || ''),
            redNo: String(row['เลขแดงที่'] || row['หมายเลขคดีแดง'] || ''),
            warrantType: String(row['ประเภทหมาย'] || row['หมายอะไร'] || 'หมายนัด'),
            targetName: String(row['ชื่อจำเลย'] || row['หมายถึงใคร'] || ''),
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

        // 1. ส่งขึ้น Server ซิงก์ทันที
        await syncWarrantsToBackend(newRecords, currentUser.username);
        // 2. ดึงข้อมูลจริงกลับมาแสดงผล
        await loadWarrantsFromServer(currentUser.username);

        alert(`อัปโหลดไฟล์เรียบร้อย! นำเข้าข้อมูลและซิงก์เข้า Google Sheet 'srnccourtrider' สำเร็จ ${newRecords.length} รายการ`);
      } catch (err) {
        alert("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

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

      const updatedList = warrantRecords.map(item => item.id === selectedWarrantId ? updatedRecord : item);
      setWarrantRecords(updatedList);

      const payload = {
        warrant: updatedRecord,
        sender: currentUser
      };
      await sendToGoogleScript(payload);
      await syncWarrantsToBackend([updatedRecord], currentUser.username);

      alert(`บันทึกรายงานผลส่งหมาย "${updatedRecord.targetName}" สำเร็จ! ระบบได้ซิงก์ข้อมูลลง Google Sheet และจัดเก็บรูปภาพเข้า Google Drive โฟลเดอร์ Warrant_Photos เรียบร้อยแล้ว`);
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึกซิงก์ข้อมูล");
    } finally {
      setSyncingServer(false);
    }
  };

  const handleResetForm = () => {
    setSelectedWarrantId('');
    setFormData({
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
  };

  const filteredWarrants = warrantRecords.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      (item.blackNo && item.blackNo.toLowerCase().includes(term)) ||
      (item.redNo && item.redNo.toLowerCase().includes(term)) ||
      (item.targetName && item.targetName.toLowerCase().includes(term))
    );
  });

  const pendingCount = warrantRecords.filter(r => !r.isSaved).length;
  const reportedCount = warrantRecords.filter(r => r.isSaved).length;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950 flex items-center justify-center p-4">
        <div className="bg-amber-950/90 border border-amber-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl backdrop-blur-md">
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
                <User className="w-5 h-5 text-amber-500/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  className="w-full bg-amber-900/50 border border-amber-700/50 rounded-lg pl-10 pr-4 py-2.5 text-amber-100 placeholder-amber-700 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="กรอกชื่อผู้ใช้งาน"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-200/80 mb-1">PASSWORD</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-amber-500/50 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  className="w-full bg-amber-900/50 border border-amber-700/50 rounded-lg pl-10 pr-4 py-2.5 text-amber-100 placeholder-amber-700 focus:outline-none focus:border-amber-500 text-sm"
                  placeholder="กรอกรหัสผ่าน"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-700 hover:bg-amber-600 text-white font-medium py-2.5 rounded-lg transition-all shadow-lg shadow-amber-900/50 flex items-center justify-center gap-2"
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
    <div className="min-h-screen bg-amber-50/30 font-sans pb-12">
      {/* Header Banner แบบเดิม */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white shadow-xl border-b-4 border-amber-600">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <Landmark className="w-12 h-12 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-amber-100 tracking-wide">
                  ระบบบันทึกและติดตามการส่งหมายศาล
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                  <span className="text-sm font-semibold text-amber-300">ศาลจังหวัดสุรินทร์</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Google Sheets Sync Online
                  </span>
                </div>
              </div>
            </div>

            {/* แท็บเมนูแบบเดิม */}
            <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-amber-500/30">
              <button
                onClick={() => setActiveTab('form')}
                className={`px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition flex items-center gap-1.5 ${
                  activeTab === 'form' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" /> ฟอร์มบันทึกหมาย
              </button>
              
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition flex items-center gap-1.5 ${
                    activeTab === 'users' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" /> จัดการผู้ใช้งาน ({usersList.length})
                </button>
              )}

              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'form' && (
          <div className="space-y-6">
            
            {/* กล่องการ์ดสีเหลืองแบบเดิม */}
            <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
                  <ListOrdered className="w-6 h-6 text-amber-700" />
                  <span>จัดการข้อมูลหมายคดี - บัญชี {currentUser.fullName} ({currentUser.username})</span>
                </h2>
              </div>

              {/* ปุ่มส้ม ฟ้า เขียว แบบเดิม 100% */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => loadWarrantsFromServer(currentUser.username)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"
                >
                  <FolderOpen className="w-5 h-5" />
                  <span>คลังโฟลเดอร์ย้อนหลัง</span>
                </button>

                <button
                  onClick={handleResetForm}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"
                >
                  <Plus className="w-5 h-5" />
                  <span>กรอกข้อมูลเอง (ล้างฟอร์มใหม่)</span>
                </button>

                <label className="cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm">
                  <Download className="w-5 h-5" />
                  <span>เลือกไฟล์ Excel บัญชีหมายศาล</span>
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
                </label>
              </div>

              {/* ช่องค้นหา + แท็บรอดำเนินการ / รายงานแล้ว */}
              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  placeholder="พิมพ์ค้นหาเลขดำ, เลขแดง, ชื่อ..."
                  className="w-full bg-white border border-amber-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-600 shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-amber-900 text-white p-3 rounded-xl text-center shadow-inner">
                    <span className="text-xs opacity-80 block">รอดำเนินการ</span>
                    <span className="text-xl font-bold">({pendingCount})</span>
                  </div>
                  <div className="bg-amber-100 text-amber-900 border border-amber-300 p-3 rounded-xl text-center">
                    <span className="text-xs font-semibold block">รายงานแล้ว</span>
                    <span className="text-xl font-bold">({reportedCount})</span>
                  </div>
                </div>
              </div>

              {/* รายการคดี */}
              {filteredWarrants.length === 0 ? (
                <div className="text-center py-6 text-amber-800/60 text-sm font-medium border border-dashed border-amber-300 rounded-xl bg-white/50">
                  ยังไม่มีรายการคดีในบัญชีของ {currentUser.fullName}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {filteredWarrants.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectWarrant(item)}
                      className={`p-3 rounded-xl border-2 text-sm cursor-pointer transition ${
                        selectedWarrantId === item.id
                          ? 'border-amber-600 bg-amber-100/80 shadow-md'
                          : item.isSaved
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-amber-200 bg-white hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>ดำ: {item.blackNo || '-'}</span>
                        <span className="text-red-600">แดง: {item.redNo || '-'}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 truncate">ถึง: {item.targetName}</div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                        <span>{item.warrantType}</span>
                        {item.isSaved ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> รายงานแล้ว
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold">รอดำเนินการ</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ฟอร์มกรอกข้อมูลหมาย (หัวข้อ 1 และ 2 แบบเดิม) */}
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6 space-y-6">
              
              {/* หัวข้อ 1 */}
              <div>
                <h3 className="text-lg font-bold text-amber-900 border-b-2 border-amber-100 pb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-700" />
                  <span>1. ข้อมูลคดีและรายละเอียดหมาย</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">เลขดำที่</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:border-amber-600"
                      value={formData.blackNo}
                      onChange={(e) => setFormData({ ...formData, blackNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">เลขแดงที่</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:border-amber-600"
                      value={formData.redNo}
                      onChange={(e) => setFormData({ ...formData, redNo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">หมายอะไร</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:border-amber-600"
                      value={formData.warrantType}
                      onChange={(e) => setFormData({ ...formData, warrantType: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ราคา/ค่านำส่ง (บาท)</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:border-amber-600"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* หัวข้อ 2 */}
              <div>
                <h3 className="text-lg font-bold text-amber-900 border-b-2 border-amber-100 pb-2 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-700" />
                  <span>2. รายละเอียดผู้รับหมายและสถานที่นำส่ง</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">หมายถึงใคร (ชื่อ-นามสกุล)</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:border-amber-600"
                      value={formData.targetName}
                      onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">วันที่ส่งหมาย</label>
                    <input
                      type="date"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:border-amber-600"
                      value={formData.sendDate}
                      onChange={(e) => setFormData({ ...formData, sendDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาที่ส่งหมาย (น.)</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:border-amber-600"
                      value={formData.sendTime}
                      onChange={(e) => setFormData({ ...formData, sendTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ที่อยู่ / บ้านเลขที่ / ถนน / หมู่บ้าน</label>
                  <textarea
                    rows="2"
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:border-amber-600 text-sm"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">อำเภอ</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ตำบล</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                      value={formData.subdistrict}
                      onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">จังหวัด</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">รหัสไปรษณีย์</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                      value={formData.zipcode}
                      onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">วิธีการส่งหมาย</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-sm font-medium"
                    value={formData.warrantResult}
                    onChange={(e) => setFormData({ ...formData, warrantResult: e.target.value })}
                  >
                    {warrantResultOptions.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* แนบรูปภาพ */}
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">รูปถ่ายสถานที่ส่งหมาย</label>
                  <label className="cursor-pointer border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl p-4 bg-amber-50/50 flex flex-col items-center justify-center gap-1 text-slate-600 transition">
                    <Camera className="w-8 h-8 text-amber-600" />
                    <span className="text-xs font-bold">เลือกรูปถ่ายสถานที่ ({formData.photos.length} รูป)</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>

                {formData.photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {formData.photos.map((imgSrc, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100 shadow-sm">
                        <img src={imgSrc} alt={`photo-${idx}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ปุ่มบันทึกซิงก์สีน้ำตาลส้มแบบเดิม 100% */}
              <div className="pt-4">
                <button
                  onClick={handleSaveAndSync}
                  disabled={syncingServer}
                  className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-4 rounded-xl transition shadow-xl shadow-amber-950/20 flex items-center justify-center gap-2 disabled:opacity-50 text-base"
                >
                  <CheckCircle2 className="w-6 h-6 text-amber-400" />
                  <span>{syncingServer ? 'กำลังบันทึกและซิงก์ข้อมูล...' : 'บันทึกข้อมูลซิงก์ Server (srnccourtrider)'}</span>
                </button>
              </div>

              {/* ปุ่มดาวน์โหลด Word, พิมพ์รายงาน PDF แบบเดิม */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow">
                  <Download className="w-4 h-4" /> ดาวน์โหลดเอกสาร (Word)
                </button>
                <button className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow">
                  <Printer className="w-4 h-4" /> พิมพ์รายงาน (PDF)
                </button>
                <button className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow">
                  <Printer className="w-4 h-4" /> พิมพ์รายงานทั้งหมด ({warrantRecords.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* แท็บจัดการผู้ใช้งาน (สำหรับ Admin) */}
        {activeTab === 'users' && currentUser?.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm border border-amber-200 p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserPlus className="w-5 h-5 text-amber-700" />
              <span>เพิ่มผู้ใช้งานระบบใหม่</span>
            </h3>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Username</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ตำแหน่ง</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  value={userForm.position}
                  onChange={(e) => setUserForm({ ...userForm, position: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">สิทธิ์การใช้งาน</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="user">เจ้าพนักงานเดินหมาย (User)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> เพิ่มผู้ใช้
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}