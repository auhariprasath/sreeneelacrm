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
      add_ons_selected: {
        Row: {
          addon_name: string
          addon_price: number
          created_at: string
          id: string
          is_custom: boolean
          requirement_id: string
        }
        Insert: {
          addon_name: string
          addon_price?: number
          created_at?: string
          id?: string
          is_custom?: boolean
          requirement_id: string
        }
        Update: {
          addon_name?: string
          addon_price?: number
          created_at?: string
          id?: string
          is_custom?: boolean
          requirement_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount_paid: number
          balance_due: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cheque_bank: string | null
          cheque_clear_date: string | null
          cheque_cleared_at: string | null
          cheque_cleared_by: string | null
          cheque_number: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dispute_reason: string | null
          disputed_at: string | null
          end_time: string | null
          event_date: string
          id: string
          lead_id: string
          payment_type: Database["public"]["Enums"]["payment_type"] | null
          quotation_id: string | null
          refund_amount: number | null
          refund_percent: number | null
          refund_processed_at: string | null
          refund_processed_by: string | null
          refund_reference: string | null
          refund_status: string | null
          requirement_id: string
          rescheduled_from_date: string | null
          rescheduled_from_start_time: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at: string
          venue: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cheque_bank?: string | null
          cheque_clear_date?: string | null
          cheque_cleared_at?: string | null
          cheque_cleared_by?: string | null
          cheque_number?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          end_time?: string | null
          event_date: string
          id?: string
          lead_id: string
          payment_type?: Database["public"]["Enums"]["payment_type"] | null
          quotation_id?: string | null
          refund_amount?: number | null
          refund_percent?: number | null
          refund_processed_at?: string | null
          refund_processed_by?: string | null
          refund_reference?: string | null
          refund_status?: string | null
          requirement_id: string
          rescheduled_from_date?: string | null
          rescheduled_from_start_time?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
          venue?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cheque_bank?: string | null
          cheque_clear_date?: string | null
          cheque_cleared_at?: string | null
          cheque_cleared_by?: string | null
          cheque_number?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          lead_id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"] | null
          quotation_id?: string | null
          refund_amount?: number | null
          refund_percent?: number | null
          refund_processed_at?: string | null
          refund_processed_by?: string | null
          refund_reference?: string | null
          refund_status?: string | null
          requirement_id?: string
          rescheduled_from_date?: string | null
          rescheduled_from_start_time?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          addons_catalog: Json
          address: string | null
          admin_max_discount_percent: number
          auto_notify_competing_leads: boolean
          auto_sms_fallback: boolean
          auto_wa_on_reschedule: boolean
          bank_account: string | null
          cancellation_policy: string | null
          created_at: string
          default_callback_time: string
          default_follow_up_minutes: number
          deleted_at: string | null
          drop_reasons: Json
          email: string | null
          event_types: Json
          google_review_link: string | null
          gst_percent: number
          gstin: string | null
          id: string
          ifsc: string | null
          is_mandapam: boolean
          logo_url: string | null
          max_capacity: number | null
          max_follow_up_attempts: number
          name: string
          peak_season_dates: Json
          quotation_counter: number
          quotation_prefix: string
          refund_15_30_percent: number
          refund_over_30_percent: number
          refund_tier_15_30: string | null
          refund_tier_30plus: string | null
          refund_tier_under15: string | null
          refund_under_15_percent: number
          require_discount_reason: boolean
          services_catalog: Json
          sessions: Json
          staff_max_discount_percent: number
          type: Database["public"]["Enums"]["company_type"]
          upi_id: string | null
          wa_number: string | null
          wa_template_competing_leads: string | null
          wa_template_payment_reminder: string | null
          wa_template_reschedule: string | null
          wa_template_thank_you: string | null
        }
        Insert: {
          addons_catalog?: Json
          address?: string | null
          admin_max_discount_percent?: number
          auto_notify_competing_leads?: boolean
          auto_sms_fallback?: boolean
          auto_wa_on_reschedule?: boolean
          bank_account?: string | null
          cancellation_policy?: string | null
          created_at?: string
          default_callback_time?: string
          default_follow_up_minutes?: number
          deleted_at?: string | null
          drop_reasons?: Json
          email?: string | null
          event_types?: Json
          google_review_link?: string | null
          gst_percent?: number
          gstin?: string | null
          id?: string
          ifsc?: string | null
          is_mandapam?: boolean
          logo_url?: string | null
          max_capacity?: number | null
          max_follow_up_attempts?: number
          name: string
          peak_season_dates?: Json
          quotation_counter?: number
          quotation_prefix?: string
          refund_15_30_percent?: number
          refund_over_30_percent?: number
          refund_tier_15_30?: string | null
          refund_tier_30plus?: string | null
          refund_tier_under15?: string | null
          refund_under_15_percent?: number
          require_discount_reason?: boolean
          services_catalog?: Json
          sessions?: Json
          staff_max_discount_percent?: number
          type: Database["public"]["Enums"]["company_type"]
          upi_id?: string | null
          wa_number?: string | null
          wa_template_competing_leads?: string | null
          wa_template_payment_reminder?: string | null
          wa_template_reschedule?: string | null
          wa_template_thank_you?: string | null
        }
        Update: {
          addons_catalog?: Json
          address?: string | null
          admin_max_discount_percent?: number
          auto_notify_competing_leads?: boolean
          auto_sms_fallback?: boolean
          auto_wa_on_reschedule?: boolean
          bank_account?: string | null
          cancellation_policy?: string | null
          created_at?: string
          default_callback_time?: string
          default_follow_up_minutes?: number
          deleted_at?: string | null
          drop_reasons?: Json
          email?: string | null
          event_types?: Json
          google_review_link?: string | null
          gst_percent?: number
          gstin?: string | null
          id?: string
          ifsc?: string | null
          is_mandapam?: boolean
          logo_url?: string | null
          max_capacity?: number | null
          max_follow_up_attempts?: number
          name?: string
          peak_season_dates?: Json
          quotation_counter?: number
          quotation_prefix?: string
          refund_15_30_percent?: number
          refund_over_30_percent?: number
          refund_tier_15_30?: string | null
          refund_tier_30plus?: string | null
          refund_tier_under15?: string | null
          refund_under_15_percent?: number
          require_discount_reason?: boolean
          services_catalog?: Json
          sessions?: Json
          staff_max_discount_percent?: number
          type?: Database["public"]["Enums"]["company_type"]
          upi_id?: string | null
          wa_number?: string | null
          wa_template_competing_leads?: string | null
          wa_template_payment_reminder?: string | null
          wa_template_reschedule?: string | null
          wa_template_thank_you?: string | null
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_cancelled: boolean
          is_sent: boolean
          lead_id: string
          note: string | null
          scheduled_at: string
          type: Database["public"]["Enums"]["follow_up_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_cancelled?: boolean
          is_sent?: boolean
          lead_id: string
          note?: string | null
          scheduled_at: string
          type?: Database["public"]["Enums"]["follow_up_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_cancelled?: boolean
          is_sent?: boolean
          lead_id?: string
          note?: string | null
          scheduled_at?: string
          type?: Database["public"]["Enums"]["follow_up_type"]
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
      payment_reminders: {
        Row: {
          booking_id: string
          company_id: string
          created_at: string
          id: string
          is_cancelled: boolean
          is_sent: boolean
          lead_id: string
          message_template: string | null
          payment_id: string | null
          scheduled_at: string
          sent_at: string | null
          trigger_percent: number | null
        }
        Insert: {
          booking_id: string
          company_id: string
          created_at?: string
          id?: string
          is_cancelled?: boolean
          is_sent?: boolean
          lead_id: string
          message_template?: string | null
          payment_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          trigger_percent?: number | null
        }
        Update: {
          booking_id?: string
          company_id?: string
          created_at?: string
          id?: string
          is_cancelled?: boolean
          is_sent?: boolean
          lead_id?: string
          message_template?: string | null
          payment_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          trigger_percent?: number | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          cheque_bank: string | null
          cheque_clear_date: string | null
          cheque_number: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dispute_reason: string | null
          due_date: string | null
          id: string
          instalment_number: number | null
          lead_id: string
          notes: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          total_instalments: number | null
          transaction_reference: string | null
          type: Database["public"]["Enums"]["payment_type"]
        }
        Insert: {
          amount: number
          booking_id: string
          cheque_bank?: string | null
          cheque_clear_date?: string | null
          cheque_number?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dispute_reason?: string | null
          due_date?: string | null
          id?: string
          instalment_number?: number | null
          lead_id: string
          notes?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          total_instalments?: number | null
          transaction_reference?: string | null
          type: Database["public"]["Enums"]["payment_type"]
        }
        Update: {
          amount?: number
          booking_id?: string
          cheque_bank?: string | null
          cheque_clear_date?: string | null
          cheque_number?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dispute_reason?: string | null
          due_date?: string | null
          id?: string
          instalment_number?: number | null
          lead_id?: string
          notes?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          total_instalments?: number | null
          transaction_reference?: string | null
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auto_approve_transfers: boolean
          company_id: string | null
          created_at: string
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      quotations: {
        Row: {
          addons: Json
          agreed_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_amount: number
          discount_percent: number
          discount_reason: string | null
          gst_amount: number
          gst_applied: boolean
          gst_percent: number
          id: string
          is_peak_season: boolean
          lead_id: string
          pdf_url: string | null
          peak_season_label: string | null
          quotation_number: string | null
          requirement_id: string
          sent_at: string | null
          sent_via: Database["public"]["Enums"]["sent_channel"] | null
          services: Json
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number
          total: number
          updated_at: string
          version: number
        }
        Insert: {
          addons?: Json
          agreed_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_percent?: number
          discount_reason?: string | null
          gst_amount?: number
          gst_applied?: boolean
          gst_percent?: number
          id?: string
          is_peak_season?: boolean
          lead_id: string
          pdf_url?: string | null
          peak_season_label?: string | null
          quotation_number?: string | null
          requirement_id: string
          sent_at?: string | null
          sent_via?: Database["public"]["Enums"]["sent_channel"] | null
          services?: Json
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          version?: number
        }
        Update: {
          addons?: Json
          agreed_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_percent?: number
          discount_reason?: string | null
          gst_amount?: number
          gst_applied?: boolean
          gst_percent?: number
          id?: string
          is_peak_season?: boolean
          lead_id?: string
          pdf_url?: string | null
          peak_season_label?: string | null
          quotation_number?: string | null
          requirement_id?: string
          sent_at?: string | null
          sent_via?: Database["public"]["Enums"]["sent_channel"] | null
          services?: Json
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      requirements: {
        Row: {
          budget_range: string | null
          community: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_hours: number | null
          end_time: string | null
          event_date: string | null
          event_type: string | null
          event_type_other: string | null
          guest_count: number | null
          id: string
          lead_id: string
          muhurtham_time: string | null
          notes: string | null
          requirement_number: number
          start_time: string | null
          status: Database["public"]["Enums"]["requirement_status"]
          updated_at: string
        }
        Insert: {
          budget_range?: string | null
          community?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_hours?: number | null
          end_time?: string | null
          event_date?: string | null
          event_type?: string | null
          event_type_other?: string | null
          guest_count?: number | null
          id?: string
          lead_id: string
          muhurtham_time?: string | null
          notes?: string | null
          requirement_number?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          updated_at?: string
        }
        Update: {
          budget_range?: string | null
          community?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_hours?: number | null
          end_time?: string | null
          event_date?: string | null
          event_type?: string | null
          event_type_other?: string | null
          guest_count?: number | null
          id?: string
          lead_id?: string
          muhurtham_time?: string | null
          notes?: string | null
          requirement_number?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          updated_at?: string
        }
        Relationships: []
      }
      slots: {
        Row: {
          company_id: string
          confirmed_by_booking_id: string | null
          created_at: string
          end_time: string
          event_date: string
          held_by_lead_id: string | null
          held_by_requirement_id: string | null
          held_until: string | null
          id: string
          session_name: string | null
          start_time: string
          status: Database["public"]["Enums"]["slot_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          confirmed_by_booking_id?: string | null
          created_at?: string
          end_time: string
          event_date: string
          held_by_lead_id?: string | null
          held_by_requirement_id?: string | null
          held_until?: string | null
          id?: string
          session_name?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["slot_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          confirmed_by_booking_id?: string | null
          created_at?: string
          end_time?: string
          event_date?: string
          held_by_lead_id?: string | null
          held_by_requirement_id?: string | null
          held_until?: string | null
          id?: string
          session_name?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["slot_status"]
          updated_at?: string
        }
        Relationships: []
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
      booking_status:
        | "cheque_pending"
        | "confirmed"
        | "cancelled"
        | "rescheduled"
        | "completed"
        | "disputed"
      company_type: "garden" | "banquet" | "party" | "mandapam"
      follow_up_type: "auto_1hr" | "tomorrow_10am" | "custom" | "done"
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
      payment_status:
        | "pending"
        | "received"
        | "bounced"
        | "disputed"
        | "refunded"
      payment_type:
        | "full"
        | "advance_50"
        | "instalment"
        | "cash"
        | "cheque"
        | "b2b_credit"
      quotation_status: "draft" | "sent" | "agreed" | "revised" | "declined"
      requirement_status:
        | "collecting"
        | "slot_checking"
        | "slot_confirmed"
        | "muhurtham_conflict"
        | "complete"
      sent_channel: "whatsapp" | "email" | "sms" | "instagram"
      slot_status: "free" | "soft_hold" | "enquiry" | "confirmed"
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
      booking_status: [
        "cheque_pending",
        "confirmed",
        "cancelled",
        "rescheduled",
        "completed",
        "disputed",
      ],
      company_type: ["garden", "banquet", "party", "mandapam"],
      follow_up_type: ["auto_1hr", "tomorrow_10am", "custom", "done"],
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
      payment_status: [
        "pending",
        "received",
        "bounced",
        "disputed",
        "refunded",
      ],
      payment_type: [
        "full",
        "advance_50",
        "instalment",
        "cash",
        "cheque",
        "b2b_credit",
      ],
      quotation_status: ["draft", "sent", "agreed", "revised", "declined"],
      requirement_status: [
        "collecting",
        "slot_checking",
        "slot_confirmed",
        "muhurtham_conflict",
        "complete",
      ],
      sent_channel: ["whatsapp", "email", "sms", "instagram"],
      slot_status: ["free", "soft_hold", "enquiry", "confirmed"],
      transfer_status: ["pending", "approved", "rejected", "auto_approved"],
    },
  },
} as const
