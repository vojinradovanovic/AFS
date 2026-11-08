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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      machine_assignments: {
        Row: {
          machine_id: string
          user_id: string
        }
        Insert: {
          machine_id: string
          user_id: string
        }
        Update: {
          machine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_assignments_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          brand: string
          created_at: string
          criticality: number
          hours_since_pm: number
          id: string
          line: string
          name: string
          nominal_speed: number
          notes: string | null
          owner_id: string
          pm_interval_hours: number
          protocol: string
          run_hours: number
          status: string
        }
        Insert: {
          brand?: string
          created_at?: string
          criticality?: number
          hours_since_pm?: number
          id?: string
          line?: string
          name: string
          nominal_speed?: number
          notes?: string | null
          owner_id?: string
          pm_interval_hours?: number
          protocol?: string
          run_hours?: number
          status?: string
        }
        Update: {
          brand?: string
          created_at?: string
          criticality?: number
          hours_since_pm?: number
          id?: string
          line?: string
          name?: string
          nominal_speed?: number
          notes?: string | null
          owner_id?: string
          pm_interval_hours?: number
          protocol?: string
          run_hours?: number
          status?: string
        }
        Relationships: []
      }
      maintenance_events: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          kind: string
          machine_id: string
          notes: string | null
          owner_id: string
          protected: boolean
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          kind?: string
          machine_id: string
          notes?: string | null
          owner_id?: string
          protected?: boolean
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          kind?: string
          machine_id?: string
          notes?: string | null
          owner_id?: string
          protected?: boolean
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_events_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_invites: {
        Row: {
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          machine_ids: string[]
          owner_id: string
          token: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          machine_ids: string[]
          owner_id?: string
          token?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          machine_ids?: string[]
          owner_id?: string
          token?: string
        }
        Relationships: []
      }
      paper_records: {
        Row: {
          data: Json
          flagged: boolean
          flags: Json
          id: string
          line: string
          machine_id: string | null
          owner_id: string
          record_type: string
          recorded_at: string
          recorded_by: string | null
          source: string
          title: string
        }
        Insert: {
          data?: Json
          flagged?: boolean
          flags?: Json
          id?: string
          line?: string
          machine_id?: string | null
          owner_id?: string
          record_type: string
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          title: string
        }
        Update: {
          data?: Json
          flagged?: boolean
          flags?: Json
          id?: string
          line?: string
          machine_id?: string | null
          owner_id?: string
          record_type?: string
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_records_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          plant_owner_id: string
          role: string
          user_id: string
        }
        Insert: {
          plant_owner_id: string
          role: string
          user_id: string
        }
        Update: {
          plant_owner_id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_operator_invite: { Args: { p_token: string }; Returns: undefined }
      can_read_machine: {
        Args: { p_id: string; p_owner: string }
        Returns: boolean
      }
      create_operator_invite: {
        Args: { p_email: string; p_machines: string[] }
        Returns: string
      }
      is_plant_manager: { Args: { p_owner: string }; Returns: boolean }
      set_machine_status: {
        Args: { p_machine: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
