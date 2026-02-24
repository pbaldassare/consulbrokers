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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categorie_prodotto: {
        Row: {
          created_at: string | null
          descrizione: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      compagnie: {
        Row: {
          attiva: boolean | null
          codice: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          attiva?: boolean | null
          codice?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          attiva?: boolean | null
          codice?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      log_attivita: {
        Row: {
          azione: string | null
          created_at: string | null
          dettagli_json: Json | null
          entita_id: string | null
          entita_tipo: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_attivita_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matrice_provvigioni: {
        Row: {
          attiva: boolean | null
          created_at: string | null
          id: string
          percentuale_provvigione: number
          prodotto_id: string
          ruolo: string | null
          tipo_calcolo: string
          ufficio_id: string | null
          user_id: string | null
        }
        Insert: {
          attiva?: boolean | null
          created_at?: string | null
          id?: string
          percentuale_provvigione: number
          prodotto_id: string
          ruolo?: string | null
          tipo_calcolo?: string
          ufficio_id?: string | null
          user_id?: string | null
        }
        Update: {
          attiva?: boolean | null
          created_at?: string | null
          id?: string
          percentuale_provvigione?: number
          prodotto_id?: string
          ruolo?: string | null
          tipo_calcolo?: string
          ufficio_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matrice_provvigioni_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matrice_provvigioni_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matrice_provvigioni_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotti: {
        Row: {
          attivo: boolean | null
          categoria_id: string | null
          codice_prodotto: string | null
          compagnia_id: string | null
          created_at: string | null
          id: string
          multititolo: boolean | null
          nome_prodotto: string
        }
        Insert: {
          attivo?: boolean | null
          categoria_id?: string | null
          codice_prodotto?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          id?: string
          multititolo?: boolean | null
          nome_prodotto: string
        }
        Update: {
          attivo?: boolean | null
          categoria_id?: string | null
          codice_prodotto?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          id?: string
          multititolo?: boolean | null
          nome_prodotto?: string
        }
        Relationships: [
          {
            foreignKeyName: "prodotti_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorie_prodotto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prodotti_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          attivo: boolean | null
          cognome: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string | null
          permessi_json: Json | null
          ruolo: string | null
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          nome?: string | null
          permessi_json?: Json | null
          ruolo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string | null
          permessi_json?: Json | null
          ruolo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect: {
        Row: {
          assegnato_a: string | null
          cognome: string | null
          created_at: string | null
          email: string | null
          fonte: string | null
          id: string
          nome: string | null
          note: string | null
          stato: string
          telefono: string | null
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          assegnato_a?: string | null
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          fonte?: string | null
          id?: string
          nome?: string | null
          note?: string | null
          stato?: string
          telefono?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assegnato_a?: string | null
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          fonte?: string | null
          id?: string
          nome?: string | null
          note?: string | null
          stato?: string
          telefono?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_assegnato_a_fkey"
            columns: ["assegnato_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      ruoli_template: {
        Row: {
          created_at: string | null
          descrizione: string | null
          id: string
          nome_template: string | null
          permessi_json: Json | null
          ruolo_base: string | null
        }
        Insert: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome_template?: string | null
          permessi_json?: Json | null
          ruolo_base?: string | null
        }
        Update: {
          created_at?: string | null
          descrizione?: string | null
          id?: string
          nome_template?: string | null
          permessi_json?: Json | null
          ruolo_base?: string | null
        }
        Relationships: []
      }
      trattative: {
        Row: {
          compagnia: string | null
          created_at: string | null
          created_by: string | null
          data_chiusura: string | null
          id: string
          premio_previsto: number | null
          prodotto: string | null
          prospect_id: string | null
          stato: string
          updated_at: string | null
        }
        Insert: {
          compagnia?: string | null
          created_at?: string | null
          created_by?: string | null
          data_chiusura?: string | null
          id?: string
          premio_previsto?: number | null
          prodotto?: string | null
          prospect_id?: string | null
          stato?: string
          updated_at?: string | null
        }
        Update: {
          compagnia?: string | null
          created_at?: string | null
          created_by?: string | null
          data_chiusura?: string | null
          id?: string
          premio_previsto?: number | null
          prodotto?: string | null
          prospect_id?: string | null
          stato?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trattative_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trattative_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect"
            referencedColumns: ["id"]
          },
        ]
      }
      uffici: {
        Row: {
          attivo: boolean | null
          codice_ufficio: string | null
          created_at: string | null
          id: string
          nome_ufficio: string
        }
        Insert: {
          attivo?: boolean | null
          codice_ufficio?: string | null
          created_at?: string | null
          id?: string
          nome_ufficio: string
        }
        Update: {
          attivo?: boolean | null
          codice_ufficio?: string | null
          created_at?: string | null
          id?: string
          nome_ufficio?: string
        }
        Relationships: []
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
      get_my_ufficio_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "ufficio"
        | "produttore"
        | "contabilita"
        | "cfo"
        | "cliente"
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
      app_role: [
        "admin",
        "ufficio",
        "produttore",
        "contabilita",
        "cfo",
        "cliente",
      ],
    },
  },
} as const
