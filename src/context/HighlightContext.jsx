import React, { createContext, useContext, useReducer, useEffect } from 'react';

const HighlightContext = createContext();

const initialState = {
  isDrawing: false,
  isCtrlPressed: false,
  currentPath: [],
  selectedAreas: [],
  currentPopup: null,
  color: '#ff0000',
  isPopupVisible: false,
  popupPosition: { x: 0, y: 0 },
  aiResponse: null,
  isLoading: false
};

const highlightReducer = (state, action) => {
  switch (action.type) {
    case 'SET_CTRL_PRESSED':
      return { ...state, isCtrlPressed: action.payload };
    
    case 'START_DRAWING':
      return { 
        ...state, 
        isDrawing: true, 
        currentPath: [],
        isPopupVisible: false 
      };
    
    case 'ADD_POINT':
      return {
        ...state,
        currentPath: [...state.currentPath, action.payload]
      };
    
    case 'STOP_DRAWING':
      return {
        ...state,
        isDrawing: false,
        currentPath: []
      };
    
    case 'SAVE_AREA':
      return {
        ...state,
        selectedAreas: [...state.selectedAreas, action.payload],
        currentPath: []
      };
    
    case 'SET_COLOR':
      return { ...state, color: action.payload };
    
    case 'SHOW_POPUP':
      return {
        ...state,
        isPopupVisible: true,
        popupPosition: action.payload.position,
        currentPopup: action.payload.area
      };
    
    case 'HIDE_POPUP':
      return {
        ...state,
        isPopupVisible: false,
        currentPopup: null
      };
    
    case 'SET_AI_RESPONSE':
      return {
        ...state,
        aiResponse: action.payload,
        isLoading: false
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'CLEAR_AREAS':
      return {
        ...state,
        selectedAreas: [],
        isPopupVisible: false,
        currentPopup: null,
        aiResponse: null
      };
    
    default:
      return state;
  }
};

export const HighlightProvider = ({ children }) => {
  const [state, dispatch] = useReducer(highlightReducer, initialState);

  // Handle keyboard events
  useEffect(() => {
    let cursorStyle = null;

    const handleKeyDown = (e) => {
      if (e.metaKey) { // Command key on macOS
        console.log('Command key pressed - hiding cursor');
        dispatch({ type: 'SET_CTRL_PRESSED', payload: true });
        
        // Inject CSS to hide cursor
        if (!cursorStyle) {
          cursorStyle = document.createElement('style');
          cursorStyle.id = 'circle-ai-cursor-style';
          cursorStyle.textContent = `
            * {
              cursor: none !important;
            }
          `;
          document.head.appendChild(cursorStyle);
          console.log('Cursor style injected');
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.metaKey) { // Command key on macOS
        console.log('Command key released - restoring cursor');
        dispatch({ type: 'SET_CTRL_PRESSED', payload: false });
        
        // Remove CSS to restore cursor immediately
        if (cursorStyle) {
          cursorStyle.remove();
          cursorStyle = null;
          console.log('Cursor style removed');
        }
        
        // Force restore cursor on all elements
        document.documentElement.style.cursor = '';
        document.body.style.cursor = '';
        
        // Also restore cursor on all elements that might have been affected
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.style.cursor === 'none') {
            el.style.cursor = '';
          }
        });
        
        if (state.isDrawing) {
          dispatch({ type: 'STOP_DRAWING' });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      // Clean up cursor on unmount
      if (cursorStyle) {
        cursorStyle.remove();
      }
      // Force restore cursor
      document.documentElement.style.cursor = '';
      document.body.style.cursor = '';
    };
  }, [state.isDrawing]);

  // Additional cleanup effect to ensure cursor is restored
  useEffect(() => {
    return () => {
      // Clean up cursor when component unmounts
      const existingStyle = document.getElementById('circle-ai-cursor-style');
      if (existingStyle) {
        existingStyle.remove();
      }
      document.documentElement.style.cursor = '';
      document.body.style.cursor = '';
    };
  }, []);

  // Handle mouse events
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (state.isCtrlPressed && !state.isDrawing) {
        e.preventDefault();
        dispatch({ type: 'START_DRAWING' });
        dispatch({ type: 'ADD_POINT', payload: { x: e.clientX, y: e.clientY } });
      }
    };

    const handleMouseMove = (e) => {
      if (state.isDrawing && state.isCtrlPressed) {
        e.preventDefault();
        dispatch({ type: 'ADD_POINT', payload: { x: e.clientX, y: e.clientY } });
      }
    };

    const handleMouseUp = (e) => {
      if (state.isDrawing) {
        e.preventDefault();
        const area = {
          id: Date.now(),
          path: [...state.currentPath],
          color: state.color,
          timestamp: new Date().toISOString()
        };
        
        dispatch({ type: 'SAVE_AREA', payload: area });
        dispatch({ type: 'STOP_DRAWING' });
        
        // Extract content and show popup
        extractContentFromArea(area);
      }
    };

    if (state.isCtrlPressed) {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [state.isCtrlPressed, state.isDrawing, state.currentPath, state.color]);

  const extractContentFromArea = async (area) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      // Calculate bounding box of the area
      const points = area.path;
      const minX = Math.min(...points.map(p => p.x));
      const maxX = Math.max(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y));
      const maxY = Math.max(...points.map(p => p.y));
      
      // Extract content from the selected area
      const content = await extractContentFromBoundingBox(minX, maxX, minY, maxY);
      
      // Send to background script for AI processing
      chrome.runtime.sendMessage({
        type: 'EXTRACT_INFO',
        data: content
      }, (response) => {
        if (response.success) {
          dispatch({ type: 'SET_AI_RESPONSE', payload: response.data });
          dispatch({ 
            type: 'SHOW_POPUP', 
            payload: { 
              position: { x: maxX + 10, y: minY },
              area: { ...area, content }
            }
          });
        } else {
          console.error('AI extraction failed:', response.error);
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      });
    } catch (error) {
      console.error('Content extraction failed:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const extractContentFromBoundingBox = async (minX, maxX, minY, maxY) => {
    // Create a temporary canvas to capture the area
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match the area
    const width = maxX - minX;
    const height = maxY - minY;
    canvas.width = width;
    canvas.height = height;
    
    // Extract text from the area (simplified approach without html2canvas for now)
    const elements = document.elementsFromPoint(minX + width/2, minY + height/2);
    let textContent = '';
    let hasImage = false;
    
    elements.forEach(element => {
      if (element.textContent) {
        textContent += element.textContent + ' ';
      }
      if (element.tagName === 'IMG') {
        hasImage = true;
      }
    });
    
    // Try to get more text from the bounding area
    const range = document.createRange();
    const selection = window.getSelection();
    
    // Find elements in the selected area
    const elementsInArea = document.querySelectorAll('*');
    let areaText = '';
    
    elementsInArea.forEach(element => {
      const rect = element.getBoundingClientRect();
      if (rect.left < maxX && rect.right > minX && rect.top < maxY && rect.bottom > minY) {
        if (element.textContent && element.textContent.trim()) {
          areaText += element.textContent + ' ';
        }
      }
    });
    
    return {
      type: hasImage ? (textContent.trim() ? 'mixed' : 'image') : 'text',
      content: areaText.trim() || textContent.trim() || 'Selected area content',
      boundingBox: { minX, maxX, minY, maxY },
      imageData: null
    };
  };

  const value = {
    ...state,
    dispatch,
    setColor: (color) => dispatch({ type: 'SET_COLOR', payload: color }),
    clearAreas: () => dispatch({ type: 'CLEAR_AREAS' }),
    hidePopup: () => dispatch({ type: 'HIDE_POPUP' })
  };

  return (
    <HighlightContext.Provider value={value}>
      {children}
    </HighlightContext.Provider>
  );
};

export const useHighlight = () => {
  const context = useContext(HighlightContext);
  if (!context) {
    throw new Error('useHighlight must be used within a HighlightProvider');
  }
  return context;
};