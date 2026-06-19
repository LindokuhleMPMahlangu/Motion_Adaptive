export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      alert_logs: {
        Row: {
          cause: string;
          created_at: string;
          facility_id: string;
          id: string;
          logged_by: string | null;
          prevention: string;
          queue_entry_id: string | null;
          wait_minutes: number;
        };
        Insert: {
          cause?: string;
          created_at?: string;
          facility_id: string;
          id?: string;
          logged_by?: string | null;
          prevention?: string;
          queue_entry_id?: string | null;
          wait_minutes?: number;
        };
        Update: {
          cause?: string;
          created_at?: string;
          facility_id?: string;
          id?: string;
          logged_by?: string | null;
          prevention?: string;
          queue_entry_id?: string | null;
          wait_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "alert_logs_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alert_logs_queue_entry_id_fkey";
            columns: ["queue_entry_id"];
            isOneToOne: false;
            referencedRelation: "queue_entries";
            referencedColumns: ["id"];
          },
        ];
      };
      facilities: {
        Row: {
          avg_service_minutes: number;
          created_at: string;
          id: string;
          location: string;
          name: string;
          norm_wait_minutes: number;
          services: string[];
          type: Database["public"]["Enums"]["facility_type"];
        };
        Insert: {
          avg_service_minutes?: number;
          created_at?: string;
          id?: string;
          location?: string;
          name: string;
          norm_wait_minutes?: number;
          services?: string[];
          type: Database["public"]["Enums"]["facility_type"];
        };
        Update: {
          avg_service_minutes?: number;
          created_at?: string;
          id?: string;
          location?: string;
          name?: string;
          norm_wait_minutes?: number;
          services?: string[];
          type?: Database["public"]["Enums"]["facility_type"];
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      queue_entries: {
        Row: {
          alerted: boolean;
          booked_for: string | null;
          checked_in_at: string | null;
          checked_out_at: string | null;
          created_at: string;
          facility_id: string;
          id: string;
          is_emergency: boolean;
          patient_id: string;
          patient_name: string;
          service: string;
          status: Database["public"]["Enums"]["queue_status"];
        };
        Insert: {
          alerted?: boolean;
          booked_for?: string | null;
          checked_in_at?: string | null;
          checked_out_at?: string | null;
          created_at?: string;
          facility_id: string;
          id?: string;
          is_emergency?: boolean;
          patient_id: string;
          patient_name?: string;
          service?: string;
          status?: Database["public"]["Enums"]["queue_status"];
        };
        Update: {
          alerted?: boolean;
          booked_for?: string | null;
          checked_in_at?: string | null;
          checked_out_at?: string | null;
          created_at?: string;
          facility_id?: string;
          id?: string;
          is_emergency?: boolean;
          patient_id?: string;
          patient_name?: string;
          service?: string;
          status?: Database["public"]["Enums"]["queue_status"];
        };
        Relationships: [
          {
            foreignKeyName: "queue_entries_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_my_queue_status: {
        Args: never;
        Returns: {
          booked_for: string;
          checked_in_at: string;
          entry_id: string;
          est_wait_minutes: number;
          facility_id: string;
          facility_name: string;
          is_emergency: boolean;
          norm_wait_minutes: number;
          people_ahead: number;
          queue_position: number;
          service: string;
          status: Database["public"]["Enums"]["queue_status"];
          total_waiting: number;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "patient" | "staff" | "admin";
      facility_type: "hospital" | "clinic" | "pharmacy";
      queue_status: "waiting" | "in_service" | "completed" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["patient", "staff", "admin"],
      facility_type: ["hospital", "clinic", "pharmacy"],
      queue_status: ["waiting", "in_service", "completed", "cancelled"],
    },
  },
} as const;
