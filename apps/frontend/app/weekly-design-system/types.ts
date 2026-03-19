// Hard-coded types for UI components
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

// Extended DailyChecklist for UI (includes additional boolean fields not in database)
export interface DailyChecklistUI {
  gratitude: string[];
  habits: string[];
  '20_20_20': boolean;
  '90_90_10': boolean;
  '2WW': boolean;
}

// UI-specific type mappings
export type TimeBlocksUI = {
  [key in DayOfWeek]: { [timeSlot: string]: string };
};

export type DailyChecklistsUI = {
  [key in DayOfWeek]: DailyChecklistUI;
};

// UI-specific WeeklyDesignSystemData that extends database types with UI fields
export interface WeeklyDesignSystemDataUI {
  id?: string;
  user_id?: string;
  week_start_date: string;
  next_goals: Array<{ goal: string }>;
  personal_goals: Array<{ goal: string }>;
  time_blocks: TimeBlocksUI;
  daily_checklists: DailyChecklistsUI;
  created_at?: string;
  updated_at?: string;
} 