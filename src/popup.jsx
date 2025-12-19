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
      <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'center' }}>
        <img
          src="full.png"
          alt="FullGrab"
          style={{ width: '160px', height: 'auto', marginBottom: '5px', marginLeft: '0px' }}
        />
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