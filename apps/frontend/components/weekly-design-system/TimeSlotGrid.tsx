import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WeeklyDesignSystemDataUI, DayOfWeek } from '../../app/weekly-design-system/types';
import { format, addDays } from 'date-fns';

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface TimeSlotGridProps {
  timeSlots: TimeSlot[];
  weeklyData: WeeklyDesignSystemDataUI;
  onDataChange: (data: Partial<WeeklyDesignSystemDataUI>) => void;
  weekStartDate: Date;
  themeClasses?: {
    header: string;
    accent: string;
  };
}

interface CellPosition {
  dayIndex: number;
  timeSlotIndex: number;
  gratitudeIndex?: number; // For gratitude inputs (0-5)
  type: 'timeSlot' | 'gratitude';
}

// Helper function to ensure checkbox values are always booleans
const ensureBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.includes('true') || value.includes(true);
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  return false;
};

// Helper function to get safe checkbox value
const getCheckboxValue = (weeklyData: WeeklyDesignSystemDataUI, day: DayOfWeek, field: '20_20_20' | '90_90_10' | '2WW'): boolean => {
  const dayData = weeklyData.daily_checklists[day];
  if (!dayData) return false;
  return ensureBoolean(dayData[field]);
};

// Helper function to get theme-based highlight colors
const getHighlightColors = (themeClasses?: { header: string; accent: string }) => {
  if (!themeClasses) {
    // Default yellow theme
    return {
      currentDay: 'rgba(245, 158, 11, 0.15)',
      currentTime: 'rgba(245, 158, 11, 0.1)',
      intersection: 'rgba(245, 158, 11, 0.3)',
      darkCurrentDay: 'rgba(245, 158, 11, 0.2)',
      darkCurrentTime: 'rgba(245, 158, 11, 0.15)',
      darkIntersection: 'rgba(245, 158, 11, 0.3)',
      borderColor: 'rgba(245, 158, 11, 0.3)'
    };
  }

  // Extract color from theme classes
  const headerClass = themeClasses.header;
  let baseColor = 'rgb(245, 158, 11)'; // fallback yellow
  
  if (headerClass.includes('bg-blue')) {
    baseColor = 'rgb(59, 130, 246)'; // blue-500
  } else if (headerClass.includes('bg-green')) {
    baseColor = 'rgb(34, 197, 94)'; // green-500
  } else if (headerClass.includes('bg-purple')) {
    baseColor = 'rgb(168, 85, 247)'; // purple-500
  } else if (headerClass.includes('bg-pink')) {
    baseColor = 'rgb(236, 72, 153)'; // pink-500
  } else if (headerClass.includes('bg-orange')) {
    baseColor = 'rgb(249, 115, 22)'; // orange-500
  } else if (headerClass.includes('bg-red')) {
    baseColor = 'rgb(239, 68, 68)'; // red-500
  } else if (headerClass.includes('bg-indigo')) {
    baseColor = 'rgb(99, 102, 241)'; // indigo-500
  } else if (headerClass.includes('bg-teal')) {
    baseColor = 'rgb(20, 184, 166)'; // teal-500
  } else if (headerClass.includes('bg-cyan')) {
    baseColor = 'rgb(6, 182, 212)'; // cyan-500
  }

  // Extract RGB values
  const rgbMatch = baseColor.match(/rgb\((\d+), (\d+), (\d+)\)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return {
      currentDay: `rgba(${r}, ${g}, ${b}, 0.15)`,
      currentTime: `rgba(${r}, ${g}, ${b}, 0.1)`,
      intersection: `rgba(${r}, ${g}, ${b}, 0.3)`,
      darkCurrentDay: `rgba(${r}, ${g}, ${b}, 0.2)`,
      darkCurrentTime: `rgba(${r}, ${g}, ${b}, 0.15)`,
      darkIntersection: `rgba(${r}, ${g}, ${b}, 0.3)`,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`
    };
  }

  // Fallback to yellow
  return {
    currentDay: 'rgba(245, 158, 11, 0.15)',
    currentTime: 'rgba(245, 158, 11, 0.1)',
    intersection: 'rgba(245, 158, 11, 0.3)',
    darkCurrentDay: 'rgba(245, 158, 11, 0.2)',
    darkCurrentTime: 'rgba(245, 158, 11, 0.15)',
    darkIntersection: 'rgba(245, 158, 11, 0.3)',
    borderColor: 'rgba(245, 158, 11, 0.3)'
  };
};

export default function TimeSlotGrid({ timeSlots, weeklyData, onDataChange, weekStartDate, themeClasses }: TimeSlotGridProps) {
  const weekDays: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [currentDay, setCurrentDay] = useState<DayOfWeek | null>(null);
  const [currentTimeSlot, setCurrentTimeSlot] = useState<string | null>(null);
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Function to get the date for each day of the week
  const getDateForDay = (dayIndex: number): string => {
    const date = addDays(weekStartDate, dayIndex);
    const day = format(date, 'd');
    const month = format(date, 'MMMM');
    const year = format(date, 'yyyy');
    
    // Add ordinal suffix to day
    const getOrdinalSuffix = (day: number): string => {
      if (day >= 11 && day <= 13) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    const dayNumber = parseInt(day);
    const ordinalSuffix = getOrdinalSuffix(dayNumber);
    
    return `${day}${ordinalSuffix} ${month} ${year}`;
  };
  
  // Refs to store all input elements
  const inputRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

  // Function to generate unique key for input ref
  const getInputKey = (dayIndex: number, timeSlotIndex: number, gratitudeIndex?: number) => {
    if (gratitudeIndex !== undefined) {
      return `gratitude-${dayIndex}-${gratitudeIndex}`;
    }
    return `timeSlot-${dayIndex}-${timeSlotIndex}`;
  };

  // Function to focus a specific cell
  const focusCell = useCallback((position: CellPosition) => {
    const key = getInputKey(position.dayIndex, position.timeSlotIndex, position.gratitudeIndex);
    const inputElement = inputRefs.current[key];
    if (inputElement) {
      inputElement.focus();
      setFocusedCell(position);
    }
  }, []);

  // Check for dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent, currentPosition: CellPosition) => {
    // Allow Ctrl+A to select all text
    if (e.ctrlKey && e.key === 'a') {
      const textarea = e.target as HTMLTextAreaElement;
      textarea.select();
      e.preventDefault();
      return;
    }
    
    // Allow normal copy/paste operations
    if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
      return; // Let browser handle copy/paste/cut
    }
    
    // Handle navigation keys - but allow Enter for new lines in textarea
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      return;
    }

    // Only prevent default for navigation if no text is selected
    const textarea = e.target as HTMLTextAreaElement;
    const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
    
    // If text is selected and user presses left/right arrows, let browser handle it
    if (hasSelection && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      return;
    }
    
    // If cursor is not at the edge of textarea and arrow keys are pressed, let browser handle it
    if (e.key === 'ArrowLeft' && textarea.selectionStart! > 0) {
      return;
    }
    
    if (e.key === 'ArrowRight' && textarea.selectionStart! < textarea.value.length) {
      return;
    }

    // For up/down arrows, check if we're at the first/last line
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const lines = textarea.value.substring(0, textarea.selectionStart!).split('\n');
      const totalLines = textarea.value.split('\n').length;
      const currentLine = lines.length;
      
      // If not at first line (ArrowUp) or last line (ArrowDown), let browser handle it
      if (e.key === 'ArrowUp' && currentLine > 1) {
        return;
      }
      if (e.key === 'ArrowDown' && currentLine < totalLines) {
        return;
      }
    }

    e.preventDefault();
    
    let newPosition: CellPosition;
    const maxDayIndex = weekDays.length - 1;
    const maxTimeSlotIndex = timeSlots.length - 1;

    switch (e.key) {
      case 'ArrowLeft':
        if (currentPosition.dayIndex > 0) {
          newPosition = { ...currentPosition, dayIndex: currentPosition.dayIndex - 1 };
        } else {
          newPosition = { ...currentPosition, dayIndex: maxDayIndex };
        }
        break;

      case 'ArrowRight':
        if (currentPosition.dayIndex < maxDayIndex) {
          newPosition = { ...currentPosition, dayIndex: currentPosition.dayIndex + 1 };
        } else {
          newPosition = { ...currentPosition, dayIndex: 0 };
        }
        break;

      case 'ArrowUp':
        if (currentPosition.type === 'gratitude') {
          if (currentPosition.gratitudeIndex! > 0) {
            newPosition = { ...currentPosition, gratitudeIndex: currentPosition.gratitudeIndex! - 1 };
          } else {
            // Move to last time slot
            newPosition = { 
              dayIndex: currentPosition.dayIndex, 
              timeSlotIndex: maxTimeSlotIndex, 
              type: 'timeSlot' 
            };
          }
        } else {
          if (currentPosition.timeSlotIndex > 0) {
            newPosition = { ...currentPosition, timeSlotIndex: currentPosition.timeSlotIndex - 1 };
          } else {
            // Wrap to last gratitude input
            newPosition = { 
              dayIndex: currentPosition.dayIndex, 
              timeSlotIndex: maxTimeSlotIndex, 
              gratitudeIndex: 5, 
              type: 'gratitude' 
            };
          }
        }
        break;

      case 'ArrowDown':
      case 'Tab':
        if (currentPosition.type === 'timeSlot') {
          if (currentPosition.timeSlotIndex < maxTimeSlotIndex) {
            newPosition = { ...currentPosition, timeSlotIndex: currentPosition.timeSlotIndex + 1 };
          } else {
            // Move to first gratitude input
            newPosition = { 
              dayIndex: currentPosition.dayIndex, 
              timeSlotIndex: currentPosition.timeSlotIndex, 
              gratitudeIndex: 0, 
              type: 'gratitude' 
            };
          }
        } else {
          if (currentPosition.gratitudeIndex! < 5) {
            newPosition = { ...currentPosition, gratitudeIndex: currentPosition.gratitudeIndex! + 1 };
          } else {
            // Wrap to first time slot
            newPosition = { 
              dayIndex: currentPosition.dayIndex, 
              timeSlotIndex: 0, 
              type: 'timeSlot' 
            };
          }
        }
        break;

      default:
        return;
    }

    focusCell(newPosition);
  }, [timeSlots.length, weekDays.length, focusCell]);

  // Parse time string like "5AM", "5:00 AM", etc. to get hour value
  const parseTimeToHour = (timeStr: string): number => {
    // Remove any whitespace and convert to uppercase
    const cleanTime = timeStr.replace(/\s+/g, '').toUpperCase();
    
    // Extract the hour value using regex
    const hourMatch = cleanTime.match(/^(\d+)(?::00)?(?:AM|PM)/i);
    if (!hourMatch) return -1;
    
    let hour = parseInt(hourMatch[1], 10);
    
    // Adjust for PM
    if (cleanTime.includes('PM') && hour < 12) {
      hour += 12;
    }
    
    // Adjust for 12AM (midnight)
    if (cleanTime.includes('AM') && hour === 12) {
      hour = 0;
    }
    
    return hour;
  };

  // Auto-resize all textareas when data changes
  useEffect(() => {
    const resizeAllTextareas = () => {
      Object.values(inputRefs.current).forEach(textarea => {
        if (textarea) {
          textarea.style.height = 'auto';
          const isGratitude = textarea.classList.contains('min-h-6');
          const minHeight = isGratitude ? 24 : 40;
          const newHeight = Math.max(minHeight, textarea.scrollHeight);
          textarea.style.height = newHeight + 'px';
          
          // Apply vertical centering for time slot textareas
          if (!isGratitude) {
            const lineHeight = 20;
            const lines = Math.ceil(textarea.scrollHeight / lineHeight);
            if (lines === 1) {
              const paddingY = Math.max(8, (newHeight - lineHeight) / 2);
              textarea.style.paddingTop = paddingY + 'px';
              textarea.style.paddingBottom = paddingY + 'px';
            } else {
              textarea.style.paddingTop = '8px';
              textarea.style.paddingBottom = '8px';
            }
          }
        }
      });
    };

    // Resize after a short delay to ensure DOM is updated
    const timeoutId = setTimeout(resizeAllTextareas, 10);
    return () => clearTimeout(timeoutId);
  }, [weeklyData]);

  // Update current day and time
  useEffect(() => {
    const updateCurrentTimeAndDay = () => {
      const now = new Date();
      const dayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      // Our array now starts with Sunday, so dayIndex directly maps to our array
      const currentDayName = weekDays[dayIndex];
      setCurrentDay(currentDayName);

      // Get current hour
      const currentHour = now.getHours();
      
      // Find the best matching time slot by comparing hours
      let bestMatchSlot = null;
      let bestMatchDiff = Infinity;
      
      for (const slot of timeSlots) {
        const slotHour = parseTimeToHour(slot.startTime);
        if (slotHour === -1) continue;
        
        const hourDiff = Math.abs(currentHour - slotHour);
        if (hourDiff < bestMatchDiff) {
          bestMatchDiff = hourDiff;
          bestMatchSlot = slot;
        }
      }
      
      if (bestMatchSlot) {
        setCurrentTimeSlot(bestMatchSlot.startTime);
      }
    };

    // Initial update
    updateCurrentTimeAndDay();
    
    // Set interval to update every minute
    const intervalId = setInterval(updateCurrentTimeAndDay, 60000);
    
    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [timeSlots, weekDays]);

  // Stable handlers to prevent re-renders
  const handleScheduleChange = useCallback((day: DayOfWeek, timeSlot: string, value: string) => {
    const updatedTimeBlocks = {
      ...weeklyData.time_blocks,
      [day]: {
        ...(weeklyData.time_blocks[day] || {}),
        [timeSlot]: value,
      },
    };
    onDataChange({ time_blocks: updatedTimeBlocks });
  }, [weeklyData.time_blocks, onDataChange]);

  const handleChecklistChange = useCallback((day: DayOfWeek, type: keyof typeof weeklyData.daily_checklists[typeof weekDays[0]], value: any) => {
    // Create a completely new object structure without mutating the original
    const currentDayChecklist = weeklyData.daily_checklists[day] || {
      gratitude: ['', '', '', '', '', ''],
      habits: [],
      '20_20_20': false,
      '90_90_10': false,
      '2WW': false
    };

    // For checkbox fields, use the value directly (it's already a boolean from the checkbox)
    let processedValue = value;
    if (type === '20_20_20' || type === '90_90_10' || type === '2WW') {
      // For checkboxes, the value should already be a boolean, so use it directly
      processedValue = Boolean(value);
    }

    const updatedChecklists = {
      ...weeklyData.daily_checklists,
      [day]: {
        ...currentDayChecklist,
        [type]: processedValue
      },
    };
    
    onDataChange({ daily_checklists: updatedChecklists });
  }, [weeklyData.daily_checklists, onDataChange]);

  const handleInputDoubleClick = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    // Select all text on double click
    const textarea = e.currentTarget;
    textarea.select();
  }, []);

  const handleInputClick = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    // Allow normal browser click behavior - no custom cursor positioning
  }, []);

  // Get highlight colors based on current theme
  const highlightColors = getHighlightColors(themeClasses);

  // Helper to determine if this is the current day column
  const isCurrentDayColumn = (day: DayOfWeek) => day === currentDay;

  // Helper to determine if this is the current time row
  const isCurrentTimeRow = (timeSlot: TimeSlot) => timeSlot.startTime === currentTimeSlot;

  // Helper to get cell style based on highlighting
  const getCellStyle = (day: DayOfWeek, timeSlot?: TimeSlot) => {
    const isCurrentDay = isCurrentDayColumn(day);
    const isCurrentTime = timeSlot && isCurrentTimeRow(timeSlot);
    
    let backgroundColor = '';
    let borderColor = '';
    
    if (isCurrentDay && isCurrentTime) {
      // Intersection of current day and time
      backgroundColor = isDarkMode ? highlightColors.darkIntersection : highlightColors.intersection;
      borderColor = highlightColors.borderColor;
    } else if (isCurrentDay) {
      // Current day column
      backgroundColor = isDarkMode ? highlightColors.darkCurrentDay : highlightColors.currentDay;
      borderColor = highlightColors.borderColor;
    } else if (isCurrentTime) {
      // Current time row
      backgroundColor = isDarkMode ? highlightColors.darkCurrentTime : highlightColors.currentTime;
      borderColor = highlightColors.borderColor;
    }
    
    return {
      backgroundColor,
      borderColor: borderColor || undefined,
    };
  };

  // Use theme classes or fallback to default yellow
  const headerClasses = themeClasses 
    ? `border border-gray-300 dark:border-gray-600 p-3 text-center ${themeClasses.header} font-bold ${themeClasses.accent}`
    : 'border border-gray-300 dark:border-gray-600 p-3 text-center bg-yellow-100 dark:bg-amber-500/20 font-bold dark:text-white';

  return (
    <div className="w-full overflow-x-auto max-w-full">
      <table className="w-full border-collapse min-w-full table-fixed">
        <thead>
          <tr>
            {weekDays.map((day, index) => (
              <th 
                key={day} 
                className={headerClasses}
                style={getCellStyle(day)}
              >
                <div className="flex flex-col">
                  <span>{day}</span>
                  {day === 'Saturday' && (
                    <div className="relative group mt-0">
                      <div className="flex items-center justify-center gap-1 text-xs font-normal opacity-75 cursor-help">
                        <span>(DS + OMAD)</span>
                        <svg className="w-3 h-3 fill-blue-500" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="absolute top-full left-1/16 transform -translate-x-1/4 mt-2 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                        Digital Sabbath + One Meal a Day
                      </div>
                    </div>
                  )}
                  <span className="text-xs font-normal opacity-75">{getDateForDay(index)}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot) => (
            <tr key={slot.startTime}>
              {weekDays.map((day) => (
                <td 
                  key={`${day}-${slot.startTime}`} 
                  className="border border-gray-300 dark:border-gray-600 p-0"
                  style={getCellStyle(day, slot)}
                >
                  <div className="grid grid-cols-[minmax(100px,107px),1fr] min-h-10 h-full">
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 px-2 py-2 border-r border-gray-300 dark:border-gray-600 flex items-center justify-center text-center h-full">
                      {`${slot.startTime} - ${slot.endTime}`}
                    </div>
                    <div className="flex items-center min-h-10 h-full">
                      <textarea
                        ref={(el) => {
                          const key = getInputKey(weekDays.indexOf(day), timeSlots.indexOf(slot));
                          inputRefs.current[key] = el;
                        }}
                        className="w-full bg-transparent border-none focus:outline-none text-sm px-2 text-center text-foreground resize-none overflow-hidden leading-tight"
                        style={{ 
                          minHeight: '40px',
                          paddingTop: '8px',
                          paddingBottom: '8px'
                        }}
                        value={weeklyData.time_blocks[day]?.[slot.startTime] || ''}
                        onChange={(e) => {
                          handleScheduleChange(day, slot.startTime, e.target.value);
                          // Auto-resize textarea with proper padding
                          e.target.style.height = 'auto';
                          const newHeight = Math.max(40, e.target.scrollHeight);
                          e.target.style.height = newHeight + 'px';
                          // Adjust padding for vertical centering when single line
                          const lineHeight = 20; // approximate line height
                          const lines = Math.ceil(e.target.scrollHeight / lineHeight);
                          if (lines === 1) {
                            const paddingY = Math.max(8, (newHeight - lineHeight) / 2);
                            e.target.style.paddingTop = paddingY + 'px';
                            e.target.style.paddingBottom = paddingY + 'px';
                          } else {
                            e.target.style.paddingTop = '8px';
                            e.target.style.paddingBottom = '8px';
                          }
                        }}
                        onClick={handleInputClick}
                        onDoubleClick={handleInputDoubleClick}
                        onFocus={() => {
                          const position: CellPosition = {
                            dayIndex: weekDays.indexOf(day),
                            timeSlotIndex: timeSlots.indexOf(slot),
                            type: 'timeSlot'
                          };
                          setFocusedCell(position);
                        }}
                        onKeyDown={(e) => {
                          const position: CellPosition = {
                            dayIndex: weekDays.indexOf(day),
                            timeSlotIndex: timeSlots.indexOf(slot),
                            type: 'timeSlot'
                          };
                          handleKeyDown(e.nativeEvent, position);
                        }}
                        placeholder=""
                        rows={1}
                      />
                    </div>
                  </div>
                </td>
              ))}
            </tr>
          ))}
          {/* AM Protocol Row */}
          <tr>
            {weekDays.map((day) => (
              <td 
                key={`${day}-protocol`} 
                className="border border-gray-300 dark:border-gray-600 p-0"
                style={getCellStyle(day)}
              >
                <div className="grid grid-cols-[minmax(100px,107px),1fr] h-12">
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 px-3 py-2 border-r border-gray-300 dark:border-gray-600 flex items-center justify-center text-center h-full">
                    20/20/20
                  </div>
                  <div className="flex items-center justify-center py-2 h-full">
                    <input 
                      type="checkbox" 
                      className="form-checkbox h-4 w-4 text-primary dark:text-blue-400 dark:border-gray-500 dark:bg-gray-700" 
                      checked={getCheckboxValue(weeklyData, day, '20_20_20')}
                      onChange={(e) => {
                        handleChecklistChange(day, '20_20_20', e.target.checked);
                      }}
                    />
                  </div>
                </div>
              </td>
            ))}
          </tr>
          
          {/* Daily Goal Setting Row */}
          <tr>
            {weekDays.map((day) => (
              <td 
                key={`${day}-goal-setting`} 
                className="border border-gray-300 dark:border-gray-600 p-0"
                style={getCellStyle(day)}
              >
                <div className="grid grid-cols-[minmax(100px,107px),1fr] h-12">
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 px-3 py-2 border-r border-gray-300 dark:border-gray-600 flex items-center justify-center text-center h-full">
                    90/90/10
                  </div>
                  <div className="flex items-center justify-center py-2 h-full">
                    <input 
                      type="checkbox" 
                      className="form-checkbox h-4 w-4 text-primary dark:text-blue-400 dark:border-gray-500 dark:bg-gray-700"
                      checked={getCheckboxValue(weeklyData, day, '90_90_10')}
                      onChange={(e) => {
                        handleChecklistChange(day, '90_90_10', e.target.checked);
                      }}
                    />
                  </div>
                </div>
              </td>
            ))}
          </tr>
          
          {/* Peak Diet Row */}
          <tr>
            {weekDays.map((day) => (
              <td 
                key={`${day}-peak-diet`} 
                className="border border-gray-300 dark:border-gray-600 p-0"
                style={getCellStyle(day)}
              >
                <div className="grid grid-cols-[minmax(100px,107px),1fr] h-12">
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 px-3 py-2 border-r border-gray-300 dark:border-gray-600 flex items-center justify-center text-center h-full">
                    <div className="relative group">
                      <div className="flex items-center gap-1 cursor-help">
                        <span>2WW</span>
                        <svg className="w-3 h-3 fill-blue-500" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="absolute top-full left-1/4 transform -translate-x-1/4 mt-2 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                        Second Win Workout
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center py-2 h-full">
                    <input 
                      type="checkbox" 
                      className="form-checkbox h-4 w-4 text-primary dark:text-blue-400 dark:border-gray-500 dark:bg-gray-700"
                      checked={getCheckboxValue(weeklyData, day, '2WW')}
                      onChange={(e) => {
                        handleChecklistChange(day, '2WW', e.target.checked);
                      }}
                    />
                  </div>
                </div>
              </td>
            ))}
          </tr>
          
          {/* Gratitude Row - This can expand */}
          <tr>
            {weekDays.map((day) => (
              <td 
                key={`${day}-gratitude`} 
                className="border border-gray-300 dark:border-gray-600 p-0"
                style={getCellStyle(day)}
              >
                <div className="grid grid-cols-[minmax(100px,107px),1fr] min-h-[8rem]">
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 px-3 py-2 border-r border-gray-300 dark:border-gray-600 flex items-center justify-center text-center">
                    Gratitude 6
                  </div>
                  <div className="px-2 py-2 flex items-start">
                    <div className="flex flex-col space-y-1 w-full">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <div key={`${day}-gratitude-${num}`} className="flex items-start">
                          <span className="text-xs sm:text-sm mr-1 dark:text-gray-300 w-4 pt-1 flex-shrink-0">{num}.</span>
                          <textarea
                            ref={(el) => {
                              const key = getInputKey(weekDays.indexOf(day), timeSlots.length - 1, num - 1);
                              inputRefs.current[key] = el;
                            }}
                            className="w-full bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none text-xs sm:text-sm text-center text-foreground resize-none overflow-hidden min-h-6"
                            value={(weeklyData.daily_checklists[day]?.gratitude || [])[num - 1] || ''}
                            onClick={handleInputClick}
                            onDoubleClick={handleInputDoubleClick}
                            onFocus={() => {
                              const position: CellPosition = {
                                dayIndex: weekDays.indexOf(day),
                                timeSlotIndex: timeSlots.length - 1,
                                gratitudeIndex: num - 1,
                                type: 'gratitude'
                              };
                              setFocusedCell(position);
                            }}
                            onKeyDown={(e) => {
                              const position: CellPosition = {
                                dayIndex: weekDays.indexOf(day),
                                timeSlotIndex: timeSlots.length - 1,
                                gratitudeIndex: num - 1,
                                type: 'gratitude'
                              };
                              handleKeyDown(e.nativeEvent, position);
                            }}
                            onChange={(e) => {
                              const updatedGratitude = [...(weeklyData.daily_checklists[day]?.gratitude || ['', '', '', '', '', ''])];
                              updatedGratitude[num - 1] = e.target.value;
                              handleChecklistChange(day, 'gratitude', updatedGratitude);
                              // Auto-resize textarea
                              e.target.style.height = 'auto';
                              e.target.style.height = Math.max(24, e.target.scrollHeight) + 'px';
                            }}
                            rows={1}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
} 