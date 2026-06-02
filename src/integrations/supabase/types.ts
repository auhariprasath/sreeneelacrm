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
      booking_vendors: {
        Row: {
          amount_agreed: number | null
          amount_paid: number
          backup_vendor_suggested: boolean
          booking_id: string
          company_id: string
          confirmed: boolean
          confirmed_at: string | null
          created_at: string
          id: string
          no_show: boolean
          no_show_logged_at: string | null
          no_show_note: string | null
          rated_at: string | null
          rating: number | null
          rating_comment: string | null
          service_description: string | null
          status_reminder_sent_at: string | null
          status_token: string | null
          vendor_id: string
        }
        Insert: {
          amount_agreed?: number | null
          amount_paid?: number
          backup_vendor_suggested?: boolean
          booking_id: string
          company_id: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          no_show?: boolean
          no_show_logged_at?: string | null
          no_show_note?: string | null
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          service_description?: string | null
          status_reminder_sent_at?: string | null
          status_token?: string | null
          vendor_id: string
        }
        Update: {
          amount_agreed?: number | null
          amount_paid?: number
          backup_vendor_suggested?: boolean
          booking_id?: string
          company_id?: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string
          id?: string
          no_show?: boolean
          no_show_logged_at?: string | null
          no_show_note?: string | null
          rated_at?: string | null
          rating?: number | null
          rating_comment?: string | null
          service_description?: string | null
          status_reminder_sent_at?: string | null
          status_token?: string | null
          vendor_id?: string
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
          completed_at: string | null
          completed_by: string | null
          confirmation_sent_at: string | null
          confirmation_sent_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dispute_reason: string | null
          disputed_at: string | null
          end_time: string | null
          event_date: string
          feedback_wa_scheduled_at: string | null
          feedback_wa_sent_at: string | null
          id: string
          lead_id: string
          payment_type: Database["public"]["Enums"]["payment_type"] | null
          quotation_id: string | null
          reengagement_scheduled_at: string | null
          reengagement_sent_at: string | null
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
          completed_at?: string | null
          completed_by?: string | null
          confirmation_sent_at?: string | null
          confirmation_sent_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          end_time?: string | null
          event_date: string
          feedback_wa_scheduled_at?: string | null
          feedback_wa_sent_at?: string | null
          id?: string
          lead_id: string
          payment_type?: Database["public"]["Enums"]["payment_type"] | null
          quotation_id?: string | null
          reengagement_scheduled_at?: string | null
          reengagement_sent_at?: string | null
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
          completed_at?: string | null
          completed_by?: string | null
          confirmation_sent_at?: string | null
          confirmation_sent_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dispute_reason?: string | null
          disputed_at?: string | null
          end_time?: string | null
          event_date?: string
          feedback_wa_scheduled_at?: string | null
          feedback_wa_sent_at?: string | null
          id?: string
          lead_id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"] | null
          quotation_id?: string | null
          reengagement_scheduled_at?: string | null
          reengagement_sent_at?: string | null
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
      call_outcomes: {
        Row: {
          company_id: string
          created_at: string
          drop_reason: string | null
          follow_up_id: string | null
          id: string
          lead_id: string
          next_action: string | null
          notes: string | null
          outcome: Database["public"]["Enums"]["call_outcome_type"]
          performed_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          drop_reason?: string | null
          follow_up_id?: string | null
          id?: string
          lead_id: string
          next_action?: string | null
          notes?: string | null
          outcome: Database["public"]["Enums"]["call_outcome_type"]
          performed_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          drop_reason?: string | null
          follow_up_id?: string | null
          id?: string
          lead_id?: string
          next_action?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome_type"]
          performed_by?: string | null
        }
        Relationships: []
      }
      campaign_leads: {
        Row: {
          campaign_id: string
          channel_used: Database["public"]["Enums"]["campaign_lead_channel"]
          company_id: string
          created_at: string
          delivered_at: string | null
          error_text: string | null
          id: string
          lead_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_lead_status"]
        }
        Insert: {
          campaign_id: string
          channel_used: Database["public"]["Enums"]["campaign_lead_channel"]
          company_id: string
          created_at?: string
          delivered_at?: string | null
          error_text?: string | null
          id?: string
          lead_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_lead_status"]
        }
        Update: {
          campaign_id?: string
          channel_used?: Database["public"]["Enums"]["campaign_lead_channel"]
          company_id?: string
          created_at?: string
          delivered_at?: string | null
          error_text?: string | null
          id?: string
          lead_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_lead_status"]
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          channel: Database["public"]["Enums"]["campaign_channel"]
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          message: string
          name: string
          segment_filters: Json
          sent_at: string | null
          sms_fallback: boolean
          status: Database["public"]["Enums"]["campaign_status"]
          total_delivered: number
          total_failed: number
          total_leads: number
          total_sent: number
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["campaign_channel"]
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          message: string
          name: string
          segment_filters?: Json
          sent_at?: string | null
          sms_fallback?: boolean
          status?: Database["public"]["Enums"]["campaign_status"]
          total_delivered?: number
          total_failed?: number
          total_leads?: number
          total_sent?: number
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["campaign_channel"]
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          message?: string
          name?: string
          segment_filters?: Json
          sent_at?: string | null
          sms_fallback?: boolean
          status?: Database["public"]["Enums"]["campaign_status"]
          total_delivered?: number
          total_failed?: number
          total_leads?: number
          total_sent?: number
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          addons_catalog: Json
          address: string | null
          admin_max_discount_percent: number
          auto_notify_backup_on_leave: boolean
          auto_notify_competing_leads: boolean
          auto_notify_vendor_on_assign: boolean
          auto_reassign_overdue_on_leave: boolean
          auto_sms_fallback: boolean
          auto_wa_client_on_leave: boolean
          auto_wa_on_reschedule: boolean
          balance_reminder_days_before: number
          bank_account: string | null
          brand_color: string | null
          cancellation_policy: string | null
          company_phone: string | null
          confirmation_auto_send: boolean
          confirmation_closing_line: string | null
          confirmation_reminder_lines: Json
          created_at: string
          default_callback_time: string
          default_follow_up_minutes: number
          deleted_at: string | null
          drop_reasons: Json
          email: string | null
          event_types: Json
          feedback_wa_delay_hours: number
          force_majeure_note: string | null
          full_address: string | null
          google_maps_link: string | null
          google_review_link: string | null
          gst_percent: number
          gstin: string | null
          id: string
          ifsc: string | null
          is_mandapam: boolean
          logo_url: string | null
          max_capacity: number | null
          max_follow_up_attempts: number
          meeting_contact_name: string | null
          meeting_contact_phone: string | null
          name: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          peak_season_dates: Json
          quotation_counter: number
          quotation_prefix: string
          razorpay_key_id: string | null
          razorpay_key_secret: string | null
          razorpay_test_mode: boolean
          reengagement_auto_send: boolean
          reengagement_delay_days: number
          refund_15_30_percent: number
          refund_over_30_percent: number
          refund_tier_15_30: string | null
          refund_tier_30plus: string | null
          refund_tier_under15: string | null
          refund_under_15_percent: number
          require_discount_reason: boolean
          send_task_requirements_wa: boolean
          services_catalog: Json
          sessions: Json
          staff_max_discount_percent: number
          task_overdue_escalation_hours: number
          task_reminder_2d: boolean
          task_reminder_at_due: boolean
          task_reminder_on_booking: boolean
          task_templates: Json
          type: Database["public"]["Enums"]["company_type"]
          upi_id: string | null
          vendor_status_reminder_hours: number
          venue_photos: Json
          wa_number: string | null
          wa_template_booking_confirmed: string | null
          wa_template_competing_leads: string | null
          wa_template_feedback: string | null
          wa_template_payment_reminder: string | null
          wa_template_reengagement: string | null
          wa_template_reschedule: string | null
          wa_template_task_assigned: string | null
          wa_template_task_completed: string | null
          wa_template_task_reminder_2d: string | null
          wa_template_thank_you: string | null
        }
        Insert: {
          addons_catalog?: Json
          address?: string | null
          admin_max_discount_percent?: number
          auto_notify_backup_on_leave?: boolean
          auto_notify_competing_leads?: boolean
          auto_notify_vendor_on_assign?: boolean
          auto_reassign_overdue_on_leave?: boolean
          auto_sms_fallback?: boolean
          auto_wa_client_on_leave?: boolean
          auto_wa_on_reschedule?: boolean
          balance_reminder_days_before?: number
          bank_account?: string | null
          brand_color?: string | null
          cancellation_policy?: string | null
          company_phone?: string | null
          confirmation_auto_send?: boolean
          confirmation_closing_line?: string | null
          confirmation_reminder_lines?: Json
          created_at?: string
          default_callback_time?: string
          default_follow_up_minutes?: number
          deleted_at?: string | null
          drop_reasons?: Json
          email?: string | null
          event_types?: Json
          feedback_wa_delay_hours?: number
          force_majeure_note?: string | null
          full_address?: string | null
          google_maps_link?: string | null
          google_review_link?: string | null
          gst_percent?: number
          gstin?: string | null
          id?: string
          ifsc?: string | null
          is_mandapam?: boolean
          logo_url?: string | null
          max_capacity?: number | null
          max_follow_up_attempts?: number
          meeting_contact_name?: string | null
          meeting_contact_phone?: string | null
          name: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          peak_season_dates?: Json
          quotation_counter?: number
          quotation_prefix?: string
          razorpay_key_id?: string | null
          razorpay_key_secret?: string | null
          razorpay_test_mode?: boolean
          reengagement_auto_send?: boolean
          reengagement_delay_days?: number
          refund_15_30_percent?: number
          refund_over_30_percent?: number
          refund_tier_15_30?: string | null
          refund_tier_30plus?: string | null
          refund_tier_under15?: string | null
          refund_under_15_percent?: number
          require_discount_reason?: boolean
          send_task_requirements_wa?: boolean
          services_catalog?: Json
          sessions?: Json
          staff_max_discount_percent?: number
          task_overdue_escalation_hours?: number
          task_reminder_2d?: boolean
          task_reminder_at_due?: boolean
          task_reminder_on_booking?: boolean
          task_templates?: Json
          type: Database["public"]["Enums"]["company_type"]
          upi_id?: string | null
          vendor_status_reminder_hours?: number
          venue_photos?: Json
          wa_number?: string | null
          wa_template_booking_confirmed?: string | null
          wa_template_competing_leads?: string | null
          wa_template_feedback?: string | null
          wa_template_payment_reminder?: string | null
          wa_template_reengagement?: string | null
          wa_template_reschedule?: string | null
          wa_template_task_assigned?: string | null
          wa_template_task_completed?: string | null
          wa_template_task_reminder_2d?: string | null
          wa_template_thank_you?: string | null
        }
        Update: {
          addons_catalog?: Json
          address?: string | null
          admin_max_discount_percent?: number
          auto_notify_backup_on_leave?: boolean
          auto_notify_competing_leads?: boolean
          auto_notify_vendor_on_assign?: boolean
          auto_reassign_overdue_on_leave?: boolean
          auto_sms_fallback?: boolean
          auto_wa_client_on_leave?: boolean
          auto_wa_on_reschedule?: boolean
          balance_reminder_days_before?: number
          bank_account?: string | null
          brand_color?: string | null
          cancellation_policy?: string | null
          company_phone?: string | null
          confirmation_auto_send?: boolean
          confirmation_closing_line?: string | null
          confirmation_reminder_lines?: Json
          created_at?: string
          default_callback_time?: string
          default_follow_up_minutes?: number
          deleted_at?: string | null
          drop_reasons?: Json
          email?: string | null
          event_types?: Json
          feedback_wa_delay_hours?: number
          force_majeure_note?: string | null
          full_address?: string | null
          google_maps_link?: string | null
          google_review_link?: string | null
          gst_percent?: number
          gstin?: string | null
          id?: string
          ifsc?: string | null
          is_mandapam?: boolean
          logo_url?: string | null
          max_capacity?: number | null
          max_follow_up_attempts?: number
          meeting_contact_name?: string | null
          meeting_contact_phone?: string | null
          name?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          peak_season_dates?: Json
          quotation_counter?: number
          quotation_prefix?: string
          razorpay_key_id?: string | null
          razorpay_key_secret?: string | null
          razorpay_test_mode?: boolean
          reengagement_auto_send?: boolean
          reengagement_delay_days?: number
          refund_15_30_percent?: number
          refund_over_30_percent?: number
          refund_tier_15_30?: string | null
          refund_tier_30plus?: string | null
          refund_tier_under15?: string | null
          refund_under_15_percent?: number
          require_discount_reason?: boolean
          send_task_requirements_wa?: boolean
          services_catalog?: Json
          sessions?: Json
          staff_max_discount_percent?: number
          task_overdue_escalation_hours?: number
          task_reminder_2d?: boolean
          task_reminder_at_due?: boolean
          task_reminder_on_booking?: boolean
          task_templates?: Json
          type?: Database["public"]["Enums"]["company_type"]
          upi_id?: string | null
          vendor_status_reminder_hours?: number
          venue_photos?: Json
          wa_number?: string | null
          wa_template_booking_confirmed?: string | null
          wa_template_competing_leads?: string | null
          wa_template_feedback?: string | null
          wa_template_payment_reminder?: string | null
          wa_template_reengagement?: string | null
          wa_template_reschedule?: string | null
          wa_template_task_assigned?: string | null
          wa_template_task_completed?: string | null
          wa_template_task_reminder_2d?: string | null
          wa_template_thank_you?: string | null
        }
        Relationships: []
      }
      event_day_logs: {
        Row: {
          assigned_to: string | null
          booking_id: string
          company_id: string
          created_at: string
          description: string
          id: string
          log_type: Database["public"]["Enums"]["event_day_log_type"]
          logged_by: string | null
          metadata: Json | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["event_day_severity"] | null
          status: Database["public"]["Enums"]["event_day_status"]
          title: string
        }
        Insert: {
          assigned_to?: string | null
          booking_id: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          log_type: Database["public"]["Enums"]["event_day_log_type"]
          logged_by?: string | null
          metadata?: Json | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["event_day_severity"] | null
          status?: Database["public"]["Enums"]["event_day_status"]
          title: string
        }
        Update: {
          assigned_to?: string | null
          booking_id?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          log_type?: Database["public"]["Enums"]["event_day_log_type"]
          logged_by?: string | null
          metadata?: Json | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["event_day_severity"] | null
          status?: Database["public"]["Enums"]["event_day_status"]
          title?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          booking_id: string
          comment: string | null
          company_id: string
          created_at: string
          id: string
          lead_id: string
          rating: number
          submitted_at: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          company_id: string
          created_at?: string
          id?: string
          lead_id: string
          rating: number
          submitted_at?: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          company_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          rating?: number
          submitted_at?: string
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
      login_log: {
        Row: {
          company_id: string | null
          device_type: string | null
          id: string
          login_at: string
          logout_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          device_type?: string | null
          id?: string
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          device_type?: string | null
          id?: string
          login_at?: string
          logout_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
          backup_staff_id: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          fcm_token: string | null
          full_name: string
          id: string
          is_active: boolean
          last_active_at: string | null
          last_login_at: string | null
          last_logout_at: string | null
          must_change_password: boolean
          on_leave: boolean
          phone: string | null
          phone_masked: boolean
        }
        Insert: {
          auto_approve_transfers?: boolean
          backup_staff_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          fcm_token?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          last_active_at?: string | null
          last_login_at?: string | null
          last_logout_at?: string | null
          must_change_password?: boolean
          on_leave?: boolean
          phone?: string | null
          phone_masked?: boolean
        }
        Update: {
          auto_approve_transfers?: boolean
          backup_staff_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          fcm_token?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_active_at?: string | null
          last_login_at?: string | null
          last_logout_at?: string | null
          must_change_password?: boolean
          on_leave?: boolean
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
      referral_loyalty_flags: {
        Row: {
          benefit_sent: boolean
          benefit_sent_at: string | null
          created_at: string
          flagged_by: string | null
          id: string
          notes: string | null
          referrer_lead_id: string
          updated_at: string
        }
        Insert: {
          benefit_sent?: boolean
          benefit_sent_at?: string | null
          created_at?: string
          flagged_by?: string | null
          id?: string
          notes?: string | null
          referrer_lead_id: string
          updated_at?: string
        }
        Update: {
          benefit_sent?: boolean
          benefit_sent_at?: string | null
          created_at?: string
          flagged_by?: string | null
          id?: string
          notes?: string | null
          referrer_lead_id?: string
          updated_at?: string
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
      task_reminders: {
        Row: {
          absolute_at: string | null
          cancelled_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_fired_at: string | null
          mode: string
          next_fire_at: string | null
          notify_admin: boolean
          notify_assignee: boolean
          offset_unit: string | null
          offset_value: number | null
          repeat: boolean
          repeat_frequency: string | null
          repeat_interval_hours: number | null
          scheduled_at: string
          send_wa: boolean
          task_id: string
          updated_at: string
        }
        Insert: {
          absolute_at?: string | null
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_fired_at?: string | null
          mode: string
          next_fire_at?: string | null
          notify_admin?: boolean
          notify_assignee?: boolean
          offset_unit?: string | null
          offset_value?: number | null
          repeat?: boolean
          repeat_frequency?: string | null
          repeat_interval_hours?: number | null
          scheduled_at: string
          send_wa?: boolean
          task_id: string
          updated_at?: string
        }
        Update: {
          absolute_at?: string | null
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_fired_at?: string | null
          mode?: string
          next_fire_at?: string | null
          notify_admin?: boolean
          notify_assignee?: boolean
          offset_unit?: string | null
          offset_value?: number | null
          repeat?: boolean
          repeat_frequency?: string | null
          repeat_interval_hours?: number | null
          scheduled_at?: string
          send_wa?: boolean
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_replies: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          message: string | null
          reply_type: Database["public"]["Enums"]["task_reply_type"]
          task_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          reply_type: Database["public"]["Enums"]["task_reply_type"]
          task_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string | null
          reply_type?: Database["public"]["Enums"]["task_reply_type"]
          task_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          booking_id: string
          company_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_at: string
          id: string
          is_from_template: boolean
          notes: Json
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          booking_id: string
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at: string
          id?: string
          is_from_template?: boolean
          notes?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          booking_id?: string
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_at?: string
          id?: string
          is_from_template?: boolean
          notes?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          vendor_id?: string | null
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
      vendor_status_updates: {
        Row: {
          booking_id: string
          booking_vendor_id: string
          company_id: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["vendor_status_stage"]
          updated_at: string
          updated_via: Database["public"]["Enums"]["vendor_status_source"]
          vendor_id: string
        }
        Insert: {
          booking_id: string
          booking_vendor_id: string
          company_id: string
          id?: string
          note?: string | null
          status: Database["public"]["Enums"]["vendor_status_stage"]
          updated_at?: string
          updated_via: Database["public"]["Enums"]["vendor_status_source"]
          vendor_id: string
        }
        Update: {
          booking_id?: string
          booking_vendor_id?: string
          company_id?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["vendor_status_stage"]
          updated_at?: string
          updated_via?: Database["public"]["Enums"]["vendor_status_source"]
          vendor_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          rating: number | null
          rating_count: number
          service_type: string
          standard_rate: number | null
          total_bookings: number
          updated_at: string
          wa_number: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          rating?: number | null
          rating_count?: number
          service_type: string
          standard_rate?: number | null
          total_bookings?: number
          updated_at?: string
          wa_number?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          rating?: number | null
          rating_count?: number
          service_type?: string
          standard_rate?: number | null
          total_bookings?: number
          updated_at?: string
          wa_number?: string | null
        }
        Relationships: []
      }
      venue_meetings: {
        Row: {
          company_id: string
          contact_person_name: string | null
          contact_person_phone: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_minutes: number
          id: string
          lead_id: string
          message_sent: string | null
          notes: string | null
          outcome_prompt_sent_at: string | null
          outcome_recorded: boolean
          photos_sent: Json
          reminder_1day_sent_at: string | null
          reminder_now_sent_at: string | null
          scheduled_date: string
          scheduled_time: string
          status: Database["public"]["Enums"]["venue_meeting_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_person_name?: string | null
          contact_person_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_minutes?: number
          id?: string
          lead_id: string
          message_sent?: string | null
          notes?: string | null
          outcome_prompt_sent_at?: string | null
          outcome_recorded?: boolean
          photos_sent?: Json
          reminder_1day_sent_at?: string | null
          reminder_now_sent_at?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: Database["public"]["Enums"]["venue_meeting_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_person_name?: string | null
          contact_person_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_minutes?: number
          id?: string
          lead_id?: string
          message_sent?: string | null
          notes?: string | null
          outcome_prompt_sent_at?: string | null
          outcome_recorded?: boolean
          photos_sent?: Json
          reminder_1day_sent_at?: string | null
          reminder_now_sent_at?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: Database["public"]["Enums"]["venue_meeting_status"]
          updated_at?: string
        }
        Relationships: []
      }
      win_loss_log: {
        Row: {
          amount_value: number | null
          closed_at: string
          closed_by: string | null
          company_id: string
          competitor_name: string | null
          created_at: string
          drop_reason: string | null
          id: string
          lead_id: string
          outcome: Database["public"]["Enums"]["win_loss_outcome"]
        }
        Insert: {
          amount_value?: number | null
          closed_at?: string
          closed_by?: string | null
          company_id: string
          competitor_name?: string | null
          created_at?: string
          drop_reason?: string | null
          id?: string
          lead_id: string
          outcome: Database["public"]["Enums"]["win_loss_outcome"]
        }
        Update: {
          amount_value?: number | null
          closed_at?: string
          closed_by?: string | null
          company_id?: string
          competitor_name?: string | null
          created_at?: string
          drop_reason?: string | null
          id?: string
          lead_id?: string
          outcome?: Database["public"]["Enums"]["win_loss_outcome"]
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
      call_outcome_type:
        | "interested"
        | "meeting_scheduled"
        | "callback_requested"
        | "other"
        | "not_interested"
      campaign_channel: "whatsapp" | "sms" | "both"
      campaign_lead_channel: "whatsapp" | "sms"
      campaign_lead_status: "pending" | "sent" | "delivered" | "failed"
      campaign_status: "draft" | "sent" | "completed"
      company_type: "garden" | "banquet" | "party" | "mandapam"
      event_day_log_type:
        | "amendment"
        | "complaint"
        | "vendor_no_show"
        | "force_majeure"
        | "note"
      event_day_severity: "low" | "medium" | "high"
      event_day_status: "open" | "in_progress" | "resolved" | "closed"
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
      payment_method_type: "manual" | "razorpay"
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
      task_priority: "low" | "medium" | "high"
      task_reply_type: "noted" | "started" | "completed" | "comment"
      task_status: "pending" | "in_progress" | "done" | "overdue"
      transfer_status: "pending" | "approved" | "rejected" | "auto_approved"
      vendor_status_source: "tap_link" | "manual_staff"
      vendor_status_stage: "packed" | "traveling" | "arrived" | "setup_done"
      venue_meeting_status:
        | "scheduled"
        | "reminder_sent"
        | "completed"
        | "cancelled"
        | "rescheduled"
      win_loss_outcome: "won" | "lost"
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
      call_outcome_type: [
        "interested",
        "meeting_scheduled",
        "callback_requested",
        "other",
        "not_interested",
      ],
      campaign_channel: ["whatsapp", "sms", "both"],
      campaign_lead_channel: ["whatsapp", "sms"],
      campaign_lead_status: ["pending", "sent", "delivered", "failed"],
      campaign_status: ["draft", "sent", "completed"],
      company_type: ["garden", "banquet", "party", "mandapam"],
      event_day_log_type: [
        "amendment",
        "complaint",
        "vendor_no_show",
        "force_majeure",
        "note",
      ],
      event_day_severity: ["low", "medium", "high"],
      event_day_status: ["open", "in_progress", "resolved", "closed"],
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
      payment_method_type: ["manual", "razorpay"],
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
      task_priority: ["low", "medium", "high"],
      task_reply_type: ["noted", "started", "completed", "comment"],
      task_status: ["pending", "in_progress", "done", "overdue"],
      transfer_status: ["pending", "approved", "rejected", "auto_approved"],
      vendor_status_source: ["tap_link", "manual_staff"],
      vendor_status_stage: ["packed", "traveling", "arrived", "setup_done"],
      venue_meeting_status: [
        "scheduled",
        "reminder_sent",
        "completed",
        "cancelled",
        "rescheduled",
      ],
      win_loss_outcome: ["won", "lost"],
    },
  },
} as const
