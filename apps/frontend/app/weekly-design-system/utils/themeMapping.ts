// Theme name to hex color mapping for database storage
export type ThemeColor = 'yellow' | 'blue' | 'green' | 'purple' | 'pink' | 'orange' | 'red' | 'indigo' | 'teal' | 'cyan';

export interface ThemeConfig {
  name: string;
  light: string;
  dark: string;
  accent: string;
  preview: string;
  hex: string; // Hex color for database storage
}

export const THEME_COLORS: Record<ThemeColor, ThemeConfig> = {
  yellow: {
    name: 'Sunshine',
    light: 'bg-yellow-100 border-yellow-200',
    dark: 'dark:bg-amber-500/20 dark:border-amber-400/30',
    accent: 'text-yellow-800 dark:text-amber-200',
    preview: 'bg-yellow-400',
    hex: '#F59E0B' // amber-500
  },
  blue: {
    name: 'Ocean',
    light: 'bg-blue-100 border-blue-200',
    dark: 'dark:bg-blue-500/20 dark:border-blue-400/30',
    accent: 'text-blue-800 dark:text-blue-200',
    preview: 'bg-blue-400',
    hex: '#3B82F6' // blue-500
  },
  green: {
    name: 'Forest',
    light: 'bg-green-100 border-green-200',
    dark: 'dark:bg-green-500/20 dark:border-green-400/30',
    accent: 'text-green-800 dark:text-green-200',
    preview: 'bg-green-400',
    hex: '#22C55E' // green-500
  },
  purple: {
    name: 'Lavender',
    light: 'bg-purple-100 border-purple-200',
    dark: 'dark:bg-purple-500/20 dark:border-purple-400/30',
    accent: 'text-purple-800 dark:text-purple-200',
    preview: 'bg-purple-400',
    hex: '#A855F7' // purple-500
  },
  pink: {
    name: 'Blossom',
    light: 'bg-pink-100 border-pink-200',
    dark: 'dark:bg-pink-500/20 dark:border-pink-400/30',
    accent: 'text-pink-800 dark:text-pink-200',
    preview: 'bg-pink-400',
    hex: '#EC4899' // pink-500
  },
  orange: {
    name: 'Sunset',
    light: 'bg-orange-100 border-orange-200',
    dark: 'dark:bg-orange-500/20 dark:border-orange-400/30',
    accent: 'text-orange-800 dark:text-orange-200',
    preview: 'bg-orange-400',
    hex: '#F97316' // orange-500
  },
  red: {
    name: 'Ruby',
    light: 'bg-red-100 border-red-200',
    dark: 'dark:bg-red-500/20 dark:border-red-400/30',
    accent: 'text-red-800 dark:text-red-200',
    preview: 'bg-red-400',
    hex: '#EF4444' // red-500
  },
  indigo: {
    name: 'Midnight',
    light: 'bg-indigo-100 border-indigo-200',
    dark: 'dark:bg-indigo-500/20 dark:border-indigo-400/30',
    accent: 'text-indigo-800 dark:text-indigo-200',
    preview: 'bg-indigo-400',
    hex: '#6366F1' // indigo-500
  },
  teal: {
    name: 'Emerald',
    light: 'bg-teal-100 border-teal-200',
    dark: 'dark:bg-teal-500/20 dark:border-teal-400/30',
    accent: 'text-teal-800 dark:text-teal-200',
    preview: 'bg-teal-400',
    hex: '#14B8A6' // teal-500
  },
  cyan: {
    name: 'Sky',
    light: 'bg-cyan-100 border-cyan-200',
    dark: 'dark:bg-cyan-500/20 dark:border-cyan-400/30',
    accent: 'text-cyan-800 dark:text-cyan-200',
    preview: 'bg-cyan-400',
    hex: '#06B6D4' // cyan-500
  }
};

// Convert theme name to hex color for database storage
export const themeNameToHex = (themeName: ThemeColor): string => {
  return THEME_COLORS[themeName]?.hex || THEME_COLORS.yellow.hex;
};

// Convert hex color from database to theme name
export const hexToThemeName = (hex: string): ThemeColor => {
  // Normalize hex color (remove # and make uppercase)
  const normalizedHex = hex.replace('#', '').toUpperCase();
  const searchHex = `#${normalizedHex}`;
  
  // Find theme by hex color
  for (const [themeName, config] of Object.entries(THEME_COLORS)) {
    if (config.hex.toUpperCase() === searchHex.toUpperCase()) {
      return themeName as ThemeColor;
    }
  }
  
  // Default to yellow if no match found
  return 'yellow';
};

// Validate if a string is a valid theme name
export const isValidThemeName = (themeName: string): themeName is ThemeColor => {
  return Object.keys(THEME_COLORS).includes(themeName);
};

// Get theme configuration by name
export const getThemeConfig = (themeName: ThemeColor): ThemeConfig => {
  return THEME_COLORS[themeName] || THEME_COLORS.yellow;
};

// Get all available theme names
export const getAllThemeNames = (): ThemeColor[] => {
  return Object.keys(THEME_COLORS) as ThemeColor[];
};

// Get all available theme configs
export const getAllThemeConfigs = (): Record<ThemeColor, ThemeConfig> => {
  return THEME_COLORS;
}; 