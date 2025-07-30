'use client';

import { useState, useEffect } from 'react';

interface CountUpTimerProps {
  isRunning: boolean;
  finalTime?: number | null; // Optional final time to display when not running
}

const CountUpTimer: React.FC<CountUpTimerProps> = ({ isRunning, finalTime }) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isStopped, setIsStopped] = useState(false);

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    
    if (isRunning) {
      // Only reset if we're starting fresh, not if we were already running
      if (!isStopped) {
        setElapsedTime(0);
      }
      setIsStopped(false);
      
      // Update every 100ms (0.1 second)
      timerId = setInterval(() => {
        setElapsedTime(prev => prev + 0.1);
      }, 100);
    } else if (isRunning === false && !isStopped) {
      // When stopping, keep the final time
      setIsStopped(true);
      // If finalTime is provided, use it
      if (finalTime !== undefined && finalTime !== null) {
        setElapsedTime(finalTime);
      }
    }
    
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning, isStopped, finalTime]);
  
  // Format time as seconds with one decimal place
  const formattedTime = elapsedTime.toFixed(1);
  
  return (
    <div className="text-center font-mono bg-blue-50 py-2 px-4 rounded-lg">
      <span className="text-xl font-bold text-blue-700">{formattedTime}s</span>
    </div>
  );
};

export default CountUpTimer;