import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Custom hook for debouncing values
 * @param value The value to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for debouncing functions
 * @param func The function to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedFunc = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        func(...args);
      }, delay);
    },
    [func, delay]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFunc;
}

/**
 * Hook for debounced autosave functionality
 * @param saveFunction The function to call for saving
 * @param delay The delay in milliseconds (default: 2000ms)
 * @param dependencies Dependencies array to watch for changes
 * @returns Object with autosave status and manual trigger
 */
export function useAutosave<T extends (...args: any[]) => Promise<any>>(
  saveFunction: T,
  delay: number = 2000,
  dependencies: any[] = []
) {
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isInitialRender = useRef(true);

  const debouncedSave = useCallback(async () => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    try {
      setAutosaveStatus('saving');
      await saveFunction();
      setAutosaveStatus('saved');
      setLastSaved(new Date());
      
      // Reset to idle after showing saved status for a bit
      setTimeout(() => setAutosaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Autosave failed:', error);
      setAutosaveStatus('error');
      // Reset to idle after showing error status
      setTimeout(() => setAutosaveStatus('idle'), 3000);
    }
  }, [saveFunction]);

  const triggerAutosave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      debouncedSave();
    }, delay);
  }, [debouncedSave, delay]);

  // Trigger autosave when dependencies change
  useEffect(() => {
    if (!isInitialRender.current) {
      triggerAutosave();
    } else {
      isInitialRender.current = false; // Reset flag after first render
    }
  }, dependencies);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    autosaveStatus,
    lastSaved,
    triggerAutosave,
    cancelAutosave: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setAutosaveStatus('idle');
    }
  };
} 