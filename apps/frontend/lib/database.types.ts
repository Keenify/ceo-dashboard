export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      cashflow: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          flow_type: "inflow" | "outflow"
          amount: number // Corresponds to Numeric(12, 2)
          description: string | null
          flow_date: string // ISO Date string, e.g., "YYYY-MM-DD"
          category: string | null
          background_color_code: string | null // Character varying(7)
          font_color_code: string | null // Character varying(7)
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
          note: string | null // Added from backend
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          flow_type: "inflow" | "outflow"
          amount: number
          description?: string | null
          flow_date: string // ISO Date string
          category?: string | null
          background_color_code?: string | null
          font_color_code?: string | null
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
          note?: string | null // Added from backend
        }
        Update: {
          id?: string
          user_id?: string
          flow_type?: "inflow" | "outflow"
          amount?: number
          description?: string | null
          flow_date?: string
          category?: string | null
          background_color_code?: string | null
          font_color_code?: string | null
          created_at?: string
          updated_at?: string
          note?: string | null // Added from backend
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users" // Assuming your users table is named "users"
            referencedColumns: ["id"]
          }
        ]
      },
      annual_calendar_plans: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          title: string
          description: string | null
          start_date: string // ISO Date string
          end_date: string // ISO Date string
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          title: string
          description?: string | null
          start_date: string // ISO Date string
          end_date: string // ISO Date string
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          start_date?: string
          end_date?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annual_calendar_plans_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      credit_card_instructions: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          card_name: string
          payment_day: number
          description: string | null
          instruction: string | null
          is_paid: boolean
          last_reset_date: string | null // ISO Date string - when this card was last reset
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          card_name: string
          payment_day: number
          description?: string | null
          instruction?: string | null
          is_paid?: boolean // Default false in DB
          last_reset_date?: string | null // ISO Date string
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          card_name?: string
          payment_day?: number
          description?: string | null
          instruction?: string | null
          is_paid?: boolean
          last_reset_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_instructions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      journal_entries: {
        Row: {
          id: string
          created_at: string
          user_id: string
          date: string
          question1: string
          question2: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          date: string
          question1: string
          question2: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          date?: string
          question1?: string
          question2?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      travel_transactions: {
        Row: {
          id: string
          booking_date: string | null
          payment_date: string
          description: string | null
          item: string
          city: string
          country: string
          local_currency: string | null
          amount_local_currency: number | null
          exchange_rate_to_sgd: number | null
          category: "expense" | "income"
          created_at: string | null
          updated_at: string | null
          user_id: string
          amount_sgd: number | null
          trip_name: string | null
        }
        Insert: {
          id?: string
          booking_date?: string | null
          payment_date: string
          description?: string | null
          item: string
          city: string
          country: string
          local_currency?: string | null
          amount_local_currency?: number | null
          exchange_rate_to_sgd?: number | null
          category: "expense" | "income"
          created_at?: string | null
          updated_at?: string | null
          user_id: string
          amount_sgd?: number | null
          trip_name?: string | null
        }
        Update: {
          id?: string
          booking_date?: string | null
          payment_date?: string
          description?: string | null
          item?: string
          city?: string
          country?: string
          local_currency?: string | null
          amount_local_currency?: number | null
          exchange_rate_to_sgd?: number | null
          category?: "expense" | "income"
          created_at?: string | null
          updated_at?: string | null
          user_id?: string
          amount_sgd?: number | null
          trip_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_transactions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      networth_entries: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          type: "personal" | "business"
          category: "asset" | "liability"
          snapshot_date: string // ISO Date string, e.g., "YYYY-MM-DD"
          section: string
          name: string | null
          value: number | null // Parsed from string Decimal on frontend
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          type: "personal" | "business"
          category: "asset" | "liability"
          snapshot_date: string // ISO Date string
          section: string
          name?: string | null
          value?: number | null
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          type?: "personal" | "business"
          category?: "asset" | "liability"
          snapshot_date?: string
          section?: string
          name?: string | null
          value?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "networth_entries_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users" // Assuming Supabase 'auth.users' is represented as 'users' here
            referencedColumns: ["id"]
          }
        ]
      },
      five_percent_reviews: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          review_date: string // ISO Date string
          work_feelings: string | null
          work_headline: string | null
          work_significance: string | null
          family_feelings: string | null
          family_headline: string | null
          family_significance: string | null
          personal_feelings: string | null
          personal_headline: string | null
          personal_significance: string | null
          next_30_60: string | null
          challenge_or_opportunity: string | null
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID
          user_id: string
          review_date: string
          work_feelings?: string | null
          work_headline?: string | null
          work_significance?: string | null
          family_feelings?: string | null
          family_headline?: string | null
          family_significance?: string | null
          personal_feelings?: string | null
          personal_headline?: string | null
          personal_significance?: string | null
          next_30_60?: string | null
          challenge_or_opportunity?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          review_date?: string
          work_feelings?: string | null
          work_headline?: string | null
          work_significance?: string | null
          family_feelings?: string | null
          family_headline?: string | null
          family_significance?: string | null
          personal_feelings?: string | null
          personal_headline?: string | null
          personal_significance?: string | null
          next_30_60?: string | null
          challenge_or_opportunity?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "five_percent_reviews_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      future_letters: {
        Row: {
          id: string
          user_id: string
          recipient_email: string
          email_subject: string | null
          email_content: string
          attachment_urls: string[] | null
          send_date: string
          send_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          recipient_email: string
          email_subject?: string | null
          email_content: string
          attachment_urls?: string[] | null
          send_date: string
          send_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          recipient_email?: string
          email_subject?: string | null
          email_content?: string
          attachment_urls?: string[] | null
          send_date?: string
          send_status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "future_letters_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      weekly_design_system: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          week_start_date: string // ISO Date string
          next_goals: Array<{
            goal: string
          }> // Goals for the next 7 days
          personal_goals: Array<{
            goal: string
          }> // Personal goals for the week
          time_blocks: {
            [key: string]: {
              [timeSlot: string]: string
            }
          } // Daily time blocks
          daily_checklists: {
            [key: string]: {
              gratitude: string[]
              habits: string[]
            }
          } // Daily checklists with gratitude and habits
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          week_start_date: string // ISO Date string
          next_goals?: Array<{
            goal: string
          }> // Default empty array in DB
          personal_goals?: Array<{
            goal: string
          }> // Default empty array in DB
          time_blocks: {
            [key: string]: {
              [timeSlot: string]: string
            }
          }
          daily_checklists: {
            [key: string]: {
              gratitude: string[]
              habits: string[]
            }
          }
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          week_start_date?: string
          next_goals?: Array<{
            goal: string
          }>
          personal_goals?: Array<{
            goal: string
          }>
          time_blocks?: {
            [key: string]: {
              [timeSlot: string]: string
            }
          }
          daily_checklists?: {
            [key: string]: {
              gratitude: string[]
              habits: string[]
            }
          }
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_design_system_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      habit_buddies: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          buddy_email: string // Text
          censor_habits: boolean // Boolean, default false
          created_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          buddy_email: string // Text
          censor_habits?: boolean // Boolean, default false
          created_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          buddy_email?: string
          censor_habits?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_buddies_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      bucket_list_items: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          category: string
          items: Array<{
            text: string
            completed: boolean
          }>
          sort_order: number // int4, default 0
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          category: string
          items: Array<{
            text: string
            completed: boolean
          }>
          sort_order?: number // int4, default 0 in DB
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          items?: Array<{
            text: string
            completed: boolean
          }>
          sort_order?: number // int4
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_list_items_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      ikigai: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          ikigai_data: {
            [key: string]: any // JSONB flexible structure
          }
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          ikigai_data: {
            [key: string]: any // JSONB flexible structure
          }
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          ikigai_data?: {
            [key: string]: any // JSONB flexible structure
          }
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ikigai_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      payment_reminders: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          card_id: string // UUID
          scheduled_date: string // ISO Date string, e.g., "YYYY-MM-DD"
          sent_at: string | null // ISO DateTime string
          status: "pending" | "sent" | "failed" | "cancelled"
          email: string
          days_before_due: number
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          card_id: string // UUID
          scheduled_date: string // ISO Date string
          sent_at?: string | null // ISO DateTime string
          status?: "pending" | "sent" | "failed" | "cancelled" // Default 'pending' in DB
          email: string
          days_before_due?: number // Default 3 in DB
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          card_id?: string
          scheduled_date?: string
          sent_at?: string | null
          status?: "pending" | "sent" | "failed" | "cancelled"
          email?: string
          days_before_due?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_card_id_fkey"
            columns: ["card_id"]
            referencedRelation: "credit_card_instructions"
            referencedColumns: ["id"]
          }
        ]
      },
      dreamboard_items: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          title: string | null
          type: "text" | "image" | "drawing" | null
          content: string | null // text content, image URL, or drawing data
          position_x: number | null
          position_y: number | null
          z_index: number | null
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          title?: string | null
          type?: "text" | "image" | "drawing" | null
          content?: string | null
          position_x?: number | null
          position_y?: number | null
          z_index?: number | null
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          type?: "text" | "image" | "drawing" | null
          content?: string | null
          position_x?: number | null
          position_y?: number | null
          z_index?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dreamboard_items_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      },
      oppp_form: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          form_date: string // ISO Date string
          form_data: Json // JSONB
          created_at: string // ISO DateTime string
          updated_at: string // ISO DateTime string
        }
        Insert: {
          id?: string // UUID, default in DB
          user_id: string // UUID
          form_date: string // ISO Date string
          form_data: Json // JSONB
          created_at?: string // Default in DB
          updated_at?: string // Default in DB
        }
        Update: {
          id?: string
          user_id?: string
          form_date?: string
          form_data?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oppp_form_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
