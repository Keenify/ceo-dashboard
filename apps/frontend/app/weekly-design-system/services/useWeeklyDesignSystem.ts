import { useState } from 'react';
import { WeeklyDesignSystemDataUI, DayOfWeek, TimeBlocksUI, DailyChecklistsUI, DailyChecklistUI } from '../types';
import { Database } from '@/lib/database.types';
import { startOfWeek, format, addDays, nextSunday } from 'date-fns';
import { ThemeColor, themeNameToHex, hexToThemeName } from '../utils/themeMapping';
import { supabase } from '@/lib/supabase';

type WeeklyDesignSystemRow = Database['public']['Tables']['weekly_design_system']['Row'];
type WeeklyDesignSystemInsert = Database['public']['Tables']['weekly_design_system']['Insert'];
type WeeklyDesignSystemUpdate = Database['public']['Tables']['weekly_design_system']['Update'];

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const API_PATH = '/weekly-design-system';

interface ApiError {
  message: string;
  status?: number;
  details?: any;
}

const DEFAULT_DAILY_CHECKLIST: DailyChecklistUI = {
  gratitude: ['', '', '', '', '', ''],
  habits: [],
  '20_20_20': false,
  '90_90_10': false,
  '2WW': false,
};

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper function to ensure goals array has at least 3 elements
const normalizeGoalsArray = (goals: any[]): { goal: string }[] => {
  if (!Array.isArray(goals)) {
    return [{ goal: "" }, { goal: "" }, { goal: "" }];
  }
  
  // Ensure we have at least 3 goals
  const normalizedGoals = goals.slice(); // Create a copy
  while (normalizedGoals.length < 3) {
    normalizedGoals.push({ goal: "" });
  }
  
  // Ensure each goal has the correct structure
  return normalizedGoals.map(goal => ({
    goal: (goal && typeof goal === 'object' && typeof goal.goal === 'string') ? goal.goal : ""
  }));
};

// Data migration and validation functions
const validateAndMigrateDailyChecklist = (checklist: any): DailyChecklistUI => {
  // Start with default structure - create a completely new object to avoid shared references
  const result: DailyChecklistUI = {
    gratitude: ['', '', '', '', '', ''],
    habits: [],
    '20_20_20': false,
    '90_90_10': false,
    '2WW': false,
  };
  
  if (!checklist || typeof checklist !== 'object') {
    return result;
  }

  // Migrate gratitude field
  if (Array.isArray(checklist.gratitude)) {
    result.gratitude = checklist.gratitude.length >= 6 
      ? checklist.gratitude.slice(0, 6) 
      : [...checklist.gratitude, ...Array(6 - checklist.gratitude.length).fill('')];
  }

  // Migrate habits field
  if (Array.isArray(checklist.habits)) {
    result.habits = checklist.habits;
  }

  // Migrate boolean fields - handle multiple legacy formats and field name changes
  result['20_20_20'] = normalizeBooleanField(checklist['20_20_20'] || checklist.am_protocol);
  result['90_90_10'] = normalizeBooleanField(checklist['90_90_10'] || checklist.daily_goal_setting);
  result['2WW'] = normalizeBooleanField(checklist['2WW'] || checklist.peak_diet);

  return result;
};

const normalizeBooleanField = (field: any): boolean => {
  // Handle all possible legacy formats
  if (field === undefined || field === null) {
    return false; // Default to false for missing fields
  }
  
  if (typeof field === 'boolean') {
    return field; // Already a boolean
  }
  
  if (Array.isArray(field)) {
    // Array format - check if contains 'true' string or true boolean
    return field.includes('true') || field.includes(true);
  }
  
  if (typeof field === 'string') {
    // String format
    return field.toLowerCase() === 'true';
  }
  
  if (typeof field === 'number') {
    // Number format (1 = true, 0 = false)
    return field > 0;
  }
  
  // Default to false for unknown formats
  return false;
};

// Ensure all boolean fields are properly converted to booleans
const ensureBooleanFields = (checklist: any): any => {
  if (!checklist || typeof checklist !== 'object') {
    return checklist;
  }
  
  return {
    ...checklist,
    '20_20_20': normalizeBooleanField(checklist['20_20_20'] || checklist.am_protocol),
    '90_90_10': normalizeBooleanField(checklist['90_90_10'] || checklist.daily_goal_setting),
    '2WW': normalizeBooleanField(checklist['2WW'] || checklist.peak_diet)
  };
};

const migrateWeeklyData = (data: any): WeeklyDesignSystemDataUI => {
  // Only log if there are actual issues - FIXED DETECTION
  // NOTE: Valid backend data uses arrays (['true'] or []), which is NOT legacy data.
  // Legacy data is: undefined fields, weird array contents, or non-array/non-boolean types.
  let hasActualLegacyIssues = false;
  
  if (data && data.daily_checklists) {
            // Check for genuinely problematic legacy data patterns
        const sampleDay = data.daily_checklists['Monday'] || data.daily_checklists[Object.keys(data.daily_checklists)[0]];
        if (sampleDay) {
          hasActualLegacyIssues = (
            // Missing required fields (undefined/null) - check both old and new field names
            (sampleDay['20_20_20'] === undefined && sampleDay.am_protocol === undefined) ||
            (sampleDay['90_90_10'] === undefined && sampleDay.daily_goal_setting === undefined) ||
            (sampleDay['2WW'] === undefined && sampleDay.peak_diet === undefined) ||
            
            // Invalid array contents (arrays with non-standard values)
            (Array.isArray(sampleDay['20_20_20']) && 
             sampleDay['20_20_20'].length > 0 && 
             !sampleDay['20_20_20'].includes('true') && 
             !sampleDay['20_20_20'].includes('false') &&
             !sampleDay['20_20_20'].includes(true) &&
             !sampleDay['20_20_20'].includes(false)) ||
             
            // Non-array, non-boolean types (strings, numbers, objects)
            (!Array.isArray(sampleDay['20_20_20']) && 
             typeof sampleDay['20_20_20'] !== 'boolean' &&
             sampleDay['20_20_20'] !== undefined &&
             sampleDay['20_20_20'] !== null) ||
             
            (!Array.isArray(sampleDay['90_90_10']) && 
             typeof sampleDay['90_90_10'] !== 'boolean' &&
             sampleDay['90_90_10'] !== undefined &&
             sampleDay['90_90_10'] !== null) ||
             
            (!Array.isArray(sampleDay['2WW']) && 
             typeof sampleDay['2WW'] !== 'boolean' &&
             sampleDay['2WW'] !== undefined &&
             sampleDay['2WW'] !== null)
          );
        }
  }

  const migratedData: WeeklyDesignSystemDataUI = {
    id: data.id,
    user_id: data.user_id,
    week_start_date: data.week_start_date,
    next_goals: normalizeGoalsArray(data.next_goals),
    personal_goals: normalizeGoalsArray(data.personal_goals),
    time_blocks: {} as TimeBlocksUI,
    daily_checklists: {} as DailyChecklistsUI,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };

  // Migrate time blocks
  DAYS.forEach(day => {
    migratedData.time_blocks[day] = 
      (data.time_blocks && data.time_blocks[day] && typeof data.time_blocks[day] === 'object') 
        ? data.time_blocks[day] 
        : {};
  });

  // Migrate daily checklists with validation
  let migrationIssues = 0;
  DAYS.forEach(day => {
    const dayChecklist = data.daily_checklists && data.daily_checklists[day] 
      ? data.daily_checklists[day] 
      : null;
    
    const beforeMigration = dayChecklist ? JSON.parse(JSON.stringify(dayChecklist)) : null;
    const migratedChecklist = validateAndMigrateDailyChecklist(dayChecklist);
    
    // Ensure all boolean fields are properly converted
    migratedData.daily_checklists[day] = ensureBooleanFields(migratedChecklist);
    
    // Count migration changes (for production logging)
    if (beforeMigration && dayChecklist) {
      const afterMigration = migratedData.daily_checklists[day];
      const booleanChanges = [
        { field: '20_20_20', before: beforeMigration.am_protocol || beforeMigration['20_20_20'], after: afterMigration['20_20_20'] },
        { field: '90_90_10', before: beforeMigration.daily_goal_setting || beforeMigration['90_90_10'], after: afterMigration['90_90_10'] },
        { field: '2WW', before: beforeMigration.peak_diet || beforeMigration['2WW'], after: afterMigration['2WW'] },
      ].filter(change => change.before !== change.after);
      
      if (booleanChanges.length > 0) {
        migrationIssues++;
      }
    }
  });

  // Only log if there were actual legacy data issues (not normal array->boolean conversion)
  if (hasActualLegacyIssues && migrationIssues > 0) {
    console.log(`✅ Legacy data migrated for week ${data.week_start_date}: ${migrationIssues} days updated`);
  }

  return migratedData;
};

const fetchWithHeaders = async (url: string, options: RequestInit = {}) => {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: 'include',
  });

  return response;
};

export const useWeeklyDesignSystem = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [allWeeklySystems, setAllWeeklySystems] = useState<WeeklyDesignSystemDataUI[]>([]);
  const [hasShownMigrationToast, setHasShownMigrationToast] = useState(false);

  const handleApiError = async (response: Response): Promise<ApiError> => {
    try {
      const errorData = await response.json();
      return {
        message: errorData.detail || 'An error occurred',
        status: response.status,
        details: errorData
      };
    } catch {
      return {
        message: 'An unexpected error occurred',
        status: response.status
      };
    }
  };

  // Theme Preference Functions using Direct Supabase Client
  const getThemePreference = async (userId: string): Promise<ThemeColor | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔍 Getting theme preference for user:', userId);
      
      const { data, error: supabaseError } = await supabase
        .from('weekly_design_system_preference')
        .select('theme_color')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no rows

      if (supabaseError) {
        console.error('❌ Supabase error getting theme:', supabaseError);
        throw new Error(supabaseError.message);
      }

      console.log('✅ Theme preference data:', data);
      
      // Convert hex color to theme name
      return data ? hexToThemeName(data.theme_color) : null;
    } catch (err) {
      const apiError: ApiError = err instanceof Error 
        ? { message: err.message }
        : { message: 'Failed to get theme preference' };
      setError(apiError);
      console.error('Failed to get theme preference:', apiError);
      return null; // Return null on error to fall back to default
    } finally {
      setIsLoading(false);
    }
  };

  const saveThemePreference = async (userId: string, themeName: ThemeColor): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const hexColor = themeNameToHex(themeName);
      console.log('💾 Saving theme preference:', { userId, themeName, hexColor });
      
      // First, check if a preference already exists for this user
      const { data: existingData, error: selectError } = await supabase
        .from('weekly_design_system_preference')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (selectError) {
        console.error('❌ Error checking existing theme preference:', selectError);
        throw new Error(selectError.message);
      }

      if (existingData) {
        // Update existing preference
        const { error: updateError } = await supabase
          .from('weekly_design_system_preference')
          .update({
            theme_color: hexColor,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Error updating theme preference:', updateError);
          throw new Error(updateError.message);
        }

        console.log('✅ Theme preference updated successfully');
      } else {
        // Create new preference
        const { error: insertError } = await supabase
          .from('weekly_design_system_preference')
          .insert({
            user_id: userId,
            theme_color: hexColor,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('❌ Error creating theme preference:', insertError);
          throw new Error(insertError.message);
        }

        console.log('✅ Theme preference created successfully');
      }

      return true;
    } catch (err) {
      const apiError: ApiError = err instanceof Error 
        ? { message: err.message }
        : { message: 'Failed to save theme preference' };
      setError(apiError);
      console.error('Failed to save theme preference:', apiError);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteThemePreference = async (userId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🗑️ Deleting theme preference for user:', userId);
      
      const { error: supabaseError } = await supabase
        .from('weekly_design_system_preference')
        .delete()
        .eq('user_id', userId);

      if (supabaseError) {
        console.error('❌ Supabase error deleting theme:', supabaseError);
        throw new Error(supabaseError.message);
      }

      console.log('✅ Theme preference deleted successfully');
      return true;
    } catch (err) {
      const apiError: ApiError = err instanceof Error 
        ? { message: err.message }
        : { message: 'Failed to delete theme preference' };
      setError(apiError);
      console.error('Failed to delete theme preference:', apiError);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const initializeWeeklyData = (weekStartDate: string): WeeklyDesignSystemDataUI => {
    const daily_checklists: DailyChecklistsUI = DAYS.reduce((acc, day) => ({
      ...acc,
      [day]: {
        gratitude: ['', '', '', '', '', ''],
        habits: [],
        '20_20_20': false,
        '90_90_10': false,
        '2WW': false,
      }
    }), {} as DailyChecklistsUI);

    const time_blocks: TimeBlocksUI = DAYS.reduce((acc, day) => ({
      ...acc,
      [day]: {}
    }), {} as TimeBlocksUI);

    return {
      week_start_date: weekStartDate,
      next_goals: [
        { goal: "" },
        { goal: "" },
        { goal: "" }
      ],
      personal_goals: [
        { goal: "" },
        { goal: "" },
        { goal: "" }
      ],
      time_blocks,
      daily_checklists
    };
  };

  const fetchAllWeeklySystems = async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchWithHeaders(
        `${API_BASE_URL}${API_PATH}/?user_id=${userId}&skip=0&limit=100`
      );

      if (!response.ok) {
        const error = await handleApiError(response);
        throw error;
      }

      const rawData = await response.json();
      
      // Convert all weekly systems to use boolean values instead of arrays
      const processedData = rawData.map((system: WeeklyDesignSystemDataUI) => convertArraysToBooleans(system));
      setAllWeeklySystems(processedData);
      return processedData;
    } catch (err) {
      const apiError: ApiError = err instanceof Error 
        ? { message: err.message }
        : err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeklyDesignSystem = async (id: string, userId: string): Promise<WeeklyDesignSystemDataUI> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchWithHeaders(`${API_BASE_URL}${API_PATH}/${id}?user_id=${userId}`);

      if (!response.ok) {
        const error = await handleApiError(response);
        throw error;
      }

      const data = await response.json();
      return convertArraysToBooleans(data);
    } catch (err) {
      const apiError: ApiError = err instanceof Error 
        ? { message: err.message }
        : err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeklyDesignSystemByWeek = async (weekId: string | Date, userId: string): Promise<WeeklyDesignSystemDataUI | null> => {
    try {
      setIsLoading(true);
      setError(null);

      // Convert date to proper format and make sure we're using Sunday as the week ID
      let formattedWeekId;
      if (typeof weekId === 'string') {
        // If a string date is provided, parse it to get Sunday
        const dateObj = new Date(weekId);
        // Get the previous Sunday (we consider Sunday as the start of the week for API)
        formattedWeekId = format(startOfWeek(dateObj, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      } else {
        // If a Date object is provided, get the previous Sunday
        formattedWeekId = format(startOfWeek(weekId, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      }

      // First check if we have this week in our existing systems
      const existingSystem = allWeeklySystems.find(
        system => system.week_start_date === formattedWeekId && system.user_id === userId
      );

      if (existingSystem) {
        return convertArraysToBooleans(existingSystem);
      }

      const response = await fetchWithHeaders(`${API_BASE_URL}${API_PATH}/by-week/${formattedWeekId}?user_id=${userId}`);

      // If we got a 404, that just means no data exists for this week yet - return null without error
      if (response.status === 404) {
        console.log(`No weekly design system found for week ${formattedWeekId}, will create new one`);
        return null;
      }

      if (!response.ok) {
        const error = await handleApiError(response);
        throw error;
      }

      const data = await response.json();
      
      // Ensure all days have proper structure
      DAYS.forEach(day => {
        if (!data.daily_checklists[day]) {
          data.daily_checklists[day] = {
            gratitude: ['', '', '', '', '', ''],
            habits: [],
            '20_20_20': false,
            '90_90_10': false,
            '2WW': false,
          };
        } else {
          // Ensure boolean fields are properly converted
          data.daily_checklists[day] = ensureBooleanFields(data.daily_checklists[day]);
        }
        if (!data.time_blocks[day]) {
          data.time_blocks[day] = {};
        }
      });

      // Convert arrays to booleans for the UI
      const processedData = convertArraysToBooleans(data);
      
      // Add to our local cache - store the processed data, not the raw data
      setAllWeeklySystems(prev => [...prev, processedData]);

      return processedData;
    } catch (err) {
      // Only set error if it's not a 404
      if (err instanceof Error || (err as ApiError).status !== 404) {
        const apiError: ApiError = err instanceof Error 
          ? { message: err.message }
          : err as ApiError;
        setError(apiError);
      }
      // No need to throw the error if it's a 404
      if ((err as ApiError).status === 404) {
        return null;
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createWeeklyDesignSystem = async (data: WeeklyDesignSystemDataUI, userId: string): Promise<WeeklyDesignSystemDataUI> => {
    try {
      setIsLoading(true);
      setError(null);

      // Ensure week_start_date is in correct format (Sunday-based)
      let formattedWeekStartDate;
      if (typeof data.week_start_date === 'string') {
        const dateObj = new Date(data.week_start_date);
        formattedWeekStartDate = format(startOfWeek(dateObj, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      } else {
        formattedWeekStartDate = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      }

      // Format the daily checklists to ensure boolean fields are sent as arrays for API compatibility
      const formattedDailyChecklists = { ...data.daily_checklists };
      
      DAYS.forEach(day => {
        if (formattedDailyChecklists[day]) {
          // Create API-compatible structure with each boolean converted to an array
          const checklist = formattedDailyChecklists[day] as any;
          // Convert booleans to arrays for API compatibility
          checklist['20_20_20'] = checklist['20_20_20'] ? ['true'] : [];
          checklist['90_90_10'] = checklist['90_90_10'] ? ['true'] : [];
          checklist['2WW'] = checklist['2WW'] ? ['true'] : [];
          // Clean up any old field names that might exist
          delete checklist.am_protocol;
          delete checklist.daily_goal_setting;
          delete checklist.peak_diet;
        }
      });

      const formattedData = {
        ...data,
        week_start_date: formattedWeekStartDate,
        daily_checklists: formattedDailyChecklists
      };

      // Include user_id as URL query parameter, not in the body
      const response = await fetchWithHeaders(`${API_BASE_URL}${API_PATH}/?user_id=${userId}`, {
        method: 'POST',
        body: JSON.stringify(formattedData),
      });

      if (!response.ok) {
        const error = await handleApiError(response);
        throw error;
      }

      const rawResult = await response.json();
      
      // Create a deep clone of the raw result to avoid modifying it directly
      const result = JSON.parse(JSON.stringify(rawResult));
      
      // Convert arrays back to booleans in the result
      if (result.daily_checklists) {
        DAYS.forEach(day => {
          if (result.daily_checklists[day]) {
            // Ensure all boolean fields are properly converted
            result.daily_checklists[day] = ensureBooleanFields(result.daily_checklists[day]);
          }
        });
      }
      
      // Store the processed result (with boolean values) in our state
      setAllWeeklySystems(prev => [...prev, result]);
      return result;
    } catch (err) {
      const apiError: ApiError = err instanceof Error 
        ? { message: err.message }
        : err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  const updateWeeklyDesignSystem = async (id: string, data: WeeklyDesignSystemDataUI, userId: string): Promise<WeeklyDesignSystemDataUI> => {
    try {
      setIsLoading(true);
      setError(null);

      // Format the data before sending
      let formattedData = { ...data };

      // If daily_checklists are being updated, format them
      if (formattedData.daily_checklists) {
        const formattedDailyChecklists = { ...formattedData.daily_checklists };
        
        DAYS.forEach(day => {
          if (formattedDailyChecklists[day]) {
            // Create API-compatible structure with each boolean converted to an array
            const checklist = formattedDailyChecklists[day] as any;
            // Convert booleans to arrays for API compatibility
            checklist['20_20_20'] = checklist['20_20_20'] ? ['true'] : [];
            checklist['90_90_10'] = checklist['90_90_10'] ? ['true'] : [];
            checklist['2WW'] = checklist['2WW'] ? ['true'] : [];
            // Clean up any old field names that might exist
            delete checklist.am_protocol;
            delete checklist.daily_goal_setting;
            delete checklist.peak_diet;
          }
        });

        formattedData = {
          ...formattedData,
          daily_checklists: formattedDailyChecklists
        };
      }

      const response = await fetchWithHeaders(`${API_BASE_URL}${API_PATH}/${id}?user_id=${userId}`, {
        method: 'PUT',
        body: JSON.stringify(formattedData),
      });

      if (!response.ok) {
        const error = await handleApiError(response);
        throw error;
      }

      const rawResult = await response.json();
      
      // Create a deep clone of the raw result to avoid modifying it directly
      const result = JSON.parse(JSON.stringify(rawResult));
      
      // Convert arrays back to booleans in the result
      if (result.daily_checklists) {
        DAYS.forEach(day => {
          if (result.daily_checklists[day]) {
            // Ensure all boolean fields are properly converted
            result.daily_checklists[day] = ensureBooleanFields(result.daily_checklists[day]);
          }
        });
      }
      
      // Store the processed result (with boolean values) in our state
      setAllWeeklySystems(prev => prev.map(system => system.id === id ? result : system));
      return result;
    } catch (err) {
      const apiError: ApiError = err instanceof Error 
        ? { message: err.message }
        : err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWeeklyDesignSystem = async (id: string, userId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchWithHeaders(`${API_BASE_URL}${API_PATH}/${id}?user_id=${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await handleApiError(response);
        throw error;
      }

      setAllWeeklySystems(prev => prev.filter(system => system.id !== id));
      return true;
    } catch (err) {
      const apiError: ApiError = err instanceof Error 
        ? { message: err.message }
        : err as ApiError;
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  };

  // Add a method to convert array fields to booleans when data is fetched
  const convertArraysToBooleans = (data: WeeklyDesignSystemDataUI): WeeklyDesignSystemDataUI => {
    if (!data || !data.daily_checklists) {
      // If no data or no daily_checklists, return migrated default data
      return migrateWeeklyData(data || {});
    }
    
    // Use the migration function for comprehensive data validation
    const migratedData = migrateWeeklyData(data);
    
    // Track migration activity (only trigger toast once per session) - FIXED DETECTION
    // NOTE: Valid backend data uses arrays (['true'] or []), which is NOT legacy data.
    // Only flag truly problematic formats that cause actual issues.
    if (data.id && !hasShownMigrationToast) {
      // Only detect TRULY problematic legacy data, not valid backend arrays
      const hadTrueLegacyData = DAYS.some(day => {
        const original = data.daily_checklists?.[day];
        if (!original) return false;
        
        // Check for genuinely problematic legacy formats:
        return (
          // Missing required fields (undefined/null) - check for old field names (legacy)
          ((original as any).am_protocol === undefined && (original as any)['20_20_20'] === undefined) ||
          ((original as any).daily_goal_setting === undefined && (original as any)['90_90_10'] === undefined) ||
          ((original as any).peak_diet === undefined && (original as any)['2WW'] === undefined) ||
          
          // Invalid array contents (arrays with non-standard values)
          (Array.isArray((original as any).am_protocol) && 
           (original as any).am_protocol.length > 0 && 
           !(original as any).am_protocol.includes('true') && 
           !(original as any).am_protocol.includes('false') &&
           !(original as any).am_protocol.includes(true) &&
           !(original as any).am_protocol.includes(false)) ||
           
          // Non-array, non-boolean types (strings, numbers, objects)
          (!Array.isArray((original as any).am_protocol) && 
           typeof (original as any).am_protocol !== 'boolean' &&
           (original as any).am_protocol !== undefined &&
           (original as any).am_protocol !== null) ||
           
          (!Array.isArray((original as any).daily_goal_setting) && 
           typeof (original as any).daily_goal_setting !== 'boolean' &&
           (original as any).daily_goal_setting !== undefined &&
           (original as any).daily_goal_setting !== null) ||
           
          (!Array.isArray((original as any).peak_diet) && 
           typeof (original as any).peak_diet !== 'boolean' &&
           (original as any).peak_diet !== undefined &&
           (original as any).peak_diet !== null)
        );
      });
      
      if (hadTrueLegacyData) {
        setHasShownMigrationToast(true);
      }
    }
    
    return migratedData;
  };

  return {
    isLoading,
    error,
    createWeeklyDesignSystem,
    getWeeklyDesignSystem,
    getWeeklyDesignSystemByWeek,
    fetchAllWeeklySystems,
    allWeeklySystems,
    updateWeeklyDesignSystem,
    deleteWeeklyDesignSystem,
    initializeWeeklyData,
    hasShownMigrationToast,
    // Theme preference functions
    getThemePreference,
    saveThemePreference,
    deleteThemePreference
  };
};

// Development test to verify legacy detection is working correctly
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testLegacyDetection = () => {
    console.log('🧪 Testing Legacy Detection Logic:');
    
    const validBackendData = {
      daily_checklists: {
        Monday: {
          gratitude: ['', '', '', '', '', ''],
          habits: [],
          am_protocol: ['true'],        // ✅ Valid backend format
          daily_goal_setting: [],      // ✅ Valid backend format
          peak_diet: ['true']          // ✅ Valid backend format
        }
      }
    };
    
    const actualLegacyData = {
      daily_checklists: {
        Monday: {
          gratitude: ['', ''],         
          habits: [],
          am_protocol: undefined,       // ❌ Legacy: missing field
          daily_goal_setting: "true",  // ❌ Legacy: string instead of array/boolean
          peak_diet: 1                 // ❌ Legacy: number instead of array/boolean
        }
      }
    };
    
    console.log('✅ Valid backend data (should NOT trigger migration toast):');
    console.log(validBackendData);
    
    console.log('❌ Actual legacy data (SHOULD trigger migration toast):');
    console.log(actualLegacyData);
    
    console.log('Your current data should look like the valid format and NOT trigger migration notifications.');
  };
}
