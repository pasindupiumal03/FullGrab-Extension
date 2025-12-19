import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const Popup = () => {
  const handleVisibleClick = () => {
    chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE' });
    window.close();
  };

  const handleFullPageClick = () => {
    chrome.runtime.sendMessage({ type: 'CAPTURE_FULL_PAGE' });
    window.close();
  };

  return (
    <div style={{
      width: '380px',
      height: 'auto',
      minHeight: '400px',
      backgroundColor: '#F8F9FB',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '30px 20px 35px 20px',
      fontFamily: "'Inter', sans-serif",
      overflow: 'visible',
      boxSizing: 'border-box'
    }}>
      <style>{`
        ::-webkit-scrollbar { display: none; }
        body { margin: 0; overflow: hidden; }
        .card-btn { 
          transition: all 0.2s ease; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .card-btn:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 4px 12px rgba(93, 37, 222, 0.15);
          border-color: #5D25DE !important;
        }
        .card-btn:active { transform: translateY(0); }
      `}</style>

      {/* Logo Section */}
      <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          {/* Camera Lens Icon */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ea580c 0%, #7e22ce 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(126, 34, 206, 0.4)'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="6"></circle>
              <circle cx="12" cy="12" r="2"></circle>
              <path d="M12 2v2"></path>
              <path d="M12 20v2"></path>
              <path d="M2 12h2"></path>
              <path d="M20 12h2"></path>
              <path d="M6.34 6.34l1.42 1.42"></path>
              <path d="M16.24 16.24l1.42 1.42"></path>
              <path d="M6.34 17.66l1.42-1.42"></path>
              <path d="M16.24 7.76l1.42-1.42"></path>
            </svg>
          </div>

          {/* Brand Text */}
          <div style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1 }}>
            <span style={{
              fontSize: '32px',
              fontWeight: 900,
              letterSpacing: '-0.5px',
              color: '#ea580c',
              WebkitTextStroke: '0.5px #ea580c',
              textShadow: '0 0 1px rgba(234, 88, 12, 0.5)'
            }}>Full</span>
            <span style={{
              fontSize: '32px',
              fontWeight: 900,
              letterSpacing: '-0.5px',
              color: '#7e22ce',
              WebkitTextStroke: '0.5px #7e22ce',
              textShadow: '0 0 1px rgba(126, 34, 206, 0.5)'
            }}>Grab</span>
          </div>
        </div>

        {/* Tagline */}
        <p style={{
          fontSize: '12px',
          color: '#9CA3AF',
          margin: 0,
          fontWeight: 500,
          letterSpacing: '0.3px'
        }}>
          Full Page Capture. Smart Privacy. Instant Sharing.
        </p>
      </div>

      {/* Actions */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', padding: '2px' }}>

        {/* Visible Area Button */}
        <button
          onClick={handleVisibleClick}
          className="card-btn"
          style={{
            width: '100%',
            padding: '18px 20px',
            backgroundColor: '#FFFFFF',
            color: '#1F2937',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            textAlign: 'left'
          }}
        >
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#F3F0FF',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            flexShrink: 0
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5D25DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '3px' }}>
              Visible Area
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: '400' }}>
              Capture what you see
            </div>
          </div>
        </button>

        {/* Full Page Button */}
        <button
          onClick={handleFullPageClick}
          className="card-btn"
          style={{
            width: '100%',
            padding: '18px 20px',
            backgroundColor: '#FFFFFF',
            color: '#1F2937',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            textAlign: 'left'
          }}
        >
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#F3F0FF',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            flexShrink: 0
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5D25DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '3px' }}>
              Full Page
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: '400' }}>
              Capture entire page
            </div>
          </div>
        </button>

      </div>

    </div>
  );
};

const root = createRoot(document.getElementById("react-target"));
root.render(<Popup />);