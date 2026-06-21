import React, { useState, useEffect } from 'react';
import PipMascot from './PipMascot';
import { ChevronRight, ChevronLeft, MapPin, Bell, User } from 'lucide-react';

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [ward, setWard] = useState('');
  
  const [statesList, setStatesList] = useState([]);
  const [citiesList, setCitiesList] = useState([]);
  const [wardsList, setWardsList] = useState([]);

  const [diet, setDiet] = useState('vegetarian');
  const [commute, setCommute] = useState('public_transport');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('password123'); // simple default
  const [error, setError] = useState('');

  // Fetch states on mount
  useEffect(() => {
    fetch('/api/locations/states')
      .then(res => res.json())
      .then(data => setStatesList(data))
      .catch(err => console.error("Error loading states:", err));
  }, []);

  // Fetch cities when state changes
  useEffect(() => {
    if (!state) return;
    setCity('');
    setWard('');
    fetch(`/api/locations/cities?state=${encodeURIComponent(state)}`)
      .then(res => res.json())
      .then(data => setCitiesList(data))
      .catch(err => console.error("Error loading cities:", err));
  }, [state]);

  // Fetch wards when city changes
  useEffect(() => {
    if (!city) return;
    setWard('');
    fetch(`/api/locations/wards?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}`)
      .then(res => res.json())
      .then(data => setWardsList(data))
      .catch(err => console.error("Error loading wards:", err));
  }, [city]);

  const handleNext = () => {
    if (step === 2 && (!state || !city || !ward)) {
      setError('Please select a valid location');
      return;
    }
    setError('');
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(s => s - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !username) {
      setError('Please enter your name and a unique username');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          name,
          state,
          city,
          ward,
          diet,
          commute
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      onComplete(data.token, data.user);
    } catch (err) {
      setError('Server connection error. Please try again.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px' }}>
      <div className="leaf-card">
        
        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '14px', fontWeight: 'bold', color: 'var(--primary-green)' }}>
          <span>Step {step} of 4</span>
          <span>{Math.round((step / 4) * 100)}% Complete</span>
        </div>
        <div className="progress-container" style={{ height: '6px', marginBottom: '30px' }}>
          <div className="progress-bar" style={{ width: `${(step / 4) * 100}%` }}></div>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#FFD2D2', border: '1px solid #D32F2F', borderRadius: '8px', color: '#B71C1C', marginBottom: '20px', fontWeight: 'bold' }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <PipMascot mood="happy" size={140} />
            </div>
            <h2>Welcome to Imprint</h2>
            <p style={{ marginBottom: '24px' }}>
              Configure your footprint settings early to start tracking with Pip.
            </p>

            <button className="btn" onClick={handleNext} style={{ marginTop: '20px' }}>
              Next <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
              <PipMascot mood="neutral" size={80} />
              <div>
                <h3>Your Location</h3>
                <p style={{ margin: 0 }}>"I need this to compare your footprint to others in your locality!"</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">State / UT</label>
              <select className="form-select" value={state} onChange={e => setState(e.target.value)}>
                <option value="">Select State</option>
                {statesList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">City</label>
              <select className="form-select" value={city} onChange={e => setCity(e.target.value)} disabled={!state}>
                <option value="">Select City</option>
                {citiesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ward / Locality</label>
              <select className="form-select" value={ward} onChange={e => setWard(e.target.value)} disabled={!city}>
                <option value="">Select Locality</option>
                {wardsList.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
              <button className="btn btn-secondary" onClick={handleBack}>
                <ChevronLeft size={18} /> Back
              </button>
              <button className="btn" onClick={handleNext}>
                Next <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <PipMascot mood="neutral" size={100} />
            </div>
            <h3>Smart Integrations</h3>
            <p>
              Would you like to enable SMS or notification permissions?
            </p>
            <div style={{ background: 'rgba(74, 124, 89, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-leaf)', margin: '20px 0', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <Bell style={{ color: 'var(--primary-green)', flexShrink: 0 }} />
                <span><strong>Smart Commute Detection</strong>: Let us remind you to log your daily travel habits if we notice a different patterns.</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <MapPin style={{ color: 'var(--primary-green)', flexShrink: 0 }} />
                <span><strong>Utility Bill Autodetect</strong>: Read billing SMS automatically to calculate electricity and fuel emissions.</span>
              </div>
            </div>
            <p style={{ fontSize: '13px', fontStyle: 'italic' }}>* Both settings are skippable and do not store real personal credentials.</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
              <button className="btn btn-secondary" onClick={handleBack}>
                <ChevronLeft size={18} /> Back
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={handleNext}>
                  Skip
                </button>
                <button className="btn" onClick={handleNext}>
                  Allow & Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
              <PipMascot mood="happy" size={80} />
              <div>
                <h3>Personal Details</h3>
                <p style={{ margin: 0 }}>"Almost there! Tell me a bit about your lifestyle choices."</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Your Name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Choose a username" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Diet Preference</label>
              <select className="form-select" value={diet} onChange={e => setDiet(e.target.value)}>
                <option value="vegan">Vegan</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="omnivore">Balanced / Omnivore</option>
                <option value="carnivore">Meat-heavy</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Primary Commute Mode</label>
              <select className="form-select" value={commute} onChange={e => setCommute(e.target.value)}>
                <option value="walk_bicycle">Bicycle / Walking</option>
                <option value="ev">Electric Vehicle (EV)</option>
                <option value="public_transport">Metro / Public Bus</option>
                <option value="two_wheeler">Petrol Two-Wheeler</option>
                <option value="car">Petrol/Diesel Car</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleBack}>
                <ChevronLeft size={18} /> Back
              </button>
              <button type="submit" className="btn">
                Complete Setup <User size={18} />
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
