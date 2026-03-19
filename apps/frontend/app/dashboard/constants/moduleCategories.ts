// Module categories for organizing modules in dashboard and sidebar
export const MODULE_CATEGORIES = {
  'Daily Practices': [
    'Daily Journal',
    'Let Me In',
    'Weekly Rhythms', 
    'Habit Tracker'
  ],
  'Productivity': [
    'To-do List',
    'Weekly Design System',
    'Annual Calendar Plans',
    'Project Management',
    'Mindmap'
  ],
  'Life & Finance': [
    'Personal Finance',
    'Travel P&L',
    'Bucket List'
  ],
  'Self-Growth': [
    'Future Me',
    'Manifestation',
    'Five Percent Reviews',
    'Ikigai',
    'Dreamboard',
    'One-Page Personal Plan'
  ]
} as const;

// Category icons mapping
export const CATEGORY_ICONS = {
  'Daily Practices': '📆',
  'Productivity': '📈',
  'Life & Finance': '💰',
  'Self-Growth': '🧘'
} as const;

// Category colors mapping for hover effects
export const CATEGORY_COLORS = {
  'Daily Practices': 'hover:border-yellow-400',
  'Productivity': 'hover:border-blue-400',
  'Life & Finance': 'hover:border-teal-400',
  'Self-Growth': 'hover:border-purple-400'
} as const;

export type ModuleCategoryKey = keyof typeof MODULE_CATEGORIES; 