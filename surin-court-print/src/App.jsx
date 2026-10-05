import React, { useState } from 'react';
import { villageMapping } from "./villageMapping";

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

          if (rawData.length > 1) {
            setTitle(rawData[0]?.[0] || 'บัญชีหมายที่รับผิดชอบ');
            setSubTitle(rawData[1]?.[0] || '');
          }

          const parsedRows = [];
          for (let i = 3; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row) continue;

            let blackNo = (row[1] || '').toString().trim();
            if (!blackNo || blackNo === 'เลขดำที่') continue;

            let rawRedNo = (row[2] || '').toString().trim();
            let redNo = (rawRedNo === '-' || !rawRedNo) ? '' : rawRedNo;
            
            let writType = (row[5] || '').toString().trim();
            let target = (row[6] || '').toString().trim();
            let rawAddr = (row[7] || '').toString().trim();
            let tambon = (row[8] || '').toString().trim();
            let amphoe = (row[11] || '').toString().trim();
            let price = parseFloat((row[13] || '0').toString().replace(/,/g, '')) || 0;

            const mooMatch = rawAddr.match(/(?:ม(?:ู๋|\.)?|หมู่)\s*(\d+)/i);
            const mooNum = mooMatch ? parseInt(mooMatch[1], 10).toString() : '';

            let cleanTambon = tambon.replace(/^(ต\.|ตำบล)/, '').trim();
            if (!cleanTambon) {
              const rowStr = row.join(' ');
              const matchTambonInRow = rowStr.match(/(?:ต\.|ตำบล)\s*([ก-๙]+)/);
              if (matchTambonInRow) {
                cleanTambon = matchTambonInRow[1].trim();
              }
            }

            let villageName = '';
            if (mooNum) {
              const primaryKey = cleanTambon + '_' + mooNum;
              villageName = villageMapping[primaryKey] || '';

              if (!villageName) {
                const keys = Object.keys(villageMapping);
                const matchedKey = keys.find(k => {
                  const parts = k.split('_');
                  const tName = parts[0].replace(/^(ต\.|ตำบล)/, '').trim();
                  const mNo = parts[1];
                  return (cleanTambon ? tName === cleanTambon : true) && mNo === mooNum;
                });
                if (matchedKey) {
                  villageName = villageMapping[matchedKey];
                }
              }
            }

            let updatedAddr = rawAddr;
            if (villageName) {
              if (!rawAddr.includes(villageName)) {
                if (mooMatch) {
                  const origMooText = mooMatch[0];
                  updatedAddr = rawAddr.replace(origMooText, origMooText + ' ' + villageName);
                } else {
                  updatedAddr = rawAddr + ' ' + villageName;
                }
              }

              const doublePattern = new RegExp(villageName + '\\s+' + villageName, 'g');
              updatedAddr = updatedAddr.replace(doublePattern, villageName);
            }

            updatedAddr = updatedAddr.replace(/\s+/g, ' ').trim();

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ padding: '24px', fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif", backgroundColor: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
      
      <style>{`
        .report-table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          font-size: 24px !important;
          line-height: 1.45 !important;
          background-color: #ffffff !important;
        }
        .report-table th {
          background-color: #0f172a !important;
          color: #ffffff !important;
          padding: 16px 8px !important;
          font-size: 26px !important;
          font-weight: 700 !important;
          border: 1px solid #334155 !important;
          text-align: center !important;
        }
        .report-table td {
          padding: 14px 10px !important;
          border: 1px solid #cbd5e1 !important;
          vertical-align: middle !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          white-space: normal !important;
          color: #0f172a !important;
          font-size: 24px !important;
        }

        .col-seq { width: 4% !important; text-align: center !important; font-weight: 600 !important; color: #475569 !important; }
        .col-black { width: 10% !important; text-align: center !important; font-weight: 700 !important; color: #0284c7 !important; font-size: 24px !important; }
        .col-red { width: 10% !important; text-align: center !important; font-weight: 700 !important; color: #dc2626 !important; font-size: 24px !important; }
        .col-type { width: 11% !important; font-weight: 500 !important; }
        .col-target { width: 23% !important; font-weight: 600 !important; }
        .col-addr { width: 16% !important; color: #0369a1 !important; font-weight: 700 !important; }
        .col-tambon { width: 9% !important; text-align: center !important; font-weight: 500 !important; }
        .col-amphoe { width: 8% !important; text-align: center !important; font-weight: 500 !important; }
        .col-price { width: 9% !important; text-align: right !important; font-weight: 700 !important; font-size: 24px !important; color: #0f172a !important; }

        @media print {
          @page { 
            size: A4 landscape !important; 
            margin: 4mm 5mm !important; 
          }
          html {
            height: 100% !important;
          }
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { 
            display: none !important; 
          }
          .print-area { 
            box-shadow: none !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            width: 100% !important; 
            border: none !important;
            height: auto !important;
            overflow: visible !important;
          }
          .header-area {
            padding-bottom: 4px !important;
            margin-bottom: 6px !important;
          }
          .report-table {
            width: 100% !important;
            font-size: 11.5pt !important;
            line-height: 1.25 !important;
            page-break-after: auto !important;
          }
          .report-table tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          .report-table thead {
            display: table-header-group !important;
          }
          .report-table th {
            background-color: #f1f5f9 !important;
            color: black !important;
            border: 1px solid #000000 !important;
            padding: 4px 3px !important;
            font-size: 12.5pt !important;
            font-weight: bold !important;
          }
          .report-table td {
            color: black !important;
            border: 1px solid #000000 !important;
            padding: 3px 4px !important;
            font-size: 11.5pt !important;
          }
          .col-black, .col-red, .col-addr, .col-price {
            color: black !important;
            font-size: 11.5pt !important;
          }
          h2 { font-size: 15pt !important; margin: 0 !important; }
          p { font-size: 12pt !important; margin: 1px 0 0 0 !important; }
        }
      `}</style>

      {/* ส่วนอัปโหลดไฟล์ */}
      <div className="no-print" style={{ maxWidth: '100%', margin: '0 auto 24px', backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#0f172a' }}>
              🏛 ระบบนำเข้าเอกสารบัญชีหมาย (สุรินทร์ คอร์ท)
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '20px', color: '#475569' }}>โปรแกรมแปลงชื่อหมู่บ้านและจัดรูปแบบเอกสารพิมพ์แนวนอน (A4 Landscape)</p>
          </div>
          {data.length > 0 && (
            <button
              onClick={handlePrint}
              style={{ backgroundColor: '#0284c7', color: 'white', padding: '14px 32px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 8px rgba(2,132,199,0.3)' }}
            >
              🖨 พิมพ์เอกสาร (แนวนอน)
            </button>
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '2px dashed #94a3b8', backgroundColor: '#f8fafc', padding: '32px', borderRadius: '12px', cursor: 'pointer' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>📂</div>
          <span style={{ fontWeight: 'bold', fontSize: '22px', color: '#0f172a' }}>คลิกเพื่อเลือกไฟล์ Excel (.xls / .xlsx)</span>
          <span style={{ fontSize: '18px', color: '#64748b', marginTop: '6px' }}>ระบบจะเติมชื่อหมู่บ้าน เรียงลำดับตามตำบล (ก-ฮ) และคำนวณยอดเงินให้อัตโนมัติ</span>
          <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {/* ส่วนแสดงผลรายงานเอกสาร */}
      {data.length > 0 ? (
        <div className="print-area" style={{ width: '100%', margin: '0 auto', backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div className="header-area" style={{ paddingBottom: '12px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '30px', fontWeight: 'bold', color: '#0f172a' }}>{title}</h2>
            <p style={{ margin: '6px 0 0', fontSize: '24px', color: '#334155', fontWeight: '600' }}>{subTitle}</p>
          </div>

          <table className="report-table">
            <thead>
              <tr>
                <th className="col-seq">ที่</th>
                <th className="col-black">เลขดำที่</th>
                <th className="col-red">เลขแดงที่</th>
                <th className="col-type">ประเภทหมาย</th>
                <th className="col-target">หมายถึงใคร</th>
                <th className="col-addr">ที่อยู่ / หมู่บ้าน</th>
                <th className="col-tambon">ตำบล</th>
                <th className="col-amphoe">อำเภอ</th>
                <th className="col-price">ราคา</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                  <td className="col-seq">{item.seq}</td>
                  <td className="col-black">{item.blackNo}</td>
                  <td className="col-red">{item.redNo}</td>
                  <td className="col-type">{item.writType}</td>
                  <td className="col-target">{item.target}</td>
                  <td className="col-addr">{item.addr}</td>
                  <td className="col-tambon">{item.tambon}</td>
                  <td className="col-amphoe">{item.amphoe}</td>
                  <td className="col-price">{item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                <td colSpan="8" style={{ textAlign: 'right', padding: '10px 12px', fontSize: '20px', color: '#0f172a' }}>รวมเป็นเงินทั้งสิ้น</td>
                <td className="col-price" style={{ textAlign: 'right', color: '#0284c7', padding: '10px 12px', fontSize: '20px', fontWeight: 'bold' }}>{totalPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-print" style={{ width: '100%', textAlign: 'center', padding: '48px', backgroundColor: '#ffffff', borderRadius: '12px', color: '#94a3b8', border: '1px solid #e2e8f0', fontSize: '24px' }}>
          กรุณากดเลือกไฟล์ Excel ด้านบนเพื่อแสดงผลตาราง
        </div>
      )}
    </div>
  );
}