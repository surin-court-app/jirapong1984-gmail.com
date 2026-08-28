import React, { useState } from 'react';

// ฐานข้อมูลแปลงชื่อหมู่บ้าน สุรินทร์
const villageMapping = {
  // === อำเภอเมืองสุรินทร์ ===
  'ในเมือง_-': '',

  // ตำบลนอกเมือง
  'นอกเมือง_1': 'บ้านหนองกง',
  'นอกเมือง_2': 'บ้านโคกปลัด',
  'นอกเมือง_3': 'บ้านไทย',
  'นอกเมือง_4': 'บ้านปรือเกียน',
  'นอกเมือง_5': 'บ้านตะตึงไถง',
  'นอกเมือง_6': 'บ้านทนง',
  'นอกเมือง_7': 'บ้านเจ็มเนียง',
  'นอกเมือง_8': 'บ้านโคกกระเพอ',
  'นอกเมือง_9': 'บ้านโคกมะเมียน',
  'นอกเมือง_10': 'บ้านพันธุลี',
  'นอกเมือง_11': 'บ้านหลักวอ',
  'นอกเมือง_12': 'บ้านเสม็ด',
  'นอกเมือง_13': 'บ้านโสน',
  'นอกเมือง_14': 'บ้านตะเกียด',
  'นอกเมือง_15': 'บ้านระหาร',
  'นอกเมือง_16': 'บ้านดอนบม',
  'นอกเมือง_17': 'บ้านโคกกระเพอ',
  'นอกเมือง_18': 'บ้านดอนแก้ว',
  'นอกเมือง_19': 'บ้านโคกเพชร',
  'นอกเมือง_20': 'บ้านหนองโตงพัฒนา',
  'นอกเมือง_21': 'บ้านห้วยปลาไหล',
  'นอกเมือง_22': 'บ้านเทิดไทย',

  // ตำบลเฉนียง
  'เฉนียง_1': 'บ้านเฉนียง',
  'เฉนียง_2': 'บ้านโชค',
  'เฉนียง_3': 'บ้านกะโดน',
  'เฉนียง_4': 'บ้านโคกเมือง',
  'เฉนียง_5': 'บ้านโคกขลัง',
  'เฉนียง_6': 'บ้านจะเกริก',
  'เฉนียง_7': 'บ้านอำปึล',

  // ตำบลสลักได
  'สลักได_1': 'บ้านสลักได',
  'สลักได_2': 'บ้านจะแกร์',
  'สลักได_3': 'บ้านเพชร',

  // ตำบลท่าสว่าง
  'ท่าสว่าง_1': 'บ้านท่าสว่าง',
  'ท่าสว่าง_2': 'บ้านเขวา',

  // ตำบลคอโค
  'คอโค_1': 'บ้านคอโค',
  'คอโค_2': 'บ้านระกา',

  // ตำบลตากูก
  'ตากูก_1': 'บ้านตากูก',
  'ตากูก_2': 'บ้านเกาะ',

  // ตำบลแกใหญ่
  'แกใหญ่_1': 'บ้านแกใหญ่',
  'แกใหญ่_2': 'บ้านแกน้อย',

  // === อำเภอปราสาท ===
  'โคกสะอาด_9': 'บ้านโคกสะอาด',
  'โคกสะอาด_11': 'บ้านโคกเวง',
  'โชคนาสาม_5': 'บ้านถนนหัก',
  'ตานี_5': 'บ้านโคกจำเริญ',
  'ตานี_7': 'บ้านนาครอง',
  'ปรือ_1': 'บ้านปรือ',
  'ปราสาททนง_2': 'บ้านปราสาททนง',
  'ปราสาททนง_8': 'บ้านปราสาททนง',
  'ประทัดบุ_9': 'บ้านปจิกพัฒนา',
  'ไพล_6': 'บ้านไพล',
  'สมุด_-': '',
};

export default function App() {
  const [data, setData] = useState([]);
  const [title, setTitle] = useState('');
  const [subTitle, setSubTitle] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (rawData.length > 2) {
            setTitle(rawData[1]?.[0] || 'บัญชีหมายที่รับผิดชอบ');
            setSubTitle(rawData[2]?.[0] || '');
          }

          const parsedRows = [];
          for (let i = 4; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row) continue;

            let blackNo = (row[1] || '').toString().trim();

            if (!blackNo || blackNo === 'เลขดำที่') continue;

            let rawRedNo = (row[2] || '').toString().trim();
            let redNo = (rawRedNo === '-' || !rawRedNo) ? '' : rawRedNo;
            
            let writType = row[5] || '';
            let target = row[6] || '';
            let rawAddr = (row[7] || '').toString().trim();
            let tambon = (row[8] || '').toString().trim();
            let amphoe = (row[11] || '').toString().trim();
            let price = parseFloat((row[13] || '0').toString().replace(/,/g, '')) || 0;

            const mooMatch = rawAddr.match(/ม\.\s*(\d+)/);
            const mooNum = mooMatch ? mooMatch[1] : '';

            const key = `${tambon}_${mooNum}`;
            const villageName = villageMapping[key] || '';

            let updatedAddr = rawAddr;
            
            if (villageName) {
              if (!rawAddr.includes(villageName)) {
                if (mooMatch) {
                  const mooPattern = new RegExp(`ม\\.\\s*${mooNum}\\b`, 'g');
                  updatedAddr = rawAddr.replace(mooPattern, `ม.${mooNum} ${villageName}`);
                } else {
                  updatedAddr = `${rawAddr} ${villageName}`;
                }
              }

              const doublePattern = new RegExp(`${villageName}\\s+${villageName}`, 'g');
              updatedAddr = updatedAddr.replace(doublePattern, villageName);
            }

            updatedAddr = updatedAddr
              .replace(/ซ\.\s*-\s*/g, '')
              .replace(/ถ\.\s*-\s*/g, '')
              .replace(/\s+/g, ' ')
              .trim();

            parsedRows.push({
              blackNo, redNo, writType, target,
              addr: updatedAddr, tambon, amphoe, price
            });
          }

          parsedRows.sort((a, b) => a.tambon.localeCompare(b.tambon, 'th'));

          const reindexedRows = parsedRows.map((item, index) => ({
            ...item,
            seq: index + 1
          }));

          setData(reindexedRows);
        } catch (err) {
          alert("เกิดข้อผิดพลาดในการอ่านข้อมูลจากไฟล์ Excel");
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      alert("ไม่สามารถโหลดไลบรารีอ่าน Excel ได้");
    }
  };

  const totalPrice = data.reduce((sum, item) => sum + item.price, 0);

  return (
    <div style={{ padding: '24px', fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif", backgroundColor: '#f1f5f9', minHeight: '100vh', color: '#0f172a' }}>
      
      <style>{`
        @media print {
          @page { 
            size: A4 landscape; 
            margin: 3mm 4mm; 
          }
          html, body {
            height: 100vh !important;
            max-height: 100vh !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
          }
          .no-print { 
            display: none !important; 
          }
          .print-area { 
            box-shadow: none !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            width: 100% !important; 
            max-width: 100% !important; 
            max-height: 100vh !important;
            border: none !important;
            page-break-inside: avoid !important;
          }
          .header-area {
            padding-bottom: 2px !important;
            margin-bottom: 4px !important;
          }
          h2 { 
            font-size: 16pt !important; 
            color: black !important;
            margin: 0 !important;
          }
          p { 
            font-size: 12pt !important; 
            color: black !important;
            margin: 1px 0 0 0 !important;
          }
          table { 
            width: 100% !important;
            max-width: 100% !important;
            table-layout: auto !important;
            font-size: 13.5pt !important; 
            line-height: 1.2 !important;
            color: black !important;
            border-collapse: collapse !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: black !important;
            padding: 5px 6px !important;
            font-size: 14pt !important;
            font-weight: bold !important;
            border: 1px solid #000000 !important;
            text-align: center !important;
            white-space: nowrap !important;
          }
          td { 
            padding: 5px 6px !important; 
            font-size: 13.5pt !important;
            color: black !important;
            border: 1px solid #000000 !important;
            vertical-align: middle !important;
            white-space: nowrap !important;
          }
          .target-col, .writ-type-col, .addr-col {
            font-size: 13pt !important;
            font-weight: normal !important;
            white-space: nowrap !important;
          }
          .addr-col {
            color: black !important;
          }
          .total-text {
            color: black !important;
            font-size: 14pt !important;
            font-weight: bold !important;
            padding: 5px 6px !important;
          }
        }
      `}</style>

      {/* ส่วนอัปโหลดไฟล์ */}
      <div className="no-print" style={{ maxWidth: '2000px', margin: '0 auto 24px', backgroundColor: '#ffffff', padding: '28px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '18px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#0f172a' }}>
              🏛️ ระบบนำเข้าเอกสารบัญชีหมาย (สุรินทร์ คอร์ท)
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '22px', color: '#475569' }}>โปรแกรมแปลงชื่อหมู่บ้านและจัดรูปแบบเอกสารพิมพ์แนวนอน (A4 Landscape)</p>
          </div>
          {data.length > 0 && (
            <button
              onClick={() => window.print()}
              style={{ backgroundColor: '#0284c7', color: 'white', padding: '18px 40px', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 8px rgba(2,132,199,0.3)' }}
            >
              🖨️ พิมพ์เอกสาร (แนวนอน)
            </button>
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '3px dashed #94a3b8', backgroundColor: '#f8fafc', padding: '44px', borderRadius: '12px', cursor: 'pointer' }}>
          <div style={{ fontSize: '60px', marginBottom: '10px' }}>📂</div>
          <span style={{ fontWeight: 'bold', fontSize: '24px', color: '#0f172a' }}>คลิกเพื่อเลือกไฟล์ Excel (.xls / .xlsx)</span>
          <span style={{ fontSize: '20px', color: '#64748b', marginTop: '8px' }}>ระบบจะเติมชื่อหมู่บ้าน เรียงลำดับตามตำบล (ก-ฮ) และคำนวณยอดเงินให้อัตโนมัติ</span>
          <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {/* ส่วนแสดงผลรายงานเอกสาร */}
      {data.length > 0 ? (
        <div className="print-area" style={{ maxWidth: '2000px', margin: '0 auto', backgroundColor: '#ffffff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div className="header-area" style={{ paddingBottom: '12px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '34px', fontWeight: 'bold', color: '#0f172a' }}>{title}</h2>
            <p style={{ margin: '10px 0 0', fontSize: '26px', color: '#334155', fontWeight: '600' }}>{subTitle}</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '28px', color: '#0f172a', lineHeight: '1.6', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                <th style={{ border: '2px solid #334155', padding: '16px 12px', textAlign: 'center', fontSize: '24px', whiteSpace: 'nowrap' }}>ที่</th>
                <th style={{ border: '2px solid #334155', padding: '16px 16px', textAlign: 'center', fontSize: '24px', whiteSpace: 'nowrap' }}>เลขดำที่</th>
                <th style={{ border: '2px solid #334155', padding: '16px 16px', textAlign: 'center', fontSize: '24px', whiteSpace: 'nowrap' }}>เลขแดงที่</th>
                <th style={{ border: '2px solid #334155', padding: '16px 20px', textAlign: 'center', fontSize: '24px', whiteSpace: 'nowrap' }}>ประเภทหมาย</th>
                <th style={{ border: '2px solid #334155', padding: '16px 24px', textAlign: 'center', fontSize: '24px', whiteSpace: 'nowrap' }}>หมายถึงใคร</th>
                <th style={{ border: '2px solid #334155', padding: '16px 20px', textAlign: 'center', fontSize: '24px', whiteSpace: 'nowrap' }}>ที่อยู่ / หมู่บ้าน</th>
                <th style={{ border: '2px solid #334155', padding: '16px 16px', textAlign: 'center', fontSize: '24px', whiteSpace: 'nowrap' }}>ตำบล</th>
                <th style={{ border: '2px solid #334155', padding: '16px 16px', textAlign: 'center', fontSize: '24px', whiteSpace: 'nowrap' }}>อำเภอ</th>
                <th style={{ border: '2px solid #334155', padding: '16px 20px', textAlign: 'center', fontSize: '24px', whiteSpace: 'nowrap' }}>ราคา</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '16px 12px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.seq}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '16px 16px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.blackNo}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '16px 16px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.redNo}</td>
                  <td className="writ-type-col" style={{ border: '1px solid #cbd5e1', padding: '16px 20px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.writType}</td>
                  <td className="target-col" style={{ border: '1px solid #cbd5e1', padding: '16px 24px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.target}</td>
                  <td className="addr-col" style={{ border: '1px solid #cbd5e1', padding: '16px 20px', color: '#0284c7', fontWeight: 'bold', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.addr}</td>
                  <td className="tambon-col" style={{ border: '1px solid #cbd5e1', padding: '16px 16px', textAlign: 'center', fontWeight: 'normal', color: '#0f172a', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.tambon}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '16px 16px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.amphoe}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '16px 20px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                <td colSpan="8" className="total-text" style={{ border: '1px solid #cbd5e1', padding: '18px 20px', textAlign: 'right', fontSize: '30px' }}>รวมเป็นเงินทั้งสิ้น</td>
                <td className="total-text" style={{ border: '1px solid #cbd5e1', padding: '18px 20px', textAlign: 'right', color: '#0284c7', fontSize: '30px' }}>{totalPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-print" style={{ maxWidth: '2000px', margin: '0 auto', textAlign: 'center', padding: '60px', backgroundColor: '#ffffff', borderRadius: '12px', color: '#94a3b8', border: '1px solid #e2e8f0', fontSize: '24px' }}>
          กรุณากดเลือกไฟล์ Excel ด้านบนเพื่อแสดงผลตาราง
        </div>
      )}
    </div>
  );
}