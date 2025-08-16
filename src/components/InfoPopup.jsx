import React from 'react';
import { useHighlight } from '../context/HighlightContext';

const InfoPopup = () => {
  const {
    isPopupVisible,
    popupPosition,
    aiResponse,
    isLoading,
    color,
    setColor,
    clearAreas,
    hidePopup
  } = useHighlight();

  if (!isPopupVisible) return null;

  const colors = [
    '#ff0000', '#00ff00', '#0000ff', '#ffff00', 
    '#ff00ff', '#00ffff', '#ff8800', '#8800ff'
  ];

  const popupStyle = {
    position: 'fixed',
    left: `${popupPosition.x}px`,
    top: `${popupPosition.y}px`,
    width: '320px',
    maxHeight: '400px',
    background: 'white',
    border: '2px solid #ddd',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 2147483649,
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    overflow: 'hidden'
  };

  const headerStyle = {
    background: '#f5f5f5',
    padding: '12px 16px',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const contentStyle = {
    padding: '16px',
    maxHeight: '300px',
    overflowY: 'auto'
  };

  const colorPickerStyle = {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap'
  };

  const colorButtonStyle = (selectedColor) => ({
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: selectedColor === color ? '3px solid #333' : '2px solid #ddd',
    cursor: 'pointer',
    transition: 'all 0.2s'
  });

  const buttonStyle = {
    padding: '6px 12px',
    margin: '4px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const loadingStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    color: '#666'
  };

  const renderAIResponse = () => {
    if (isLoading) {
      return (
        <div style={loadingStyle}>
          <div>Analyzing selected area...</div>
        </div>
      );
    }

    if (!aiResponse) {
      return (
        <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
          No analysis available
        </div>
      );
    }

    return (
      <div>
        <div style={{ marginBottom: '12px' }}>
          <strong>Summary:</strong>
          <div style={{ marginTop: '4px', color: '#333' }}>
            {aiResponse.summary}
          </div>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong>Analysis:</strong>
          <div style={{ marginTop: '4px', color: '#333' }}>
            {aiResponse.analysis}
          </div>
        </div>
        
        {aiResponse.suggestions && aiResponse.suggestions.length > 0 && (
          <div>
            <strong>Suggestions:</strong>
            <ul style={{ marginTop: '4px', marginBottom: '0', paddingLeft: '20px' }}>
              {aiResponse.suggestions.map((suggestion, index) => (
                <li key={index} style={{ color: '#333', marginBottom: '2px' }}>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={popupStyle}>
      <div style={headerStyle}>
        <div style={{ fontWeight: 'bold', color: '#333' }}>
          AI Analysis
        </div>
        <button
          onClick={hidePopup}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#666',
            padding: '0',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>
      </div>
      
      <div style={contentStyle}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            Drawing Color:
          </div>
          <div style={colorPickerStyle}>
            {colors.map((colorOption) => (
              <div
                key={colorOption}
                style={{
                  ...colorButtonStyle(colorOption),
                  backgroundColor: colorOption
                }}
                onClick={() => setColor(colorOption)}
                title={`Select ${colorOption} color`}
              />
            ))}
          </div>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
            Actions:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={clearAreas}
              style={{
                ...buttonStyle,
                background: '#ff4444',
                color: 'white',
                border: '1px solid #cc0000'
              }}
            >
              Clear All
            </button>
            <button
              onClick={hidePopup}
              style={buttonStyle}
            >
              Close
            </button>
          </div>
        </div>
        
        <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
          {renderAIResponse()}
        </div>
      </div>
    </div>
  );
};

export default InfoPopup;
