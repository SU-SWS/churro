'use client';

import { useState, useEffect } from 'react';

interface CountUpTimerProps {
  isRunning: boolean;
  onReset?: () => void;
}

const CountUpTimer: React.FC<CountUpTimerProps> = ({ isRunning, onReset }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    
    if (isRunning) {
      // Reset timer when starting
      setElapsedTime(0);
      
      // Update every 100ms (0.1 second)
      timerId = setInterval(() => {
        setElapsedTime(prev => prev + 0.1);
      }, 100);
    } else if (onReset) {
      // When stopping, optionally reset
      onReset();
    }
    
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning, onReset]);
  
  // Format time as seconds with one decimal place
  const formattedTime = elapsedTime.toFixed(1);
  
  return (
    <div className="text-center font-mono">
      <span className="text-xl font-bold">{formattedTime}s</span>
    </div>
  );
};

export default CountUpTimer;