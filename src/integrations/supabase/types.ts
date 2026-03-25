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
      anagrafiche_professionali: {
        Row: {
          abi: string | null
          albo_numero: string | null
          annullato: boolean | null
          attivo: boolean | null
          banca_riga1: string | null
          banca_riga2: string | null
          banca_riga3: string | null
          cab: string | null
          cap: string | null
          cellulare: string | null
          citta: string | null
          codice: string | null
          codice_fiscale: string | null
          codice_fornitore: string | null
          cognome: string | null
          compagnia_id: string | null
          created_at: string | null
          email: string | null
          fax: string | null
          iban: string | null
          id: string
          indirizzo: string | null
          intestatario_cc: string | null
          iscrizione_rui: string | null
          nome: string | null
          nome_breve: string | null
          nome_rui: string | null
          note: string | null
          numero_rui: string | null
          partita_iva: string | null
          pec: string | null
          percentuale_base: number | null
          percentuale_consulenza: number | null
          percentuale_ra: number | null
          provincia: string | null
          ragione_sociale: string | null
          referente_email: string | null
          referente_nome: string | null
          sezione_rui: string | null
          sigla: string | null
          specializzazione: string | null
          studio_ufficio: string | null
          telefono: string | null
          tipo: string
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          abi?: string | null
          albo_numero?: string | null
          annullato?: boolean | null
          attivo?: boolean | null
          banca_riga1?: string | null
          banca_riga2?: string | null
          banca_riga3?: string | null
          cab?: string | null
          cap?: string | null
          cellulare?: string | null
          citta?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          codice_fornitore?: string | null
          cognome?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_cc?: string | null
          iscrizione_rui?: string | null
          nome?: string | null
          nome_breve?: string | null
          nome_rui?: string | null
          note?: string | null
          numero_rui?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_base?: number | null
          percentuale_consulenza?: number | null
          percentuale_ra?: number | null
          provincia?: string | null
          ragione_sociale?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          sezione_rui?: string | null
          sigla?: string | null
          specializzazione?: string | null
          studio_ufficio?: string | null
          telefono?: string | null
          tipo: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          abi?: string | null
          albo_numero?: string | null
          annullato?: boolean | null
          attivo?: boolean | null
          banca_riga1?: string | null
          banca_riga2?: string | null
          banca_riga3?: string | null
          cab?: string | null
          cap?: string | null
          cellulare?: string | null
          citta?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          codice_fornitore?: string | null
          cognome?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_cc?: string | null
          iscrizione_rui?: string | null
          nome?: string | null
          nome_breve?: string | null
          nome_rui?: string | null
          note?: string | null
          numero_rui?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_base?: number | null
          percentuale_consulenza?: number | null
          percentuale_ra?: number | null
          provincia?: string | null
          ragione_sociale?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          sezione_rui?: string | null
          sigla?: string | null
          specializzazione?: string | null
          studio_ufficio?: string | null
          telefono?: string | null
          tipo?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anagrafiche_professionali_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anagrafiche_professionali_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      anomalie_sistema: {
        Row: {
          created_at: string
          data_risoluzione: string | null
          descrizione: string
          entita_id: string
          entita_tipo: string
          gravita: string
          id: string
          note_risoluzione: string | null
          risolta_da: string | null
          stato: string
          tipo: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string
          data_risoluzione?: string | null
          descrizione: string
          entita_id: string
          entita_tipo: string
          gravita?: string
          id?: string
          note_risoluzione?: string | null
          risolta_da?: string | null
          stato?: string
          tipo: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string
          data_risoluzione?: string | null
          descrizione?: string
          entita_id?: string
          entita_tipo?: string
          gravita?: string
          id?: string
          note_risoluzione?: string | null
          risolta_da?: string | null
          stato?: string
          tipo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anomalie_sistema_risolta_da_fkey"
            columns: ["risolta_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomalie_sistema_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      banca_documenti: {
        Row: {
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          nome_file: string
          path_storage: string
          righe_estratte: number | null
          stato: string
          tipo_documento: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          nome_file: string
          path_storage: string
          righe_estratte?: number | null
          stato?: string
          tipo_documento: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          nome_file?: string
          path_storage?: string
          righe_estratte?: number | null
          stato?: string
          tipo_documento?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banca_documenti_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banca_documenti_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
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
      causali_contabili: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
          tipo_tabella: string
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
          tipo_tabella: string
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
          tipo_tabella?: string
        }
        Relationships: []
      }
      certificazioni_cu: {
        Row: {
          aliquota_ritenuta: number | null
          altri_importi: number | null
          anno_fiscale: number
          codice_fornitore: string | null
          created_at: string | null
          data_primanota: string | null
          fornitore_id: string | null
          id: string
          imponibile: number | null
          nome_fornitore: string | null
          non_soggetto: number | null
          numero_documento: string | null
          numero_primanota: string | null
          numero_protocollo: string | null
          ritenuta: number | null
          stato: string | null
          tipo_reddito: string | null
          totale: number | null
          ufficio_id: string | null
        }
        Insert: {
          aliquota_ritenuta?: number | null
          altri_importi?: number | null
          anno_fiscale: number
          codice_fornitore?: string | null
          created_at?: string | null
          data_primanota?: string | null
          fornitore_id?: string | null
          id?: string
          imponibile?: number | null
          nome_fornitore?: string | null
          non_soggetto?: number | null
          numero_documento?: string | null
          numero_primanota?: string | null
          numero_protocollo?: string | null
          ritenuta?: number | null
          stato?: string | null
          tipo_reddito?: string | null
          totale?: number | null
          ufficio_id?: string | null
        }
        Update: {
          aliquota_ritenuta?: number | null
          altri_importi?: number | null
          anno_fiscale?: number
          codice_fornitore?: string | null
          created_at?: string | null
          data_primanota?: string | null
          fornitore_id?: string | null
          id?: string
          imponibile?: number | null
          nome_fornitore?: string | null
          non_soggetto?: number | null
          numero_documento?: string | null
          numero_primanota?: string | null
          numero_protocollo?: string | null
          ritenuta?: number | null
          stato?: string | null
          tipo_reddito?: string | null
          totale?: number | null
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificazioni_cu_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "fornitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificazioni_cu_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_canali: {
        Row: {
          created_at: string | null
          creato_da: string | null
          id: string
          nome: string | null
          tipo: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string | null
          creato_da?: string | null
          id?: string
          nome?: string | null
          tipo?: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string | null
          creato_da?: string | null
          id?: string
          nome?: string | null
          tipo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_canali_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_canali_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_canali_membri: {
        Row: {
          canale_id: string
          created_at: string | null
          id: string
          ruolo_canale: string
          user_id: string
        }
        Insert: {
          canale_id: string
          created_at?: string | null
          id?: string
          ruolo_canale?: string
          user_id: string
        }
        Update: {
          canale_id?: string
          created_at?: string | null
          id?: string
          ruolo_canale?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_canali_membri_canale_id_fkey"
            columns: ["canale_id"]
            isOneToOne: false
            referencedRelation: "chat_canali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_canali_membri_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conferme_lettura: {
        Row: {
          confermato: boolean | null
          confermato_at: string | null
          created_at: string | null
          id: string
          messaggio_id: string
          user_id: string
        }
        Insert: {
          confermato?: boolean | null
          confermato_at?: string | null
          created_at?: string | null
          id?: string
          messaggio_id: string
          user_id: string
        }
        Update: {
          confermato?: boolean | null
          confermato_at?: string | null
          created_at?: string | null
          id?: string
          messaggio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conferme_lettura_messaggio_id_fkey"
            columns: ["messaggio_id"]
            isOneToOne: false
            referencedRelation: "chat_messaggi_interni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conferme_lettura_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messaggi: {
        Row: {
          created_at: string | null
          entita_id: string
          entita_tipo: string
          id: string
          letto: boolean | null
          messaggio: string
          mittente_id: string
        }
        Insert: {
          created_at?: string | null
          entita_id: string
          entita_tipo: string
          id?: string
          letto?: boolean | null
          messaggio: string
          mittente_id: string
        }
        Update: {
          created_at?: string | null
          entita_id?: string
          entita_tipo?: string
          id?: string
          letto?: boolean | null
          messaggio?: string
          mittente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messaggi_mittente_id_fkey"
            columns: ["mittente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messaggi_interni: {
        Row: {
          canale_id: string
          created_at: string | null
          id: string
          messaggio: string
          mittente_id: string
          richiedi_conferma: boolean | null
          tipo_messaggio: string
        }
        Insert: {
          canale_id: string
          created_at?: string | null
          id?: string
          messaggio: string
          mittente_id: string
          richiedi_conferma?: boolean | null
          tipo_messaggio?: string
        }
        Update: {
          canale_id?: string
          created_at?: string | null
          id?: string
          messaggio?: string
          mittente_id?: string
          richiedi_conferma?: boolean | null
          tipo_messaggio?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messaggi_interni_canale_id_fkey"
            columns: ["canale_id"]
            isOneToOne: false
            referencedRelation: "chat_canali"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messaggi_interni_mittente_id_fkey"
            columns: ["mittente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chiusure_contabili: {
        Row: {
          avviato_da: string | null
          completato_da: string | null
          completato_il: string | null
          created_at: string | null
          id: string
          note: string | null
          periodo: string
          stato: string
          step_movimenti: boolean | null
          step_quadratura_iva: boolean | null
          step_report: boolean | null
          step_riconciliazione: boolean | null
          step_scadenziario: boolean | null
          tipo: string
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          avviato_da?: string | null
          completato_da?: string | null
          completato_il?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          periodo: string
          stato?: string
          step_movimenti?: boolean | null
          step_quadratura_iva?: boolean | null
          step_report?: boolean | null
          step_riconciliazione?: boolean | null
          step_scadenziario?: boolean | null
          tipo?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avviato_da?: string | null
          completato_da?: string | null
          completato_il?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          periodo?: string
          stato?: string
          step_movimenti?: boolean | null
          step_quadratura_iva?: boolean | null
          step_report?: boolean | null
          step_riconciliazione?: boolean | null
          step_scadenziario?: boolean | null
          tipo?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chiusure_contabili_avviato_da_fkey"
            columns: ["avviato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chiusure_contabili_completato_da_fkey"
            columns: ["completato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chiusure_contabili_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti: {
        Row: {
          attenzione_di: string | null
          attivita: string | null
          attivo: boolean | null
          azienda_ssn_sx: boolean | null
          azienda_stat: string | null
          cap_residenza: string | null
          cap_sede: string | null
          cellulare: string | null
          citta_residenza: string | null
          citta_sede: string | null
          cliente_associato: boolean | null
          cliente_captive: boolean | null
          cliente_non_ceduto: boolean | null
          codice_ateco: string | null
          codice_fiscale: string | null
          codice_fiscale_azienda: string | null
          codice_ricerca: string | null
          codice_sdi: string | null
          cognome: string | null
          comune_nascita: string | null
          contratto: string | null
          created_at: string | null
          data_nascita: string | null
          email: string | null
          fatturato: number | null
          fax: string | null
          fido_cauzioni: number | null
          fido_credito: number | null
          forma_giuridica: string | null
          gruppo_finanziario_id: string | null
          id: string
          indirizzo_residenza: string | null
          indirizzo_sede: string | null
          indotto: string | null
          internazionale: boolean | null
          luogo_nascita: string | null
          matricola: string | null
          nazione: string | null
          nome: string | null
          note: string | null
          num_dipendenti: number | null
          partita_iva: string | null
          pec: string | null
          prospect: string | null
          provincia_nascita: string | null
          provincia_residenza: string | null
          provincia_sede: string | null
          ragione_sociale: string | null
          referente_cognome: string | null
          referente_email: string | null
          referente_nome: string | null
          referente_telefono: string | null
          riferimento: string | null
          sesso: string | null
          settore: string | null
          spec_sx_danni: string | null
          spec_sx_sanita: string | null
          statistica_premi_sinistri: boolean | null
          stato_cliente: string | null
          telefono: string | null
          tipo_cliente: string
          tipo_persona: string | null
          tipo_sommario: string | null
          titolo: string | null
          ufficio_id: string | null
          updated_at: string | null
          user_id: string | null
          zona: string | null
        }
        Insert: {
          attenzione_di?: string | null
          attivita?: string | null
          attivo?: boolean | null
          azienda_ssn_sx?: boolean | null
          azienda_stat?: string | null
          cap_residenza?: string | null
          cap_sede?: string | null
          cellulare?: string | null
          citta_residenza?: string | null
          citta_sede?: string | null
          cliente_associato?: boolean | null
          cliente_captive?: boolean | null
          cliente_non_ceduto?: boolean | null
          codice_ateco?: string | null
          codice_fiscale?: string | null
          codice_fiscale_azienda?: string | null
          codice_ricerca?: string | null
          codice_sdi?: string | null
          cognome?: string | null
          comune_nascita?: string | null
          contratto?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          fatturato?: number | null
          fax?: string | null
          fido_cauzioni?: number | null
          fido_credito?: number | null
          forma_giuridica?: string | null
          gruppo_finanziario_id?: string | null
          id?: string
          indirizzo_residenza?: string | null
          indirizzo_sede?: string | null
          indotto?: string | null
          internazionale?: boolean | null
          luogo_nascita?: string | null
          matricola?: string | null
          nazione?: string | null
          nome?: string | null
          note?: string | null
          num_dipendenti?: number | null
          partita_iva?: string | null
          pec?: string | null
          prospect?: string | null
          provincia_nascita?: string | null
          provincia_residenza?: string | null
          provincia_sede?: string | null
          ragione_sociale?: string | null
          referente_cognome?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          referente_telefono?: string | null
          riferimento?: string | null
          sesso?: string | null
          settore?: string | null
          spec_sx_danni?: string | null
          spec_sx_sanita?: string | null
          statistica_premi_sinistri?: boolean | null
          stato_cliente?: string | null
          telefono?: string | null
          tipo_cliente?: string
          tipo_persona?: string | null
          tipo_sommario?: string | null
          titolo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zona?: string | null
        }
        Update: {
          attenzione_di?: string | null
          attivita?: string | null
          attivo?: boolean | null
          azienda_ssn_sx?: boolean | null
          azienda_stat?: string | null
          cap_residenza?: string | null
          cap_sede?: string | null
          cellulare?: string | null
          citta_residenza?: string | null
          citta_sede?: string | null
          cliente_associato?: boolean | null
          cliente_captive?: boolean | null
          cliente_non_ceduto?: boolean | null
          codice_ateco?: string | null
          codice_fiscale?: string | null
          codice_fiscale_azienda?: string | null
          codice_ricerca?: string | null
          codice_sdi?: string | null
          cognome?: string | null
          comune_nascita?: string | null
          contratto?: string | null
          created_at?: string | null
          data_nascita?: string | null
          email?: string | null
          fatturato?: number | null
          fax?: string | null
          fido_cauzioni?: number | null
          fido_credito?: number | null
          forma_giuridica?: string | null
          gruppo_finanziario_id?: string | null
          id?: string
          indirizzo_residenza?: string | null
          indirizzo_sede?: string | null
          indotto?: string | null
          internazionale?: boolean | null
          luogo_nascita?: string | null
          matricola?: string | null
          nazione?: string | null
          nome?: string | null
          note?: string | null
          num_dipendenti?: number | null
          partita_iva?: string | null
          pec?: string | null
          prospect?: string | null
          provincia_nascita?: string | null
          provincia_residenza?: string | null
          provincia_sede?: string | null
          ragione_sociale?: string | null
          referente_cognome?: string | null
          referente_email?: string | null
          referente_nome?: string | null
          referente_telefono?: string | null
          riferimento?: string | null
          sesso?: string | null
          settore?: string | null
          spec_sx_danni?: string | null
          spec_sx_sanita?: string | null
          statistica_premi_sinistri?: boolean | null
          stato_cliente?: string | null
          telefono?: string | null
          tipo_cliente?: string
          tipo_persona?: string | null
          tipo_sommario?: string | null
          titolo?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          zona?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clienti_gruppo_finanziario_id_fkey"
            columns: ["gruppo_finanziario_id"]
            isOneToOne: false
            referencedRelation: "gruppi_finanziari"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti_relazioni: {
        Row: {
          cliente_collegato_id: string
          cliente_id: string
          created_at: string | null
          id: string
          note: string | null
          tipo_relazione: string
        }
        Insert: {
          cliente_collegato_id: string
          cliente_id: string
          created_at?: string | null
          id?: string
          note?: string | null
          tipo_relazione?: string
        }
        Update: {
          cliente_collegato_id?: string
          cliente_id?: string
          created_at?: string | null
          id?: string
          note?: string | null
          tipo_relazione?: string
        }
        Relationships: [
          {
            foreignKeyName: "clienti_relazioni_cliente_collegato_id_fkey"
            columns: ["cliente_collegato_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_relazioni_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      codici_commerciali_cliente: {
        Row: {
          altro_broker: boolean | null
          altro_broker_nome: string | null
          cliente_id: string
          contatto: string | null
          created_at: string | null
          data_acquisito: string | null
          data_disdetta: string | null
          filiale: string | null
          id: string
          mandato: string | null
          percentuale: number | null
          profilo_id: string | null
          ruolo: string
          scadenza_mandato: string | null
          societa_brand: string | null
          termine_proroga: string | null
          updated_at: string | null
        }
        Insert: {
          altro_broker?: boolean | null
          altro_broker_nome?: string | null
          cliente_id: string
          contatto?: string | null
          created_at?: string | null
          data_acquisito?: string | null
          data_disdetta?: string | null
          filiale?: string | null
          id?: string
          mandato?: string | null
          percentuale?: number | null
          profilo_id?: string | null
          ruolo: string
          scadenza_mandato?: string | null
          societa_brand?: string | null
          termine_proroga?: string | null
          updated_at?: string | null
        }
        Update: {
          altro_broker?: boolean | null
          altro_broker_nome?: string | null
          cliente_id?: string
          contatto?: string | null
          created_at?: string | null
          data_acquisito?: string | null
          data_disdetta?: string | null
          filiale?: string | null
          id?: string
          mandato?: string | null
          percentuale?: number | null
          profilo_id?: string | null
          ruolo?: string
          scadenza_mandato?: string | null
          societa_brand?: string | null
          termine_proroga?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codici_commerciali_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codici_commerciali_cliente_profilo_id_fkey"
            columns: ["profilo_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compagnie: {
        Row: {
          attiva: boolean | null
          cap: string | null
          codice: string | null
          codice_fiscale: string | null
          comune: string | null
          created_at: string | null
          fax: string | null
          gruppo_compagnia: string | null
          gruppo_statistico: string | null
          iban: string | null
          id: string
          indirizzo: string | null
          intestato_a: string | null
          mail: string | null
          mail_avvisi: string | null
          mail_ec: string | null
          nome: string
          nome_segue: string | null
          partita_iva: string | null
          pec: string | null
          percentuale_ra: number | null
          provincia: string | null
          stato: string | null
          telefono: string | null
          tipo_mandatario: string | null
          ultima_scadenza_polizza: string | null
        }
        Insert: {
          attiva?: boolean | null
          cap?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          created_at?: string | null
          fax?: string | null
          gruppo_compagnia?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestato_a?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nome: string
          nome_segue?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          stato?: string | null
          telefono?: string | null
          tipo_mandatario?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Update: {
          attiva?: boolean | null
          cap?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          comune?: string | null
          created_at?: string | null
          fax?: string | null
          gruppo_compagnia?: string | null
          gruppo_statistico?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestato_a?: string | null
          mail?: string | null
          mail_avvisi?: string | null
          mail_ec?: string | null
          nome?: string
          nome_segue?: string | null
          partita_iva?: string | null
          pec?: string | null
          percentuale_ra?: number | null
          provincia?: string | null
          stato?: string | null
          telefono?: string | null
          tipo_mandatario?: string | null
          ultima_scadenza_polizza?: string | null
        }
        Relationships: []
      }
      dettaglio_riparto: {
        Row: {
          addizionali: number | null
          compagnia_id: string | null
          created_at: string | null
          data_copertura: string | null
          emissione_compagnia: string | null
          id: string
          netto: number | null
          perc_gestione: number | null
          perc_provv_addizionali: number | null
          perc_provv_netto: number | null
          provv_addizionali: number | null
          provv_netto: number | null
          quota_percentuale: number | null
          tasse: number | null
          tipo_pagamento: string | null
          titolo_id: string
          totale: number | null
        }
        Insert: {
          addizionali?: number | null
          compagnia_id?: string | null
          created_at?: string | null
          data_copertura?: string | null
          emissione_compagnia?: string | null
          id?: string
          netto?: number | null
          perc_gestione?: number | null
          perc_provv_addizionali?: number | null
          perc_provv_netto?: number | null
          provv_addizionali?: number | null
          provv_netto?: number | null
          quota_percentuale?: number | null
          tasse?: number | null
          tipo_pagamento?: string | null
          titolo_id: string
          totale?: number | null
        }
        Update: {
          addizionali?: number | null
          compagnia_id?: string | null
          created_at?: string | null
          data_copertura?: string | null
          emissione_compagnia?: string | null
          id?: string
          netto?: number | null
          perc_gestione?: number | null
          perc_provv_addizionali?: number | null
          perc_provv_netto?: number | null
          provv_addizionali?: number | null
          provv_netto?: number | null
          quota_percentuale?: number | null
          tasse?: number | null
          tipo_pagamento?: string | null
          titolo_id?: string
          totale?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dettaglio_riparto_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dettaglio_riparto_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      distinte_giornaliere: {
        Row: {
          chiuso_da: string | null
          chiuso_il: string | null
          created_at: string | null
          creato_da: string | null
          data_distinta: string
          differenza_cassa: number | null
          id: string
          note: string | null
          saldo_cassa_atteso: number | null
          stato: string
          totale_assegni: number | null
          totale_bonifici: number | null
          totale_contanti: number | null
          totale_generale: number | null
          totale_pos: number | null
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          chiuso_da?: string | null
          chiuso_il?: string | null
          created_at?: string | null
          creato_da?: string | null
          data_distinta: string
          differenza_cassa?: number | null
          id?: string
          note?: string | null
          saldo_cassa_atteso?: number | null
          stato?: string
          totale_assegni?: number | null
          totale_bonifici?: number | null
          totale_contanti?: number | null
          totale_generale?: number | null
          totale_pos?: number | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chiuso_da?: string | null
          chiuso_il?: string | null
          created_at?: string | null
          creato_da?: string | null
          data_distinta?: string
          differenza_cassa?: number | null
          id?: string
          note?: string | null
          saldo_cassa_atteso?: number | null
          stato?: string
          totale_assegni?: number | null
          totale_bonifici?: number | null
          totale_contanti?: number | null
          totale_generale?: number | null
          totale_pos?: number | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distinte_giornaliere_chiuso_da_fkey"
            columns: ["chiuso_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distinte_giornaliere_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distinte_giornaliere_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      distinte_giornaliere_righe: {
        Row: {
          created_at: string | null
          descrizione: string | null
          distinta_id: string
          id: string
          importo: number
          movimento_id: string | null
          riferimento: string | null
          tipo_pagamento: string
        }
        Insert: {
          created_at?: string | null
          descrizione?: string | null
          distinta_id: string
          id?: string
          importo?: number
          movimento_id?: string | null
          riferimento?: string | null
          tipo_pagamento: string
        }
        Update: {
          created_at?: string | null
          descrizione?: string | null
          distinta_id?: string
          id?: string
          importo?: number
          movimento_id?: string | null
          riferimento?: string | null
          tipo_pagamento?: string
        }
        Relationships: [
          {
            foreignKeyName: "distinte_giornaliere_righe_distinta_id_fkey"
            columns: ["distinta_id"]
            isOneToOne: false
            referencedRelation: "distinte_giornaliere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distinte_giornaliere_righe_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimenti_contabili"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          active: boolean | null
          compagnia_id: string | null
          created_at: string | null
          description: string | null
          folder_type: string
          icon: string | null
          id: string
          name: string
          order_index: number | null
          parent_folder_id: string | null
        }
        Insert: {
          active?: boolean | null
          compagnia_id?: string | null
          created_at?: string | null
          description?: string | null
          folder_type?: string
          icon?: string | null
          id?: string
          name: string
          order_index?: number | null
          parent_folder_id?: string | null
        }
        Update: {
          active?: boolean | null
          compagnia_id?: string | null
          created_at?: string | null
          description?: string | null
          folder_type?: string
          icon?: string | null
          id?: string
          name?: string
          order_index?: number | null
          parent_folder_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_library: {
        Row: {
          active: boolean | null
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          folder_id: string
          id: string
          tags: string[] | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          folder_id: string
          id?: string
          tags?: string[] | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          active?: boolean | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          folder_id?: string
          id?: string
          tags?: string[] | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_library_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      documenti: {
        Row: {
          bucket_name: string
          caricato_da: string | null
          categoria: string | null
          created_at: string | null
          entita_id: string
          entita_tipo: string
          id: string
          nome_file: string
          path_storage: string
          visibile_al_cliente: boolean | null
        }
        Insert: {
          bucket_name?: string
          caricato_da?: string | null
          categoria?: string | null
          created_at?: string | null
          entita_id: string
          entita_tipo: string
          id?: string
          nome_file: string
          path_storage: string
          visibile_al_cliente?: boolean | null
        }
        Update: {
          bucket_name?: string
          caricato_da?: string | null
          categoria?: string | null
          created_at?: string | null
          entita_id?: string
          entita_tipo?: string
          id?: string
          nome_file?: string
          path_storage?: string
          visibile_al_cliente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "documenti_caricato_da_fkey"
            columns: ["caricato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documenti_utenti: {
        Row: {
          categoria: string
          created_at: string | null
          id: string
          nome_file: string
          note: string | null
          path_storage: string
          user_id: string
        }
        Insert: {
          categoria?: string
          created_at?: string | null
          id?: string
          nome_file: string
          note?: string | null
          path_storage: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string | null
          id?: string
          nome_file?: string
          note?: string | null
          path_storage?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documenti_utenti_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      elab_annuali: {
        Row: {
          anno: number
          created_at: string | null
          eseguita_da: string | null
          id: string
          risultato_json: Json | null
          stato: string | null
          tipo: string
          ufficio_id: string | null
        }
        Insert: {
          anno: number
          created_at?: string | null
          eseguita_da?: string | null
          id?: string
          risultato_json?: Json | null
          stato?: string | null
          tipo: string
          ufficio_id?: string | null
        }
        Update: {
          anno?: number
          created_at?: string | null
          eseguita_da?: string | null
          id?: string
          risultato_json?: Json | null
          stato?: string | null
          tipo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elab_annuali_eseguita_da_fkey"
            columns: ["eseguita_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elab_annuali_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      elaborazioni_periodiche: {
        Row: {
          created_at: string | null
          eseguita_da: string | null
          id: string
          periodo_a: string | null
          periodo_da: string | null
          risultato_json: Json | null
          stato: string | null
          tipo: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string | null
          eseguita_da?: string | null
          id?: string
          periodo_a?: string | null
          periodo_da?: string | null
          risultato_json?: Json | null
          stato?: string | null
          tipo: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string | null
          eseguita_da?: string | null
          id?: string
          periodo_a?: string | null
          periodo_da?: string | null
          risultato_json?: Json | null
          stato?: string | null
          tipo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elaborazioni_periodiche_eseguita_da_fkey"
            columns: ["eseguita_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elaborazioni_periodiche_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      estratti_conto: {
        Row: {
          created_at: string | null
          data_operazione: string
          descrizione: string | null
          documento_id: string | null
          hash_riga: string | null
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
          documento_id?: string | null
          hash_riga?: string | null
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
          documento_id?: string | null
          hash_riga?: string | null
          id?: string
          importo?: number
          saldo?: number | null
          stato?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estratti_conto_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "banca_documenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estratti_conto_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      filiali: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      flussi_compagnia: {
        Row: {
          api_endpoint: string | null
          api_response: string | null
          compagnia_id: string | null
          created_at: string
          created_by: string | null
          formato: string
          id: string
          payload_output: string | null
          periodo: string
          stato: string
          tipo_flusso: string
          ufficio_id: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_response?: string | null
          compagnia_id?: string | null
          created_at?: string
          created_by?: string | null
          formato?: string
          id?: string
          payload_output?: string | null
          periodo: string
          stato?: string
          tipo_flusso?: string
          ufficio_id?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_response?: string | null
          compagnia_id?: string | null
          created_at?: string
          created_by?: string | null
          formato?: string
          id?: string
          payload_output?: string | null
          periodo?: string
          stato?: string
          tipo_flusso?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flussi_compagnia_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flussi_compagnia_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flussi_compagnia_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      fornitori: {
        Row: {
          attivo: boolean | null
          cap: string | null
          codice: string | null
          codice_fiscale: string | null
          created_at: string | null
          email: string | null
          id: string
          indirizzo: string | null
          localita: string | null
          nazione: string | null
          nome: string
          partita_iva: string | null
          pec: string | null
          provincia: string | null
          stato_cliente: boolean | null
          stato_fornitore: boolean | null
          stato_soggetto: boolean | null
          ufficio_id: string | null
          ultima_fattura: string | null
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          cap?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          localita?: string | null
          nazione?: string | null
          nome: string
          partita_iva?: string | null
          pec?: string | null
          provincia?: string | null
          stato_cliente?: boolean | null
          stato_fornitore?: boolean | null
          stato_soggetto?: boolean | null
          ufficio_id?: string | null
          ultima_fattura?: string | null
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          cap?: string | null
          codice?: string | null
          codice_fiscale?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          localita?: string | null
          nazione?: string | null
          nome?: string
          partita_iva?: string | null
          pec?: string | null
          provincia?: string | null
          stato_cliente?: boolean | null
          stato_fornitore?: boolean | null
          stato_soggetto?: boolean | null
          ufficio_id?: string | null
          ultima_fattura?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornitori_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      gruppi_compagnia: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      gruppi_finanziari: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
          nome: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
          nome?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      gruppi_ramo: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      gruppi_statistici: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      impostazioni_sistema: {
        Row: {
          chiave: string
          descrizione: string | null
          id: string
          updated_at: string
          valore_json: Json
        }
        Insert: {
          chiave: string
          descrizione?: string | null
          id?: string
          updated_at?: string
          valore_json?: Json
        }
        Update: {
          chiave?: string
          descrizione?: string | null
          id?: string
          updated_at?: string
          valore_json?: Json
        }
        Relationships: []
      }
      impostazioni_ufficio: {
        Row: {
          chiave: string
          id: string
          ufficio_id: string
          updated_at: string
          valore_json: Json
        }
        Insert: {
          chiave: string
          id?: string
          ufficio_id: string
          updated_at?: string
          valore_json?: Json
        }
        Update: {
          chiave?: string
          id?: string
          ufficio_id?: string
          updated_at?: string
          valore_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "impostazioni_ufficio_ufficio_id_fkey"
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
          matching_metodo: string | null
          matching_score: number | null
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
          matching_metodo?: string | null
          matching_score?: number | null
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
          matching_metodo?: string | null
          matching_score?: number | null
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
      iva_registri: {
        Row: {
          created_at: string
          id: string
          imponibile: number
          iva: number
          note: string | null
          periodo: string
          totale: number
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          imponibile?: number
          iva?: number
          note?: string | null
          periodo: string
          totale?: number
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          imponibile?: number
          iva?: number
          note?: string | null
          periodo?: string
          totale?: number
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iva_registri_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
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
          severity: string
          ufficio_id: string | null
          user_id: string | null
        }
        Insert: {
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          severity?: string
          ufficio_id?: string | null
          user_id?: string | null
        }
        Update: {
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          severity?: string
          ufficio_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_attivita_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_attivita_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      log_attivita_archivio: {
        Row: {
          archiviato_il: string | null
          azione: string | null
          created_at: string | null
          dettagli_json: Json | null
          entita_id: string | null
          entita_tipo: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          archiviato_il?: string | null
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          archiviato_il?: string | null
          azione?: string | null
          created_at?: string | null
          dettagli_json?: Json | null
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
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
          iva_aliquota: number | null
          iva_imponibile: number | null
          iva_importo: number | null
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
          iva_aliquota?: number | null
          iva_imponibile?: number | null
          iva_importo?: number | null
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
          iva_aliquota?: number | null
          iva_imponibile?: number | null
          iva_importo?: number | null
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
      note_restituzione: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          created_by: string | null
          flag_json: Json | null
          id: string
          note: string | null
          stato: string
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          flag_json?: Json | null
          id?: string
          note?: string | null
          stato?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          created_by?: string | null
          flag_json?: Json | null
          id?: string
          note?: string | null
          stato?: string
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_restituzione_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      note_restituzione_dettaglio: {
        Row: {
          created_at: string | null
          id: string
          nota_id: string
          prodotto_id: string | null
          titolo_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nota_id: string
          prodotto_id?: string | null
          titolo_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nota_id?: string
          prodotto_id?: string | null
          titolo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_restituzione_dettaglio_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "note_restituzione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_dettaglio_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_restituzione_dettaglio_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
        ]
      }
      notifiche: {
        Row: {
          created_at: string
          destinatario_id: string
          entita_id: string | null
          entita_tipo: string | null
          id: string
          letto: boolean
          messaggio: string
          priorita: string
          tipo: string
          titolo: string
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string
          destinatario_id: string
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          letto?: boolean
          messaggio: string
          priorita?: string
          tipo: string
          titolo: string
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string
          destinatario_id?: string
          entita_id?: string | null
          entita_tipo?: string | null
          id?: string
          letto?: boolean
          messaggio?: string
          priorita?: string
          tipo?: string
          titolo?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifiche_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifiche_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamenti_provvigioni: {
        Row: {
          created_at: string
          creato_da: string
          id: string
          metodo: string
          note: string | null
          pagato_a_user_id: string
          periodo_a: string
          periodo_da: string
          riferimento: string | null
          totale_importo: number
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string
          creato_da: string
          id?: string
          metodo?: string
          note?: string | null
          pagato_a_user_id: string
          periodo_a: string
          periodo_da: string
          riferimento?: string | null
          totale_importo?: number
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string
          creato_da?: string
          id?: string
          metodo?: string
          note?: string | null
          pagato_a_user_id?: string
          periodo_a?: string
          periodo_da?: string
          riferimento?: string | null
          totale_importo?: number
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamenti_provvigioni_creato_da_fkey"
            columns: ["creato_da"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamenti_provvigioni_pagato_a_user_id_fkey"
            columns: ["pagato_a_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamenti_provvigioni_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamenti_provvigioni_righe: {
        Row: {
          created_at: string
          id: string
          importo: number
          pagamento_id: string
          provvigione_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          importo?: number
          pagamento_id: string
          provvigione_id: string
        }
        Update: {
          created_at?: string
          id?: string
          importo?: number
          pagamento_id?: string
          provvigione_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamenti_provvigioni_righe_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamenti_provvigioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamenti_provvigioni_righe_provvigione_id_fkey"
            columns: ["provvigione_id"]
            isOneToOne: false
            referencedRelation: "provvigioni_generate"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_log: {
        Row: {
          created_at: string
          dettagli_json: Json | null
          durata_ms: number
          id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          dettagli_json?: Json | null
          durata_ms: number
          id?: string
          tipo: string
        }
        Update: {
          created_at?: string
          dettagli_json?: Json | null
          durata_ms?: number
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      piano_conti_conti: {
        Row: {
          attivo: boolean | null
          bic: string | null
          cf_piva: string | null
          citta: string | null
          codice: string
          created_at: string | null
          data_sospensione: string | null
          descrizione: string
          flag_stato: boolean | null
          gestione_partite: boolean | null
          gestione_tesoreria: boolean | null
          gruppo_id: string
          iban: string | null
          id: string
          natura_segno: string
          natura_tipo: string
          sezione_bilancio_id: string | null
          tipo_sezionale: string | null
          updated_at: string | null
          voce_spesa: string | null
        }
        Insert: {
          attivo?: boolean | null
          bic?: string | null
          cf_piva?: string | null
          citta?: string | null
          codice: string
          created_at?: string | null
          data_sospensione?: string | null
          descrizione: string
          flag_stato?: boolean | null
          gestione_partite?: boolean | null
          gestione_tesoreria?: boolean | null
          gruppo_id: string
          iban?: string | null
          id?: string
          natura_segno?: string
          natura_tipo?: string
          sezione_bilancio_id?: string | null
          tipo_sezionale?: string | null
          updated_at?: string | null
          voce_spesa?: string | null
        }
        Update: {
          attivo?: boolean | null
          bic?: string | null
          cf_piva?: string | null
          citta?: string | null
          codice?: string
          created_at?: string | null
          data_sospensione?: string | null
          descrizione?: string
          flag_stato?: boolean | null
          gestione_partite?: boolean | null
          gestione_tesoreria?: boolean | null
          gruppo_id?: string
          iban?: string | null
          id?: string
          natura_segno?: string
          natura_tipo?: string
          sezione_bilancio_id?: string | null
          tipo_sezionale?: string | null
          updated_at?: string | null
          voce_spesa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "piano_conti_conti_gruppo_id_fkey"
            columns: ["gruppo_id"]
            isOneToOne: false
            referencedRelation: "piano_conti_gruppi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piano_conti_conti_sezione_bilancio_id_fkey"
            columns: ["sezione_bilancio_id"]
            isOneToOne: false
            referencedRelation: "sezioni_bilancio"
            referencedColumns: ["id"]
          },
        ]
      }
      piano_conti_gruppi: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
          natura_segno: string
          natura_tipo: string
          sezione_bilancio_id: string | null
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
          natura_segno?: string
          natura_tipo?: string
          sezione_bilancio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
          natura_segno?: string
          natura_tipo?: string
          sezione_bilancio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "piano_conti_gruppi_sezione_bilancio_id_fkey"
            columns: ["sezione_bilancio_id"]
            isOneToOne: false
            referencedRelation: "sezioni_bilancio"
            referencedColumns: ["id"]
          },
        ]
      }
      portafoglio_incassi: {
        Row: {
          cliente_id: string | null
          created_at: string
          descrizione: string
          id: string
          importo_atteso: number
          periodicita: string
          prossima_scadenza: string
          stato: string
          ufficio_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descrizione: string
          id?: string
          importo_atteso?: number
          periodicita?: string
          prossima_scadenza: string
          stato?: string
          ufficio_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descrizione?: string
          id?: string
          importo_atteso?: number
          periodicita?: string
          prossima_scadenza?: string
          stato?: string
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portafoglio_incassi_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portafoglio_incassi_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      portafoglio_incassi_eventi: {
        Row: {
          created_at: string
          data_scadenza: string
          esito: string
          estratto_id: string | null
          id: string
          importo_atteso: number
          note: string | null
          portafoglio_id: string
        }
        Insert: {
          created_at?: string
          data_scadenza: string
          esito?: string
          estratto_id?: string | null
          id?: string
          importo_atteso?: number
          note?: string | null
          portafoglio_id: string
        }
        Update: {
          created_at?: string
          data_scadenza?: string
          esito?: string
          estratto_id?: string | null
          id?: string
          importo_atteso?: number
          note?: string | null
          portafoglio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portafoglio_incassi_eventi_estratto_id_fkey"
            columns: ["estratto_id"]
            isOneToOne: false
            referencedRelation: "estratti_conto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portafoglio_incassi_eventi_portafoglio_id_fkey"
            columns: ["portafoglio_id"]
            isOneToOne: false
            referencedRelation: "portafoglio_incassi"
            referencedColumns: ["id"]
          },
        ]
      }
      primanota_generale: {
        Row: {
          aliquota_ritenuta: number | null
          altri_importi: number | null
          causale_id: string | null
          created_at: string | null
          created_by: string | null
          data_documento: string | null
          data_pn: string | null
          data_protocollo: string | null
          descrizione: string | null
          fornitore_id: string | null
          id: string
          imponibile: number | null
          non_soggetto: number | null
          numero_documento: string | null
          numero_pn: string | null
          numero_protocollo: string | null
          ritenuta: number | null
          stato: string | null
          tipo: string | null
          totale: number | null
          ufficio_id: string | null
        }
        Insert: {
          aliquota_ritenuta?: number | null
          altri_importi?: number | null
          causale_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_documento?: string | null
          data_pn?: string | null
          data_protocollo?: string | null
          descrizione?: string | null
          fornitore_id?: string | null
          id?: string
          imponibile?: number | null
          non_soggetto?: number | null
          numero_documento?: string | null
          numero_pn?: string | null
          numero_protocollo?: string | null
          ritenuta?: number | null
          stato?: string | null
          tipo?: string | null
          totale?: number | null
          ufficio_id?: string | null
        }
        Update: {
          aliquota_ritenuta?: number | null
          altri_importi?: number | null
          causale_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_documento?: string | null
          data_pn?: string | null
          data_protocollo?: string | null
          descrizione?: string | null
          fornitore_id?: string | null
          id?: string
          imponibile?: number | null
          non_soggetto?: number | null
          numero_documento?: string | null
          numero_pn?: string | null
          numero_protocollo?: string | null
          ritenuta?: number | null
          stato?: string | null
          tipo?: string | null
          totale?: number | null
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "primanota_generale_causale_id_fkey"
            columns: ["causale_id"]
            isOneToOne: false
            referencedRelation: "causali_contabili"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primanota_generale_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primanota_generale_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "fornitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "primanota_generale_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_consensi: {
        Row: {
          cliente_id: string
          created_at: string | null
          data_consenso: string
          fonte: string | null
          id: string
          informativa_id: string | null
          stato: string
          tipo_consenso: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data_consenso?: string
          fonte?: string | null
          id?: string
          informativa_id?: string | null
          stato: string
          tipo_consenso: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data_consenso?: string
          fonte?: string | null
          id?: string
          informativa_id?: string | null
          stato?: string
          tipo_consenso?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_consensi_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_consensi_informativa_id_fkey"
            columns: ["informativa_id"]
            isOneToOne: false
            referencedRelation: "privacy_informative"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_informative: {
        Row: {
          attiva: boolean | null
          contenuto: string | null
          created_at: string | null
          id: string
          titolo: string
          versione: string
        }
        Insert: {
          attiva?: boolean | null
          contenuto?: string | null
          created_at?: string | null
          id?: string
          titolo: string
          versione: string
        }
        Update: {
          attiva?: boolean | null
          contenuto?: string | null
          created_at?: string | null
          id?: string
          titolo?: string
          versione?: string
        }
        Relationships: []
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
          cap: string | null
          citta: string | null
          codice_contabile: string | null
          codice_fiscale: string | null
          cognome: string | null
          created_at: string | null
          data_iscrizione_rui: string | null
          descrizione: string | null
          email: string | null
          fax: string | null
          iban: string | null
          id: string
          indirizzo: string | null
          intestatario_cc: string | null
          nome: string | null
          nome_rui: string | null
          numero_rui: string | null
          percentuale_base: number | null
          percentuale_consulenza: number | null
          percentuale_ra: number | null
          permessi_json: Json | null
          provincia: string | null
          ruolo: string | null
          search_vector: unknown
          sezione_rui: string | null
          telefono: string | null
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          attivo?: boolean | null
          cap?: string | null
          citta?: string | null
          codice_contabile?: string | null
          codice_fiscale?: string | null
          cognome?: string | null
          created_at?: string | null
          data_iscrizione_rui?: string | null
          descrizione?: string | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id: string
          indirizzo?: string | null
          intestatario_cc?: string | null
          nome?: string | null
          nome_rui?: string | null
          numero_rui?: string | null
          percentuale_base?: number | null
          percentuale_consulenza?: number | null
          percentuale_ra?: number | null
          permessi_json?: Json | null
          provincia?: string | null
          ruolo?: string | null
          search_vector?: unknown
          sezione_rui?: string | null
          telefono?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attivo?: boolean | null
          cap?: string | null
          citta?: string | null
          codice_contabile?: string | null
          codice_fiscale?: string | null
          cognome?: string | null
          created_at?: string | null
          data_iscrizione_rui?: string | null
          descrizione?: string | null
          email?: string | null
          fax?: string | null
          iban?: string | null
          id?: string
          indirizzo?: string | null
          intestatario_cc?: string | null
          nome?: string | null
          nome_rui?: string | null
          numero_rui?: string | null
          percentuale_base?: number | null
          percentuale_consulenza?: number | null
          percentuale_ra?: number | null
          permessi_json?: Json | null
          provincia?: string | null
          ruolo?: string | null
          search_vector?: unknown
          sezione_rui?: string | null
          telefono?: string | null
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
          search_vector: unknown
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
          search_vector?: unknown
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
          search_vector?: unknown
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
      rami: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          gruppo_ramo_id: string | null
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          gruppo_ramo_id?: string | null
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          gruppo_ramo_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rami_gruppo_ramo_id_fkey"
            columns: ["gruppo_ramo_id"]
            isOneToOne: false
            referencedRelation: "gruppi_ramo"
            referencedColumns: ["id"]
          },
        ]
      }
      report_salvati: {
        Row: {
          created_at: string
          creato_da: string
          filtri_json: Json | null
          id: string
          nome: string
          tipo_report: string
        }
        Insert: {
          created_at?: string
          creato_da: string
          filtri_json?: Json | null
          id?: string
          nome: string
          tipo_report?: string
        }
        Update: {
          created_at?: string
          creato_da?: string
          filtri_json?: Json | null
          id?: string
          nome?: string
          tipo_report?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_salvati_creato_da_fkey"
            columns: ["creato_da"]
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
      scadenziario: {
        Row: {
          created_at: string | null
          data_pagamento: string | null
          data_scadenza: string
          descrizione: string | null
          fornitore_id: string | null
          id: string
          importo: number | null
          primanota_id: string | null
          stato: string | null
          ufficio_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_pagamento?: string | null
          data_scadenza: string
          descrizione?: string | null
          fornitore_id?: string | null
          id?: string
          importo?: number | null
          primanota_id?: string | null
          stato?: string | null
          ufficio_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_pagamento?: string | null
          data_scadenza?: string
          descrizione?: string | null
          fornitore_id?: string | null
          id?: string
          importo?: number | null
          primanota_id?: string | null
          stato?: string | null
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scadenziario_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "fornitori"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenziario_primanota_id_fkey"
            columns: ["primanota_id"]
            isOneToOne: false
            referencedRelation: "primanota_generale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scadenziario_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      sezioni_bilancio: {
        Row: {
          attivo: boolean | null
          codice: string
          created_at: string | null
          descrizione: string
          id: string
          ordine: number | null
        }
        Insert: {
          attivo?: boolean | null
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
          ordine?: number | null
        }
        Update: {
          attivo?: boolean | null
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
          ordine?: number | null
        }
        Relationships: []
      }
      sinistri: {
        Row: {
          cliente_id: string | null
          compagnia_id: string | null
          created_at: string | null
          data_apertura: string
          data_chiusura: string | null
          descrizione: string | null
          id: string
          numero_sinistro: string | null
          responsabile_id: string | null
          search_vector: unknown
          stato: string
          titolo_id: string | null
          ufficio_id: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          data_apertura?: string
          data_chiusura?: string | null
          descrizione?: string | null
          id?: string
          numero_sinistro?: string | null
          responsabile_id?: string | null
          search_vector?: unknown
          stato?: string
          titolo_id?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          data_apertura?: string
          data_chiusura?: string | null
          descrizione?: string | null
          id?: string
          numero_sinistro?: string | null
          responsabile_id?: string | null
          search_vector?: unknown
          stato?: string
          titolo_id?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistri_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_responsabile_id_fkey"
            columns: ["responsabile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_titolo_id_fkey"
            columns: ["titolo_id"]
            isOneToOne: false
            referencedRelation: "titoli"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistri_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_checklist: {
        Row: {
          completato: boolean | null
          created_at: string | null
          descrizione: string
          id: string
          obbligatorio: boolean | null
          sinistro_id: string
        }
        Insert: {
          completato?: boolean | null
          created_at?: string | null
          descrizione: string
          id?: string
          obbligatorio?: boolean | null
          sinistro_id: string
        }
        Update: {
          completato?: boolean | null
          created_at?: string | null
          descrizione?: string
          id?: string
          obbligatorio?: boolean | null
          sinistro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_checklist_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistri"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_eventi: {
        Row: {
          created_at: string | null
          data_scadenza: string
          id: string
          note: string | null
          sinistro_id: string
          stato: string
          tipo_evento: string
        }
        Insert: {
          created_at?: string | null
          data_scadenza: string
          id?: string
          note?: string | null
          sinistro_id: string
          stato?: string
          tipo_evento: string
        }
        Update: {
          created_at?: string | null
          data_scadenza?: string
          id?: string
          note?: string | null
          sinistro_id?: string
          stato?: string
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_eventi_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistri"
            referencedColumns: ["id"]
          },
        ]
      }
      spedizioni_cartacee: {
        Row: {
          corriere: string | null
          created_at: string | null
          created_by: string | null
          data_spedizione: string
          id: string
          nota_id: string | null
          stato: string
          tipo_spedizione: string
          tracking_code: string | null
          ufficio_id: string | null
        }
        Insert: {
          corriere?: string | null
          created_at?: string | null
          created_by?: string | null
          data_spedizione?: string
          id?: string
          nota_id?: string | null
          stato?: string
          tipo_spedizione?: string
          tracking_code?: string | null
          ufficio_id?: string | null
        }
        Update: {
          corriere?: string | null
          created_at?: string | null
          created_by?: string | null
          data_spedizione?: string
          id?: string
          nota_id?: string | null
          stato?: string
          tipo_spedizione?: string
          tracking_code?: string | null
          ufficio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spedizioni_cartacee_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spedizioni_cartacee_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "note_restituzione"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spedizioni_cartacee_ufficio_id_fkey"
            columns: ["ufficio_id"]
            isOneToOne: false
            referencedRelation: "uffici"
            referencedColumns: ["id"]
          },
        ]
      }
      tipi_mandatario: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      tipi_rinnovo: {
        Row: {
          attivo: boolean
          codice: string
          created_at: string | null
          descrizione: string
          id: string
        }
        Insert: {
          attivo?: boolean
          codice: string
          created_at?: string | null
          descrizione: string
          id?: string
        }
        Update: {
          attivo?: boolean
          codice?: string
          created_at?: string | null
          descrizione?: string
          id?: string
        }
        Relationships: []
      }
      titoli: {
        Row: {
          addizionali: number | null
          addizionali_quietanza: number | null
          anni_durata: number | null
          appendice: string | null
          cambio: number | null
          cig_rif: string | null
          cliente_anagrafica_id: string | null
          cliente_id: string | null
          compagnia_id: string | null
          created_at: string | null
          data_competenza: string | null
          data_incasso: string | null
          data_scadenza: string | null
          descrizione_polizza: string | null
          disdetta_mesi: number | null
          durata_a: string | null
          durata_da: string | null
          emissione_fee: boolean | null
          formato_elettronico: boolean | null
          garanzia_a: string | null
          garanzia_da: string | null
          giorni_presentazione: number | null
          gruppo_ramo: string | null
          id: string
          importo_incassato: number | null
          indicizzata: boolean | null
          libro_matricola: string | null
          limite_mora: string | null
          mora_giorni: number | null
          no_calcolo_tasse: boolean | null
          note: string | null
          numero_titolo: string | null
          pag_diretto_compagnia: boolean | null
          periodicita: string | null
          premio_lordo: number | null
          premio_netto: number | null
          premio_netto_quietanza: number | null
          prodotto_id: string | null
          produttore_id: string | null
          provvigioni_firma: number | null
          provvigioni_quietanza: number | null
          ramo_id: string | null
          rate: number | null
          regolazione: boolean | null
          riga: number | null
          rimborso: boolean | null
          search_vector: unknown
          sostituisce_appendice: string | null
          sostituisce_polizza: string | null
          sostituisce_riga: number | null
          specialist: string | null
          stato: string
          storno_appendice: string | null
          storno_polizza: string | null
          storno_riga: number | null
          targa_telaio: string | null
          tasse: number | null
          tasse_quietanza: number | null
          tipo_lettera_regolazione: string | null
          tipo_portafoglio: string | null
          tipo_rinnovo: string | null
          tipo_scadenza: string | null
          ufficio_id: string | null
          updated_at: string | null
          valuta: string | null
          vincolo: string | null
        }
        Insert: {
          addizionali?: number | null
          addizionali_quietanza?: number | null
          anni_durata?: number | null
          appendice?: string | null
          cambio?: number | null
          cig_rif?: string | null
          cliente_anagrafica_id?: string | null
          cliente_id?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          data_competenza?: string | null
          data_incasso?: string | null
          data_scadenza?: string | null
          descrizione_polizza?: string | null
          disdetta_mesi?: number | null
          durata_a?: string | null
          durata_da?: string | null
          emissione_fee?: boolean | null
          formato_elettronico?: boolean | null
          garanzia_a?: string | null
          garanzia_da?: string | null
          giorni_presentazione?: number | null
          gruppo_ramo?: string | null
          id?: string
          importo_incassato?: number | null
          indicizzata?: boolean | null
          libro_matricola?: string | null
          limite_mora?: string | null
          mora_giorni?: number | null
          no_calcolo_tasse?: boolean | null
          note?: string | null
          numero_titolo?: string | null
          pag_diretto_compagnia?: boolean | null
          periodicita?: string | null
          premio_lordo?: number | null
          premio_netto?: number | null
          premio_netto_quietanza?: number | null
          prodotto_id?: string | null
          produttore_id?: string | null
          provvigioni_firma?: number | null
          provvigioni_quietanza?: number | null
          ramo_id?: string | null
          rate?: number | null
          regolazione?: boolean | null
          riga?: number | null
          rimborso?: boolean | null
          search_vector?: unknown
          sostituisce_appendice?: string | null
          sostituisce_polizza?: string | null
          sostituisce_riga?: number | null
          specialist?: string | null
          stato?: string
          storno_appendice?: string | null
          storno_polizza?: string | null
          storno_riga?: number | null
          targa_telaio?: string | null
          tasse?: number | null
          tasse_quietanza?: number | null
          tipo_lettera_regolazione?: string | null
          tipo_portafoglio?: string | null
          tipo_rinnovo?: string | null
          tipo_scadenza?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          valuta?: string | null
          vincolo?: string | null
        }
        Update: {
          addizionali?: number | null
          addizionali_quietanza?: number | null
          anni_durata?: number | null
          appendice?: string | null
          cambio?: number | null
          cig_rif?: string | null
          cliente_anagrafica_id?: string | null
          cliente_id?: string | null
          compagnia_id?: string | null
          created_at?: string | null
          data_competenza?: string | null
          data_incasso?: string | null
          data_scadenza?: string | null
          descrizione_polizza?: string | null
          disdetta_mesi?: number | null
          durata_a?: string | null
          durata_da?: string | null
          emissione_fee?: boolean | null
          formato_elettronico?: boolean | null
          garanzia_a?: string | null
          garanzia_da?: string | null
          giorni_presentazione?: number | null
          gruppo_ramo?: string | null
          id?: string
          importo_incassato?: number | null
          indicizzata?: boolean | null
          libro_matricola?: string | null
          limite_mora?: string | null
          mora_giorni?: number | null
          no_calcolo_tasse?: boolean | null
          note?: string | null
          numero_titolo?: string | null
          pag_diretto_compagnia?: boolean | null
          periodicita?: string | null
          premio_lordo?: number | null
          premio_netto?: number | null
          premio_netto_quietanza?: number | null
          prodotto_id?: string | null
          produttore_id?: string | null
          provvigioni_firma?: number | null
          provvigioni_quietanza?: number | null
          ramo_id?: string | null
          rate?: number | null
          regolazione?: boolean | null
          riga?: number | null
          rimborso?: boolean | null
          search_vector?: unknown
          sostituisce_appendice?: string | null
          sostituisce_polizza?: string | null
          sostituisce_riga?: number | null
          specialist?: string | null
          stato?: string
          storno_appendice?: string | null
          storno_polizza?: string | null
          storno_riga?: number | null
          targa_telaio?: string | null
          tasse?: number | null
          tasse_quietanza?: number | null
          tipo_lettera_regolazione?: string | null
          tipo_portafoglio?: string | null
          tipo_rinnovo?: string | null
          tipo_scadenza?: string | null
          ufficio_id?: string | null
          updated_at?: string | null
          valuta?: string | null
          vincolo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "titoli_cliente_anagrafica_id_fkey"
            columns: ["cliente_anagrafica_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titoli_compagnia_id_fkey"
            columns: ["compagnia_id"]
            isOneToOne: false
            referencedRelation: "compagnie"
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
            foreignKeyName: "titoli_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "rami"
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
      upload_rate_limit: {
        Row: {
          conteggio: number
          id: string
          ora_riferimento: string
          user_id: string
        }
        Insert: {
          conteggio?: number
          id?: string
          ora_riferimento?: string
          user_id: string
        }
        Update: {
          conteggio?: number
          id?: string
          ora_riferimento?: string
          user_id?: string
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
      cfo_kpi_mensili: {
        Row: {
          entrate: number | null
          ko_banca: number | null
          mese: string | null
          premi_incassati: number | null
          provvigioni_generate: number | null
          provvigioni_pagate: number | null
          saldo: number | null
          sinistri_aperti: number | null
          ufficio_id: string | null
          uscite: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      archivia_notifiche_vecchie: { Args: never; Returns: Json }
      cfo_entrate_uscite_mensili: {
        Args: { _data_a?: string; _data_da?: string; _ufficio_id?: string }
        Returns: Json
      }
      cfo_kpi: {
        Args: { _data_a?: string; _data_da?: string; _ufficio_id?: string }
        Returns: Json
      }
      cfo_premi_per_compagnia: {
        Args: { _data_a?: string; _data_da?: string }
        Returns: Json
      }
      cfo_provvigioni_mensili: {
        Args: { _data_a?: string; _data_da?: string; _ufficio_id?: string }
        Returns: Json
      }
      cfo_provvigioni_non_pagate: { Args: never; Returns: Json }
      cfo_redditivita_ufficio: {
        Args: { _data_a?: string; _data_da?: string }
        Returns: Json
      }
      cfo_report_titoli: {
        Args: {
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _produttore_id?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      check_consenso_marketing: {
        Args: { _cliente_id: string }
        Returns: boolean
      }
      get_my_cliente_ids: { Args: never; Returns: string[] }
      get_my_ufficio_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _canale_id: string; _user_id: string }
        Returns: boolean
      }
      refresh_cfo_kpi: { Args: never; Returns: undefined }
      refresh_cfo_kpi_mensili: { Args: never; Returns: undefined }
      report_banca_ko: { Args: { _ufficio_id?: string }; Returns: Json }
      report_contabilita: {
        Args: {
          _categoria?: string
          _data_a?: string
          _data_da?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      report_provvigioni_produttore: {
        Args: {
          _data_a?: string
          _data_da?: string
          _solo_non_pagate?: boolean
          _user_id?: string
        }
        Returns: Json
      }
      report_sinistri: {
        Args: {
          _data_a?: string
          _data_da?: string
          _stato?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      report_titoli_incassati: {
        Args: {
          _compagnia_id?: string
          _data_a?: string
          _data_da?: string
          _ufficio_id?: string
        }
        Returns: Json
      }
      run_data_quality_checks: { Args: never; Returns: Json }
      segna_eventi_sinistri_scaduti: { Args: never; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "ufficio"
        | "produttore"
        | "contabilita"
        | "cfo"
        | "cliente"
        | "backoffice"
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
        "backoffice",
      ],
    },
  },
} as const
