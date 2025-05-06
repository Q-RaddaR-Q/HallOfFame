import React from 'react';
import { Pixel } from '../services/pixelService';

interface SelectedPixelsPanelProps {
  selectedPixels: Array<{ x: number; y: number; color: string }>;
  onRemovePixel: (x: number, y: number) => void;
  onClearSelection: () => void;
  onProceedToPayment: () => void;
  totalPrice: number;
  processingFee: number;
}

const SelectedPixelsPanel: React.FC<SelectedPixelsPanelProps> = ({
  selectedPixels,
  onRemovePixel,
  onClearSelection,
  onProceedToPayment,
  totalPrice,
  processingFee,
}) => {
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      maxWidth: '600px',
      width: '90%',
      zIndex: 1000,
    }}>
      <h3 style={{ marginBottom: '15px', fontSize: '18px' }}>
        Selected Pixels ({selectedPixels.length})
      </h3>
      
      <div style={{ 
        maxHeight: '200px', 
        overflowY: 'auto',
        marginBottom: '20px',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '10px'
      }}>
        {selectedPixels.map((pixel, index) => (
          <div key={`${pixel.x}-${pixel.y}`} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px',
            backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white',
            borderRadius: '4px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: pixel.color,
                border: '1px solid #ccc',
                borderRadius: '4px',
              }} />
              <span>Position: ({pixel.x}, {pixel.y})</span>
            </div>
            <button
              onClick={() => onRemovePixel(pixel.x, pixel.y)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div style={{ 
        padding: '15px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '8px',
        border: '1px solid #e9ecef',
        marginBottom: '20px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Payment Summary</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Pixels ({selectedPixels.length}):</span>
          <span>${totalPrice.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Processing Fee:</span>
          <span>${processingFee.toFixed(2)}</span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid #e9ecef',
          fontWeight: 'bold'
        }}>
          <span>Total:</span>
          <span>${(totalPrice + processingFee).toFixed(2)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          onClick={onClearSelection}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Clear Selection
        </button>
        <button
          onClick={onProceedToPayment}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Proceed to Payment
        </button>
      </div>
    </div>
  );
};

export default SelectedPixelsPanel; 