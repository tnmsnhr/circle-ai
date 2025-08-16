import React from 'react';
import ReactDOM from 'react-dom/client';
import CircleOverlay from './components/CircleOverlay';
import InfoPopup from './components/InfoPopup';
import { HighlightProvider } from './context/HighlightContext';

// Create overlay container
const createOverlayContainer = () => {
  const container = document.createElement('div');
  container.id = 'circle-ai-overlay';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483647;
  `;
  document.body.appendChild(container);
  return container;
};

// Create popup container
const createPopupContainer = () => {
  const container = document.createElement('div');
  container.id = 'circle-ai-popup';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483646;
  `;
  document.body.appendChild(container);
  return container;
};

// Initialize the extension
const initExtension = () => {
  // Create containers
  const overlayContainer = createOverlayContainer();
  const popupContainer = createPopupContainer();

  // Render React components
  const root = ReactDOM.createRoot(overlayContainer);
  root.render(
    <HighlightProvider>
      <CircleOverlay />
      <InfoPopup />
    </HighlightProvider>
  );
};

// Start the extension when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExtension);
} else {
  initExtension();
}
