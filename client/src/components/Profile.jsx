import React, { useState, useEffect } from 'react';
import { Award, Flame, Calendar, MapPin, Smile, Edit3, X, Save } from 'lucide-react';
import PipMascot from './PipMascot';
import { useTranslation } from 'react-i18next';

export default function Profile({ token, onUserUpdate, initialEdit = false, onEditEnd }) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(initialEdit);

  useEffect(() => {
    if (initialEdit) {
      setIsEditing(true);
    }
  }, [initialEdit]);

  // Form State
  const [name, setName] = useState('');
  const [diet, setDiet] = useState('vegetarian');
  const [commute, setCommute] = useState('public_transport');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [ward, setWard] = useState('');
  const [language, setLanguage] = useState('en');

  // Dropdown lists
  const [statesList, setStatesList] = useState([]);
  const [citiesList, setCitiesList] = useState([]);
  const [wardsList, setWardsList] = useState([]);

  // Notifications / feedback
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');

  const fetchProfile = () => {
    setLoading(true);
    fetch('/api/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        setName(data.user.name);
        setDiet(data.user.diet);
        setCommute(data.user.commute);
        setLanguage(data.user.language || 'en');
        
        // Parsed location representation helper
        const locParts = data.user.location.split(', ');
        if (locParts.length === 3) {
          setWard(locParts[0]);
          setCity(locParts[1]);
          setState(locParts[2]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProfile();
  }, [token]);

  // Load States list once
  useEffect(() => {
    fetch('/api/locations/states')
      .then(res => res.json())
      .then(data => setStatesList(data))
      .catch(err => console.error("Error loading states:", err));
  }, []);

  // Cascading City list
  useEffect(() => {
    if (!state) return;
    fetch(`/api/locations/cities?state=${encodeURIComponent(state)}`)
      .then(res => res.json())
      .then(data => {
        setCitiesList(data);
      })
      .catch(err => console.error("Error loading cities:", err));
  }, [state]);

  // Cascading Ward list
  useEffect(() => {
    if (!state || !city) return;
    fetch(`/api/locations/wards?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}`)
      .then(res => res.json())
      .then(data => {
        setWardsList(data);
      })
      .catch(err => console.error("Error loading wards:", err));
  }, [state, city]);

  const handleStateChange = (val) => {
    setState(val);
    setCity('');
    setWard('');
    setCitiesList([]);
    setWardsList([]);
  };

  const handleCityChange = (val) => {
    setCity(val);
    setWard('');
    setWardsList([]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaveMessage('');

    if (!name || !state || !city || !ward) {
      setError('Please fill in all profile details.');
      return;
    }

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, diet, commute, state, city, ward, language })
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Failed to update profile.');
        return;
      }

      setSaveMessage(result.message);
      setIsEditing(false);
      if (onEditEnd) {
        onEditEnd();
      }
      
      // Update global context/state
      if (onUserUpdate) {
        onUserUpdate(result.user);
      }

      // Re-fetch profile to show updated info
      fetchProfile();
      
      setTimeout(() => {
        setSaveMessage('');
      }, 5000);
    } catch (err) {
      setError('Connection error. Please try again.');
    }
  };

  if (loading || !profile) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <h3>Loading your ecological profile...</h3>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Save Status Announcement bubble */}
      {saveMessage && (
        <div className="leaf-card" style={{ background: '#E8F5E9', border: '1.5px solid var(--primary-green)', padding: '16px', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <PipMascot mood="happy" size={60} />
          <div>
            <strong style={{ display: 'block', color: 'var(--primary-green)', marginBottom: '3px' }}>Pip says:</strong>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '15px' }}>"{saveMessage}"</p>
          </div>
        </div>
      )}

      {/* Profile details header or editor view */}
      <div className="leaf-card">
        {!isEditing ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '32px', fontWeight: '900' }}>
                {profile.user.name[0]}
              </div>

              <div>
                <h2>{profile.user.name}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', fontSize: '14px', color: '#666', marginTop: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={16} /> {profile.user.location}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize' }}>
                    <Smile size={16} /> {profile.user.diet} diet
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize' }}>
                    <Calendar size={16} /> Commute: {profile.user.commute.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setError('');
                setIsEditing(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', padding: '8px 14px' }}
            >
              <Edit3 size={16} /> {t('profile.editBtn')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
              <PipMascot mood="neutral" size={70} />
              <div>
                <h3>{t('profile.editTitle')}</h3>
                <p style={{ margin: 0 }}>{t('profile.editSub')}</p>
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px', background: '#FFD2D2', border: '1px solid #D32F2F', borderRadius: '8px', color: '#B71C1C', marginBottom: '20px', fontWeight: 'bold' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">{t('profile.nameLabel')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('onboarding.dietLabel')}</label>
                <select className="form-select" value={diet} onChange={e => setDiet(e.target.value)}>
                  <option value="vegan">Vegan</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="omnivore">Balanced / Omnivore</option>
                  <option value="carnivore">Meat-heavy</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('onboarding.commuteLabel')}</label>
                <select className="form-select" value={commute} onChange={e => setCommute(e.target.value)}>
                  <option value="walk_bicycle">Bicycle / Walking</option>
                  <option value="ev">Electric Vehicle (EV)</option>
                  <option value="public_transport">Metro / Public Bus</option>
                  <option value="two_wheeler">Petrol Two-Wheeler</option>
                  <option value="car">Petrol/Diesel Car</option>
                </select>
              </div>
            </div>

            <h4 style={{ margin: '20px 0 10px 0', borderBottom: '1px solid var(--border-leaf)', paddingBottom: '8px' }}>{t('onboarding.locationLabel')}</h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">{t('onboarding.state')}</label>
                <select className="form-select" value={state} onChange={e => handleStateChange(e.target.value)}>
                  <option value="">Select State</option>
                  {statesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('onboarding.city')}</label>
                <select className="form-select" value={city} onChange={e => handleCityChange(e.target.value)} disabled={!state}>
                  <option value="">Select City</option>
                  {citiesList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('onboarding.ward')}</label>
                <select className="form-select" value={ward} onChange={e => setWard(e.target.value)} disabled={!city}>
                  <option value="">Select Locality</option>
                  {wardsList.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('profile.langLabel')}</label>
                <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="bn">Bengali</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setIsEditing(false);
                  if (onEditEnd) onEditEnd();
                  fetchProfile();
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <X size={16} /> {t('profile.btnCancel')}
              </button>
              <button 
                type="submit" 
                className="btn"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={16} /> {t('profile.btnSave')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Gamification Stats */}
      {!isEditing && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
          <h3 style={{ margin: 0 }}>My Progress</h3>
          <button 
            className="btn" 
            onClick={() => {
              setError('');
              setIsEditing(true);
            }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontSize: '14px', 
              padding: '10px 18px',
              background: 'var(--primary-green)',
              color: '#FFF',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(74, 124, 89, 0.15)'
            }}
          >
            <Edit3 size={16} /> Edit Profile Details
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        
        {/* Streak card */}
        <div className="leaf-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', borderRight: '8px solid var(--earth-brown)' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(139, 105, 20, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flame size={28} style={{ color: 'var(--earth-brown)' }} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#666' }}>Active Streak</span>
            <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-dark)' }}>{profile.streak} days</span>
          </div>
        </div>

        {/* CO2 Saved card */}
        <div className="leaf-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', borderRight: '8px solid var(--primary-green)' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(74, 124, 89, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={28} style={{ color: 'var(--primary-green)' }} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#666' }}>Total CO₂ Mitigation</span>
            <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-dark)' }}>{profile.totalSaved_kg} kg</span>
          </div>
        </div>

      </div>

      {/* Badges / Milestones */}
      <div className="leaf-card">
        <h3>Unlocked Badges</h3>
        <p>Your ecological achievements and milestones verified by Pip.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginTop: '20px' }}>
          {profile.badges.map(badge => (
            <div 
              key={badge.id} 
              style={{ 
                background: '#FAF8F5', 
                border: '1.5px solid var(--border-leaf)', 
                borderRadius: '16px', 
                padding: '20px', 
                textAlign: 'center',
                boxShadow: 'inset 0 0 10px rgba(74, 124, 89, 0.03)'
              }}
            >
              <div style={{ width: '48px', height: '48px', background: 'var(--primary-green)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#FFF' }}>
                <Award size={24} />
              </div>
              <strong style={{ display: 'block', fontSize: '15px', color: 'var(--primary-green)', marginBottom: '4px' }}>
                {badge.title}
              </strong>
              <span style={{ fontSize: '12px', color: '#666', lineHeight: 1.3, display: 'block' }}>
                {badge.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

