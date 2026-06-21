import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import PipMascot from './PipMascot';
import { useTranslation } from 'react-i18next';
import { Camera, FileText, Check, AlertTriangle, ArrowRight, Loader } from 'lucide-react';

const SAMPLES = {
  electricity: `
    BESCOM ELECTRICITY BILL
    Consumer: Sam Smith
    Month: May 2026
    Total units consumed: 120 kWh
    Amount Due: Rs. 780.00
    Please pay before due date.
  `,
  grocery: `
    ORGANIC NATURE SUPERMARKET
    1. Basmati Rice 2kg - 180.00
    2. Chicken Breast 1.5kg - 340.00
    3. Fresh Spinach 500g - 45.00
    4. Amul Butter 500g - 230.00
    TOTAL: 795.00
  `
};

export default function ScannerHub({ token }) {
  const { t } = useTranslation();
  const [scanType, setScanType] = useState('bill'); // 'bill' or 'grocery'
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [scanResult, setScanResult] = useState(null);
  
  // Manual correction state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDetails, setManualDetails] = useState({
    type: 'electricity',
    provider: '',
    units: '',
    amount: '',
    period: '',
    items: [],
    total_kg: ''
  });

  const runOcr = async (fileOrText, fileInfo = {}) => {
    setLoading(true);
    setScanResult(null);
    setShowManualForm(false);
    
    let text = "";

    if (typeof fileOrText === 'string') {
      text = fileOrText;
    } else {
      try {
        const worker = await createWorker('eng');
        const ret = await worker.recognize(fileOrText);
        text = ret.data.text;
        await worker.terminate();
      } catch (err) {
        console.error("Tesseract client error:", err);
        text = ""; // Fallback
      }
    }

    setOcrText(text);

    // Call server to parse OCR text
    try {
      const res = await fetch('/api/scanner/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          type: scanType, 
          textContent: text,
          fileType: fileInfo.type,
          fileSize: fileInfo.size
        })
      });
      
      const resData = await res.json();
      if (res.ok) {
        // If confidence is low, show manual form pre-filled and do not show success message
        if (resData.requiresCorrection || resData.confidence < 0.5 || !resData.parsed || Object.keys(resData.parsed).length === 0) {
          setScanResult(null);
          setShowManualForm(true);
          // Pre-fill manual values
          if (scanType === 'bill') {
            setManualDetails({
              type: resData.parsed?.type || 'electricity',
              provider: resData.parsed?.provider || '',
              units: resData.parsed?.units || '',
              amount: resData.parsed?.amount || '',
              period: resData.parsed?.period || '',
              items: [],
              total_kg: ''
            });
          } else {
            setManualDetails({
              type: 'grocery',
              provider: '',
              units: '',
              amount: '',
              period: '',
              items: resData.parsed?.items || [],
              total_kg: resData.parsed?.total_kg || ''
            });
          }
        } else {
          setScanResult(resData);
          setShowManualForm(false);
        }
      } else {
        setScanResult(null);
        setShowManualForm(true);
        if (resData.error) {
          alert(`Scan upload failed: ${resData.error}`);
        }
      }
    } catch (e) {
      console.error(e);
      setShowManualForm(true);
    }
    setLoading(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert("Invalid file type. Please select a PNG, JPG, or GIF image.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("File size exceeds 5MB limit.");
        return;
      }
      runOcr(file, { type: file.type, size: file.size });
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/scanner/manual-correct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: scanType, details: manualDetails })
      });
      
      const resData = await res.json();
      if (res.ok) {
        setScanResult({ success: true, instantInsight: resData.instantInsight });
        setShowManualForm(false);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Segment Select */}
      <div className="segment-bar">
        <div 
          className={`segment-item ${scanType === 'bill' ? 'active' : ''}`}
          onClick={() => { setScanType('bill'); setScanResult(null); setShowManualForm(false); }}
        >
          {t('scanner.billTab')}
        </div>
        <div 
          className={`segment-item ${scanType === 'grocery' ? 'active' : ''}`}
          onClick={() => { setScanType('grocery'); setScanResult(null); setShowManualForm(false); }}
        >
          {t('scanner.groceryTab')}
        </div>
      </div>

      <div className="dashboard-grid">
        
        {/* Input Scan Section */}
        <div className="leaf-card">
          <h3>{t('scanner.uploadTitle')}</h3>
          <p>{t('scanner.uploadSubDesc')}</p>

          <div style={{ border: '3px dashed var(--border-leaf)', borderRadius: '16px', padding: '30px', textAlign: 'center', margin: '20px 0', background: 'rgba(74, 124, 89, 0.02)' }}>
            <Camera size={48} style={{ color: 'var(--primary-green)', marginBottom: '15px' }} />
            <div>
              <label className="btn" style={{ padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>
                {t('scanner.chooseImage')}
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            </div>
            <span style={{ fontSize: '12px', color: '#777', display: 'block', marginTop: '10px' }}>
              {t('scanner.supportedFiles')}
            </span>
          </div>

          <div style={{ marginTop: '20px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
              {t('scanner.orSample')}
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px 12px', fontSize: '12px' }}
                onClick={() => runOcr(scanType === 'bill' ? SAMPLES.electricity : SAMPLES.grocery)}
              >
                {t('scanner.loadSample')}
              </button>
            </div>
          </div>
        </div>

        {/* Status / Output Section */}
        <div className="leaf-card">
          <h3>{t('scanner.outputTitle')}</h3>
          
          {loading && (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <Loader className="spin" size={36} style={{ color: 'var(--primary-green)', margin: '0 auto 10px auto' }} />
              <p>{t('scanner.analyzing')}</p>
            </div>
          )}

          {!loading && !scanResult && !showManualForm && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
              <FileText size={40} style={{ margin: '0 auto 10px auto' }} />
              <p>{t('scanner.uploadPrompt')}</p>
            </div>
          )}

          {/* Corrected or Successful Scan Result */}
          {scanResult && !showManualForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-green)', fontWeight: 'bold' }}>
                <Check size={20} />
                <span>{t('scanner.success')}</span>
              </div>

              {scanResult.parsed && (
                <div style={{ background: '#FAF8F5', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-leaf)' }}>
                  <h4 style={{ margin: 0, textTransform: 'capitalize' }}>
                    {scanType === 'bill' ? `${scanResult.parsed.type} bill` : 'Grocery receipt'}
                  </h4>
                  <p style={{ fontSize: '14px', margin: '5px 0' }}>
                    {scanType === 'bill' ? (
                      <>
                        <strong>{t('scanner.provider')}:</strong> {scanResult.parsed.provider}<br />
                        <strong>{t('scanner.unitsLabel')}:</strong> {scanResult.parsed.units} units<br />
                        <strong>{t('scanner.emissions')}:</strong> {scanResult.parsed.co2_kg} kg CO₂
                      </>
                    ) : (
                      <>
                        <strong>{t('scanner.itemsFound')}:</strong> {scanResult.parsed.items?.length || 0}<br />
                        <strong>{t('scanner.emissions')}:</strong> {scanResult.parsed.total_kg ? Number(scanResult.parsed.total_kg).toFixed(1) : 0} kg CO₂
                      </>
                    )}
                  </p>
                </div>
              )}

              {scanResult.instantInsight && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <PipMascot mood="happy" size={70} />
                  <div className="speech-bubble" style={{ fontSize: '13px' }}>
                    <strong>{t('scanner.pipInsight')}</strong><br />
                    "{scanResult.instantInsight}"
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Silent manual correction fallback */}
          {showManualForm && (
            <form onSubmit={handleManualSubmit}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--earth-brown)', marginBottom: '15px', fontWeight: 'bold' }}>
                <AlertTriangle size={20} />
                <span>{t('scanner.lowConfidence')}</span>
              </div>

              {scanType === 'bill' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('scanner.utilityType')}</label>
                    <select 
                      className="form-select" 
                      value={manualDetails.type}
                      onChange={e => setManualDetails({ ...manualDetails, type: e.target.value })}
                    >
                      <option value="electricity">Electricity</option>
                      <option value="gas">PNG Gas</option>
                      <option value="lpg">LPG Cylinder</option>
                      <option value="petrol">Petrol</option>
                      <option value="diesel">Diesel</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('scanner.providerName')}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={manualDetails.provider}
                      onChange={e => setManualDetails({ ...manualDetails, provider: e.target.value })}
                      placeholder="e.g. BESCOM"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label className="form-label">{t('scanner.unitsLabel')}</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={manualDetails.units}
                        onChange={e => setManualDetails({ ...manualDetails, units: e.target.value })}
                        placeholder="kWh/SCM/kg/litres"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('scanner.billingAmount')}</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={manualDetails.amount}
                        onChange={e => setManualDetails({ ...manualDetails, amount: e.target.value })}
                        placeholder="₹ Amount"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('scanner.billingPeriod')}</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={manualDetails.period}
                      onChange={e => setManualDetails({ ...manualDetails, period: e.target.value })}
                      placeholder="e.g. 2026-05"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('scanner.groceryTotal')}</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="form-input" 
                      value={manualDetails.total_kg}
                      onChange={e => setManualDetails({ ...manualDetails, total_kg: e.target.value })}
                      placeholder="Estimated total weight"
                      required
                    />
                  </div>
                  <p style={{ fontSize: '12px', color: '#666' }}>{t('scanner.groceriesNote')}</p>
                </>
              )}

              <button type="submit" className="btn" style={{ width: '100%', marginTop: '10px' }}>
                {t('scanner.submitManual')} <ArrowRight size={18} />
              </button>
            </form>
          )}

        </div>
      </div>
      
    </div>
  );
}
