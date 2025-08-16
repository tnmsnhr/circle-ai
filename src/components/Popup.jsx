import React, { useState } from 'react';

const Popup = () => {
  const [isEnabled, setIsEnabled] = useState(true);

  const toggleExtension = () => {
    setIsEnabled(!isEnabled);
    // Send message to content script to enable/disable
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'TOGGLE_EXTENSION',
        enabled: !isEnabled
      });
    });
  };

  const clearAllAreas = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'CLEAR_AREAS'
      });
    });
  };

  const containerStyle = {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    color: '#333'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #eee'
  };

  const titleStyle = {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#2c3e50',
    margin: '0 0 8px 0'
  };

  const subtitleStyle = {
    fontSize: '12px',
    color: '#7f8c8d',
    margin: '0'
  };

  const sectionStyle = {
    marginBottom: '20px'
  };

  const sectionTitleStyle = {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#34495e'
  };

  const instructionStyle = {
    background: '#f8f9fa',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '12px',
    borderLeft: '4px solid #3498db'
  };

  const buttonStyle = {
    width: '100%',
    padding: '10px',
    marginBottom: '8px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  };

  const toggleButtonStyle = {
    ...buttonStyle,
    background: isEnabled ? '#e74c3c' : '#27ae60',
    color: 'white'
  };

  const clearButtonStyle = {
    ...buttonStyle,
    background: '#95a5a6',
    color: 'white'
  };

  const featureListStyle = {
    listStyle: 'none',
    padding: '0',
    margin: '0'
  };

  const featureItemStyle = {
    padding: '6px 0',
    borderBottom: '1px solid #eee',
    fontSize: '13px'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Circle AI Assistant</h1>
        <p style={subtitleStyle}>AI-powered content analysis tool</p>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>How to Use:</div>
        <div style={instructionStyle}>
          <strong>1.</strong> Hold <kbd>⌘</kbd> key<br/>
          <strong>2.</strong> Click and drag to draw a circle/area<br/>
          <strong>3.</strong> Release to analyze the selected content<br/>
          <strong>4.</strong> View AI analysis in the popup
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Controls:</div>
        <button
          style={toggleButtonStyle}
          onClick={toggleExtension}
        >
          {isEnabled ? 'Disable Extension' : 'Enable Extension'}
        </button>
        
        <button
          style={clearButtonStyle}
          onClick={clearAllAreas}
        >
          Clear All Areas
        </button>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Features:</div>
        <ul style={featureListStyle}>
          <li style={featureItemStyle}>✓ Free-hand drawing with ⌘ key</li>
          <li style={featureItemStyle}>✓ Multiple color options</li>
          <li style={featureItemStyle}>✓ AI-powered content analysis</li>
          <li style={featureItemStyle}>✓ Works with text, images, and code</li>
          <li style={featureItemStyle}>✓ Real-time analysis popup</li>
        </ul>
      </div>

      <div style={{ 
        textAlign: 'center', 
        fontSize: '11px', 
        color: '#95a5a6',
        marginTop: '20px',
        paddingTop: '15px',
        borderTop: '1px solid #eee'
      }}>
        Version 1.0.0
      </div>
    </div>
  );
};

export default Popup;