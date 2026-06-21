import React, { useState, useEffect } from 'react';
import PipMascot from './PipMascot';
import { HelpCircle, RefreshCw, Check, X, ShieldAlert, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function Feed({ token }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState({});

  const fetchFeed = () => {
    setLoading(true);
    fetch('/api/feed', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setCards(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFeed();
  }, [token]);

  const handleFeedback = async (cardId, actionId, accepted) => {
    try {
      const res = await fetch('/api/agent/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action_id: actionId, accepted })
      });
      if (res.ok) {
        // Remove or update the card state locally
        setCards(cards.map(c => {
          if (c.id === cardId) {
            return {
              ...c,
              suggested_action: { ...c.suggested_action, status: accepted ? 'accepted' : 'dismissed' }
            };
          }
          return c;
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerAgentRun = async () => {
    setRunningAgent(true);
    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchFeed(); // reload feed
      }
    } catch (e) {
      console.error(e);
    }
    setRunningAgent(false);
  };

  const toggleTrace = (id) => {
    setExpandedTrace(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Feed Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Imprint Feed</h3>
          <p style={{ margin: 0 }}>Active reasoning logs and suggestions curated by Pip.</p>
        </div>
        <button 
          className="btn" 
          onClick={triggerAgentRun}
          disabled={runningAgent}
          style={{ padding: '10px 18px', fontSize: '14px' }}
        >
          <RefreshCw size={16} className={runningAgent ? 'spin' : ''} />
          {runningAgent ? 'Pip is thinking...' : 'Ask Pip to Reason'}
        </button>
      </div>

      {loading && cards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Gathering Pip's thoughts...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="leaf-card" style={{ textAlign: 'center', padding: '45px' }}>
          <PipMascot mood="neutral" size={100} />
          <h4>No Feed insights yet</h4>
          <p>Log your daily activities or trigger an agent cycle using the button above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {cards.map(card => (
            <div key={card.id} className="leaf-card feed-item" style={{ background: '#FFFFFF' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <PipMascot mood={card.mood} size={85} />
                
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#888', fontWeight: 'bold' }}>
                      {new Date(card.timestamp).toLocaleString()}
                    </span>
                    <span style={{ 
                      fontSize: '12px', 
                      fontWeight: '800', 
                      padding: '4px 8px', 
                      borderRadius: '8px', 
                      textTransform: 'uppercase',
                      color: card.mood === 'happy' ? 'var(--primary-green)' : card.mood === 'concerned' ? '#E85D04' : '#666',
                      background: card.mood === 'happy' ? '#F0F7F2' : card.mood === 'concerned' ? '#FFF5F0' : '#ECECEC'
                    }}>
                      {card.mood}
                    </span>
                  </div>

                  <p style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 16px 0', color: 'var(--text-dark)' }}>
                    "{card.message}"
                  </p>

                  {/* Suggestion panel */}
                  {card.suggested_action && (
                    <div style={{ 
                      background: 'rgba(74, 124, 89, 0.03)', 
                      border: '1px solid var(--border-leaf)', 
                      borderRadius: '16px', 
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      marginBottom: '15px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '14px', display: 'block', color: 'var(--primary-green)' }}>Pip's Recommendation:</strong>
                          <span style={{ fontSize: '14px' }}>{card.suggested_action.action_desc}</span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary-green)', whiteSpace: 'nowrap' }}>
                          -{card.suggested_action.savings_kg} kg CO₂/day
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        {card.suggested_action.status === 'accepted' ? (
                          <div style={{ color: 'var(--primary-green)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                            <Check size={16} /> Accepted and logged to memory
                          </div>
                        ) : card.suggested_action.status === 'dismissed' ? (
                          <div style={{ color: '#D32F2F', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                            <X size={16} /> Dismissed
                          </div>
                        ) : (
                          <>
                            <button 
                              className="btn" 
                              onClick={() => handleFeedback(card.id, card.suggested_action.action_id, true)}
                              style={{ padding: '6px 14px', borderRadius: '10px', fontSize: '13px' }}
                            >
                              Accept
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => handleFeedback(card.id, card.suggested_action.action_id, false)}
                              style={{ padding: '6px 14px', borderRadius: '10px', fontSize: '13px' }}
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reasoning Trace Collapse */}
                  <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '10px' }}>
                    <button 
                      onClick={() => toggleTrace(card.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', color: 'var(--earth-brown)' }}
                    >
                      {expandedTrace[card.id] ? (
                        <>
                          <ChevronUp size={14} /> Hide Reasoning Trace
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> View Reasoning Trace
                        </>
                      )}
                    </button>
                    {expandedTrace[card.id] && (
                      <pre style={{ 
                        marginTop: '10px', 
                        padding: '12px', 
                        background: '#FAF8F5', 
                        border: '1px solid var(--border-leaf)', 
                        borderRadius: '8px', 
                        fontSize: '12px', 
                        fontFamily: 'monospace',
                        color: '#666',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {card.trace || 'No trace recorded.'}
                      </pre>
                    )}
                  </div>

                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
