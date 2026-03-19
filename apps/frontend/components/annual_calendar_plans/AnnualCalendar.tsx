import React, { useEffect, useRef, useState } from 'react';
import { format, startOfYear, addMonths, eachDayOfInterval, endOfMonth, startOfMonth, getDaysInMonth, differenceInDays, addDays, parseISO, isSameDay } from 'date-fns';
import { AnnualCalendarPlan, AllowedColor } from '@/app/annual_calendar_plans/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ColorUpdateModal from './ColorUpdateModal';

interface AnnualCalendarProps {
  year: number;
  plans?: AnnualCalendarPlan[];
  onDateClick?: (date: string) => void;
  onYearChange: (year: number) => void;
  onPlanClick?: (plan: AnnualCalendarPlan) => void;
  onDragCreatePlan?: (startDate: string, endDate: string) => void;
  onUpdateColor?: (planId: string, color: AllowedColor) => Promise<void>;
}

interface PlanSpan {
  plan: AnnualCalendarPlan;
  startIndex: number;
  endIndex: number;
  rowIndex: number;
}

const getColorClasses = (color: string) => {
  const colorMap: Record<string, { bg: string; hover: string; text: string; border: string }> = {
    red: { bg: 'bg-red-500', hover: 'hover:bg-red-600', text: 'text-white', border: 'border-red-700' },
    yellow: { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', text: 'text-black', border: 'border-yellow-700' },
    orange: { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', text: 'text-white', border: 'border-orange-700' },
    blue: { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', text: 'text-white', border: 'border-blue-700' },
    green: { bg: 'bg-green-500', hover: 'hover:bg-green-600', text: 'text-white', border: 'border-green-700' },
    black: { bg: 'bg-black', hover: 'hover:bg-gray-800', text: 'text-white', border: 'border-gray-800' },
    white: { bg: 'bg-white', hover: 'hover:bg-gray-100', text: 'text-black', border: 'border-gray-400' },
    purple: { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', text: 'text-white', border: 'border-purple-700' },
    pink: { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', text: 'text-white', border: 'border-pink-700' }
  };
  
  return colorMap[color] || colorMap.blue; // fallback to blue
};

const AnnualCalendar: React.FC<AnnualCalendarProps> = ({ year, plans = [], onDateClick, onYearChange, onPlanClick, onDragCreatePlan, onUpdateColor }) => {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 2;
  const maxYear = currentYear + 2;
  const [forceUpdate, setForceUpdate] = useState(0);
  const [cellWidth, setCellWidth] = useState(40);
  const [viewportScale, setViewportScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  
  // Drag state management
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const [dragEndDate, setDragEndDate] = useState<Date | null>(null);
  const [dragPreview, setDragPreview] = useState<{start: Date, end: Date} | null>(null);
  
  // Color update modal state
  const [colorUpdateModalOpen, setColorUpdateModalOpen] = useState(false);
  const [selectedPlanForColor, setSelectedPlanForColor] = useState<AnnualCalendarPlan | null>(null);
  
  // Monitor zoom level changes and calculate responsive values
  useEffect(() => {
    const calculateResponsiveValues = () => {
      if (!containerRef.current) return;
      
      const containerWidth = containerRef.current.clientWidth;
      const availableWidth = containerWidth - 100; // Subtract month name column width
      const idealCellWidth = Math.max(30, Math.min(50, availableWidth / 35)); // 35 cells per row
      
      // Calculate viewport scale based on zoom level
      const currentZoom = window.devicePixelRatio || 1;
      const baseZoom = 1;
      const scale = Math.max(0.6, Math.min(1.4, currentZoom / baseZoom));
      
      setCellWidth(idealCellWidth);
      setViewportScale(scale);
      setForceUpdate(prev => prev + 1);
    };
    
    // Use a timeout to avoid too many rapid updates
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(calculateResponsiveValues, 100);
    };
    
    calculateResponsiveValues(); // Initial measurement
    window.addEventListener('resize', debouncedResize);
    
    // Listen for zoom events
    const handleZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        debouncedResize();
      }
    };
    
    window.addEventListener('wheel', handleZoom, { passive: true });
    
    // Observe container size changes
    const resizeObserver = new ResizeObserver(debouncedResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('wheel', handleZoom);
      resizeObserver.disconnect();
    };
  }, []);

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = addMonths(startOfYear(new Date(year, 0)), i);
    return {
      name: format(date, 'MMMM').toUpperCase(),
      days: eachDayOfInterval({
        start: startOfMonth(date),
        end: endOfMonth(date)
      }),
      firstDayOfWeek: startOfMonth(date).getDay(),
      totalDays: getDaysInMonth(date)
    };
  });

  const weekDays = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

  const getPlansForDate = (dateStr: string) => {
    return plans.filter(plan => {
      const planStart = parseISO(plan.start_date);
      const planEnd = parseISO(plan.end_date);
      const currentDate = parseISO(dateStr);
      
      return currentDate >= planStart && currentDate <= planEnd;
    });
  };

  const calculatePlanSpans = (daysArray: (Date | null)[], monthPlans: AnnualCalendarPlan[]) => {
    const planSpans: PlanSpan[] = [];
    const planRows: { [planId: string]: number } = {};
    const rowOccupancy: { [rowIndex: number]: Set<number> } = {}; // Track which days are occupied in each row
    
    // Sort plans by start date to process them in chronological order
    const sortedPlans = [...monthPlans].sort((a, b) => 
      parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime()
    );

    sortedPlans.forEach(plan => {
      const planDays: number[] = [];
      const planStart = parseISO(plan.start_date);
      const planEnd = parseISO(plan.end_date);
      
      // Find all day indices for this plan
      daysArray.forEach((day, index) => {
        if (day) {
          const currentDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          const planStartDate = new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate());
          const planEndDate = new Date(planEnd.getFullYear(), planEnd.getMonth(), planEnd.getDate());
          
          if (currentDate >= planStartDate && currentDate <= planEndDate) {
            planDays.push(index);
          }
        }
      });

      if (planDays.length === 0) return;

      // Find the first available row for this plan
      if (!(plan.id in planRows)) {
        let assignedRow = 0;
        
        // Check each row starting from 0 to find one that doesn't conflict
        while (true) {
          // Initialize row occupancy if it doesn't exist
          if (!rowOccupancy[assignedRow]) {
            rowOccupancy[assignedRow] = new Set();
          }
          
          // Check if this plan's days conflict with existing plans in this row
          const hasConflict = planDays.some(dayIndex => rowOccupancy[assignedRow].has(dayIndex));
          
          if (!hasConflict) {
            // No conflict, assign this row
            planRows[plan.id] = assignedRow;
            // Mark all days as occupied in this row
            planDays.forEach(dayIndex => rowOccupancy[assignedRow].add(dayIndex));
            break;
          } else {
            // Conflict found, try next row
            assignedRow++;
          }
        }
      }

      // Create a single continuous span for the entire plan
      if (planDays.length > 0) {
        planSpans.push({
          plan,
          startIndex: Math.min(...planDays),
          endIndex: Math.max(...planDays),
          rowIndex: planRows[plan.id]
        });
      }
    });

    // Calculate max rows used
    const maxRows = Math.max(1, Math.max(...Object.values(planRows)) + 1);

    return { planSpans, maxRows };
  };

  const getMiddleIndex = (startIndex: number, endIndex: number) => {
    return Math.floor((startIndex + endIndex) / 2);
  };

  const isMultiDayPlan = (startIndex: number, endIndex: number) => {
    return endIndex > startIndex;
  };

  // Helper function to check if a date is within drag selection
  const isDateInDragSelection = (date: Date) => {
    if (!dragPreview) return false;
    return date >= dragPreview.start && date <= dragPreview.end;
  };

  // Helper function to measure actual text width
  const measureTextWidth = (text: string, fontSize: string, fontWeight: string = 'font-semibold') => {
    // Create a temporary span to measure text
    const tempSpan = document.createElement('span');
    tempSpan.style.fontSize = fontSize;
    tempSpan.style.fontWeight = fontWeight === 'font-semibold' ? '600' : 'normal';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'nowrap';
    tempSpan.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'; // Match Tailwind default
    tempSpan.textContent = text;
    
    document.body.appendChild(tempSpan);
    const width = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    
    return width;
  };
  
  // Helper function to calculate maximum characters that can fit using actual measurements
  const calculateMaxCharacters = (spanWidth: number, fontSize: string, text: string, updateTrigger: number) => {
    // Use actual cellWidth without additional scaling since it already includes responsive sizing
    const actualCellWidth = cellWidth;
    
    // Calculate available width with adaptive padding based on zoom level
    let paddingWidth;
    if (spanWidth <= 2) {
      paddingWidth = Math.max(2 * viewportScale, actualCellWidth * 0.1); // Minimal padding for very small spans
    } else if (spanWidth <= 5) {
      paddingWidth = Math.max(4 * viewportScale, spanWidth * actualCellWidth * 0.08); // 8% padding
    } else {
      paddingWidth = Math.max(6 * viewportScale, spanWidth * actualCellWidth * 0.06); // 6% padding
    }
    
    const availableWidth = spanWidth * actualCellWidth - paddingWidth;
    
    // If the full text fits, return it
    const fullTextWidth = measureTextWidth(text, fontSize);
    if (fullTextWidth <= availableWidth) {
      return text.length;
    }
    
    // Check if we can fit the text with ellipsis
    const textWithEllipsisWidth = measureTextWidth(text + '...', fontSize);
    if (textWithEllipsisWidth <= availableWidth) {
      // Even if full text fits with ellipsis, we want to show ellipsis to indicate potential truncation
      return text.length - 1; // Leave space for ellipsis
    }
    
    // Check if even just ellipsis fits
    const ellipsisWidth = measureTextWidth('...', fontSize);
    if (ellipsisWidth > availableWidth) {
      // Not enough space for ellipsis, try to fit at least some characters
      let maxChars = 0;
      for (let i = 1; i <= text.length; i++) {
        const testText = text.substring(0, i);
        const testWidth = measureTextWidth(testText, fontSize);
        if (testWidth <= availableWidth) {
          maxChars = i;
        } else {
          break;
        }
      }
      return Math.max(1, maxChars);
    }
    
    // Binary search to find the maximum characters that fit with ellipsis
    let left = 1;
    let right = text.length; // Include full text length in search
    let maxChars = 0;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const testText = text.substring(0, mid) + '...';
      const testWidth = measureTextWidth(testText, fontSize);
      
      if (testWidth <= availableWidth) {
        maxChars = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return Math.max(1, maxChars); // Ensure at least 1 character
  };

  // Helper function to truncate text with ellipsis
  const truncateText = (text: string, maxChars: number) => {
    if (maxChars === 0) {
      return ''; // Return empty string if no space
    }
    
    // If the text fits completely, return it as is
    if (text.length <= maxChars) {
      return text;
    }
    
    // If we have remaining characters that can't be shown, always add ellipsis
    // maxChars already accounts for the ellipsis space from calculateMaxCharacters
    return `${text.substring(0, maxChars)}...`;
  };

  const getWeeksInMonth = (totalDays: number, firstDayOfWeek: number) => {
    return Math.ceil((totalDays + firstDayOfWeek) / 7);
  };

  const handleDateClick = (date: Date) => {
    if (onDateClick) {
      onDateClick(format(date, 'yyyy-MM-dd'));
    }
  };

  const handlePlanClick = (e: React.MouseEvent, plan: AnnualCalendarPlan) => {
    e.stopPropagation();
    if (onPlanClick) {
      onPlanClick(plan);
    }
  };

  const handlePlanColorClick = (e: React.MouseEvent, plan: AnnualCalendarPlan) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedPlanForColor(plan);
    setColorUpdateModalOpen(true);
  };

  const handleColorUpdate = async (planId: string, color: AllowedColor) => {
    if (onUpdateColor) {
      await onUpdateColor(planId, color);
    }
    setColorUpdateModalOpen(false);
    setSelectedPlanForColor(null);
  };

  // Drag event handlers
  const handleMouseDown = (e: React.MouseEvent, date: Date) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartDate(date);
    setDragEndDate(date);
    setDragPreview({ start: date, end: date });
  };

  const handleMouseEnter = (date: Date) => {
    if (isDragging && dragStartDate) {
      const start = dragStartDate < date ? dragStartDate : date;
      const end = dragStartDate < date ? date : dragStartDate;
      setDragEndDate(date);
      setDragPreview({ start, end });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStartDate && dragEndDate && onDragCreatePlan) {
      const start = dragStartDate < dragEndDate ? dragStartDate : dragEndDate;
      const end = dragStartDate < dragEndDate ? dragEndDate : dragStartDate;
      onDragCreatePlan(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
    }
    setIsDragging(false);
    setDragStartDate(null);
    setDragEndDate(null);
    setDragPreview(null);
  };

  // Global mouse up handler to handle drag end anywhere
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStartDate, dragEndDate]);

  return (
    <div ref={containerRef} className="bg-white" style={{ minWidth: '800px' }}>
      {/* Hidden div for text measurements */}
      <div ref={measureRef} style={{ position: 'absolute', visibility: 'hidden' }} />
      {/* Header - Dynamic and Responsive */}
      <div className="mb-8 flex items-center justify-center w-full">
        <div className="flex items-center gap-4 px-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onYearChange(year - 1)}
            disabled={year <= minYear}
            className="flex-shrink-0"
            style={{
              minWidth: `${Math.max(36, 40 * viewportScale)}px`,
              minHeight: `${Math.max(36, 40 * viewportScale)}px`
            }}
          >
            <ChevronLeft 
              className={`${cellWidth >= 35 ? 'h-5 w-5' : 'h-4 w-4'}`}
              style={{
                fontSize: `${Math.max(16, 18 * viewportScale)}px`
              }}
            />
          </Button>
          <div 
            className="text-blue-800 border-2 border-blue-800 px-4 py-1 font-bold text-center flex-shrink-0"
            style={{
              fontSize: `${Math.max(28, 36 * viewportScale)}px`,
              minWidth: `${Math.max(120, 140 * viewportScale)}px`,
              borderWidth: `${Math.max(1, 2 * viewportScale)}px`
            }}
          >
            {year}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onYearChange(year + 1)}
            disabled={year >= maxYear}
            className="flex-shrink-0"
            style={{
              minWidth: `${Math.max(36, 40 * viewportScale)}px`,
              minHeight: `${Math.max(36, 40 * viewportScale)}px`
            }}
          >
            <ChevronRight 
              className={`${cellWidth >= 35 ? 'h-5 w-5' : 'h-4 w-4'}`}
              style={{
                fontSize: `${Math.max(16, 18 * viewportScale)}px`
              }}
            />
          </Button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div 
        className="grid gap-0 mb-2 pb-1 relative"
        style={{
          gridTemplateColumns: `100px repeat(35, ${cellWidth}px)`,
        }}
      >
        {/* Responsive bottom border */}
        <div 
          className="absolute bottom-0 left-0 border-b border-gray-200"
          style={{
            width: `${100 + 35 * cellWidth}px`
          }}
        />
        <div className="text-left" /> {/* Empty cell for month names */}
        {[1, 2, 3, 4, 5].map((weekNum) => (
          <React.Fragment key={weekNum}>
            {weekDays.map((day, i) => (
              <div 
                key={`${weekNum}-${i}`} 
                className={`
                  text-center font-medium
                  ${i === 0 || i === 6 ? 'text-red-600' : 'text-gray-800'}
                  ${i === 6 ? 'border-r border-gray-300' : ''}
                `}
                style={{
                  width: `${cellWidth}px`,
                  fontSize: `${Math.max(12, 14 * viewportScale)}px`
                }}
              >
                {cellWidth >= 35 ? day : day.charAt(0)}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="space-y-3">
        {months.map((month, monthIndex) => {
          const weeksInMonth = getWeeksInMonth(month.totalDays, month.firstDayOfWeek);
          const daysArray = Array.from({ length: weeksInMonth * 7 }, (_, i) => {
            const dayIndex = i - month.firstDayOfWeek;
            return dayIndex >= 0 && dayIndex < month.totalDays ? month.days[dayIndex] : null;
          });

          // Get all plans that appear in this month
          const monthPlans = plans.filter(plan => {
            const planStart = parseISO(plan.start_date);
            const planEnd = parseISO(plan.end_date);
            const monthStart = month.days[0];
            const monthEnd = month.days[month.days.length - 1];
            
            return !(planEnd < monthStart || planStart > monthEnd);
          });

          const { planSpans, maxRows } = calculatePlanSpans(daysArray, monthPlans);

          return (
            <div key={monthIndex} className="relative">
              {/* Month row */}
              <div 
                className="grid gap-0 items-start" 
                style={{ 
                  gridTemplateColumns: `100px repeat(35, ${cellWidth}px)`,
                  minHeight: `${Math.max(32, 40 * viewportScale) + maxRows * Math.max(24, 28 * viewportScale)}px` 
                }}
              >
                {/* Month Name */}
                <div 
                  className="text-left text-blue-800 font-semibold pt-1"
                  style={{
                    fontSize: `${Math.max(14, 18 * viewportScale)}px`
                  }}
                >
                  {cellWidth >= 35 ? month.name : month.name.substring(0, 3)}
                </div>

                {/* Date cells grouped by weeks */}
                {Array.from({ length: 5 }).map((_, weekIndex) => (
                  <React.Fragment key={weekIndex}>
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const dayArrayIndex = weekIndex * 7 + dayIndex;
                      const day = daysArray[dayArrayIndex];

                      if (!day) {
                        return (
                          <div 
                            key={`empty-${dayArrayIndex}`} 
                            className={`
                              text-center py-1
                              ${dayIndex === 6 ? 'border-r border-gray-300' : ''}
                            `}
                            style={{
                              height: `${Math.max(28, 32 * viewportScale)}px`,
                              width: `${cellWidth}px`,
                              fontSize: `${Math.max(12, 16 * viewportScale)}px`
                            }}
                          />
                        );
                      }

                      const dateStr = format(day, 'yyyy-MM-dd');
                      const isWeekend = dayIndex === 0 || dayIndex === 6;
                      const isInDragSelection = isDateInDragSelection(day);
                      const isToday = year === new Date().getFullYear() && 
                                     monthIndex === new Date().getMonth() && 
                                     parseInt(format(day, 'd')) === new Date().getDate();

                      return (
                        <div
                          key={dayArrayIndex}
                          onClick={() => handleDateClick(day)}
                          onMouseDown={(e) => handleMouseDown(e, day)}
                          onMouseEnter={() => handleMouseEnter(day)}
                          className={`
                            text-center py-1 cursor-pointer relative select-none
                            ${dayIndex === 6 ? 'border-r border-gray-300' : ''}
                            ${isToday ? 'bg-gradient-to-br from-blue-50 to-blue-100' : 
                              isInDragSelection ? 'bg-blue-200' : 'hover:bg-gray-50'}
                            ${isDragging ? 'cursor-crosshair' : ''}
                            transition-colors
                          `}
                          style={{
                            height: `${Math.max(28, 32 * viewportScale)}px`,
                            width: `${cellWidth}px`,
                            fontSize: `${Math.max(12, 16 * viewportScale)}px`
                          }}
                        >
                          {/* Today's date special border overlay */}
                          {isToday && (
                            <div
                              className="absolute inset-0 border-2 border-blue-500 rounded-md pointer-events-none"
                              style={{
                                zIndex: 50,
                                borderWidth: '3px',
                                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(59, 130, 246, 0.2)'
                              }}
                            />
                          )}
                          <div
                            className={`
                              ${isToday ? 'text-blue-700 font-bold' : 
                                isWeekend ? 'text-red-600' : 'text-gray-800'}
                              relative z-40
                            `}
                          >
                            {format(day, 'd')}
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Plan spans overlay */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                {/* Render continuous plan bars */}
                {planSpans.map((span) => {
                  const colorClasses = getColorClasses(span.plan.color);
                  const spanWidth = span.endIndex - span.startIndex + 1;
                  const isMultiDay = isMultiDayPlan(span.startIndex, span.endIndex);
                  const middleIndex = getMiddleIndex(span.startIndex, span.endIndex);
                  
                  // Calculate available space for text with adaptive padding
                  let paddingCells;
                  if (spanWidth <= 2) {
                    paddingCells = 0; // No padding for very small spans
                  } else if (spanWidth <= 5) {
                    paddingCells = Math.max(0, Math.floor(spanWidth * 0.04)); // 4% padding for small spans
                  } else {
                    paddingCells = Math.max(0, Math.floor(spanWidth * 0.06)); // 6% padding for larger spans
                  }
                  
                  const textStartIndex = isMultiDay ? Math.max(0, span.startIndex + paddingCells) : span.startIndex;
                  const textEndIndex = isMultiDay ? Math.min(34, span.endIndex - paddingCells) : span.endIndex;
                  const textWidth = Math.max(1, textEndIndex - textStartIndex + 1);
                  
                  // Determine font size based on span width and viewport scale
                  let baseFontSize;
                  if (spanWidth <= 1) {
                    baseFontSize = 10;
                  } else if (spanWidth <= 2) {
                    baseFontSize = 11;
                  } else if (spanWidth <= 4) {
                    baseFontSize = 12;
                  } else {
                    baseFontSize = 13;
                  }
                  const fontSize = `${Math.max(8, Math.min(16, baseFontSize * viewportScale))}px`;
                  
                  // Calculate maximum characters that can fit
                  const maxChars = calculateMaxCharacters(spanWidth, fontSize, span.plan.title, forceUpdate);
                  const displayText = truncateText(span.plan.title, maxChars);
                  
                  return (
                    <div key={`plan-${span.plan.id}`}>
                      {/* Continuous background bar */}
                      <div
                        onClick={(e) => handlePlanClick(e, span.plan)}
                        onContextMenu={(e) => handlePlanColorClick(e, span.plan)}
                        className={`
                          absolute pointer-events-auto cursor-pointer
                          ${colorClasses.bg} ${colorClasses.hover} transition-colors
                          border-2 ${colorClasses.border} rounded-md
                        `}
                        style={{
                          height: `${Math.max(20, 24 * viewportScale)}px`,
                          top: `${Math.max(24, 28 * viewportScale) + span.rowIndex * Math.max(20, 28 * viewportScale)}px`,
                          left: `${100 + span.startIndex * cellWidth}px`,
                          width: `${spanWidth * cellWidth}px`,
                          zIndex: 30
                        }}
                        title={`${span.plan.title} (Right-click to change color)`}
                      />
                      
                      {/* Text overlay */}
                      <div
                        className={`absolute pointer-events-none ${colorClasses.text} leading-tight flex items-center justify-center font-semibold drop-shadow-sm`}
                        style={{
                          height: `${Math.max(20, 24 * viewportScale)}px`,
                          top: `${Math.max(24, 28 * viewportScale) + span.rowIndex * Math.max(20, 28 * viewportScale)}px`,
                          left: `${100 + textStartIndex * cellWidth}px`,
                          width: `${textWidth * cellWidth}px`,
                          zIndex: 35,
                          fontSize: fontSize
                        }}
                      >
                        <span 
                          className="text-center whitespace-nowrap overflow-hidden block"
                          style={{
                            maxWidth: spanWidth <= 2 ? '95%' : '92%',
                            paddingLeft: `${Math.max(1, 3 * viewportScale)}px`,
                            paddingRight: `${Math.max(1, 3 * viewportScale)}px`,
                            boxSizing: 'border-box',
                            textOverflow: 'ellipsis'
                          }}
                          title={span.plan.title}
                        >
                          {displayText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom border for each month except last - span to latest day position */}
              {monthIndex < 11 && (
                <div 
                  className="border-b-2 border-gray-300 my-3"
                  style={{
                    width: `${100 + 35 * cellWidth}px`
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Color Update Modal */}
      {selectedPlanForColor && (
        <ColorUpdateModal
          plan={selectedPlanForColor}
          isOpen={colorUpdateModalOpen}
          onClose={() => {
            setColorUpdateModalOpen(false);
            setSelectedPlanForColor(null);
          }}
          onUpdateColor={handleColorUpdate}
        />
      )}
    </div>
  );
};

export default AnnualCalendar;
