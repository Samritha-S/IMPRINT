import React, { useState, useEffect } from 'react';
import PipMascot from './PipMascot';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, Users, Flame, Utensils, Car, Lightbulb, Check, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function Dashboard({ token }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ level: 'ward', list: [], note: '' });
  const [leadLevel, setLeadLevel] = useState('ward');
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState(false);
  const [history, setHistory] = useState([]);

  const fetchDashboard = () => {
    setLoading(true);
    fetch('/api/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || 'Failed to fetch dashboard');
        }
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Dashboard error:", err);
        setData({ apiError: err.message });
        setLoading(false);
      });
  };

  const fetchHistory = () => {
    fetch('/api/dashboard/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(hData => setHistory(hData))
      .catch(err => console.error("History error:", err));
  };

  const fetchLeaderboard = (level) => {
    fetch(`/api/leaderboard?level=${level}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(resData => {
        setLeaderboard(resData);
      })
      .catch(err => console.error("Leaderboard error:", err));
  };

  useEffect(() => {
    fetchDashboard();
    fetchHistory();
  }, [token]);

  useEffect(() => {
    fetchLeaderboard(leadLevel);
  }, [leadLevel, token]);

  const handleAcceptAction = async (actionId) => {
    try {
      const res = await fetch('/api/agent/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action_id: actionId, accepted: true })
      });
      if (res.ok) {
        setActionSuccess(true);
        setTimeout(() => {
          setActionSuccess(false);
          fetchDashboard(); // reload to get new card
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const chartElement = React.useMemo(() => {
    return (
      <AreaChart 
        data={history} 
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        role="img"
        aria-label="Stacked area chart showing daily carbon footprint breakdown over the last 30 days"
      >
        <desc>
          A stacked area chart displaying the daily history of emissions from Food, Transport, Electricity, and Gas. 
          The data indicates trends in personal carbon footprint over time.
        </desc>
        <defs>
          <linearGradient id="colorFood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E85D04" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#E85D04" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorTransport" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4A7C59" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#4A7C59" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorElectricity" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8DB87A" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#8DB87A" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8B6914" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#8B6914" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tickFormatter={(tick) => tick.slice(5)} />
        <YAxis />
        <Tooltip formatter={(value) => `${value} kg`} />
        <Legend />
        <Area type="monotone" name={t('dashboard.chartCategories.food')} dataKey="food" stackId="1" stroke="#E85D04" fill="url(#colorFood)" strokeWidth={2} />
        <Area type="monotone" name={t('dashboard.chartCategories.transport')} dataKey="transport" stackId="1" stroke="#4A7C59" fill="url(#colorTransport)" strokeWidth={2} />
        <Area type="monotone" name={t('dashboard.chartCategories.electricity')} dataKey="electricity" stackId="1" stroke="#8DB87A" fill="url(#colorElectricity)" strokeWidth={2} />
        <Area type="monotone" name={t('dashboard.chartCategories.gas')} dataKey="gas" stackId="1" stroke="#8B6914" fill="url(#colorGas)" strokeWidth={2} />
      </AreaChart>
    );
  }, [history]);

  if (loading || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <PipMascot mood="neutral" size={100} />
        <h3>{t('dashboard.title')}</h3>
      </div>
    );
  }

  if (data.apiError) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#D32F2F' }}>
        <PipMascot mood="concerned" size={100} />
        <h3>Error loading dashboard</h3>
        <p>{data.apiError}</p>
      </div>
    );
  }

  const progressColor = data.today.progress_pct > 0 ? '#E85D04' : '#4A7C59';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* 1. Main Mascot Card */}
      <div className="leaf-card" style={{ background: '#FAF8F5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <PipMascot mood={data.today.mood} size={130} />
            <span style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--earth-brown)', marginTop: '8px' }}>
              {t('dashboard.mascotTitle')} {data.today.mood}
            </span>
          </div>

          <div style={{ flex: 1, minWidth: '280px' }}>
            <div className="speech-bubble" style={{ marginBottom: '15px' }}>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-dark)' }}>
                "{data.today.message}"
              </p>
            </div>

            {/* Quick Action Suggestion Chip */}
            {data.today.suggested_action && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: '#FFFFFF', border: '1.5px solid var(--border-leaf)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Flame size={18} style={{ color: 'var(--earth-brown)' }} />
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    {data.today.suggested_action.action_desc}
                    <strong style={{ color: 'var(--primary-green)', marginLeft: '6px' }}>
                      (-{data.today.suggested_action.savings_kg} kg CO₂)
                    </strong>
                  </span>
                </div>
                {actionSuccess || data.today.suggested_action.status === 'accepted' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary-green)', fontWeight: 'bold', fontSize: '14px' }}>
                    <Check size={16} /> {t('feed.accept')}
                  </span>
                ) : data.today.suggested_action.status === 'dismissed' ? (
                  <span style={{ color: '#D32F2F', fontWeight: 'bold', fontSize: '14px' }}>
                    {t('feed.dismiss')}
                  </span>
                ) : (
                  <button 
                    className="btn" 
                    onClick={() => handleAcceptAction(data.today.suggested_action.action_id)}
                    style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '13px' }}
                  >
                    {t('feed.accept')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Today's Imprint Value Card & Weekly breakdown in grid */}
      <div className="dashboard-grid">
        
        {/* Today's carbon imprint status */}
        <div className="leaf-card">
          <h3>{t('dashboard.title')}</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '15px 0' }}>
            <span style={{ fontSize: '48px', fontWeight: '900', color: 'var(--primary-green)', lineHeight: 1 }}>
              {Number(data.today.total_kg).toFixed(1)}
            </span>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#666666' }}>kg CO₂</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: progressColor, fontWeight: '800' }}>
            {data.today.progress_pct > 0 ? (
              <>
                <ArrowUp size={18} />
                <span>{data.today.progress_pct}% above your weekly average</span>
              </>
            ) : (
              <>
                <ArrowDown size={18} />
                <span>{Math.abs(data.today.progress_pct)}% below your weekly average</span>
              </>
            )}
          </div>

          <div className="progress-container" style={{ marginTop: '20px' }}>
            {/* simple visual percentage filled */}
            <div 
              className="progress-bar" 
              style={{ 
                width: `${Math.min(100, Math.max(10, (data.today.total_kg / 15) * 100))}%`,
                backgroundColor: progressColor
              }}
            ></div>
          </div>
          <span style={{ fontSize: '12px', color: '#777' }}>Target: Keep under 10.0 kg/day</span>
        </div>

        {/* Weekly breakdown */}
        <div className="leaf-card">
          <h3>{t('dashboard.weeklyGlance')}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '15px' }}>
            
            {/* Food */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(232, 93, 4, 0.1)', display: 'flex', alignItems: 'center', justifyContext: 'center' }}>
                  <Utensils size={18} style={{ color: '#E85D04', margin: 'auto' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{t('dashboard.chartCategories.food')}</div>
                  <div style={{ fontSize: '12px', color: '#777' }}>{data.week.food} kg total</div>
                </div>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: data.week.foodDelta > 0 ? '#E85D04' : '#4A7C59' }}>
                {data.week.foodDelta > 0 ? `+${data.week.foodDelta}%` : `${data.week.foodDelta}%`}
              </span>
            </div>

            {/* Transport */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(74, 124, 89, 0.1)', display: 'flex', alignItems: 'center', justifyContext: 'center' }}>
                  <Car size={18} style={{ color: '#4A7C59', margin: 'auto' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{t('dashboard.chartCategories.transport')}</div>
                  <div style={{ fontSize: '12px', color: '#777' }}>{data.week.transport} kg total</div>
                </div>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: data.week.transportDelta > 0 ? '#E85D04' : '#4A7C59' }}>
                {data.week.transportDelta > 0 ? `+${data.week.transportDelta}%` : `${data.week.transportDelta}%`}
              </span>
            </div>

            {/* Energy */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139, 105, 20, 0.1)', display: 'flex', alignItems: 'center', justifyContext: 'center' }}>
                  <Lightbulb size={18} style={{ color: '#8B6914', margin: 'auto' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{t('dashboard.chartCategories.electricity')}</div>
                  <div style={{ fontSize: '12px', color: '#777' }}>{data.week.energy} kg total</div>
                </div>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: data.week.energyDelta > 0 ? '#E85D04' : '#4A7C59' }}>
                {data.week.energyDelta > 0 ? `+${data.week.energyDelta}%` : `${data.week.energyDelta}%`}
              </span>
            </div>

          </div>
        </div>

      </div>

      {/* 2.5 Habits History Stacked Area Chart */}
      <div className="leaf-card">
        <h3>{t('dashboard.habits')}</h3>
        <p>{t('dashboard.habitsDesc')}</p>
        <div style={{ height: '300px', width: '100%', marginTop: '15px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartElement}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Neighbourhood Pulse Leaderboard */}
      <div className="leaf-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3>{t('dashboard.pulse')}</h3>
            <p style={{ margin: 0, fontSize: '14px' }}>{t('dashboard.pulseDesc')}</p>
          </div>

          <div className="segment-bar" style={{ margin: 0 }}>
            {['ward', 'city', 'state'].map(lvl => (
              <div 
                key={lvl} 
                className={`segment-item ${leadLevel === lvl ? 'active' : ''}`}
                onClick={() => setLeadLevel(lvl)}
                style={{ fontSize: '14px' }}
              >
                {t(`dashboard.leaderboardLevel.${lvl}`)}
              </div>
            ))}
          </div>
        </div>

        {/* Fallback Notification */}
        {leaderboard.note && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF5F0', border: '1.5px dashed var(--earth-brown)', borderRadius: '12px', padding: '10px 14px', margin: '15px 0', fontSize: '13px', fontWeight: '700', color: 'var(--earth-brown)' }}>
            <AlertCircle size={16} />
            <span>{leaderboard.note}</span>
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 120px', padding: '10px', borderBottom: '1px solid rgba(0,0,0,0.1)', fontWeight: 'bold', fontSize: '14px', color: '#666' }}>
            <span>{t('dashboard.leaderboardHeaders.rank')}</span>
            <span>{t('dashboard.leaderboardHeaders.user')}</span>
            <span style={{ textAlign: 'right' }}>{t('dashboard.leaderboardHeaders.average')}</span>
          </div>
          {leaderboard.list.map((item, idx) => (
            <div 
              key={idx} 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '50px 1fr 120px', 
                padding: '12px 10px', 
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                alignItems: 'center',
                background: idx === 0 ? 'rgba(74, 124, 89, 0.03)' : 'transparent',
                fontWeight: idx === 0 ? '800' : 'normal'
              }}
            >
              <span style={{ color: idx < 3 ? 'var(--primary-green)' : '#999', fontWeight: 'bold' }}>#{idx + 1}</span>
              <span>{item.name}</span>
              <span style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-green)' }}>{item.avg_footprint} kg</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
