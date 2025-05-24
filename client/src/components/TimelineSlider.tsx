import React, { useState, useEffect } from 'react';
import { Pixel } from '../services/pixelService';

interface TimelineSliderProps {
  pixels: Pixel[];
  onTimeChange: (date: Date) => void;
}

const TimelineSlider: React.FC<TimelineSliderProps> = ({ pixels, onTimeChange }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [minDate, setMinDate] = useState<Date>(new Date());
  const [maxDate, setMaxDate] = useState<Date>(new Date());

  useEffect(() => {
    if (pixels.length > 0) {
      const dates = pixels.map(pixel => new Date(pixel.lastUpdated));
      const min = new Date(Math.min(...dates.map(d => d.getTime())));
      const max = new Date(Math.max(...dates.map(d => d.getTime())));
      setMinDate(min);
      setMaxDate(max);
      setSelectedDate(max); // Start with the most recent date
    }
  }, [pixels]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timestamp = parseInt(e.target.value);
    const newDate = new Date(timestamp);
    setSelectedDate(newDate);
    onTimeChange(newDate);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: '15px',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      width: '80%',
      maxWidth: '800px',
      zIndex: 1000,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {minDate.toLocaleDateString()}
          </span>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {maxDate.toLocaleDateString()}
          </span>
        </div>
        <input
          type="range"
          min={minDate.getTime()}
          max={maxDate.getTime()}
          value={selectedDate.getTime()}
          onChange={handleSliderChange}
          style={{
            width: '100%',
            height: '4px',
            WebkitAppearance: 'none',
            background: '#ddd',
            outline: 'none',
            borderRadius: '2px',
          }}
        />
        <div style={{
          textAlign: 'center',
          fontSize: '16px',
          fontWeight: '500',
        }}>
          {selectedDate.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default TimelineSlider; 