'use client';

import { useState, useEffect, useRef } from 'react';

interface CountUpTimerProps {
  isRunning: boolean;
  finalTime?: number | null;
}

const CountUpTimer: React.FC<CountUpTimerProps> = ({ isRunning, finalTime }) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  // Use a ref to store the start time to prevent it from being reset on re-renders
  const startTimeRef = useRef<number | null>(null);
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      // Set the start time only once when the timer begins
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }

      // Clear any existing interval before starting a new one
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
      }

      // Set up an interval to re-render the component
      timerIdRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const delta = (Date.now() - startTimeRef.current) / 1000; // elapsed time in seconds
          setElapsedTime(delta);
        }
      }, 100); // Update every 100ms

    } else {
      // Timer is stopping
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }

      // If a final time is provided, display it. Otherwise, keep the last calculated time.
      if (finalTime !== undefined && finalTime !== null) {
        setElapsedTime(finalTime);
      }

      // Reset the start time ref for the next run
      startTimeRef.current = null;
    }

    // Cleanup function to clear the interval when the component unmounts
    return () => {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
      }
    };
  }, [isRunning, finalTime]);

  const formattedTime = elapsedTime.toFixed(1);

  return (
    <div className="text-center font-mono bg-black-10 py-10 px-15 rounded-lg border border-black-20">
      <span className="text-xl font-bold text-cardinal-red">{formattedTime}s</span>
    </div>
  );
};

export default CountUpTimer;