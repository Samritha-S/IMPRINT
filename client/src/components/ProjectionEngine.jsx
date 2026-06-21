import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { HelpCircle } from 'lucide-react';

export default function ProjectionEngine({ token }) {
  const { t } = useTranslation();
  const [ev, setEv] = useState(0);
  const [veg, setVeg] = useState(0);
  const [flights, setFlights] = useState(0);
  const [dataPoints, setDataPoints] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchProjection = () => {
    setLoading(true);
    fetch('/api/projection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        evAdoption: ev,
        vegDietShift: veg,
        flightReduction: flights
      })
    })
      .then(res => res.json())
      .then(data => {
        setDataPoints(data.dataPoints || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProjection();
  }, [ev, veg, flights, token]);

  const latestPoint = dataPoints[dataPoints.length - 1] || { baseline: 1800, optimized: 1800, treesSaved: 0 };
  const percentReduction = Math.round(((latestPoint.baseline - latestPoint.optimized) / latestPoint.baseline) * 100) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="leaf-card">
        <h3>{t('projection.title')}</h3>
        <p>{t('projection.desc')}</p>
        
        {/* Sliders Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', margin: '20px 0' }}>
          
          {/* EV Slider */}
          <div style={{ background: '#FAF8F5', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-leaf)' }}>
            <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>{t('projection.evShift')}</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={ev} 
              onChange={e => setEv(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary-green)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginTop: '6px' }}>
              <span>{t('projection.baselineLabel')}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--primary-green)' }}>{Math.round(ev * 100)}% Electric</span>
            </div>
          </div>

          {/* Vegetarian Diet Slider */}
          <div style={{ background: '#FAF8F5', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-leaf)' }}>
            <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>{t('projection.dietShift')}</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={veg} 
              onChange={e => setVeg(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary-green)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginTop: '6px' }}>
              <span>{t('projection.standardDiet')}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--primary-green)' }}>{Math.round(veg * 100)}% Veg</span>
            </div>
          </div>

          {/* Flight Reduction Slider */}
          <div style={{ background: '#FAF8F5', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-leaf)' }}>
            <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>{t('projection.efficiencyShift')}</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={flights} 
              onChange={e => setFlights(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary-green)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666', marginTop: '6px' }}>
              <span>{t('projection.baselineUse')}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--primary-green)' }}>{Math.round(flights * 100)}% Saved</span>
            </div>
          </div>

        </div>

        {/* Projection Chart */}
        <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '16px', border: '1px solid rgba(74, 124, 89, 0.1)' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>{t('projection.chartTitle')}</h4>
          <div style={{ height: '300px' }}>
            {loading ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                {t('projection.loading')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dataPoints} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBaseline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B6914" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8B6914" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOptimized" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A7C59" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4A7C59" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" tickFormatter={(yr) => `Yr ${yr}`} />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value} kg`} />
                  <Legend />
                  <Area type="monotone" name={t('projection.bauCurve')} dataKey="baseline" stroke="#8B6914" fillOpacity={1} fill="url(#colorBaseline)" strokeWidth={2} />
                  <Area type="monotone" name={t('projection.targetCurve')} dataKey="optimized" stroke="#4A7C59" fillOpacity={1} fill="url(#colorOptimized)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Highlight Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div style={{ padding: '16px', background: '#F0F7F2', borderRadius: '16px', border: '1px solid var(--border-leaf)', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#666' }}>{t('projection.carbonReduced')}</span>
            <span style={{ display: 'block', fontSize: '32px', fontWeight: '900', color: 'var(--primary-green)' }}>
              {percentReduction}%
            </span>
          </div>

          <div style={{ padding: '16px', background: '#FDFCF7', borderRadius: '16px', border: '1.5px solid var(--border-leaf)', textAlign: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#666' }}>{t('projection.treesLabel')}</span>
            <span style={{ display: 'block', fontSize: '32px', fontWeight: '900', color: 'var(--earth-brown)' }}>
              {latestPoint.treesSaved} 🌲
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
