'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { TimeSlotGrid, NextGoalsList, PersonalGoalsList } from '../../components/weekly-design-system';
import { WeeklyDesignSystemDataUI } from './types';
import { Database } from '@/lib/database.types';
import { Inter } from "next/font/google";
import { CalendarRange, Check, X, Loader2, Palette } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useWeeklyDesignSystem } from './services/useWeeklyDesignSystem';
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThemeColor, THEME_COLORS, getThemeConfig } from './utils/themeMapping';

type WeeklyDesignSystemRow = Database['public']['Tables']['weekly_design_system']['Row'];
type WeeklyDesignSystemInsert = Database['public']['Tables']['weekly_design_system']['Insert'];
type WeeklyDesignSystemUpdate = Database['public']['Tables']['weekly_design_system']['Update'];

// Save status types
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const inter = Inter({ subsets: ["latin"] });

const DEFAULT_TIME_SLOTS = [
  { startTime: '5AM', endTime: '6AM' },
  { startTime: '6AM', endTime: '7AM' },
  { startTime: '7AM', endTime: '8AM' },
  { startTime: '8AM', endTime: '9AM' },
  { startTime: '9AM', endTime: '10AM' },
  { startTime: '10AM', endTime: '11AM' },
  { startTime: '11AM', endTime: '12PM' },
  { startTime: '12PM', endTime: '1PM' },
  { startTime: '1PM', endTime: '2PM' },
  { startTime: '2PM', endTime: '3PM' },
  { startTime: '3PM', endTime: '4PM' },
  { startTime: '4PM', endTime: '5PM' },
  { startTime: '5PM', endTime: '6PM' },
  { startTime: '6PM', endTime: '7PM' },
  { startTime: '7PM', endTime: '8PM' },
  { startTime: '8PM', endTime: '9PM' },
  { startTime: '9PM', endTime: '10PM' },
  { startTime: '10PM', endTime: '11PM' }
];

// Helper function to normalize data and ensure consistent types
const normalizeWeeklyData = (data: WeeklyDesignSystemDataUI): WeeklyDesignSystemDataUI => {
  const normalized = { ...data };
  
  // Ensure daily_checklists have consistent boolean values
  if (normalized.daily_checklists) {
    Object.keys(normalized.daily_checklists).forEach(day => {
      const dayData = normalized.daily_checklists[day as keyof typeof normalized.daily_checklists];
      if (dayData) {
        // Ensure boolean fields are actually booleans - using new field names
        const normalizedDayData = {
          ...dayData,
          '20_20_20': typeof dayData['20_20_20'] === 'boolean' ? dayData['20_20_20'] : 
                      Array.isArray(dayData['20_20_20']) ? (dayData['20_20_20'] as any[]).includes('true') : 
                      // Handle migration from old field name
                      (typeof (dayData as any).am_protocol === 'boolean' ? (dayData as any).am_protocol : 
                       Array.isArray((dayData as any).am_protocol) ? ((dayData as any).am_protocol as any[]).includes('true') : false),
          
          '90_90_10': typeof dayData['90_90_10'] === 'boolean' ? dayData['90_90_10'] : 
                      Array.isArray(dayData['90_90_10']) ? (dayData['90_90_10'] as any[]).includes('true') : 
                      // Handle migration from old field name
                      (typeof (dayData as any).daily_goal_setting === 'boolean' ? (dayData as any).daily_goal_setting : 
                       Array.isArray((dayData as any).daily_goal_setting) ? ((dayData as any).daily_goal_setting as any[]).includes('true') : false),
          
          '2WW': typeof dayData['2WW'] === 'boolean' ? dayData['2WW'] : 
                 Array.isArray(dayData['2WW']) ? (dayData['2WW'] as any[]).includes('true') : 
                 // Handle migration from old field name
                 (typeof (dayData as any).peak_diet === 'boolean' ? (dayData as any).peak_diet : 
                  Array.isArray((dayData as any).peak_diet) ? ((dayData as any).peak_diet as any[]).includes('true') : false),
        };
        normalized.daily_checklists[day as keyof typeof normalized.daily_checklists] = normalizedDayData;
      }
    });
  }
  
  return normalized;
};

// Theme Selector Component
const ThemeSelector = ({ currentTheme, onThemeChange }: { currentTheme: ThemeColor; onThemeChange: (theme: ThemeColor) => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-md hover:bg-muted/30 transition-colors min-w-[140px]"
        title="Change theme color"
      >
        <Palette className="w-4 h-4" />
        <div className={`w-4 h-4 rounded-full ${THEME_COLORS[currentTheme].preview}`} />
        <span className="text-sm font-medium">{THEME_COLORS[currentTheme].name}</span>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-background border border-border rounded-md shadow-lg z-50 p-2 min-w-64">
          <div className="text-sm font-medium mb-2 px-2 text-muted-foreground">Choose Theme</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(THEME_COLORS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => {
                  onThemeChange(key as ThemeColor);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors ${
                  currentTheme === key ? 'bg-muted border border-border' : ''
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${config.preview}`} />
                <span className="text-sm">{config.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function WeeklyDesignSystemPage() {
  const [weekStartDate, setWeekStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isComponentLoading, setIsComponentLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string>('');
  const [currentTheme, setCurrentTheme] = useState<ThemeColor>('yellow');
  const [isThemeLoading, setIsThemeLoading] = useState(false);
  const router = useRouter();
  
  // Use refs to store stable references
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const statusTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitializedRef = useRef(false);
  const currentWeekRef = useRef<string>('');
  const lastSavedDataRef = useRef<string>('');
  const userRef = useRef<any>(null);
  const themeInitializedRef = useRef(false);
  
  const { 
    isLoading,
    error,
    createWeeklyDesignSystem,
    getWeeklyDesignSystemByWeek,
    updateWeeklyDesignSystem,
    fetchAllWeeklySystems,
    allWeeklySystems,
    initializeWeeklyData,
    hasShownMigrationToast,
    // Theme preference functions
    getThemePreference,
    saveThemePreference,
    deleteThemePreference
  } = useWeeklyDesignSystem();

  const [weeklyData, setWeeklyData] = useState<WeeklyDesignSystemDataUI>(() => 
    normalizeWeeklyData(initializeWeeklyData(format(weekStartDate, 'yyyy-MM-dd')))
  );

  // Load theme from database with localStorage fallback
  const loadThemePreference = useCallback(async (userId: string) => {
    if (themeInitializedRef.current) return;
    
    try {
      setIsThemeLoading(true);
      
      // Try to get theme from database first
      const dbTheme = await getThemePreference(userId);
      
      if (dbTheme) {
        // Use database theme
        setCurrentTheme(dbTheme);
        // Also update localStorage for offline fallback
        localStorage.setItem('wds-theme', dbTheme);
        console.log(`🎨 Loaded theme from database: ${THEME_COLORS[dbTheme].name}`);
      } else {
        // Fall back to localStorage if no database preference
        const savedTheme = localStorage.getItem('wds-theme') as ThemeColor;
        if (savedTheme && THEME_COLORS[savedTheme]) {
          setCurrentTheme(savedTheme);
          // Save the localStorage theme to database for future cross-device sync
          await saveThemePreference(userId, savedTheme);
          console.log(`🎨 Migrated theme from localStorage to database: ${THEME_COLORS[savedTheme].name}`);
        } else {
          // Use default theme and save to database
          await saveThemePreference(userId, 'yellow');
          console.log(`🎨 Initialized default theme: ${THEME_COLORS.yellow.name}`);
        }
      }
      
      themeInitializedRef.current = true;
    } catch (error) {
      console.error('Failed to load theme preference:', error);
      // Fall back to localStorage on error
      const savedTheme = localStorage.getItem('wds-theme') as ThemeColor;
      if (savedTheme && THEME_COLORS[savedTheme]) {
        setCurrentTheme(savedTheme);
      }
    } finally {
      setIsThemeLoading(false);
    }
  }, [getThemePreference, saveThemePreference]);

  // Save theme to database with localStorage backup
  const handleThemeChange = useCallback(async (theme: ThemeColor) => {
    const currentUser = userRef.current;
    if (!currentUser) {
      console.error('No user found for theme change');
      return;
    }

    setCurrentTheme(theme);
    
    // Update localStorage immediately for instant feedback
    localStorage.setItem('wds-theme', theme);
    
    try {
      // Save to database for cross-device sync
      const success = await saveThemePreference(currentUser.id, theme);
      
      if (success) {
        toast.success(`🎨 Theme changed to ${THEME_COLORS[theme].name}`, {
          description: "Synced across all your devices",
          duration: 2000,
        });
      } else {
        toast.error(`Failed to sync theme preference`, {
          description: "Theme saved locally only",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to save theme preference:', error);
      toast.error(`Failed to sync theme preference`, {
        description: "Theme saved locally only",
        duration: 3000,
      });
    }
  }, [saveThemePreference]);

  // Get current theme classes
  const getThemeClasses = useCallback(() => {
    const theme = THEME_COLORS[currentTheme];
    return {
      header: `${theme.light} ${theme.dark}`,
      accent: theme.accent,
    };
  }, [currentTheme]);

  // Store service functions in refs to prevent recreation
  const serviceRefs = useRef({
    createWeeklyDesignSystem,
    getWeeklyDesignSystemByWeek,
    updateWeeklyDesignSystem,
    fetchAllWeeklySystems,
    initializeWeeklyData
  });

  // Update service refs when they change
  useEffect(() => {
    serviceRefs.current = {
      createWeeklyDesignSystem,
      getWeeklyDesignSystemByWeek,
      updateWeeklyDesignSystem,
      fetchAllWeeklySystems,
      initializeWeeklyData
    };
  }, [createWeeklyDesignSystem, getWeeklyDesignSystemByWeek, updateWeeklyDesignSystem, fetchAllWeeklySystems, initializeWeeklyData]);

  // Update user ref when user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Completely stable autosave function
  const performSave = useCallback(async (dataToSave: WeeklyDesignSystemDataUI) => {
    const currentUser = userRef.current;
    if (!currentUser) {
      console.error('No user found');
      setSaveStatus('error');
      setSaveError('No user found');
      return;
    }

    // Avoid saving if data hasn't actually changed
    const dataString = JSON.stringify(dataToSave);
    if (lastSavedDataRef.current === dataString) {
      return;
    }

    // Set saving status
    setSaveStatus('saving');
    setSaveError('');

    try {
      let result;
      if (dataToSave.id) {
        result = await serviceRefs.current.updateWeeklyDesignSystem(dataToSave.id, dataToSave, currentUser.id);
      } else {
        result = await serviceRefs.current.createWeeklyDesignSystem(dataToSave, currentUser.id);
      }
      
      // Normalize the result to ensure consistent data types
      const normalizedResult = normalizeWeeklyData(result);
      
      // Only update state if this is a new record (has no previous ID)
      if (!dataToSave.id && normalizedResult.id) {
        setWeeklyData(prev => ({ ...prev, id: normalizedResult.id }));
      }
      
      lastSavedDataRef.current = JSON.stringify(normalizedResult);
      
      // Set saved status
      setSaveStatus('saved');
      
      // Clear the saved status after 3 seconds
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      statusTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
      
    } catch (error) {
      console.error('Failed to autosave weekly design system:', error);
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
      
      // Clear error status after 5 seconds
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      statusTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
        setSaveError('');
      }, 5000);
    }
  }, []);

  // Completely stable debounced save function
  const debouncedSave = useCallback((dataToSave: WeeklyDesignSystemDataUI) => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      performSave(dataToSave);
    }, 500); // 0.5 second for better UX
  }, [performSave]);

  // Stable function to load week data
  const loadWeekData = useCallback(async (weekStart: Date, userId: string) => {
    const weekId = format(weekStart, 'yyyy-MM-dd');
    
    // Avoid loading the same week multiple times
    if (currentWeekRef.current === weekId) {
      return;
    }
    
    const isWeekChange = currentWeekRef.current !== '' && currentWeekRef.current !== weekId;
    currentWeekRef.current = weekId;
    
    try {
      const data = await serviceRefs.current.getWeeklyDesignSystemByWeek(weekId, userId);
      
      if (data) {
        // Normalize data to ensure consistent types
        const normalizedData = normalizeWeeklyData(data);
        
        // Debug: Log checkbox values to help diagnose the issue
        if (process.env.NODE_ENV === 'development') {
          console.log('📋 Loaded weekly data for', weekId);
          console.log('Sunday checkboxes:', normalizedData.daily_checklists?.Sunday);
          console.log('Monday checkboxes:', normalizedData.daily_checklists?.Monday);
        }
        setWeeklyData(normalizedData);
        lastSavedDataRef.current = JSON.stringify(normalizedData);
        
        // Dismiss the loading toast for existing data
        if (isWeekChange) {
          toast.dismiss();
        }
      } else {
        const newData = normalizeWeeklyData(serviceRefs.current.initializeWeeklyData(weekId));
        // Debug: Log initial data
        if (process.env.NODE_ENV === 'development') {
          console.log('🆕 Created new weekly data for', weekId);
          console.log('Sunday checkboxes (new):', newData.daily_checklists?.Sunday);
          console.log('Monday checkboxes (new):', newData.daily_checklists?.Monday);
        }
        setWeeklyData(newData);
        // Don't auto-create here, let it happen on first save
        
        // Show info toast for new week (but not on initial load)
        if (isWeekChange) {
          // Dismiss the loading toast and show the final result
          toast.dismiss();
          setTimeout(() => {
            toast.info("📝 New week started!", {
              description: "Ready to plan your weekly design system",
              duration: 2000,
            });
          }, 100);
        }
      }
    } catch (error) {
      console.error('Failed to load weekly design system:', error);
      const fallbackData = normalizeWeeklyData(serviceRefs.current.initializeWeeklyData(weekId));
      setWeeklyData(fallbackData);
    }
  }, []);

  // Initialize once
  useEffect(() => {
    const initialize = async () => {
      if (isInitializedRef.current) return;
      
      setIsComponentLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) {
          router.push("/login");
          return;
        }
        setUser(authData.user);

        // Load theme preference from database
        await loadThemePreference(authData.user.id);

        // First fetch all weekly systems
        await serviceRefs.current.fetchAllWeeklySystems(authData.user.id);

        // Load the current week's data
        await loadWeekData(weekStartDate, authData.user.id);
        
        isInitializedRef.current = true;
        setIsComponentLoading(false);
      } catch (error) {
        console.error('Failed to initialize weekly design system:', error);
        setWeeklyData(normalizeWeeklyData(serviceRefs.current.initializeWeeklyData(format(weekStartDate, 'yyyy-MM-dd'))));
        isInitializedRef.current = true;
        setIsComponentLoading(false);
      }
    };

    initialize();
  }, [loadThemePreference]);

  // Load data when week changes (but only after initialization)
  useEffect(() => {
    if (!userRef.current || !isInitializedRef.current) return;
    loadWeekData(weekStartDate, userRef.current.id);
  }, [weekStartDate, loadWeekData]);

  // Migration detection (removed toast notification)
  useEffect(() => {
    if (hasShownMigrationToast) {
      // Migration detected - could add console log if needed for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log("Legacy data detected and automatically updated");
      }
    }
  }, [hasShownMigrationToast]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const handleDateChange = useCallback((date: Date | null) => {
    if (date) {
      const newWeekStart = startOfWeek(date, { weekStartsOn: 0 });
      const oldWeekStart = weekStartDate;
      
      // Only show initial toast if the week actually changed
      if (newWeekStart.getTime() !== oldWeekStart.getTime()) {
        const weekRange = formatDateRange(newWeekStart);
        toast.info(`📅 Switched to week: ${weekRange}`, {
          description: "Loading data for this week...",
          duration: 2500,
        });
      }
      
      setWeekStartDate(newWeekStart);
      setShowDatePicker(false);
    }
  }, [weekStartDate]);

  const handleDataChange = useCallback((newData: Partial<WeeklyDesignSystemDataUI>) => {
    if (!userRef.current) {
      console.error('No user found');
      return;
    }

    setWeeklyData(prevData => {
      const updatedData = {
        ...prevData,
        ...newData,
      };
      
      // Normalize the data to ensure consistent types
      const normalizedData = normalizeWeeklyData(updatedData);
      
      // Debug: Log checkbox changes  
      if (process.env.NODE_ENV === 'development' && newData.daily_checklists) {
        Object.keys(newData.daily_checklists).forEach(day => {
          const dayData = newData.daily_checklists![day as keyof typeof newData.daily_checklists];
          if (dayData && (dayData['20_20_20'] !== undefined || dayData['90_90_10'] !== undefined || dayData['2WW'] !== undefined)) {
            console.log(`📝 Checkbox change for ${day}:`, {
              '20_20_20': dayData['20_20_20'],
              '90_90_10': dayData['90_90_10'],
              '2WW': dayData['2WW']
            });
          }
        });
      }
      
      // Trigger autosave with the normalized data
      debouncedSave(normalizedData);
      
      return normalizedData;
    });
  }, [debouncedSave]);

  // Save Status Indicator Component
  const SaveStatusIndicator = () => {
    if (saveStatus === 'idle') return null;
    
    return (
      <div className="flex items-center gap-2 text-sm">
        {saveStatus === 'saving' && (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-blue-600">Saving...</span>
          </>
        )}
        {saveStatus === 'saved' && (
          <>
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-green-600">Saved</span>
          </>
        )}
        {saveStatus === 'error' && (
          <>
            <X className="w-4 h-4 text-red-500" />
            <span className="text-red-600">Error: {saveError}</span>
          </>
        )}
      </div>
    );
  };

  // Use component loading state instead of service loading state
  if (!user || isComponentLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const themeClasses = getThemeClasses();

  return (
    <div className="w-full max-w-full p-4 bg-white dark:bg-gray-900 overflow-x-hidden">
      <h1 className={`text-2xl font-bold text-center ${themeClasses.header} ${themeClasses.accent} py-2 mb-4 rounded-md`}>
        THE WEEKLY DESIGN SYSTEM (WDS)
      </h1>
      
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <label className="font-normal text-foreground mr-2">WEEK OF:</label>
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="bg-transparent border-b border-border focus:outline-none px-2 py-1 text-foreground cursor-pointer hover:bg-muted/30 rounded flex items-center"
              >
                {formatDateRange(weekStartDate)}
                <CalendarRange className="ml-2 h-4 w-4" />
              </button>
              {showDatePicker && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-md shadow-lg">
                  <DatePicker
                    selected={weekStartDate}
                    onChange={handleDateChange}
                    inline
                    calendarClassName="border-none"
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Theme Selector */}
          {isThemeLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-md min-w-[140px]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading theme...</span>
            </div>
          ) : (
            <ThemeSelector currentTheme={currentTheme} onThemeChange={handleThemeChange} />
          )}
        </div>
        
        {/* Save Status Indicator */}
        <SaveStatusIndicator />
      </div>

      <div className="mb-4 w-full flex gap-4">
        <PersonalGoalsList
          personalGoals={weeklyData.personal_goals || [{ goal: "" }, { goal: "" }, { goal: "" }]}
          onChange={(personalGoals) => handleDataChange({ personal_goals: personalGoals })}
          isEditing={true}
          themeClasses={themeClasses}
        />
        <NextGoalsList
          nextGoals={weeklyData.next_goals || [{ goal: "" }, { goal: "" }, { goal: "" }]}
          onChange={(nextGoals) => handleDataChange({ next_goals: nextGoals })}
          isEditing={true}
          themeClasses={themeClasses}
        />
      </div>

      <TimeSlotGrid
        timeSlots={DEFAULT_TIME_SLOTS}
        weeklyData={weeklyData}
        onDataChange={handleDataChange}
        weekStartDate={weekStartDate}
        themeClasses={themeClasses}
      />
    </div>
  );
}

function formatDateRange(date: Date): string {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
  return `${format(weekStart, 'MMMM d')} - ${format(weekEnd, 'MMMM d, yyyy')}`;
} 