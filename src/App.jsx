import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, Printer, Plus, FileText, User, Landmark, Lock, LogOut, CheckCircle2, AlertCircle, Users, Trash2, UserPlus, ListOrdered, Edit3, X, Save, FileSpreadsheet, Upload, ArrowRight, CheckSquare, Clock, CheckCircle, FilePlus, History, Search, RotateCcw, PrinterCheck, Calendar, ShieldCheck, FileSearch, Folder } from 'lucide-react';

// ใช้ Relative Path เพื่อเชื่อมต่อไปยัง Express บน Server เดียวกันโดยอัตโนมัติ
const API_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api';

export default function SurinCourtWarrantApp() {
  const getCurrentTimeStr = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const warrantResultOptions = [
    "ส่งได้โดยวิธีปิดหมาย",
    "ส่งได้รับได้ด้วยตัวเอง",
    "ส่งได้โดยวิธีปิดประกาศ",
    "ส่งได้โดยมีผู้แทน ซึ่งอายุกว่า 20 ปี และอยู่บ้าน/สำนักงานเดียวกัน",
    "ส่งไม่ได้เพราะไม่มีผู้รับตามจ่าหน้า",
    "ส่งไม่ได้เพราะบ้านรื้อถอน",
    "ส่งได้เพราะ...",
    "ส่งไม่ได้เพราะ...",
    "อื่น..."
  ];

  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // ดึงข้อมูลผู้ใช้งานที่เคยล็อกอินค้างไว้จาก localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('srnc_court_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem('srnc_court_user');
  });

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('warrantForm');

  const [printMode, setPrintMode] = useState('single');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPrintDate, setSelectedPrintDate] = useState(new Date().toISOString().split('T')[0]);

  const [excelFilterStatus, setExcelFilterStatus] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentRecords, setCurrentRecords] = useState([]);

  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserData, setEditUserData] = useState({ username: '', password: '', fullName: '', position: '', role: 'user' });
  const [newUser, setNewUser] = useState({ username: '', password: '', fullName: '', position: '', role: 'user' });

  // State สำหรับคลังโฟลเดอร์ย้อนหลัง
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const initialFormState = {
    selectedRecordId: null,
    blackNo: '', redNo: '', payer: '',
    warrantType: '', targetName: '', 
    sendDate: todayStr, 
    sendTime: getCurrentTimeStr(),
    address: '', village: '', subdistrict: '', district: '', province: 'สุรินทร์', zipcode: '32000', warrantResult: 'ส่งได้โดยวิธีปิดหมาย', price: '', gps: '', photos: []
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/audit-logs`);
      if (res.ok) setAuditLogs(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchUserWarrants = async (username) => {
    try {
      const res = await fetch(`${API_URL}/warrants/${username}`);
      if (res.ok) setCurrentRecords(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUserWarrants(currentUser.username);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'auditLogs' && currentUser?.role === 'admin') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const addAuditLog = async (action, details, userObj = currentUser) => {
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleString('th-TH'),
      username: userObj ? userObj.username : 'Unknown',
      fullName: userObj ? userObj.fullName : 'ไม่ระบุตัวตน',
      action, details
    };
    try {
      await fetch(`${API_URL}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
      fetchAuditLogs();
    } catch (e) { console.error(e); }
  };

  const inactivityTimerRef = useRef(null);
  useEffect(() => {
    if (!isLoggedIn) return;
    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        addAuditLog('AUTO_LOGOUT_TIMEOUT', 'ระบบออกจากระบบอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน 30 นาที');
        handleLogout();
        alert("คุณไม่ได้ใช้งานระบบเป็นเวลาเกิน 30 นาที ระบบได้ทำการออกจากระบบโดยอัตโนมัติเพื่อความปลอดภัย");
      }, 30 * 60 * 1000);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [isLoggedIn, currentUser]);

  const handleClearFormForManualInput = () => {
    setFormData({
      ...initialFormState,
      selectedRecordId: `manual_${currentUser?.username || 'user'}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sendDate: todayStr,
      sendTime: getCurrentTimeStr()
    });
    addAuditLog('MANUAL_INPUT_START', 'เปิดฟอร์มสำหรับกรอกข้อมูลด้วยตัวเอง');
  };

  const formatThaiDate = (dateString) => {
    if (!dateString) return "....................";
    const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const parts = dateString.split('-');
    return parts.length === 3 ? `${parseInt(parts[2], 10)} ${thaiMonths[parseInt(parts[1], 10) - 1]} ${parseInt(parts[0], 10) + 543}` : dateString;
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`ไฟล์ ${file.name} มีขนาดเกิน 5MB`);
        return false;
      }
      return true;
    });

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          photos: [...prev.photos, reader.result]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemovePhoto = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleSelectWarrantResult = (e) => {
    const selectedVal = e.target.value;
    if (!selectedVal) return;

    if (selectedVal === "ส่งได้เพราะ..." || selectedVal === "ส่งไม่ได้เพราะ..." || selectedVal === "อื่น...") {
      setFormData(prev => ({ ...prev, warrantResult: selectedVal.replace('...', ' ') }));
    } else {
      setFormData(prev => ({ ...prev, warrantResult: selectedVal }));
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        if (window.XLSX) {
          const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = window.XLSX.utils.sheet_to_json(ws, { header: 1 });

          const parsedRecords = [];
          const nowStamp = Date.now();

          data.forEach((row, idx) => {
            if (row && (row[1] || row[6])) {
              const blackNo = row[1] ? String(row[1]).trim() : '';
              const targetName = row[6] ? String(row[6]).trim() : '';
              
              if (blackNo.includes('ดำ') || targetName.includes('ชื่อ')) return;

              const uniqueRandom = Math.random().toString(36).substring(2, 9);
              const uniqueId = `item_${currentUser.username}_${nowStamp}_${idx}_${uniqueRandom}`;

              parsedRecords.push({
                id: uniqueId,
                ownerUsername: currentUser.username,
                blackNo: blackNo,
                redNo: row[2] ? String(row[2]).trim() : '',
                warrantType: row[5] ? String(row[5]).trim() : '',
                targetName: targetName,
                address: row[7] ? String(row[7]).trim() : '',
                village: row[10] ? String(row[10]).trim() : '',
                subdistrict: row[8] ? String(row[8]).trim() : '',
                district: row[11] ? String(row[11]).trim() : '',
                province: row[12] ? String(row[12]).trim() : 'สุรินทร์',
                zipcode: row[14] ? String(row[14]).trim() : '32000',
                price: row[13] ? String(row[13]).replace(',', '').trim() : '0.00',
                warrantResult: 'ส่งได้โดยวิธีปิดหมาย', 
                gps: '', 
                photos: [],
                sendDate: todayStr,
                sendTime: getCurrentTimeStr(), 
                isSaved: false
              });
            }
          });

          if (parsedRecords.length === 0) {
            alert("ไม่พบข้อมูลจำเลยในไฟล์ Excel");
            return;
          }

          await fetch(`${API_URL}/warrants/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, records: parsedRecords })
          });

          fetchUserWarrants(currentUser.username);
          addAuditLog('IMPORT_EXCEL', `นำเข้าไฟล์ Excel: ${file.name} (${parsedRecords.length} รายการ)`);
          alert(`อัปโหลดไฟล์เรียบร้อย! นำเข้าข้อมูลจำเลยทั้งหมด ${parsedRecords.length} รายการ`);
        }
      } catch (err) { alert("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel"); }
    };
    reader.readAsBinaryString(file);
  };

  const handleSelectExcelData = (item) => {
    setFormData({
      selectedRecordId: item.id,
      blackNo: item.blackNo || '',
      redNo: item.redNo || '',
      warrantType: item.warrantType || '',
      targetName: item.targetName || '',
      sendDate: item.sendDate || todayStr,
      sendTime: item.sendTime || getCurrentTimeStr(),
      address: item.address || '',
      village: item.village || '',
      subdistrict: item.subdistrict || '',
      district: item.district || '',
      province: item.province || 'สุรินทร์',
      zipcode: item.zipcode || '32000',
      warrantResult: item.warrantResult || 'ส่งได้โดยวิธีปิดหมาย',
      price: item.price || '0.00',
      gps: item.gps || '',
      photos: item.photos || []
    });
    addAuditLog('SELECT_CASE', `เลือกจำเลย: ${item.targetName} (คดีดำ: ${item.blackNo})`);
  };

  const handleSaveFormData = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!formData.blackNo && !formData.targetName) return alert("กรุณากรอกเลขดำหรือชื่อผู้รับหมายก่อนกดบันทึก");

    if (!formData.selectedRecordId) {
      return alert("กรุณากดปุ่ม 'เลือกนำเข้า' ของจำเลยที่ต้องการทำรายงานก่อนครับ");
    }

    const recordPayload = [{ ...formData, id: formData.selectedRecordId, ownerUsername: currentUser.username, isSaved: true }];

    await fetch(`${API_URL}/warrants/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username, records: recordPayload })
    });

    fetchUserWarrants(currentUser.username);
    addAuditLog('SAVE_REPORT', `บันทึกรายงานผลของ: ${formData.targetName} (คดีดำ: ${formData.blackNo})`);
    alert(`บันทึกรายงานผลของ "${formData.targetName}" เรียบร้อยแล้ว!`);
  };

  const handleDeleteWarrantRecord = async (itemId, blackNo, targetName) => {
    if (window.confirm(`ลบรายการจำเลย ${targetName} (${blackNo || '-'}) ใช่หรือไม่?`)) {
      await fetch(`${API_URL}/warrants/${itemId}`, { method: 'DELETE' });
      fetchUserWarrants(currentUser.username);
      addAuditLog('DELETE_RECORD', `ลบรายการจำเลย: ${targetName} (${blackNo || '-'})`);
    }
  };

  const handleDeleteAllRecords = async () => {
    if (window.confirm(`คำเตือน! ลบรายการคดีทั้งหมดในบัญชีของ "${currentUser?.fullName}" ใช่หรือไม่?`)) {
      await fetch(`${API_URL}/warrants/owner/${currentUser.username}`, { method: 'DELETE' });
      fetchUserWarrants(currentUser.username);
      addAuditLog('DELETE_ALL_RECORDS', `ลบรายการคดีทั้งหมดในบัญชี`);
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setFormData(prev => ({ ...prev, gps: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
        addAuditLog('FETCH_GPS', `ดึงพิกัด GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        alert(`ดึงพิกัด GPS เรียบร้อย: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      });
    } else {
      alert("เบราว์เซอร์นี้ไม่รองรับการดึง GPS");
    }
  };

  // ปรับสไตล์แผนที่พรีวิว GPS เป็นสไตล์ Google Maps Light Vector
  const getMapImageUrl = (gpsVal) => {
    let lat = "14.872185", lng = "103.461160";
    if (gpsVal && typeof gpsVal === 'string') {
      const cleanGps = gpsVal.replace(/[^\d.,-]/g, '').trim();
      const parts = cleanGps.split(',');
      if (parts.length === 2) {
        const parsedLat = parseFloat(parts[0]);
        const parsedLng = parseFloat(parts[1]);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          lat = parsedLat.toFixed(6);
          lng = parsedLng.toFixed(6);
        }
      }
    }
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lng},${lat}&zoom=16&size=600x280&maptype=mapnik&markers=${lat},${lng},red-pushpin`;
  };

  const handleConfirmBatchPrint = () => {
    setShowPrintModal(false);
    setPrintMode('batch');
    setTimeout(() => window.print(), 200);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (data.success) {
        setIsLoggedIn(true);
        setCurrentUser(data.user);
        localStorage.setItem('srnc_court_user', JSON.stringify(data.user));
        setLoginError('');
        setPasswordInput('');
        setActiveTab('warrantForm');
        setFormData({ ...initialFormState, sendDate: todayStr, sendTime: getCurrentTimeStr() });
        addAuditLog('LOGIN', 'เข้าสู่ระบบสำเร็จ', data.user);
      } else {
        setLoginError(data.message);
      }
    } catch (err) {
      setLoginError('ไม่สามารถเชื่อมต่อ Server ได้');
    }
  };

  const handleLogout = () => {
    if (currentUser) addAuditLog('LOGOUT', 'ออกจากระบบ');
    localStorage.removeItem('srnc_court_user');
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.fullName || !newUser.position) return alert("กรอกข้อมูลผู้ใช้งานให้ครบถ้วน");

    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
        addAuditLog('CREATE_USER', `สร้างผู้ใช้ใหม่: ${newUser.username}`);
        setNewUser({ username: '', password: '', fullName: '', position: '', role: 'user' });
        alert("เพิ่มผู้ใช้งานเรียบร้อยแล้ว!");
      } else {
        alert(data.message);
      }
    } catch (e) { alert("เกิดข้อผิดพลาดในการสร้างผู้ใช้"); }
  };

  const handleSaveEditUser = async (id) => {
    await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editUserData)
    });
    fetchUsers();
    setEditingUserId(null);
    alert("อัปเดตข้อมูลผู้ใช้งานเรียบร้อยแล้ว");
  };

  const handleDeleteUser = async (id, targetName) => {
    if (window.confirm(`คุณต้องการลบบัญชีผู้ใช้ "${targetName}" ใช่หรือไม่?`)) {
      await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
      fetchUsers();
      addAuditLog('DELETE_USER', `ลบผู้ใช้: ${targetName}`);
    }
  };

  // คำนวณการจัดกลุ่มคลังข้อมูลโฟลเดอร์ (ปี พ.ศ. -> เดือน -> วันที่)
  const getGroupedArchive = () => {
    const archive = {};
    const monthNames = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    currentRecords.forEach(rec => {
      if (!rec.isSaved) return;
      const dateStr = rec.sendDate || todayStr;
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const yearBE = (parseInt(parts[0], 10) + 543).toString();
        const monthName = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
        const day = parseInt(parts[2], 10).toString();

        if (!archive[yearBE]) archive[yearBE] = {};
        if (!archive[yearBE][monthName]) archive[yearBE][monthName] = {};
        if (!archive[yearBE][monthName][day]) archive[yearBE][monthName][day] = [];

        archive[yearBE][monthName][day].push(rec);
      }
    });

    return archive;
  };

  const archivedData = getGroupedArchive();

  const pendingRecords = currentRecords.filter(r => !r.isSaved);
  const todayCompletedRecords = currentRecords.filter(r => r.isSaved && r.sendDate === todayStr);
  const allCompletedRecords = currentRecords.filter(r => r.isSaved);

  let displayedRecords = excelFilterStatus === 'pending' ? pendingRecords : todayCompletedRecords;
  
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    displayedRecords = currentRecords.filter(r => 
      (r.blackNo && r.blackNo.toLowerCase().includes(q)) ||
      (r.redNo && r.redNo.toLowerCase().includes(q)) ||
      (r.targetName && r.targetName.toLowerCase().includes(q)) ||
      (r.warrantType && r.warrantType.toLowerCase().includes(q))
    );
  }

  const recordsToBatchPrint = selectedPrintDate === 'ALL'
    ? allCompletedRecords
    : allCompletedRecords.filter(r => r.sendDate === selectedPrintDate);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-amber-950 to-gray-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-yellow-500/30">
          <div className="bg-gray-900 text-center p-6 border-b-4 border-yellow-500 flex flex-col items-center">
            <img src="/srnc-picture.png" alt="ตราศาล" className="w-24 h-24 object-contain mb-3 drop-shadow-md" onError={(e) => e.target.src = "/srncpicture.png"} />
            <h1 className="text-xl font-extrabold text-yellow-400 tracking-wide">ศาลจังหวัดสุรินทร์</h1>
            <p className="text-xs text-gray-300 mt-1">ระบบงานบันทึกและติดตามการส่งหมายศาลอิเล็กทรอนิกส์ (Server Online)</p>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-800 flex items-center justify-center gap-2"><Lock className="w-5 h-5 text-amber-800" /> เข้าสู่ระบบใช้งาน</h2>
              <p className="text-xs text-gray-500 mt-1">กรุณากรอก Username และ Password เพื่อยืนยันตัวตน</p>
            </div>
            {loginError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{loginError}</span></div>}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Username</label>
                <div className="relative"><User className="w-4 h-4 text-gray-400 absolute left-3 top-3" /><input type="text" required value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-amber-600 focus:outline-none" placeholder="ป้อนชื่อผู้ใช้งาน" /></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Password</label>
                <div className="relative"><Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" /><input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-amber-600 focus:outline-none" placeholder="ป้อนรหัสผ่าน" /></div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-yellow-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 text-white font-bold py-3 rounded-xl shadow-lg transition duration-200 text-sm flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> เข้าสู่ระบบ</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-12">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=TH+Sarabun+New:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        
        .sarabun-font {
          font-family: 'TH Sarabun New', 'Sarabun', sans-serif !important;
          font-size: 15pt !important;
          line-height: 1.15 !important;
        }

        .dot-underline {
          border-bottom: 1px dotted #000;
          display: inline-block;
          padding: 0 4px;
        }

        .gps-overlay-text {
          color: #ffffff !important;
          font-weight: 800 !important;
          font-size: 13pt !important;
          line-height: 1.25 !important;
          text-shadow: 
            -1.5px -1.5px 0 #000,  
             1.5px -1.5px 0 #000,
            -1.5px  1.5px 0 #000,
             1.5px  1.5px 0 #000,
             0px 2px 4px rgba(0,0,0,0.9);
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0.3cm 1.0cm !important;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          * {
            border-left: none !important;
            box-shadow: none !important;
            outline: none !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }
          .page-single {
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: auto !important;
            max-height: 275mm !important;
            overflow: hidden !important;
          }
          .page-batch {
            page-break-after: always !important;
            break-after: page !important;
            height: auto !important;
            max-height: 275mm !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="bg-gray-900 text-yellow-400 px-6 py-3 flex justify-between items-center border-b-4 border-yellow-500 shadow-md no-print">
        <div className="flex items-center gap-3">
          <img src="/srnc-picture.png" alt="ตราศาล" className="w-8 h-8 object-contain" onError={(e) => e.target.src = "/srncpicture.png"} />
          <span className="font-bold text-lg tracking-wide text-white">ระบบงานศาลยุติธรรมอิเล็กทรอนิกส์</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 bg-gray-800 px-4 py-1.5 rounded-full border border-gray-700 text-left">
            <User className="w-4 h-4 text-yellow-400" />
            <div>
              <span className="text-xs font-bold text-white block">{currentUser?.fullName} ({currentUser?.username})</span>
              <span className="text-[10px] text-yellow-300 block">{currentUser?.position} ({currentUser?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'})</span>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white px-3 py-1.5 rounded-lg border border-red-500/30 text-xs flex items-center gap-1.5 transition"><LogOut className="w-3.5 h-3.5" /> ออกจากระบบ</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-6 px-4 space-y-6">
        
        {/* Banner + Tabs */}
        <div className="bg-gradient-to-r from-gray-900 via-amber-950 to-gray-900 text-white p-6 rounded-t-2xl shadow-xl border-b border-yellow-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div className="flex items-center gap-4">
            <img src="/srnc-picture.png" alt="ตราศาล" className="w-12 h-12 object-contain drop-shadow" onError={(e) => e.target.src = "/srncpicture.png"} />
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-yellow-400 flex items-center gap-2">ระบบบันทึกและติดตามการส่งหมายศาล</h1>
              <p className="text-gray-300 text-sm mt-1 flex items-center gap-2">ศาลจังหวัดสุรินทร์ <span className="bg-emerald-800/80 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Database Sync Online</span></p>
            </div>
          </div>

          <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('warrantForm')}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                activeTab === 'warrantForm' ? 'bg-amber-800 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" /> ฟอร์มบันทึกหมาย
            </button>
            {currentUser?.role === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('auditLogs')}
                  className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                    activeTab === 'auditLogs' ? 'bg-amber-800 text-white shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <FileSearch className="w-4 h-4" /> Audit Log ({auditLogs.length})
                </button>
                <button
                  onClick={() => setActiveTab('userManagement')}
                  className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                    activeTab === 'userManagement' ? 'bg-amber-800 text-white shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" /> จัดการผู้ใช้งาน ({users.length})
                </button>
              </>
            )}
          </div>
        </div>

        {/* TAB 1: ฟอร์มบันทึกหมายศาล */}
        {activeTab === 'warrantForm' && (
          <div className="bg-white p-6 md:p-8 rounded-b-2xl shadow-xl space-y-8 no-print">
            
            <div className="bg-amber-50/60 border border-amber-300 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-amber-200">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-base">
                  <FileSpreadsheet className="w-5 h-5 text-amber-800" />
                  <span>จัดการข้อมูลหมายคดี - บัญชี {currentUser?.fullName} ({currentUser?.username})</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {currentRecords.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteAllRecords}
                      className="bg-red-700 hover:bg-red-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
                    >
                      <Trash2 className="w-4 h-4" /> ลบทั้งหมด ({currentRecords.length})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => { setExcelFilterStatus('completed'); setSearchQuery(''); }}
                    className="bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
                    title="ดูประวัติหมายที่เคยบันทึกไว้ทั้งหมด"
                  >
                    <History className="w-4 h-4" /> ประวัติ/ค้นหารายงานย้อนหลัง
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowArchiveModal(true);
                      setSelectedYear(null);
                      setSelectedMonth(null);
                      setSelectedDate(null);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
                    title="เปิดดูข้อมูลย้อนหลังแบบแยกโฟลเดอร์ วัน/เดือน/ปี"
                  >
                    <Folder className="w-4 h-4" /> คลังโฟลเดอร์ย้อนหลัง
                  </button>

                  <button
                    type="button"
                    onClick={handleClearFormForManualInput}
                    className="bg-sky-700 hover:bg-sky-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
                  >
                    <FilePlus className="w-4 h-4" /> กรอกข้อมูลเอง (ล้างฟอร์มใหม่)
                  </button>

                  <label className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer transition">
                    <Upload className="w-4 h-4" /> เลือกไฟล์ Excel บัญชีหมายศาล
                    <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="พิมพ์ค้นหาเลขดำ, เลขแดง, ชื่อ..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-gray-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 text-xs">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {currentRecords.length > 0 && (
                  <div className="flex bg-amber-200/60 p-1 rounded-lg gap-1 border border-amber-300 text-xs">
                    <button
                      type="button"
                      onClick={() => setExcelFilterStatus('pending')}
                      className={`px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition ${
                        excelFilterStatus === 'pending' && !searchQuery ? 'bg-amber-800 text-white shadow' : 'text-amber-900 hover:bg-amber-300/60'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" /> รอดำเนินการ ({pendingRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelFilterStatus('completed')}
                      className={`px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition ${
                        excelFilterStatus === 'completed' || searchQuery ? 'bg-emerald-700 text-white shadow' : 'text-emerald-900 hover:bg-emerald-200/60'
                      }`}
                      title="แสดงเฉพาะหมายที่บันทึกรายงานผลในวันนี้"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> รายงานแล้ว ({todayCompletedRecords.length})
                    </button>
                  </div>
                )}
              </div>

              {currentRecords.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                  {displayedRecords.map((item) => (
                    <div key={item.id} className={`p-3 rounded-lg border flex justify-between items-center transition ${
                      formData.selectedRecordId === item.id ? 'bg-amber-100 border-amber-500 shadow-sm' : 'bg-white border-amber-200 hover:border-amber-400'
                    }`}>
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-gray-800 flex items-center gap-1.5">
                          <span>ดำ: <span className="text-amber-800 font-mono">{item.blackNo}</span> | แดง: <span className="text-amber-800 font-mono">{item.redNo || '-'}</span></span>
                          {item.isSaved && <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded font-bold">รายงานแล้ว</span>}
                        </div>
                        <div className="text-gray-600">ถึง: <span className="font-bold text-gray-900">{item.targetName}</span></div>
                        <div className="text-gray-500">{item.warrantType} | อ.{item.district || '-'}</div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteWarrantRecord(item.id, item.blackNo, item.targetName)}
                          className="bg-red-100 hover:bg-red-600 text-red-700 hover:text-white p-1.5 rounded-lg text-xs font-bold transition"
                          title="ลบรายการคดีนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectExcelData(item)}
                          className="bg-amber-800 hover:bg-amber-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition"
                        >
                          {item.isSaved ? 'เรียกดู/แก้ไข' : 'เลือกนำเข้า'} <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-white rounded-lg border border-dashed border-amber-300 text-xs text-gray-500">
                  ยังไม่มีรายการคดีในบัญชีของ <span className="font-bold text-amber-900">{currentUser?.fullName}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveFormData} className="space-y-8">
              {/* Section 1 */}
              <div>
                <div className="flex items-center gap-2 text-gray-800 font-bold text-lg pb-2 border-b-2 border-yellow-500 mb-4">
                  <FileText className="w-5 h-5 text-amber-800" />
                  <span>1. ข้อมูลคดีและรายละเอียดหมาย</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เลขดำที่</label>
                    <input type="text" value={formData.blackNo} onChange={(e) => setFormData({...formData, blackNo: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800" placeholder="เช่น พ431/2566" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">เลขแดงที่</label>
                    <input type="text" value={formData.redNo} onChange={(e) => setFormData({...formData, redNo: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800" placeholder="เช่น พ1112/2566" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">หมายอะไร</label>
                    <input type="text" value={formData.warrantType} onChange={(e) => setFormData({...formData, warrantType: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800" placeholder="เช่น หมายนัด" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ราคา/ค่านำส่ง (บาท)</label>
                    <input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800 font-semibold text-green-700" placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div>
                <div className="flex items-center gap-2 text-gray-800 font-bold text-lg pb-2 border-b-2 border-yellow-500 mb-4">
                  <User className="w-5 h-5 text-amber-800" />
                  <span>2. รายละเอียดผู้รับหมายและสถานที่นำส่ง</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">หมายถึงใคร (ชื่อ-นามสกุล)</label>
                    <input type="text" value={formData.targetName} onChange={(e) => setFormData({...formData, targetName: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800" placeholder="เช่น นายทอง สุขจิตร ที่1" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-800 uppercase mb-1">วันที่ส่งหมาย</label>
                    <input type="date" value={formData.sendDate} onChange={(e) => setFormData({...formData, sendDate: e.target.value})} className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800 font-medium" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-800 uppercase mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-800" /> เวลาที่ส่งหมาย (น.)
                    </label>
                    <input 
                      type="text" 
                      value={formData.sendTime} 
                      onChange={(e) => setFormData({...formData, sendTime: e.target.value})} 
                      className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800 font-bold font-mono" 
                      placeholder="เช่น 18:12"
                    />
                  </div>
                  
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ที่อยู่ / บ้านเลขที่ / ถนน / หมู่บ้าน</label>
                    <textarea rows="2" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800" placeholder="เช่น 127 ม. 5 ซ. - ถ. -"></textarea>
                  </div>

                  {/* ช่องกรอกข้อความทั่วไป ไม่ใช้ Dropdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 md:col-span-3">
                    {/* หมู่ที่ / ชื่อหมู่บ้าน */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">หมู่ที่ / ชื่อหมู่บ้าน</label>
                      <input
                        type="text"
                        value={formData.village || ''}
                        onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800 font-medium text-xs"
                        placeholder="เช่น หมู่ 5"
                      />
                    </div>

                    {/* อำเภอ */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">อำเภอ</label>
                      <input
                        type="text"
                        value={formData.district || ''}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800 font-bold text-xs"
                        placeholder="เช่น เมืองสุรินทร์"
                      />
                    </div>

                    {/* ตำบล */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">ตำบล</label>
                      <input
                        type="text"
                        value={formData.subdistrict || ''}
                        onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800 font-bold text-xs"
                        placeholder="เช่น ในเมือง"
                      />
                    </div>

                    {/* จังหวัด */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">จังหวัด</label>
                      <input
                        type="text"
                        value={formData.province || 'สุรินทร์'}
                        onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800 font-bold text-xs"
                        placeholder="สุรินทร์"
                      />
                    </div>

                    {/* รหัสไปรษณีย์ */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">รหัสไปรษณีย์</label>
                      <input
                        type="text"
                        value={formData.zipcode || ''}
                        onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-gray-800 font-mono font-bold text-xs"
                        placeholder="32000"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-3 bg-amber-50/40 p-4 rounded-xl border border-amber-200 space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1">
                        <CheckSquare className="w-4 h-4 text-amber-800" /> ผลการส่งหมาย (เลือกหรือพิมพ์ระบุเพิ่มเติม)
                      </label>
                      
                      <select
                        onChange={handleSelectWarrantResult}
                        value={formData.warrantResult}
                        className="bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs text-amber-900 font-bold focus:ring-2 focus:ring-amber-600 focus:outline-none cursor-pointer"
                      >
                        <option value="" disabled>-- คลิกเลือกข้อความผลการส่งหมายมาตรฐาน --</option>
                        {warrantResultOptions.map((opt, idx) => (
                          <option key={idx} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <textarea
                      rows="2"
                      value={formData.warrantResult}
                      onChange={(e) => setFormData({ ...formData, warrantResult: e.target.value })}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-sm text-gray-800 font-medium"
                      placeholder="ระบุผลการส่งหมาย..."
                    ></textarea>
                  </div>

                </div>
              </div>

              {/* Section 3 */}
              <div>
                <div className="flex items-center gap-2 text-gray-800 font-bold text-lg pb-2 border-b-2 border-yellow-500 mb-4">
                  <MapPin className="w-5 h-5 text-amber-800" />
                  <span>3. หลักฐานการส่งหมาย และพิกัด GPS</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-yellow-50 border border-yellow-200 rounded-xl flex flex-col justify-between shadow-sm space-y-3">
                    <div className="text-center">
                      <span className="font-bold text-base text-gray-800 block">พิกัด GPS นำส่ง</span>
                      <span className="text-xs text-gray-500">กดปุ่มดึงพิกัด หรือพิมพ์/คัดลอกพิกัดมาวางแก้ได้</span>
                    </div>

                    <button type="button" onClick={handleGetLocation} className="w-full bg-gray-900 hover:bg-gray-800 text-yellow-400 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow transition">
                      <MapPin className="w-4 h-4" /> ดึงพิกัด GPS ปัจจุบัน
                    </button>

                    <input 
                      type="text" 
                      value={formData.gps} 
                      onChange={(e) => setFormData({ ...formData, gps: e.target.value })}
                      className="text-center text-sm font-mono font-bold w-full bg-white border-2 border-yellow-400 py-2.5 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-600 focus:outline-none shadow-inner" 
                      placeholder="เช่น 14.872185, 103.461160" 
                    />

                    <div className="border border-yellow-300 rounded-lg overflow-hidden bg-white shadow-xs">
                      <div className="bg-yellow-100/80 px-3 py-1 text-[11px] font-bold text-amber-900 flex justify-between items-center">
                        <span>ภาพพรีวิวแผนที่ถนน GPS:</span>
                        <span className="font-mono text-[10px]">{formData.gps || "ยังไม่ได้ระบุ"}</span>
                      </div>
                      <img 
                        src={getMapImageUrl(formData.gps)} 
                        alt="ภาพพรีวิวแผนที่ GPS" 
                        className="w-full h-32 object-cover block" 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://staticmap.openstreetmap.de/staticmap.php?center=${formData.gps ? formData.gps.split(',')[1] : '103.461160'},${formData.gps ? formData.gps.split(',')[0] : '14.872185'}&zoom=16&size=600x280&maptype=mapnik`;
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col justify-between shadow-sm">
                    <div className="text-center mb-3">
                      <span className="font-bold text-base text-gray-800 block">ภาพถ่ายสถานที่ส่ง</span>
                      <span className="text-xs text-gray-500">รองรับภาพถ่ายหน้าบ้าน / ผู้รับหมาย (จำกัดขนาดไฟล์ละไม่เกิน 5MB)</span>
                    </div>

                    <label className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow cursor-pointer transition">
                      <Camera className="w-4 h-4" /> ถ่ายภาพ / เลือกรูปถ่าย
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange} 
                        className="hidden" 
                        multiple 
                      />
                    </label>

                    {formData.photos.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between items-center text-xs text-gray-600 font-bold">
                          <span>รูปถ่ายที่เลือกแล้ว ({formData.photos.length} รูป):</span>
                          <button 
                            type="button" 
                            onClick={() => setFormData(prev => ({ ...prev, photos: [] }))} 
                            className="text-red-500 hover:underline text-[10px]"
                          >
                            ล้างทั้งหมด
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-white border border-gray-200 rounded-lg">
                          {formData.photos.map((imgUrl, idx) => (
                            <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-300 aspect-square">
                              <img src={imgUrl} alt={`สถานที่ส่ง ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(idx)}
                                className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow hover:bg-red-700 transition"
                                title="ลบรูปนี้"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="mt-3 text-xs text-gray-400 text-center block">ยังไม่ได้เลือกรูปถ่าย</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 flex flex-col md:flex-row gap-3">
                <button 
                  type="submit" 
                  className="flex-1 bg-gradient-to-r from-yellow-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 text-white py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg transition"
                >
                  <Plus className="w-5 h-5" /> บันทึกข้อมูลซิงก์ Server
                </button>

                <button 
                  type="button" 
                  onClick={() => {
                    setPrintMode('single');
                    addAuditLog('PRINT_SINGLE_PDF', `สั่งพิมพ์รายงาน PDF คดีดำ: ${formData.blackNo} ถึง: ${formData.targetName}`);
                    setTimeout(() => window.print(), 150);
                  }} 
                  className="bg-gray-800 hover:bg-gray-900 text-yellow-400 px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition border border-yellow-500"
                >
                  <Printer className="w-4 h-4" /> พิมพ์รายงาน (PDF)
                </button>

                <button 
                  type="button" 
                  onClick={() => {
                    if (allCompletedRecords.length === 0) {
                      alert("ยังไม่มีรายการคดีที่บันทึกรายงานผลเข้าระบบ");
                      return;
                    }
                    setShowPrintModal(true);
                  }} 
                  className="bg-emerald-800 hover:bg-emerald-900 text-white px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition border border-emerald-600"
                >
                  <PrinterCheck className="w-4 h-4" /> พิมพ์รายงานทั้งหมด ({allCompletedRecords.length})
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal คลังโฟลเดอร์ย้อนหลัง (แยกตามวัน/เดือน/ปี) */}
        {showArchiveModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] border border-amber-300">
              
              {/* Header */}
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center border-b-2 border-amber-500">
                <h3 className="text-lg font-bold flex items-center gap-2 text-yellow-400">
                  <Folder className="w-5 h-5 text-yellow-400" /> คลังจัดเก็บข้อมูลย้อนหลัง (แยกตามวัน/เดือน/ปี)
                </h3>
                <button 
                  onClick={() => setShowArchiveModal(false)}
                  className="text-gray-400 hover:text-white text-xl font-bold px-2"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Breadcrumb Navigation */}
              <div className="bg-slate-100 px-6 py-3 border-b text-sm flex items-center gap-2 font-medium text-slate-700">
                <span 
                  className="cursor-pointer hover:underline text-blue-600 font-bold flex items-center gap-1"
                  onClick={() => { setSelectedYear(null); setSelectedMonth(null); setSelectedDate(null); }}
                >
                  <Folder className="w-4 h-4 text-amber-600" /> คลังหลัก (ปี พ.ศ.)
                </span>
                {selectedYear && (
                  <>
                    <span>/</span>
                    <span 
                      className="cursor-pointer hover:underline text-blue-600 font-bold"
                      onClick={() => { setSelectedMonth(null); setSelectedDate(null); }}
                    >
                      พ.ศ. {selectedYear}
                    </span>
                  </>
                )}
                {selectedMonth && (
                  <>
                    <span>/</span>
                    <span 
                      className="cursor-pointer hover:underline text-blue-600 font-bold"
                      onClick={() => setSelectedDate(null)}
                    >
                      {selectedMonth}
                    </span>
                  </>
                )}
                {selectedDate && (
                  <>
                    <span>/</span>
                    <span className="text-amber-700 font-bold">วันที่ {selectedDate}</span>
                  </>
                )}
              </div>

              {/* Content Area */}
              <div className="p-6 overflow-y-auto flex-1">
                {/* Level 1: เลือกปี */}
                {!selectedYear && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">เลือกปี พ.ศ. ที่ต้องการเข้าดูข้อมูล:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {Object.keys(archivedData).length === 0 ? (
                        <p className="text-gray-400 col-span-full text-center py-12 italic">ยังไม่มีข้อมูลรายงานผลที่บันทึกในระบบ</p>
                      ) : (
                        Object.keys(archivedData).map((year) => (
                          <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className="flex flex-col items-center justify-center p-6 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition shadow-sm group cursor-pointer"
                          >
                            <Folder className="w-12 h-12 text-amber-600 group-hover:scale-110 transition mb-2" />
                            <span className="font-bold text-amber-950 text-base">ปี พ.ศ. {year}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Level 2: เลือกเดือน */}
                {selectedYear && !selectedMonth && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">เลือกเดือน (ปี พ.ศ. {selectedYear}):</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Object.keys(archivedData[selectedYear] || {}).map((month) => (
                        <button
                          key={month}
                          onClick={() => setSelectedMonth(month)}
                          className="flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-xl transition shadow-sm group cursor-pointer"
                        >
                          <Folder className="w-10 h-10 text-blue-600 group-hover:scale-110 transition" />
                          <div className="text-left">
                            <p className="font-bold text-blue-950 text-sm">{month}</p>
                            <p className="text-xs text-blue-700">
                              {Object.keys(archivedData[selectedYear][month]).length} วันที่มีบันทึก
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Level 3: เลือกวัน */}
                {selectedYear && selectedMonth && !selectedDate && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                      เลือกวันที่ ({selectedMonth} {selectedYear}):
                    </h4>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                      {Object.keys(archivedData[selectedYear][selectedMonth] || {}).map((day) => (
                        <button
                          key={day}
                          onClick={() => setSelectedDate(day)}
                          className="flex flex-col items-center p-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition shadow-sm group cursor-pointer"
                        >
                          <Folder className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition mb-1" />
                          <span className="font-bold text-emerald-950 text-sm">วันที่ {day}</span>
                          <span className="text-[10px] text-emerald-700 font-bold mt-0.5">
                            {archivedData[selectedYear][selectedMonth][day].length} รายการ
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Level 4: รายการข้อมูลในวันที่เลือก */}
                {selectedYear && selectedMonth && selectedDate && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      รายการหมายศาลวันที่ {selectedDate} {selectedMonth} {selectedYear}:
                    </h4>
                    <div className="space-y-3">
                      {archivedData[selectedYear][selectedMonth][selectedDate].map((rec, index) => (
                        <div key={rec.id || index} className="p-4 border border-gray-200 rounded-xl bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm hover:border-amber-400 transition">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-800 text-sm">
                              คดีดำ: <span className="text-amber-800 font-mono">{rec.blackNo || '-'}</span> | คดีแดง: <span className="text-amber-800 font-mono">{rec.redNo || '-'}</span>
                            </div>
                            <div className="text-xs text-slate-700">
                              หมายถึง: <strong className="text-slate-900">{rec.targetName || '-'}</strong> | ประเภท: {rec.warrantType || '-'}
                            </div>
                            <div className="text-xs text-slate-500">
                              ที่อยู่: {rec.address} {rec.village} {rec.subdistrict} {rec.district} {rec.province}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* ปุ่มเรียกดู/แก้ไข */}
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectExcelData(rec);
                                setShowArchiveModal(false);
                              }}
                              className="bg-amber-800 hover:bg-amber-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow transition cursor-pointer"
                            >
                              เรียกดู/แก้ไข <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            {/* ปุ่มลบรายการ */}
                            <button
                              type="button"
                              onClick={() => handleDeleteWarrantRecord(rec.id, rec.blackNo, rec.targetName)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow transition cursor-pointer"
                              title="ลบรายการนี้ออกจากระบบ"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> ลบ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
                <span className="flex items-center gap-1 font-medium"><ShieldCheck className="w-4 h-4 text-emerald-600" /> ข้อมูลซิงค์ก้อนเดียวกับ Turso Cloud ถาวร</span>
                <button
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition font-bold"
                >
                  ปิดหน้าต่าง
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Modal เลือกวันที่พิมพ์ */}
        {showPrintModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-amber-300 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-200 pb-3">
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-700" /> เลือกวันที่ต้องการพิมพ์รายงานทั้งหมด
                </h3>
                <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-gray-700 uppercase">กรองตามวันที่ส่งหมาย:</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={selectedPrintDate === 'ALL' ? '' : selectedPrintDate}
                    onChange={(e) => setSelectedPrintDate(e.target.value)}
                    className="flex-1 p-2 bg-amber-50/50 border border-amber-300 rounded-lg text-sm text-gray-800 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedPrintDate('ALL')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                      selectedPrintDate === 'ALL' ? 'bg-amber-800 text-white border-amber-800' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    พิมพ์ทุกวัน
                  </button>
                </div>

                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                  จะพิมพ์เฉพาะรายการที่บันทึกแล้ว จำนวน: <span className="font-bold text-emerald-700 text-sm">{recordsToBatchPrint.length}</span> รายการ
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2.5 rounded-xl text-xs transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchPrint}
                  disabled={recordsToBatchPrint.length === 0}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-xl text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  <PrinterCheck className="w-4 h-4" /> ยืนยันพิมพ์ ({recordsToBatchPrint.length} คดี)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUDIT LOG (เฉพาะ ADMIN) */}
        {activeTab === 'auditLogs' && currentUser?.role === 'admin' && (
          <div className="bg-white p-6 md:p-8 rounded-b-2xl shadow-xl space-y-6 no-print">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-amber-800" /> บันทึกประวัติการใช้งานระบบ (Audit Logs)
              </h2>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-900 text-yellow-400 uppercase sticky top-0">
                  <tr>
                    <th className="p-3">เวลา</th>
                    <th className="p-3">ผู้ใช้งาน</th>
                    <th className="p-3">กิจกรรม (Action)</th>
                    <th className="p-3">รายละเอียด (Details)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition">
                        <td className="p-3 text-gray-500 whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-3 font-bold text-amber-900 whitespace-nowrap">{log.fullName} ({log.username})</td>
                        <td className="p-3 font-bold text-blue-800 whitespace-nowrap">{log.action}</td>
                        <td className="p-3 text-gray-800">{log.details}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-gray-400 italic">ยังไม่มีข้อมูลประวัติ Audit Log</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: USER MANAGEMENT (เฉพาะ ADMIN) */}
        {activeTab === 'userManagement' && currentUser?.role === 'admin' && (
          <div className="bg-white p-6 md:p-8 rounded-b-2xl shadow-xl space-y-8 no-print">
            <div className="border border-amber-200 bg-amber-50/40 p-6 rounded-xl">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-amber-200 pb-2">
                <UserPlus className="w-5 h-5 text-amber-800" /> เพิ่มผู้ใช้งานใหม่เข้าระบบ
              </h2>
              
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    placeholder="เช่น user01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Password</label>
                  <input
                    type="text"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    placeholder="รหัสผ่าน"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ชื่อ - นามสกุล</label>
                  <input
                    type="text"
                    required
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    placeholder="เช่น นายรักชาติ ยิ่งชีพ"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ตำแหน่ง</label>
                  <input
                    type="text"
                    required
                    value={newUser.position}
                    onChange={(e) => setNewUser({...newUser, position: e.target.value})}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    placeholder="เช่น พนักงานเดินหมายศาล"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">ระดับสิทธิ์ (Role)</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  >
                    <option value="user">ผู้ใช้งานทั่วไป (User)</option>
                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-amber-800 hover:bg-amber-900 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-2 shadow"
                  >
                    <Plus className="w-4 h-4" /> บันทึกสร้างผู้ใช้
                  </button>
                </div>
              </form>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                <ListOrdered className="w-5 h-5 text-amber-800" /> รายชื่อผู้ใช้งานในระบบทั้งหมด ({users.length} คน)
              </h2>

              <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-900 text-yellow-400 uppercase text-xs">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Username</th>
                      <th className="p-3">Password</th>
                      <th className="p-3">ชื่อ - นามสกุล</th>
                      <th className="p-3">ตำแหน่ง</th>
                      <th className="p-3">สิทธิ์ใช้งาน</th>
                      <th className="p-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((u, index) => {
                      const isEditing = editingUserId === u.id;

                      return (
                        <tr key={u.id} className={isEditing ? "bg-amber-50" : "hover:bg-gray-50 transition"}>
                          <td className="p-3 font-semibold">{index + 1}</td>

                          <td className="p-3 font-mono font-bold text-amber-900">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUserData.username}
                                onChange={(e) => setEditUserData({...editUserData, username: e.target.value})}
                                className="w-full p-1 bg-white border border-gray-300 rounded text-xs"
                              />
                            ) : (
                              u.username
                            )}
                          </td>

                          <td className="p-3 text-gray-500 font-mono text-xs">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUserData.password}
                                onChange={(e) => setEditUserData({...editUserData, password: e.target.value})}
                                className="w-full p-1 bg-white border border-gray-300 rounded text-xs"
                              />
                            ) : (
                              "••••••"
                            )}
                          </td>

                          <td className="p-3 font-medium text-gray-900">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUserData.fullName}
                                onChange={(e) => setEditUserData({...editUserData, fullName: e.target.value})}
                                className="w-full p-1 bg-white border border-gray-300 rounded text-xs font-bold"
                              />
                            ) : (
                              u.fullName
                            )}
                          </td>

                          <td className="p-3 text-gray-600">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editUserData.position}
                                onChange={(e) => setEditUserData({...editUserData, position: e.target.value})}
                                className="w-full p-1 bg-white border border-gray-300 rounded text-xs"
                              />
                            ) : (
                              u.position
                            )}
                          </td>

                          <td className="p-3">
                            {isEditing ? (
                              <select
                                value={editUserData.role}
                                onChange={(e) => setEditUserData({...editUserData, role: e.target.value})}
                                className="p-1 bg-white border border-gray-300 rounded text-xs"
                              >
                                <option value="user">ผู้ใช้งานทั่วไป</option>
                                <option value="admin">ผู้ดูแลระบบ</option>
                              </select>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                u.role === 'admin' 
                                  ? 'bg-purple-100 text-purple-800 border-purple-300' 
                                  : 'bg-blue-100 text-blue-800 border-blue-300'
                              }`}>
                                {u.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งาน (User)'}
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleSaveEditUser(u.id)}
                                  className="text-emerald-700 hover:text-emerald-900 bg-emerald-100 p-1.5 rounded-lg transition"
                                  title="บันทึก"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="text-gray-600 hover:text-gray-800 bg-gray-200 p-1.5 rounded-lg transition"
                                  title="ยกเลิก"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => { setEditingUserId(u.id); setEditUserData({ ...u }); }}
                                  className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded-lg transition"
                                  title="แก้ไขข้อมูล"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.fullName)}
                                  className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded-lg transition"
                                  title="ลบผู้ใช้งาน"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            แบบฟอร์มรายงานพิมพ์ PDF 1 หน้า A4 สมบูรณ์
            ========================================== */}
        <div className="print-area hidden sarabun-font bg-white text-black max-w-2xl mx-auto">
          {printMode === 'single' && (
            <div className="page-single flex flex-col justify-between">
              <div>
                <div className="text-center font-bold text-xl mb-0.5">
                  บันทึกการปิดหมาย / คำบังคับ
                </div>

                <div className="flex justify-end mb-0.5">
                  <div className="w-72 space-y-0.5 text-right">
                    <div className="font-bold text-lg text-center pr-4">[ศาลจังหวัดสุรินทร์]</div>
                    <div>คดีหมายเลขดำที่ <span className="dot-underline font-bold text-base min-w-[120px] text-center">{formData.blackNo || "........................"}</span></div>
                    <div>คดีหมายเลขแดงที่ <span className="dot-underline font-bold text-base min-w-[120px] text-center">{formData.redNo || "........................"}</span></div>
                  </div>
                </div>

                <div className="space-y-0.5 text-justify pt-0.5">
                  <div>
                    เขียนที่ บ้านเลขที่ <span className="dot-underline font-bold">{formData.address || "............"}</span> {formData.village ? <span>{formData.village}</span> : ''} ตำบล <span className="dot-underline font-bold">{formData.subdistrict || "............"}</span> อำเภอ <span className="dot-underline font-bold">{formData.district || "............"}</span> จังหวัด <span className="dot-underline font-bold">{formData.province || "สุรินทร์"}</span>
                  </div>

                  <div>
                    วันที่ <span className="dot-underline font-bold">{formatThaiDate(formData.sendDate)}</span>
                  </div>

                  <div>
                    วันนี้เวลาประมาณ <span className="dot-underline font-bold">{formData.sendTime || getCurrentTimeStr()}</span> น. ข้าพเจ้าได้นำ <span className="dot-underline font-bold">{formData.warrantType || "หมายศาล"}</span> มาส่งให้แก่ <span className="dot-underline font-bold">{formData.targetName || "...................................."}</span> เมื่อมาถึงบ้านเลขที่ <span className="dot-underline font-bold">{formData.address || "............"}</span> {formData.village ? <span>{formData.village}</span> : ''} ตำบล <span className="dot-underline font-bold">{formData.subdistrict || "............"}</span> อำเภอ <span className="dot-underline font-bold">{formData.district || "............"}</span> จังหวัด <span className="dot-underline font-bold">{formData.province || "สุรินทร์"}</span> ซึ่งเป็นบ้านของจำเลย
                  </div>

                  <div>
                    ข้าพเจ้าได้ทำการปิด หมาย ไว้ ณ ภูมิลำเนาของ <span className="dot-underline font-bold">{formData.targetName || "...................................."}</span> <br />
                    ในที่เปิดเผยและมองเห็นได้ชัดเจนตามคำสั่งศาล
                  </div>

                  <div className="text-center font-bold pt-0.5 text-lg">
                    จึงบันทึกไว้เป็นหลักฐาน
                  </div>

                  <div className="flex flex-col items-end pt-0.5 space-y-0.5">
                    <div className="text-center space-y-0.5">
                      <div>......................................................................ผู้บันทึก/ปิดหมาย</div>
                      <div className="font-bold">({currentUser ? currentUser.fullName : "นายจิรพงษ์ มณีปรุ"})</div>
                    </div>
                  </div>

                  <div className="text-center font-bold text-base pt-0.5">
                    ลักษณะบ้าน <span className="dot-underline font-bold">{formData.warrantResult || "ส่งได้โดยวิธีปิดหมาย"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-0.5 space-y-0.5">
                <div className="flex flex-col items-center justify-center space-y-0.5 w-full">
                  
                  <div className="w-full rounded-lg overflow-hidden flex items-center justify-center h-64 bg-white">
                    {formData.photos.length > 0 ? (
                      <img src={formData.photos[0]} alt="รูปสถานที่ส่งหมาย" className="w-full h-64 object-contain mx-auto rounded-lg" />
                    ) : (
                      <div className="text-xs text-gray-400 font-bold w-full h-full flex items-center justify-center rounded-lg">[ ยังไม่ได้เลือกรูปถ่ายสถานที่ ]</div>
                    )}
                  </div>

                  <div className="text-center font-bold text-xs pt-0.5">
                    พิกัด GPS: {formData.gps || "14.872185, 103.461160"}
                  </div>

                  <div className="w-full rounded-lg overflow-hidden h-64 relative bg-white">
                    <img 
                      src={getMapImageUrl(formData.gps)} 
                      alt="แผนที่ GPS" 
                      className="w-full h-64 object-cover block mx-auto rounded-lg" 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://staticmap.openstreetmap.de/staticmap.php?center=${formData.gps ? formData.gps.split(',')[1] : '103.461160'},${formData.gps ? formData.gps.split(',')[0] : '14.872185'}&zoom=16&size=600x280&maptype=mapnik`;
                      }}
                    />
                    
                    <div className="absolute bottom-3 right-3 text-right whitespace-nowrap gps-overlay-text">
                      <div>GPS: {formData.gps || "14.872186, 103.461157"}</div>
                      <div>{formData.village ? `${formData.village} ` : ''}ตำบล {formData.subdistrict || 'โคกสะอาด'} อำเภอ {formData.district || 'ปราสาท'}</div>
                      <div>จังหวัด {formData.province || 'สุรินทร์'} {formData.zipcode || '32140'}</div>
                      <div>วันที่ {formatThaiDate(formData.sendDate)}</div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

          {printMode === 'batch' && (
            <div>
              {recordsToBatchPrint.map((item, idx) => (
                <div key={item.id || idx} className="page-batch flex flex-col justify-between pt-1">
                  <div>
                    <div className="text-center font-bold text-xl mb-0.5">
                      บันทึกการปิดหมาย / คำบังคับ
                    </div>

                    <div className="flex justify-end mb-0.5">
                      <div className="w-72 space-y-0.5 text-right">
                        <div className="font-bold text-lg text-center pr-4">[ศาลจังหวัดสุรินทร์]</div>
                        <div>คดีหมายเลขดำที่ <span className="dot-underline font-bold text-base min-w-[120px] text-center">{item.blackNo || "........................"}</span></div>
                        <div>คดีหมายเลขแดงที่ <span className="dot-underline font-bold text-base min-w-[120px] text-center">{item.redNo || "........................"}</span></div>
                      </div>
                    </div>

                    <div className="space-y-0.5 text-justify pt-0.5">
                      <div>
                        เขียนที่ บ้านเลขที่ <span className="dot-underline font-bold">{item.address || "............"}</span> {item.village ? <span>{item.village}</span> : ''} ตำบล <span className="dot-underline font-bold">{item.subdistrict || "............"}</span> อำเภอ <span className="dot-underline font-bold">{item.district || "............"}</span> จังหวัด <span className="dot-underline font-bold">{item.province || "สุรินทร์"}</span>
                      </div>

                      <div>
                        วันที่ <span className="dot-underline font-bold">{formatThaiDate(item.sendDate)}</span>
                      </div>

                      <div>
                        วันนี้เวลาประมาณ <span className="dot-underline font-bold">{item.sendTime || getCurrentTimeStr()}</span> น. ข้าพเจ้าได้นำ <span className="dot-underline font-bold">{item.warrantType || "หมายศาล"}</span> มาส่งให้แก่ <span className="dot-underline font-bold">{item.targetName || "...................................."}</span> เมื่อมาถึงบ้านเลขที่ <span className="dot-underline font-bold">{item.address || "............"}</span> {item.village ? <span>{item.village}</span> : ''} ตำบล <span className="dot-underline font-bold">{item.subdistrict || "............"}</span> อำเภอ <span className="dot-underline font-bold">{item.district || "............"}</span> จังหวัด <span className="dot-underline font-bold">{item.province || "สุรินทร์"}</span> ซึ่งเป็นบ้านของจำเลย
                      </div>

                      <div>
                        ข้าพเจ้าได้ทำการปิด หมาย ไว้ ณ ภูมิลำเนาของ <span className="dot-underline font-bold">{item.targetName || "...................................."}</span> <br />
                        ในที่เปิดเผยและมองเห็นได้ชัดเจนตามคำสั่งศาล
                      </div>

                      <div className="text-center font-bold pt-0.5 text-lg">
                        จึงบันทึกไว้เป็นหลักฐาน
                      </div>

                      <div className="flex flex-col items-end pt-0.5 space-y-0.5">
                        <div className="text-center space-y-0.5">
                          <div>......................................................................ผู้บันทึก/ปิดหมาย</div>
                          <div className="font-bold">({currentUser ? currentUser.fullName : "นายจิรพงษ์ มณีปรุ"})</div>
                        </div>
                      </div>

                      <div className="text-center font-bold text-base pt-0.5">
                        ลักษณะบ้าน <span className="dot-underline font-bold">{item.warrantResult || "ส่งได้โดยวิธีปิดหมาย"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-0.5 space-y-0.5">
                    <div className="flex flex-col items-center justify-center space-y-0.5 w-full">
                      
                      <div className="w-full rounded-lg overflow-hidden flex items-center justify-center h-64 bg-white">
                        {item.photos && item.photos.length > 0 ? (
                          <img src={item.photos[0]} alt="รูปสถานที่ส่งหมาย" className="w-full h-64 object-contain mx-auto rounded-lg" />
                        ) : (
                          <div className="text-xs text-gray-400 font-bold w-full h-full flex items-center justify-center rounded-lg">[ ยังไม่ได้เลือกรูปถ่ายสถานที่ ]</div>
                        )}
                      </div>

                      <div className="text-center font-bold text-xs pt-0.5">
                        พิกัด GPS: {item.gps || "14.872185, 103.461160"}
                      </div>

                      <div className="w-full rounded-lg overflow-hidden h-64 relative bg-white">
                        <img 
                          src={getMapImageUrl(item.gps)} 
                          alt="แผนที่ GPS" 
                          className="w-full h-64 object-cover block mx-auto rounded-lg" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://staticmap.openstreetmap.de/staticmap.php?center=${item.gps ? item.gps.split(',')[1] : '103.461160'},${item.gps ? item.gps.split(',')[0] : '14.872185'}&zoom=16&size=600x280&maptype=mapnik`;
                          }}
                        />
                        
                        <div className="absolute bottom-3 right-3 text-right whitespace-nowrap gps-overlay-text">
                          <div>GPS: {item.gps || "14.872186, 103.461157"}</div>
                          <div>{item.village ? `${item.village} ` : ''}ตำบล {item.subdistrict || 'โคกสะอาด'} อำเภอ {item.district || 'ปราสาท'}</div>
                          <div>จังหวัด {item.province || 'สุรินทร์'} {item.zipcode || '32140'}</div>
                          <div>วันที่ {formatThaiDate(item.sendDate)}</div>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}