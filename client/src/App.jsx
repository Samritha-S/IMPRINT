import React, { useState, useEffect, Suspense, lazy } from 'react';
import Onboarding from './components/Onboarding';
import Feed from './components/Feed';
import Profile from './components/Profile';
import PipMascot from './components/PipMascot';
import { LayoutDashboard, Camera, LineChart, FileText, User as UserIcon, LogOut, Leaf, Edit3 } from 'lucide-react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const ScannerHub = lazy(() => import('./components/ScannerHub'));
const ProjectionEngine = lazy(() => import('./components/ProjectionEngine'));

const DEFAULT_A11Y = { fontSize: 'default', highContrast: false, reduceMotion: false, dyslexiaFont: false };
const FONT_SCALE_MAP = { small: 0.875, default: 1, large: 1.125, 'extra-large': 1.25 };

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('imprint_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('imprint_user') || 'null'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editProfileMode, setEditProfileMode] = useState(false);

  // Accessibility settings — persisted to localStorage, applied to <html>
  const [a11ySettings, setA11ySettings] = useState(() => {
    try { return { ...DEFAULT_A11Y, ...JSON.parse(localStorage.getItem('imprint_a11y') || '{}') }; }
    catch { return DEFAULT_A11Y; }
  });

  useEffect(() => {
    const html = document.documentElement;
    // Font scale
    html.style.setProperty('--font-scale', FONT_SCALE_MAP[a11ySettings.fontSize] ?? 1);
    // Theme classes
    html.classList.toggle('hc-mode', !!a11ySettings.highContrast);
    html.classList.toggle('reduce-motion', !!a11ySettings.reduceMotion);
    html.classList.toggle('dyslexia-mode', !!a11ySettings.dyslexiaFont);
    // Persist
    localStorage.setItem('imprint_a11y', JSON.stringify(a11ySettings));
  }, [a11ySettings]);

  const updateA11y = (key, value) => setA11ySettings(prev => ({ ...prev, [key]: value }));
  
  // Login / Register state for auth screen
  const [isLogin, setIsLogin] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const handleAuthComplete = (authToken, authUser) => {
    setToken(authToken);
    setUser(authUser);
    localStorage.setItem('imprint_token', authToken);
    localStorage.setItem('imprint_user', JSON.stringify(authUser));
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('imprint_token');
    localStorage.removeItem('imprint_user');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Login failed');
        return;
      }
      handleAuthComplete(data.token, data.user);
    } catch (err) {
      console.error('Login submit error:', err);
      setAuthError('Connection failed.');
    }
  };

  // If not authenticated
  if (!token || !user) {
    if (!isLogin) {
      // Show Onboarding register flow
      return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-cream)', padding: '20px' }}>
          <div style={{ textAlign: 'center', margin: '40px 0 20px 0' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '32px' }}>
              <Leaf size={32} /> Imprint
            </h1>
            <p>Welcome to carbon footprint awareness powered by Pip.</p>
          </div>
          <Onboarding onComplete={handleAuthComplete} />
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Already have an account? </span>
            <button 
              className="btn btn-secondary" 
              onClick={() => setIsLogin(true)} 
              style={{ padding: '4px 12px', fontSize: '13px' }}
            >
              Sign In
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg-cream)' }}>
        <div className="leaf-card" style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <PipMascot mood="happy" size={90} />
            <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
              <Leaf size={24} /> Imprint
            </h2>
            <p style={{ margin: 0 }}>Sign in to start tracking with Pip</p>
          </div>

          {authError && (
            <div style={{ padding: '10px', background: '#FFD2D2', border: '1px solid #D32F2F', borderRadius: '8px', color: '#B71C1C', fontSize: '14px', marginBottom: '16px', fontWeight: 'bold' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-input" 
                value={usernameInput} 
                onChange={e => setUsernameInput(e.target.value)} 
                placeholder="e.g. pip" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={passwordInput} 
                onChange={e => setPasswordInput(e.target.value)} 
                placeholder="e.g. password123" 
                required 
              />
            </div>

            <button type="submit" className="btn" style={{ width: '100%', marginTop: '10px' }}>
              Sign In
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '20px' }}>
            <span style={{ fontSize: '13px' }}>Tip: Log in with username <strong>pip</strong> and password <strong>password123</strong> to view seeded mock records instantly!</span>
            <div style={{ marginTop: '15px' }}>
              <button className="btn btn-secondary" onClick={() => setIsLogin(false)} style={{ width: '100%' }}>
                Create New Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const changeTab = (tab) => {
    setActiveTab(tab);
    setEditProfileMode(false);
  };

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <Leaf size={28} />
          <span>Imprint</span>
        </div>

        <nav>
          <ul className="nav-links">
            <li 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => changeTab('dashboard')}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </li>
            <li 
              className={`nav-item ${activeTab === 'scanner' ? 'active' : ''}`}
              onClick={() => changeTab('scanner')}
            >
              <Camera size={20} />
              <span>Scanner Hub</span>
            </li>
            <li 
              className={`nav-item ${activeTab === 'projection' ? 'active' : ''}`}
              onClick={() => changeTab('projection')}
            >
              <LineChart size={20} />
              <span>10-Yr Curve</span>
            </li>
            <li 
              className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => changeTab('feed')}
            >
              <FileText size={20} />
              <span>Imprint Feed</span>
            </li>
            <li 
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => changeTab('profile')}
            >
              <UserIcon size={20} />
              <span>Profile & Badges</span>
            </li>
          </ul>
        </nav>

        <div style={{ marginTop: '40px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div 
              style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => {
                setActiveTab('profile');
                setEditProfileMode(true);
              }}
              title="View Profile Details"
            >
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{user?.name}</span>
              <span style={{ fontSize: '11px', color: '#888' }}>{user?.username}</span>
            </div>
            <button
              onClick={() => {
                setActiveTab('profile');
                setEditProfileMode(true);
              }}
              style={{
                background: 'rgba(74, 124, 89, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--primary-green)'
              }}
              title="Edit Profile"
            >
              <Edit3 size={14} />
            </button>
          </div>
          <button 
            className="btn btn-secondary btn-danger" 
            onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#FFF', padding: '8px 12px', borderRadius: '10px', fontSize: '13px', marginBottom: '15px' }}
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </aside>


      {/* Main Content Area */}
      <main style={{ paddingBottom: '40px' }}>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--primary-green)', fontWeight: 'bold' }}>
            Loading Pip's tools...
          </div>
        }>
          {activeTab === 'dashboard' && <Dashboard token={token} />}
          {activeTab === 'scanner' && <ScannerHub token={token} />}
          {activeTab === 'projection' && <ProjectionEngine token={token} />}
          {activeTab === 'feed' && <Feed token={token} />}
          {activeTab === 'profile' && (
            <Profile 
              token={token} 
              initialEdit={editProfileMode}
              onEditEnd={() => setEditProfileMode(false)}
              onUserUpdate={(updatedUser) => {
                setUser(updatedUser);
                localStorage.setItem('imprint_user', JSON.stringify(updatedUser));
              }}
              a11ySettings={a11ySettings}
              updateA11y={updateA11y}
            />
          )}
        </Suspense>
      </main>

    </div>
  );
}
