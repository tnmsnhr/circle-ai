import React, { useRef, useEffect } from 'react';
import { useHighlight } from '../context/HighlightContext';

const CircleOverlay = () => {
  const canvasRef = useRef(null);
  const {
    isDrawing,
    isCtrlPressed,
    currentPath,
    selectedAreas,
    color
  } = useHighlight();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match viewport
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Draw current path
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing || currentPath.length < 2) return;

    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all saved areas
    selectedAreas.forEach(area => {
      drawPath(ctx, area.path, area.color);
    });
    
    // Draw current path
    drawPath(ctx, currentPath, color);
  }, [currentPath, selectedAreas, isDrawing, color]);

  // Draw saved areas when they change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all saved areas
    selectedAreas.forEach(area => {
      drawPath(ctx, area.path, area.color);
    });
    
    // Draw current path if drawing
    if (isDrawing && currentPath.length >= 2) {
      drawPath(ctx, currentPath, color);
    }
  }, [selectedAreas]);

  const drawPath = (ctx, path, pathColor) => {
    if (path.length < 2) return;

    ctx.strokeStyle = pathColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.8;

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // Show visual indicator when Command is pressed
  const showCtrlIndicator = () => {
    if (!isCtrlPressed) return null;
    
    return (
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
          zIndex: 2147483648,
          pointerEvents: 'none',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        Hold ⌘ + Draw to select area
      </div>
    );
  };

  // Custom circular cursor component
  const CustomCursor = () => {
    const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
    const [isVisible, setIsVisible] = React.useState(false);

    React.useEffect(() => {
      const handleMouseMove = (e) => {
        if (isCtrlPressed) {
          setMousePosition({ x: e.clientX, y: e.clientY });
        }
      };

      console.log('CustomCursor: isCtrlPressed changed to:', isCtrlPressed);
      
      if (isCtrlPressed) {
        console.log('CustomCursor: Making cursor visible');
        setIsVisible(true);
        document.addEventListener('mousemove', handleMouseMove);
      } else {
        console.log('CustomCursor: Hiding cursor');
        setIsVisible(false);
        setMousePosition({ x: 0, y: 0 });
      }

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }, [isCtrlPressed]);

    // Don't render if not visible
    if (!isVisible || !isCtrlPressed) return null;

    return (
      <div
        style={{
          position: 'fixed',
          left: mousePosition.x - 5,
          top: mousePosition.y - 5,
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: color,
          border: '2px solid white',
          boxShadow: '0 0 6px rgba(0, 0, 0, 0.8)',
          zIndex: 2147483649,
          pointerEvents: 'none',
          transition: 'none',
          transform: 'translateZ(0)', // Force hardware acceleration
          display: isVisible ? 'block' : 'none' // Explicit display control
        }}
      />
    );
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 2147483647
        }}
      />
      {showCtrlIndicator()}
      <CustomCursor />
    </>
  );
};

export default CircleOverlay;