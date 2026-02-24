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
      estratti_conto: {
        Row: {
          created_at: string | null
          data_operazione: string
          descrizione: string | null
          id: string
          importo: number
          saldo: number | null
          stato: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_operazione?: string
          descrizione?: string | null
          id?: string
          importo: number
          saldo?: number | null
          stato?: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_operazione?: string
          descrizione?: string | null
          id?: string
          importo?: number
          saldo?: number | null
          stato?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estratti_conto_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      incroci_bancari: {
        Row: {
          created_at: string | null
          differenza: number | null
          esito: string
          estratto_id: string | null
          id: string
          movimento_id: string | null
          note: string | null
          verificato: boolean | null
        }
        Insert: {
          created_at?: string | null
          differenza?: number | null
          esito: string
          estratto_id?: string | null
          id?: string
          movimento_id?: string | null
          note?: string | null
          verificato?: boolean | null
        }
        Update: {
          created_at?: string | null
          differenza?: number | null
          esito?: string
          estratto_id?: string | null
          id?: string
          movimento_id?: string | null
          note?: string | null
          verificato?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "incroci_bancari_estratto_id_fkey"
            columns: ["estratto_id"]
            isOneToOne: false
            referencedRelation: "estratti_conto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incroci_bancari_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimenti_contabili"
            referencedColumns: ["id"]
          },
        ]
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
      movimenti_contabili: {
        Row: {
          categoria: string | null
          created_at: string | null
          created_by: string | null
          data_movimento: string
          descrizione: string | null
          id: string
          importo: number
          riferimento_id: string | null
          riferimento_tipo: string | null
          stato: string
          tipo: string
          ufficio_id: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          data_movimento?: string
          descrizione?: string | null
          id?: string
          importo: number
          riferimento_id?: string | null
          riferimento_tipo?: string | null
          stato?: string
          tipo: string
          ufficio_id?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          created_by?: string | null
          data_movimento?: string
          descrizione?: string | null
          id?: string
          importo?: number
          riferimento_id?: string | null
          riferimento_tipo?: string | null
          stato?: string
          tipo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_contabili_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_contabili_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
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
      provvigioni_generate: {
        Row: {
          calcolata_il: string | null
          id: string
          importo_provvigione: number | null
          pagata: boolean | null
          percentuale: number | null
          titolo_id: string
          user_id: string | null
        }
        Insert: {
          calcolata_il?: string | null
          id?: string
          importo_provvigione?: number | null
          pagata?: boolean | null
          percentuale?: number | null
          titolo_id: string
          user_id?: string | null
        }
        Update: {
          calcolata_il?: string | null
          id?: string
          importo_provvigione?: number | null
          pagata?: boolean | null
          percentuale?: number | null
          titolo_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provvigioni_generate_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provvigioni_generate_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rimessa_dettaglio: {
        Row: {
          id: string
          importo: number | null
          rimessa_id: string
          titolo_id: string | null
        }
        Insert: {
          id?: string
          importo?: number | null
          rimessa_id: string
          titolo_id?: string | null
        }
        Update: {
          id?: string
          importo?: number | null
          rimessa_id?: string
          titolo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rimessa_dettaglio_rimessa_id_fkey"
            columns: ["rimessa_id"]
            isOneToOne: false
            referencedRelation: "rimessa_premi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_dettaglio_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      rimessa_premi: {
        Row: {
          api_endpoint: string | null
          api_response: string | null
          compagnia_id: string | null
          created_at: string | null
          created_by: string | null
          data_creazione: string | null
          id: string
          stato: string
          totale_importi: number | null
          ufficio_id: string | null
          updated_at: string | null
          xml_output: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_response?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_creazione?: string | null
          id?: string
          stato?: string
          totale_importi?: number | null
          ufficio_id?: string | null
          updated_at?: string | null
          xml_output?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_response?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_creazione?: string | null
          id?: string
          stato?: string
          totale_importi?: number | null
          ufficio_id?: string | null
          updated_at?: string | null
          xml_output?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rimessa_premi_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_premi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rimessa_premi_ufficio_id_fkey"
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
      titoli: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          data_incasso: string | null
          id: string
          importo_incassato: number | null
          note: string | null
          numero_titolo: string | null
          premio_lordo: number | null
          prodotto_id: string | null
          produttore_id: string | null
          stato: string
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          data_incasso?: string | null
          id?: string
          importo_incassato?: number | null
          note?: string | null
          numero_titolo?: string | null
          premio_lordo?: number | null
          prodotto_id?: string | null
          produttore_id?: string | null
          stato?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          data_incasso?: string | null
          id?: string
          importo_incassato?: number | null
          note?: string | null
          numero_titolo?: string | null
          premio_lordo?: number | null
          prodotto_id?: string | null
          produttore_id?: string | null
          stato?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "titoli_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_produttore_id_fkey"
            columns: ["produttore_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
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
