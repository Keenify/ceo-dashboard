export interface AnnualCalendarPlan {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export type AnnualCalendarPlanCreate = Omit<AnnualCalendarPlan, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'color'> & {
  color: AllowedColor;
};

export type AnnualCalendarPlanUpdate = Partial<AnnualCalendarPlanCreate>;

export interface AnnualCalendarPlanFilter {
  start_date_from?: string;
  start_date_to?: string;
  end_date_from?: string;
  end_date_to?: string;
  title_contains?: string;
}

export interface PlanStats {
  active: number;
  upcoming: number;
  completionRate: number;
}

export const ALLOWED_COLORS = [
  'red',
  'yellow', 
  'orange',
  'blue',
  'green',
  'black',
  'white',
  'purple',
  'pink'
] as const;

export type AllowedColor = typeof ALLOWED_COLORS[number];

export const isValidColor = (color: string): color is AllowedColor => {
  return ALLOWED_COLORS.includes(color as AllowedColor);
}; 