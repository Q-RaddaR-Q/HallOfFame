import React from 'react';
import { Pixel } from '../services/pixelService';

interface TopMenuProps {
  pixels: Pixel[];
}

const TopMenu: React.FC<TopMenuProps> = ({ pixels }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '15px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <button
          style={{
            padding: '10px 15px',
            backgroundColor: '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            opacity: 0.5,
          }}
          disabled
        >
          Statistics
        </button>

        <button
          style={{
            padding: '10px 15px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            opacity: 0.5,
          }}
          disabled
        >
          Export
        </button>

        <button
          style={{
            padding: '10px 15px',
            backgroundColor: '#607D8B',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            opacity: 0.5,
          }}
          disabled
        >
          Settings
        </button>
      </div>
    </div>
  );
};

export default TopMenu; 