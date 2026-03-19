export const OPPP_TEMPLATE = {
  "10-25_years": {
    relationships: [],
    achievements: [],
    rituals: [],
    wealth: []
  },
  "1_year": {
    relationships: [],
    achievements: [],
    rituals: [],
    wealth: []
  },
  "start": {
    relationships: [],
    achievements: [],
    rituals: [],
    wealth: []
  },
  "stop": {
    relationships: [],
    achievements: [],
    rituals: [],
    wealth: []
  }
} as const;

export type OPPPFormData = {
  "10-25_years": {
    relationships: string[];
    achievements: string[];
    rituals: string[];
    wealth: string[];
  };
  "1_year": {
    relationships: string[];
    achievements: string[];
    rituals: string[];
    wealth: string[];
  };
  "start": {
    relationships: string[];
    achievements: string[];
    rituals: string[];
    wealth: string[];
  };
  "stop": {
    relationships: string[];
    achievements: string[];
    rituals: string[];
    wealth: string[];
  };
};

export interface OPPPForm {
  id: string;
  user_id: string;
  form_date: string;
  form_data: OPPPFormData;
  created_at: string;
  updated_at: string;
}

export interface OPPPFormPayload {
  user_id: string;
  form_date: string;
  form_data: OPPPFormData;
}

export type TimeFrame = "10-25_years" | "1_year" | "start" | "stop";
export type Category = "relationships" | "achievements" | "rituals" | "wealth";

export const TIME_FRAME_LABELS = {
  "10-25_years": "10-25 Years (Aspirations)",
  "1_year": "1 Year (Activities)", 
  "start": "Start",
  "stop": "Stop"
} as const;

export const CATEGORY_LABELS = {
  relationships: "Relationships",
  achievements: "Achievements", 
  rituals: "Rituals",
  wealth: "Wealth ($)"
} as const;