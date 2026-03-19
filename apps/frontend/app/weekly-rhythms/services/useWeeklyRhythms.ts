"use client";

import { useState, useCallback } from 'react';

// --- Types for Weekly Rhythms ---
export interface WeeklyRhythmGoal {
  goal: string;
  target_completion_by: string;
}
export interface WeeklyRhythmAction {
  action_item: string;
  outcome: string;
}
export interface WeeklyRhythmChallenge {
  challenge: string;
  note: string;
}
export interface WeeklyRhythmNextGoal {
  goal: string;
  help_needed: string;
}

// Payload for create/update
export interface WeeklyRhythmPayload {
  week_start_date?: string;
  most_significant_moment?: string;
  goals?: WeeklyRhythmGoal[];
  actions?: WeeklyRhythmAction[];
  challenges?: WeeklyRhythmChallenge[];
  next_goals?: WeeklyRhythmNextGoal[];
  user_id: string;
}

// Response type
export interface WeeklyRhythmResponse {
  week_start_date: string;
  most_significant_moment: string;
  goals: WeeklyRhythmGoal[];
  actions: WeeklyRhythmAction[];
  challenges: WeeklyRhythmChallenge[];
  next_goals: WeeklyRhythmNextGoal[];
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const backendApiDomain = process.env.NEXT_PUBLIC_BACKEND_API_DOMAIN || 'http://localhost:8000';
const WEEKLY_RHYTHMS_ENDPOINT = `${backendApiDomain}/weekly-rhythms/`;

// Data migration and validation functions
const normalizeDateString = (dateStr: string | null | undefined): string => {
  if (!dateStr || typeof dateStr !== 'string') {
    return ''; // Return empty string for invalid/missing dates
  }

  // If it's already in YYYY-MM-DD format, keep it
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try to parse various legacy formats
  try {
    // Handle common legacy formats
    let normalizedDate: Date | null = null;

    // Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
    let cleanStr = dateStr.replace(/(\d+)(st|nd|rd|th)/gi, '$1');

    // Try different parsing approaches
    const parseAttempts = [
      () => new Date(cleanStr),
      () => new Date(dateStr), // Original string
      () => {
        // Handle DD/MM format by adding current year and explicitly parsing as DD/MM/YYYY
        if (/^\d{1,2}\/\d{1,2}$/.test(cleanStr)) {
          const currentYear = new Date().getFullYear();
          const parts = cleanStr.split('/');
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          
          // Validate day and month ranges
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            // Create date with explicit DD/MM/YYYY format (month is 0-indexed in Date constructor)
            const date = new Date(currentYear, month - 1, day);
            
            // Verify the date is valid (e.g., Feb 30 would be invalid)
            if (date.getFullYear() === currentYear && 
                date.getMonth() === month - 1 && 
                date.getDate() === day) {
              return date;
            }
          }
        }
        return null;
      },
      () => {
        // Handle "DD Month YYYY" format
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                           'july', 'august', 'september', 'october', 'november', 'december'];
        const lowerStr = cleanStr.toLowerCase();
        for (let i = 0; i < monthNames.length; i++) {
          if (lowerStr.includes(monthNames[i])) {
            return new Date(cleanStr);
          }
        }
        return null;
      },
      () => {
        // Handle DD/MM/YYYY format (European date format)
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanStr)) {
          const parts = cleanStr.split('/');
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          
          // Validate ranges
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
            // Create date with explicit DD/MM/YYYY format (month is 0-indexed)
            const date = new Date(year, month - 1, day);
            
            // Verify the date is valid
            if (date.getFullYear() === year && 
                date.getMonth() === month - 1 && 
                date.getDate() === day) {
              return date;
            }
          }
        }
        return null;
      }
    ];

    for (const attempt of parseAttempts) {
      try {
        const result = attempt();
        if (result && !isNaN(result.getTime())) {
          normalizedDate = result;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (normalizedDate && !isNaN(normalizedDate.getTime())) {
      // Format as YYYY-MM-DD
      const year = normalizedDate.getFullYear();
      const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
      const day = String(normalizedDate.getDate()).padStart(2, '0');
      const formatted = `${year}-${month}-${day}`;
      
      // Log successful migration for debugging
      if (dateStr !== formatted) {
        console.log(`📅 Migrated date: "${dateStr}" → "${formatted}"`);
      }
      
      return formatted;
    }
  } catch (error) {
    console.warn(`⚠️ Could not parse date "${dateStr}":`, error);
  }

  // If all parsing fails, return empty string and log
  console.warn(`❌ Failed to parse legacy date: "${dateStr}" - setting to empty`);
  return '';
};

const migrateWeeklyRhythmData = (data: WeeklyRhythmResponse): { data: WeeklyRhythmResponse, migrationOccurred: boolean } => {
  let migrationIssues = 0;
  
  // Migrate goals target_completion_by dates
  const migratedGoals = data.goals?.map((goal, index) => {
    const originalDate = goal.target_completion_by;
    const migratedDate = normalizeDateString(originalDate);
    
    if (originalDate && originalDate !== migratedDate) {
      migrationIssues++;
    }
    
    return {
      ...goal,
      target_completion_by: migratedDate
    };
  }) || [];

  // Ensure all array fields are arrays, not null
  const safeActions = Array.isArray(data.actions) ? data.actions : [];
  const safeChallenges = Array.isArray(data.challenges) ? data.challenges : [];
  const safeNextGoals = Array.isArray(data.next_goals) ? data.next_goals : [];
  
  // Count null-to-array migrations
  if (!Array.isArray(data.actions) || !Array.isArray(data.challenges) || !Array.isArray(data.next_goals)) {
    migrationIssues++;
    console.log(`🔧 Fixed null array fields for week ${data.week_start_date}`);
  }

  if (migrationIssues > 0) {
    console.log(`✅ Weekly rhythm migration: ${migrationIssues} issues fixed for week ${data.week_start_date}`);
  }

  return {
    data: {
      ...data,
      goals: migratedGoals,
      actions: safeActions,
      challenges: safeChallenges,
      next_goals: safeNextGoals
    },
    migrationOccurred: migrationIssues > 0
  };
};

export function useWeeklyRhythms() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [migrationDetected, setMigrationDetected] = useState<boolean>(false);

  // Test function for development (accessible via the hook)
  const testDateMigration = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🧪 Testing Weekly Rhythms Date Migration:');
      
      // Test the specific case the user asked about
      console.log('🔍 Testing "31/5" specifically:');
      const testResult = normalizeDateString("31/5");
      console.log(`📅 "31/5" → "${testResult}"`);
      
      const testDates = [
        '31th July 2025',
        '31/5',        // DD/MM format (May 31st)
        '15/12',       // DD/MM format (December 15th)
        '1/1',         // DD/MM format (January 1st)
        '29/2',        // DD/MM format (Feb 29th - might be invalid depending on year)
        '31/2',        // DD/MM format (Invalid - Feb 31st doesn't exist)
        '15/12/2024',  // DD/MM/YYYY format
        '31/5/2025',   // DD/MM/YYYY format
        '15th December 2024',
        '2024-12-31',
        'January 15, 2025',
        '1st January 2025',
        '25/12/2024',
        '',
        null,
        undefined,
        'invalid date string'
      ];
      
      testDates.forEach(testDate => {
        const result = normalizeDateString(testDate);
        console.log(`📅 "${testDate}" → "${result}"`);
      });
    }
  }, []);

  // --- Create ---
  const addWeeklyRhythm = useCallback(
    async (payload: WeeklyRhythmPayload): Promise<WeeklyRhythmResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(WEEKLY_RHYTHMS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: WeeklyRhythmResponse = await response.json();
        setLoading(false);
        
        const migrationResult = migrateWeeklyRhythmData(data);
        if (migrationResult.migrationOccurred) {
          setMigrationDetected(true);
        }
        return migrationResult.data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while adding weekly rhythm'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch all by user ---
  const fetchWeeklyRhythms = useCallback(
    async (userId: string, skip = 0, limit = 100): Promise<WeeklyRhythmResponse[] | null> => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('skip', String(skip));
      params.append('limit', String(limit));
      const url = `${WEEKLY_RHYTHMS_ENDPOINT}?${params.toString()}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: WeeklyRhythmResponse[] = await response.json();
        setLoading(false);
        
        // Migrate all entries
        let anyMigration = false;
        const migratedData = data.map(entry => {
          const migrationResult = migrateWeeklyRhythmData(entry);
          if (migrationResult.migrationOccurred) {
            anyMigration = true;
          }
          return migrationResult.data;
        });
        
        if (anyMigration) {
          setMigrationDetected(true);
        }
        
        return migratedData;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching weekly rhythms'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Fetch by id ---
  const fetchWeeklyRhythmById = useCallback(
    async (id: string, userId: string): Promise<WeeklyRhythmResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${WEEKLY_RHYTHMS_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: WeeklyRhythmResponse = await response.json();
        setLoading(false);
        
        const migrationResult = migrateWeeklyRhythmData(data);
        if (migrationResult.migrationOccurred) {
          setMigrationDetected(true);
        }
        return migrationResult.data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching weekly rhythm'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Update ---
  const updateWeeklyRhythm = useCallback(
    async (id: string, userId: string, updatePayload: Partial<WeeklyRhythmPayload>): Promise<WeeklyRhythmResponse | null> => {
      setLoading(true);
      setError(null);
      const url = `${WEEKLY_RHYTHMS_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data: WeeklyRhythmResponse = await response.json();
        setLoading(false);
        
        const migrationResult = migrateWeeklyRhythmData(data);
        if (migrationResult.migrationOccurred) {
          setMigrationDetected(true);
        }
        return migrationResult.data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while updating weekly rhythm'));
        setLoading(false);
        return null;
      }
    },
    []
  );

  // --- Delete ---
  const deleteWeeklyRhythm = useCallback(
    async (id: string, userId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      const url = `${WEEKLY_RHYTHMS_ENDPOINT}${id}?user_id=${encodeURIComponent(userId)}`;
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'Accept': '*/*' },
        });
        if (response.status === 204) {
          setLoading(false);
          return true;
        } else {
          let errorDetail = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch (parseError) {}
          throw new Error(errorDetail);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while deleting weekly rhythm'));
        setLoading(false);
        return false;
      }
    },
    []
  );

  return {
    addWeeklyRhythm,
    fetchWeeklyRhythms,
    fetchWeeklyRhythmById,
    updateWeeklyRhythm,
    deleteWeeklyRhythm,
    loading,
    error,
    migrationDetected,
  };
}
