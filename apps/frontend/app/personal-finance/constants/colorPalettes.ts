export interface ColorPalette {
  name: string;
  backgroundColor: string;
  fontColor: string;
}

export const PREDEFINED_COLOR_PALETTES: ColorPalette[] = [
  { name: "Default", backgroundColor: "#FFFFFF", fontColor: "#000000" },
  { name: "Light Blue / Dark Text", backgroundColor: "#E0F2FE", fontColor: "#0D3A56" },
  { name: "Light Green / Dark Text", backgroundColor: "#D1FAE5", fontColor: "#065F46" },
  { name: "Light Yellow / Dark Text", backgroundColor: "#FEF9C3", fontColor: "#713F12" },
  { name: "Light Red / Dark Text", backgroundColor: "#FEE2E2", fontColor: "#991B1B" },
  { name: "Light Purple / Dark Text", backgroundColor: "#F3E8FF", fontColor: "#581C87" },
  { name: "Dark Blue / Light Text", backgroundColor: "#1E3A8A", fontColor: "#EFF6FF" },
  { name: "Dark Green / Light Text", backgroundColor: "#064E3B", fontColor: "#ECFDF5" },
  { name: "Dark Red / Light Text", backgroundColor: "#7F1D1D", fontColor: "#FEF2F2" },
  { name: "Teal / Black", backgroundColor: "#99F6E4", fontColor: "#134E4A"},
  { name: "Orange / White", backgroundColor: "#F97316", fontColor: "#FFFFFF"},

];

export const DEFAULT_BACKGROUND_COLOR = "#FFFFFF";
export const DEFAULT_FONT_COLOR = "#000000";

// Helper to find a palette by its codes, returns default if not found or codes are null
export const findPaletteByCodes = (bgColor: string | null | undefined, ftColor: string | null | undefined): ColorPalette => {
  if (!bgColor || !ftColor) {
    return PREDEFINED_COLOR_PALETTES.find(p => p.backgroundColor === DEFAULT_BACKGROUND_COLOR && p.fontColor === DEFAULT_FONT_COLOR) || PREDEFINED_COLOR_PALETTES[0];
  }
  return PREDEFINED_COLOR_PALETTES.find(p => p.backgroundColor === bgColor && p.fontColor === ftColor) || 
         { name: "Custom", backgroundColor: bgColor, fontColor: ftColor }; // Fallback for custom/unknown
};

// Helper to get default palette
export const getDefaultPalette = (): ColorPalette => {
  return PREDEFINED_COLOR_PALETTES.find(p => p.backgroundColor === DEFAULT_BACKGROUND_COLOR && p.fontColor === DEFAULT_FONT_COLOR) || PREDEFINED_COLOR_PALETTES[0];
}; 