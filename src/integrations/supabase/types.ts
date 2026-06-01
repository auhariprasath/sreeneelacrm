export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          action_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          deleted_at: string | null
          id: string
          lead_id: string
          metadata: Json | null
          note: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          action_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          note?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          action_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          note?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          bank_account: string | null
          cancellation_policy: string | null
          created_at: string
          email: string | null
          google_review_link: string | null
          gstin: string | null
          id: string
          ifsc: string | null
          logo_url: string | null
          name: string
          refund_tier_15_30: string | null
          refund_tier_30plus: string | null
          refund_tier_under15: string | null
          type: Database["public"]["Enums"]["company_type"]
          upi_id: string | null
          wa_number: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          cancellation_policy?: string | null
          created_at?: string
          email?: string | null
          google_review_link?: string | null
          gstin?: string | null
          id?: string
          ifsc?: string | null
          logo_url?: string | null
          name: string
          refund_tier_15_30?: string | null
          refund_tier_30plus?: string | null
          refund_tier_under15?: string | null
          type: Database["public"]["Enums"]["company_type"]
          upi_id?: string | null
          wa_number?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          cancellation_policy?: string | null
          created_at?: string
          email?: string | null
          google_review_link?: string | null
          gstin?: string | null
          id?: string
          ifsc?: string | null
          logo_url?: string | null
          name?: string
          refund_tier_15_30?: string | null
          refund_tier_30plus?: string | null
          refund_tier_under15?: string | null
          type?: Database["public"]["Enums"]["company_type"]
          upi_id?: string | null
          wa_number?: string | null
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_sent: boolean
          lead_id: string
          note: string | null
          scheduled_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_sent?: boolean
          lead_id: string
          note?: string | null
          scheduled_at: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_sent?: boolean
          lead_id?: string
          note?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          blacklist_reason: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          follow_up_count: number
          full_name: string
          id: string
          is_blacklisted: boolean
          language: string
          lead_score: Database["public"]["Enums"]["lead_score"]
          max_follow_up_attempts: number
          notes: string | null
          phone: string
          referred_by_lead_id: string | null
          referred_by_name: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          blacklist_reason?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          follow_up_count?: number
          full_name: string
          id?: string
          is_blacklisted?: boolean
          language?: string
          lead_score?: Database["public"]["Enums"]["lead_score"]
          max_follow_up_attempts?: number
          notes?: string | null
          phone: string
          referred_by_lead_id?: string | null
          referred_by_name?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          blacklist_reason?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          follow_up_count?: number
          full_name?: string
          id?: string
          is_blacklisted?: boolean
          language?: string
          lead_score?: Database["public"]["Enums"]["lead_score"]
          max_follow_up_attempts?: number
          notes?: string | null
          phone?: string
          referred_by_lead_id?: string | null
          referred_by_name?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referred_by_lead_id_fkey"
            columns: ["referred_by_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          lead_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          lead_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          lead_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_approve_transfers: boolean
          company_id: string | null
          created_at: string
          email: string | null
          fcm_token: string | null
          full_name: string
          id: string
          is_active: boolean
          last_active_at: string | null
          must_change_password: boolean
          phone: string | null
          phone_masked: boolean
        }
        Insert: {
          auto_approve_transfers?: boolean
          company_id?: string | null
          created_at?: string
          email?: string | null
          fcm_token?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          last_active_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          phone_masked?: boolean
        }
        Update: {
          auto_approve_transfers?: boolean
          company_id?: string | null
          created_at?: string
          email?: string | null
          fcm_token?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          must_change_password?: boolean
          phone?: string | null
          phone_masked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          created_at: string
          from_company_id: string
          id: string
          lead_id: string
          reason: string
          rejection_reason: string | null
          requested_by: string
          requirement_summary: string
          reviewed_by: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_company_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_company_id: string
          id?: string
          lead_id: string
          reason: string
          rejection_reason?: string | null
          requested_by: string
          requirement_summary: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_company_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_company_id?: string
          id?: string
          lead_id?: string
          reason?: string
          rejection_reason?: string | null
          requested_by?: string
          requirement_summary?: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_company_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_requests_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "call"
        | "whatsapp"
        | "note"
        | "status_change"
        | "assignment"
        | "transfer"
        | "view"
        | "system"
        | "photo"
        | "intake"
        | "quotation"
        | "payment"
      app_role: "super_admin" | "admin" | "staff"
      company_type: "garden" | "banquet" | "party" | "mandapam"
      lead_score: "hot" | "warm" | "cold"
      lead_source: "inbound_call" | "walkin" | "referral" | "portal" | "manual"
      lead_status:
        | "new"
        | "in_progress"
        | "neutral"
        | "positive"
        | "negative"
        | "closed"
        | "unresponsive"
        | "locked"
      notification_type:
        | "new_lead"
        | "follow_up"
        | "transfer"
        | "payment"
        | "event_reminder"
        | "low_rating"
        | "system"
      transfer_status: "pending" | "approved" | "rejected" | "auto_approved"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "call",
        "whatsapp",
        "note",
        "status_change",
        "assignment",
        "transfer",
        "view",
        "system",
        "photo",
        "intake",
        "quotation",
        "payment",
      ],
      app_role: ["super_admin", "admin", "staff"],
      company_type: ["garden", "banquet", "party", "mandapam"],
      lead_score: ["hot", "warm", "cold"],
      lead_source: ["inbound_call", "walkin", "referral", "portal", "manual"],
      lead_status: [
        "new",
        "in_progress",
        "neutral",
        "positive",
        "negative",
        "closed",
        "unresponsive",
        "locked",
      ],
      notification_type: [
        "new_lead",
        "follow_up",
        "transfer",
        "payment",
        "event_reminder",
        "low_rating",
        "system",
      ],
      transfer_status: ["pending", "approved", "rejected", "auto_approved"],
    },
  },
} as const
