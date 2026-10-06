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
      intereses: {
        Row: { id: string; contact_id: string; categoria_id: string; plan_id: string | null; origen: string; estado: string; created_at: string; avisado_at: string | null; consent_at: string | null; paused_at: string | null; invite_until: string | null; notice_attempts: number }
        Insert: { id?: string; contact_id: string; categoria_id: string; plan_id?: string | null; origen: string; estado?: string; created_at?: string; avisado_at?: string | null; consent_at?: string | null; paused_at?: string | null; invite_until?: string | null; notice_attempts?: number }
        Update: { estado?: string; avisado_at?: string | null; consent_at?: string | null; paused_at?: string | null; invite_until?: string | null; notice_attempts?: number }
        Relationships: []
      }
      mt_service_access: {
        Row: { service_id: string; mode: string; provider: string; rotation_confirmed_at: string | null; updated_by: string | null; updated_at: string }
        Insert: { service_id: string; mode?: string; provider?: string; rotation_confirmed_at?: string | null; updated_by?: string | null; updated_at?: string }
        Update: { mode?: string; provider?: string; rotation_confirmed_at?: string | null; updated_by?: string | null; updated_at?: string }
        Relationships: []
      }
      mt_automation_settings: {
        Row: { id: boolean; settings: Json; updated_at: string }
        Insert: { id?: boolean; settings?: Json; updated_at?: string }
        Update: { settings?: Json; updated_at?: string }
        Relationships: []
      }
      mt_commerce_copy: {
        Row: { key: string; text: string; updated_at: string; updated_by: string | null }
        Insert: { key: string; text: string; updated_at?: string; updated_by?: string | null }
        Update: { text?: string; updated_at?: string; updated_by?: string | null }
        Relationships: []
      }
      whatsapp_conversation_state: {
        Row: { wa_id: string; mode: string; version: number; operator_id: string | null; active_process: string | null; order_id: string | null; handoff_reason: string | null; flow_version: number | null; context: Json; lease_token: string | null; locked_until: string | null; updated_at: string }
        Insert: { wa_id: string; mode?: string; version?: number; operator_id?: string | null; active_process?: string | null; order_id?: string | null; handoff_reason?: string | null; flow_version?: number | null; context?: Json; lease_token?: string | null; locked_until?: string | null; updated_at?: string }
        Update: { mode?: string; version?: number; operator_id?: string | null; active_process?: string | null; order_id?: string | null; handoff_reason?: string | null; flow_version?: number | null; context?: Json; lease_token?: string | null; locked_until?: string | null; updated_at?: string }
        Relationships: []
      }
      whatsapp_automation_inbox: {
        Row: { id: number; wa_message_id: string; wa_id: string; status: string; attempts: number; available_at: string; lease_token: string | null; fence: number | null; last_error_code: string | null; completed_at: string | null }
        Insert: { id?: never; wa_message_id: string; wa_id: string; status?: string; attempts?: number; available_at?: string; lease_token?: string | null; fence?: number | null; last_error_code?: string | null; completed_at?: string | null }
        Update: { status?: string; attempts?: number; available_at?: string; lease_token?: string | null; fence?: number | null; last_error_code?: string | null; completed_at?: string | null }
        Relationships: []
      }
      yappy_mail_sync_state: {
        Row: { id: boolean; mailbox: string; uid_validity: number | null; last_uid: number; last_synced_at: string | null; last_error_code: string | null; sync_locked_until: string | null; updated_at: string }
        Insert: { id?: boolean; mailbox?: string; uid_validity?: number | null; last_uid?: number; last_synced_at?: string | null; last_error_code?: string | null; sync_locked_until?: string | null; updated_at?: string }
        Update: { id?: boolean; mailbox?: string; uid_validity?: number | null; last_uid?: number; last_synced_at?: string | null; last_error_code?: string | null; sync_locked_until?: string | null; updated_at?: string }
        Relationships: []
      }
      yappy_mail_messages: {
        Row: { id: string; uid_validity: number; imap_uid: number; internet_message_id: string | null; received_at: string; from_address: string; subject: string | null; dmarc_pass: boolean | null; parser_version: number; status: string; failure_reason: string | null; created_at: string }
        Insert: { id?: string; uid_validity: number; imap_uid: number; internet_message_id?: string | null; received_at: string; from_address: string; subject?: string | null; dmarc_pass?: boolean | null; parser_version?: number; status: string; failure_reason?: string | null; created_at?: string }
        Update: { id?: string; uid_validity?: number; imap_uid?: number; internet_message_id?: string | null; received_at?: string; from_address?: string; subject?: string | null; dmarc_pass?: boolean | null; parser_version?: number; status?: string; failure_reason?: string | null; created_at?: string }
        Relationships: []
      }
      yappy_payments: {
        Row: { id: string; confirmation_code: string; amount: number; currency: string; payer_name_short: string; payer_phone_last4: string; paid_at: string; mail_message_id: string; match_status: string; candidate_venta_ids: string[]; matched_venta_id: string | null; resolved_by: string | null; resolved_at: string | null; resolution_note: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; confirmation_code: string; amount: number; currency?: string; payer_name_short: string; payer_phone_last4: string; paid_at: string; mail_message_id: string; match_status?: string; candidate_venta_ids?: string[]; matched_venta_id?: string | null; resolved_by?: string | null; resolved_at?: string | null; resolution_note?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; confirmation_code?: string; amount?: number; currency?: string; payer_name_short?: string; payer_phone_last4?: string; paid_at?: string; mail_message_id?: string; match_status?: string; candidate_venta_ids?: string[]; matched_venta_id?: string | null; resolved_by?: string | null; resolved_at?: string | null; resolution_note?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      activity_log: {
        Row: {
          accion: Database["public"]["Enums"]["accion_log_enum"]
          cambios: Json | null
          detalles: string
          entidad: Database["public"]["Enums"]["entidad_log_enum"]
          entidad_id: string
          entidad_legacy_id: string | null
          entidad_nombre: string
          id: string
          metadata: Json | null
          timestamp: string
          usuario_email: string
          usuario_id: string | null
        }
        Insert: {
          accion: Database["public"]["Enums"]["accion_log_enum"]
          cambios?: Json | null
          detalles: string
          entidad: Database["public"]["Enums"]["entidad_log_enum"]
          entidad_id: string
          entidad_legacy_id?: string | null
          entidad_nombre: string
          id?: string
          metadata?: Json | null
          timestamp?: string
          usuario_email: string
          usuario_id?: string | null
        }
        Update: {
          accion?: Database["public"]["Enums"]["accion_log_enum"]
          cambios?: Json | null
          detalles?: string
          entidad?: Database["public"]["Enums"]["entidad_log_enum"]
          entidad_id?: string
          entidad_legacy_id?: string | null
          entidad_nombre?: string
          id?: string
          metadata?: Json | null
          timestamp?: string
          usuario_email?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          id: string
          nombre: string
          notas: string | null
          tipo: Database["public"]["Enums"]["categoria_tipo_enum"]
          tipo_categoria:
            | Database["public"]["Enums"]["categoria_tipo_cat_enum"]
            | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nombre: string
          notas?: string | null
          tipo: Database["public"]["Enums"]["categoria_tipo_enum"]
          tipo_categoria?:
            | Database["public"]["Enums"]["categoria_tipo_cat_enum"]
            | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          tipo?: Database["public"]["Enums"]["categoria_tipo_enum"]
          tipo_categoria?:
            | Database["public"]["Enums"]["categoria_tipo_cat_enum"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          whatsapp_auto_enabled: boolean
          whatsapp_auto_daily_cap: number
          executive_push_block_order: Json
          executive_push_enabled: boolean
          executive_push_interval_hours: number
          executive_push_last_sent_at: string | null
          executive_push_last_sent_date: string | null
          executive_push_last_sent_slot: string | null
          executive_push_selected_blocks: Json
          executive_push_send_time: string
          executive_push_timezone: string
          executive_push_updated_by: string | null
          executive_push_window_end: string
          executive_push_window_start: string
          hora_envio: number
          id: string
          notificaciones_dias_anticipacion: number
          updated_at: string
          whatsapp_prefijo: string
        }
        Insert: {
          whatsapp_auto_enabled?: boolean
          whatsapp_auto_daily_cap?: number
          executive_push_block_order?: Json
          executive_push_enabled?: boolean
          executive_push_interval_hours?: number
          executive_push_last_sent_at?: string | null
          executive_push_last_sent_date?: string | null
          executive_push_last_sent_slot?: string | null
          executive_push_selected_blocks?: Json
          executive_push_send_time?: string
          executive_push_timezone?: string
          executive_push_updated_by?: string | null
          executive_push_window_end?: string
          executive_push_window_start?: string
          hora_envio?: number
          id?: string
          notificaciones_dias_anticipacion?: number
          updated_at?: string
          whatsapp_prefijo?: string
        }
        Update: {
          whatsapp_auto_enabled?: boolean
          whatsapp_auto_daily_cap?: number
          executive_push_block_order?: Json
          executive_push_enabled?: boolean
          executive_push_interval_hours?: number
          executive_push_last_sent_at?: string | null
          executive_push_last_sent_date?: string | null
          executive_push_last_sent_slot?: string | null
          executive_push_selected_blocks?: Json
          executive_push_send_time?: string
          executive_push_timezone?: string
          executive_push_updated_by?: string | null
          executive_push_window_end?: string
          executive_push_window_start?: string
          hora_envio?: number
          id?: string
          notificaciones_dias_anticipacion?: number
          updated_at?: string
          whatsapp_prefijo?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_executive_push_updated_by_fkey"
            columns: ["executive_push_updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          activo: boolean
          code: string
          nombre: string | null
        }
        Insert: {
          activo?: boolean
          code: string
          nombre?: string | null
        }
        Update: {
          activo?: boolean
          code?: string
          nombre?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          currency_pair: string
          last_updated: string
          rate: number
          source: string
        }
        Insert: {
          currency_pair: string
          last_updated?: string
          rate: number
          source?: string
        }
        Update: {
          currency_pair?: string
          last_updated?: string
          rate?: number
          source?: string
        }
        Relationships: []
      }
      executive_push_runs: {
        Row: {
          claimed_at: string
          disabled: number
          error: string | null
          failed: number
          finished_at: string | null
          id: string
          metadata: Json
          reason: string | null
          request_id: number | null
          sent: number
          started_at: string | null
          status: string
        }
        Insert: {
          claimed_at?: string
          disabled?: number
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          request_id?: number | null
          sent?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          claimed_at?: string
          disabled?: number
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          request_id?: number | null
          sent?: number
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          created_at: string
          created_by: string | null
          detalle: string | null
          exchange_rate: number | null
          fecha: string
          id: string
          moneda_original: string
          monto_original: number
          monto_usd: number
          tipo_gasto_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detalle?: string | null
          exchange_rate?: number | null
          fecha: string
          id?: string
          moneda_original: string
          monto_original: number
          monto_usd: number
          tipo_gasto_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detalle?: string | null
          exchange_rate?: number | null
          fecha?: string
          id?: string
          moneda_original?: string
          monto_original?: number
          monto_usd?: number
          tipo_gasto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "gastos_tipo_gasto_id_fkey"
            columns: ["tipo_gasto_id"]
            isOneToOne: false
            referencedRelation: "tipos_gasto"
            referencedColumns: ["id"]
          },
        ]
      }
      metodos_pago: {
        Row: {
          activo: boolean
          alias: string | null
          asociado_a: Database["public"]["Enums"]["asociado_a_enum"] | null
          banco: string | null
          contrasena: string | null
          created_at: string
          created_by: string | null
          email: string | null
          fecha_expiracion: string | null
          id: string
          identificador: string
          moneda: string
          nombre: string
          notas: string | null
          numero_tarjeta: string | null
          pais: string
          tipo: Database["public"]["Enums"]["metodo_pago_tipo_enum"]
          tipo_cuenta: Database["public"]["Enums"]["tipo_cuenta_enum"] | null
          titular: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          alias?: string | null
          asociado_a?: Database["public"]["Enums"]["asociado_a_enum"] | null
          banco?: string | null
          contrasena?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          fecha_expiracion?: string | null
          id?: string
          identificador: string
          moneda: string
          nombre: string
          notas?: string | null
          numero_tarjeta?: string | null
          pais?: string
          tipo: Database["public"]["Enums"]["metodo_pago_tipo_enum"]
          tipo_cuenta?: Database["public"]["Enums"]["tipo_cuenta_enum"] | null
          titular: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          alias?: string | null
          asociado_a?: Database["public"]["Enums"]["asociado_a_enum"] | null
          banco?: string | null
          contrasena?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          fecha_expiracion?: string | null
          id?: string
          identificador?: string
          moneda?: string
          nombre?: string
          notas?: string | null
          numero_tarjeta?: string | null
          pais?: string
          tipo?: Database["public"]["Enums"]["metodo_pago_tipo_enum"]
          tipo_cuenta?: Database["public"]["Enums"]["tipo_cuenta_enum"] | null
          titular?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metodos_pago_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metodos_pago_moneda_fkey"
            columns: ["moneda"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          dedupe_key: string
          dias_restantes: number | null
          dismissed_at: string | null
          entidad: Database["public"]["Enums"]["notificacion_entidad_enum"]
          fecha_prometida_pago: string | null
          id: string
          leida: boolean
          mensaje: string | null
          prioridad: Database["public"]["Enums"]["notificacion_prioridad_enum"]
          read_at: string | null
          resaltada: boolean
          scheduled_for: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          dias_restantes?: number | null
          dismissed_at?: string | null
          entidad: Database["public"]["Enums"]["notificacion_entidad_enum"]
          fecha_prometida_pago?: string | null
          id?: string
          leida?: boolean
          mensaje?: string | null
          prioridad: Database["public"]["Enums"]["notificacion_prioridad_enum"]
          read_at?: string | null
          resaltada?: boolean
          scheduled_for?: string | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          dias_restantes?: number | null
          dismissed_at?: string | null
          entidad?: Database["public"]["Enums"]["notificacion_entidad_enum"]
          fecha_prometida_pago?: string | null
          id?: string
          leida?: boolean
          mensaje?: string | null
          prioridad?: Database["public"]["Enums"]["notificacion_prioridad_enum"]
          read_at?: string | null
          resaltada?: boolean
          scheduled_for?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      notificaciones_reposo: {
        Row: {
          categoria_id: string | null
          categoria_nombre_snapshot: string | null
          dias_reposo_snapshot: number | null
          fecha_fin_reposo_snapshot: string | null
          fecha_inicio_reposo_snapshot: string | null
          notificacion_id: string
          servicio_contrasena_snapshot: string | null
          servicio_correo_snapshot: string | null
          servicio_id: string
          servicio_nombre_snapshot: string
        }
        Insert: {
          categoria_id?: string | null
          categoria_nombre_snapshot?: string | null
          dias_reposo_snapshot?: number | null
          fecha_fin_reposo_snapshot?: string | null
          fecha_inicio_reposo_snapshot?: string | null
          notificacion_id: string
          servicio_contrasena_snapshot?: string | null
          servicio_correo_snapshot?: string | null
          servicio_id: string
          servicio_nombre_snapshot: string
        }
        Update: {
          categoria_id?: string | null
          categoria_nombre_snapshot?: string | null
          dias_reposo_snapshot?: number | null
          fecha_fin_reposo_snapshot?: string | null
          fecha_inicio_reposo_snapshot?: string | null
          notificacion_id?: string
          servicio_contrasena_snapshot?: string | null
          servicio_correo_snapshot?: string | null
          servicio_id?: string
          servicio_nombre_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_reposo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "notificaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "v_notificaciones_reposo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "v_notificaciones_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "v_notificaciones_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones_servicio: {
        Row: {
          categoria_id: string | null
          categoria_nombre_snapshot: string | null
          ciclo_pago_snapshot:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          costo_servicio_snapshot: number | null
          fecha_inicio_snapshot: string | null
          fecha_vencimiento_snapshot: string | null
          metodo_pago_alias_snapshot: string | null
          metodo_pago_nombre_snapshot: string | null
          metodo_pago_tarjeta_terminacion_snapshot: string | null
          moneda_snapshot: string | null
          notificacion_id: string
          renovacion_automatica_snapshot: boolean | null
          servicio_contrasena_snapshot: string | null
          servicio_correo_snapshot: string | null
          servicio_id: string
          servicio_nombre_snapshot: string
          servicio_periodo_id: string | null
        }
        Insert: {
          categoria_id?: string | null
          categoria_nombre_snapshot?: string | null
          ciclo_pago_snapshot?:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          costo_servicio_snapshot?: number | null
          fecha_inicio_snapshot?: string | null
          fecha_vencimiento_snapshot?: string | null
          metodo_pago_alias_snapshot?: string | null
          metodo_pago_nombre_snapshot?: string | null
          metodo_pago_tarjeta_terminacion_snapshot?: string | null
          moneda_snapshot?: string | null
          notificacion_id: string
          renovacion_automatica_snapshot?: boolean | null
          servicio_contrasena_snapshot?: string | null
          servicio_correo_snapshot?: string | null
          servicio_id: string
          servicio_nombre_snapshot: string
          servicio_periodo_id?: string | null
        }
        Update: {
          categoria_id?: string | null
          categoria_nombre_snapshot?: string | null
          ciclo_pago_snapshot?:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          costo_servicio_snapshot?: number | null
          fecha_inicio_snapshot?: string | null
          fecha_vencimiento_snapshot?: string | null
          metodo_pago_alias_snapshot?: string | null
          metodo_pago_nombre_snapshot?: string | null
          metodo_pago_tarjeta_terminacion_snapshot?: string | null
          moneda_snapshot?: string | null
          notificacion_id?: string
          renovacion_automatica_snapshot?: boolean | null
          servicio_contrasena_snapshot?: string | null
          servicio_correo_snapshot?: string | null
          servicio_id?: string
          servicio_nombre_snapshot?: string
          servicio_periodo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_servicio_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "notificaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "v_notificaciones_reposo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "v_notificaciones_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "v_notificaciones_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "servicio_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_servicio_periodos_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["ultimo_periodo_id"]
          },
        ]
      }
      notificaciones_venta: {
        Row: {
          categoria_id: string | null
          categoria_nombre_snapshot: string | null
          ciclo_pago_snapshot:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          cliente_id: string | null
          cliente_nombre_snapshot: string
          cliente_telefono_snapshot: string | null
          codigo_snapshot: string | null
          fecha_fin_snapshot: string | null
          fecha_inicio_snapshot: string | null
          metodo_pago_id: string | null
          metodo_pago_nombre_snapshot: string | null
          moneda_snapshot: string | null
          notificacion_id: string
          perfil_nombre_snapshot: string | null
          precio_final_snapshot: number | null
          servicio_contrasena_snapshot: string | null
          servicio_correo_snapshot: string | null
          servicio_id: string | null
          servicio_nombre_snapshot: string
          venta_id: string
          venta_periodo_id: string | null
        }
        Insert: {
          categoria_id?: string | null
          categoria_nombre_snapshot?: string | null
          ciclo_pago_snapshot?:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          cliente_id?: string | null
          cliente_nombre_snapshot: string
          cliente_telefono_snapshot?: string | null
          codigo_snapshot?: string | null
          fecha_fin_snapshot?: string | null
          fecha_inicio_snapshot?: string | null
          metodo_pago_id?: string | null
          metodo_pago_nombre_snapshot?: string | null
          moneda_snapshot?: string | null
          notificacion_id: string
          perfil_nombre_snapshot?: string | null
          precio_final_snapshot?: number | null
          servicio_contrasena_snapshot?: string | null
          servicio_correo_snapshot?: string | null
          servicio_id?: string | null
          servicio_nombre_snapshot: string
          venta_id: string
          venta_periodo_id?: string | null
        }
        Update: {
          categoria_id?: string | null
          categoria_nombre_snapshot?: string | null
          ciclo_pago_snapshot?:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          cliente_id?: string | null
          cliente_nombre_snapshot?: string
          cliente_telefono_snapshot?: string | null
          codigo_snapshot?: string | null
          fecha_fin_snapshot?: string | null
          fecha_inicio_snapshot?: string | null
          metodo_pago_id?: string | null
          metodo_pago_nombre_snapshot?: string | null
          moneda_snapshot?: string | null
          notificacion_id?: string
          perfil_nombre_snapshot?: string | null
          precio_final_snapshot?: number | null
          servicio_contrasena_snapshot?: string | null
          servicio_correo_snapshot?: string | null
          servicio_id?: string | null
          servicio_nombre_snapshot?: string
          venta_id?: string
          venta_periodo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_venta_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_terceros_servicios_activos"
            referencedColumns: ["tercero_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "notificaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "v_notificaciones_reposo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "v_notificaciones_servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_notificacion_id_fkey"
            columns: ["notificacion_id"]
            isOneToOne: true
            referencedRelation: "v_notificaciones_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_archivadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_venta_periodos_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["ultimo_periodo_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "venta_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_servicio: {
        Row: {
          anulada_at: string | null
          anulada_by: string | null
          categoria_id_snapshot: string | null
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["pago_estado_enum"]
          exchange_rate: number | null
          fecha_pago: string
          id: string
          metodo_pago_id: string | null
          metodo_pago_nombre_snapshot: string
          moneda_original: string
          monto_original: number
          monto_usd: number
          motivo_anulacion: string | null
          notas: string | null
          servicio_id: string
          servicio_periodo_id: string
        }
        Insert: {
          anulada_at?: string | null
          anulada_by?: string | null
          categoria_id_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["pago_estado_enum"]
          exchange_rate?: number | null
          fecha_pago?: string
          id?: string
          metodo_pago_id?: string | null
          metodo_pago_nombre_snapshot?: string
          moneda_original: string
          monto_original: number
          monto_usd: number
          motivo_anulacion?: string | null
          notas?: string | null
          servicio_id: string
          servicio_periodo_id: string
        }
        Update: {
          anulada_at?: string | null
          anulada_by?: string | null
          categoria_id_snapshot?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["pago_estado_enum"]
          exchange_rate?: number | null
          fecha_pago?: string
          id?: string
          metodo_pago_id?: string | null
          metodo_pago_nombre_snapshot?: string
          moneda_original?: string
          monto_original?: number
          monto_usd?: number
          motivo_anulacion?: string | null
          notas?: string | null
          servicio_id?: string
          servicio_periodo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_servicio_anulada_by_fkey"
            columns: ["anulada_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_categoria_id_snapshot_fkey"
            columns: ["categoria_id_snapshot"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_categoria_id_snapshot_fkey"
            columns: ["categoria_id_snapshot"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "pagos_servicio_categoria_id_snapshot_fkey"
            columns: ["categoria_id_snapshot"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "pagos_servicio_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "servicio_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_servicio_periodos_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["ultimo_periodo_id"]
          },
        ]
      }
      pagos_venta: {
        Row: {
          anulada_at: string | null
          anulada_by: string | null
          created_at: string
          created_by: string | null
          destino_reembolso: string | null
          estado: Database["public"]["Enums"]["pago_estado_enum"]
          exchange_rate: number | null
          fecha_pago: string
          id: string
          metodo_pago_id: string | null
          metodo_pago_nombre_snapshot: string
          moneda_original: string
          monto_original: number
          monto_usd: number
          motivo_anulacion: string | null
          notas: string | null
          venta_id: string
          venta_periodo_id: string
        }
        Insert: {
          anulada_at?: string | null
          anulada_by?: string | null
          created_at?: string
          created_by?: string | null
          destino_reembolso?: string | null
          estado?: Database["public"]["Enums"]["pago_estado_enum"]
          exchange_rate?: number | null
          fecha_pago?: string
          id?: string
          metodo_pago_id?: string | null
          metodo_pago_nombre_snapshot?: string
          moneda_original: string
          monto_original: number
          monto_usd: number
          motivo_anulacion?: string | null
          notas?: string | null
          venta_id: string
          venta_periodo_id: string
        }
        Update: {
          anulada_at?: string | null
          anulada_by?: string | null
          created_at?: string
          created_by?: string | null
          destino_reembolso?: string | null
          estado?: Database["public"]["Enums"]["pago_estado_enum"]
          exchange_rate?: number | null
          fecha_pago?: string
          id?: string
          metodo_pago_id?: string | null
          metodo_pago_nombre_snapshot?: string
          moneda_original?: string
          monto_original?: number
          monto_usd?: number
          motivo_anulacion?: string | null
          notas?: string | null
          venta_id?: string
          venta_periodo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_venta_anulada_by_fkey"
            columns: ["anulada_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "pagos_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_archivadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_venta_periodos_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["ultimo_periodo_id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "venta_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          activo: boolean
          categoria_id: string
          ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
          created_at: string
          id: string
          nombre: string
          orden: number | null
          plan_tipo_id: string
          precio: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id: string
          ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
          created_at?: string
          id?: string
          nombre: string
          orden?: number | null
          plan_tipo_id: string
          precio: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string
          ciclo_pago?: Database["public"]["Enums"]["ciclo_pago_enum"]
          created_at?: string
          id?: string
          nombre?: string
          orden?: number | null
          plan_tipo_id?: string
          precio?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "planes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "planes_plan_tipo_id_categoria_id_fkey"
            columns: ["plan_tipo_id", "categoria_id"]
            isOneToOne: false
            referencedRelation: "planes_tipos"
            referencedColumns: ["id", "categoria_id"]
          },
        ]
      }
      planes_tipos: {
        Row: {
          activo: boolean
          categoria_id: string
          created_at: string
          id: string
          nombre: string
          orden: number | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planes_tipos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_tipos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "planes_tipos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          platform: string
          updated_at: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          platform?: string
          updated_at?: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          platform?: string
          updated_at?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rpc_idempotency_keys: {
        Row: {
          created_at: string
          created_by: string
          idempotency_key: string
          result_id: string
          rpc_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          idempotency_key: string
          result_id: string
          rpc_name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          idempotency_key?: string
          result_id?: string
          rpc_name?: string
        }
        Relationships: []
      }
      servicio_periodos: {
        Row: {
          ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
          costo_original: number
          costo_usd: number
          created_at: string
          created_by: string | null
          exchange_rate: number | null
          fecha_inicio: string
          fecha_vencimiento: string
          id: string
          moneda_original: string
          numero_periodo: number
          renovacion_automatica: boolean
          servicio_id: string
          tipo: Database["public"]["Enums"]["periodo_tipo_enum"]
        }
        Insert: {
          ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
          costo_original: number
          costo_usd: number
          created_at?: string
          created_by?: string | null
          exchange_rate?: number | null
          fecha_inicio: string
          fecha_vencimiento: string
          id?: string
          moneda_original: string
          numero_periodo: number
          renovacion_automatica?: boolean
          servicio_id: string
          tipo: Database["public"]["Enums"]["periodo_tipo_enum"]
        }
        Update: {
          ciclo_pago?: Database["public"]["Enums"]["ciclo_pago_enum"]
          costo_original?: number
          costo_usd?: number
          created_at?: string
          created_by?: string | null
          exchange_rate?: number | null
          fecha_inicio?: string
          fecha_vencimiento?: string
          id?: string
          moneda_original?: string
          numero_periodo?: number
          renovacion_automatica?: boolean
          servicio_id?: string
          tipo?: Database["public"]["Enums"]["periodo_tipo_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "servicio_periodos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_periodos_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "servicio_periodos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_periodos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_periodos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "servicio_periodos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          activo: boolean
          archivado_at: string | null
          archivado_by: string | null
          categoria_id: string
          contrasena: string
          correo: string
          cortado_at: string | null
          cortado_by: string | null
          created_at: string
          created_by: string | null
          dias_reposo: number | null
          en_reposo: boolean
          fecha_fin_reposo: string | null
          fecha_inicio_reposo: string | null
          id: string
          motivo_archivado: string | null
          motivo_corte: string | null
          nombre: string
          notas: string | null
          perfiles_disponibles: number
          perfiles_ocupados: number
          plan_tipo_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          archivado_at?: string | null
          archivado_by?: string | null
          categoria_id: string
          contrasena: string
          correo: string
          cortado_at?: string | null
          cortado_by?: string | null
          created_at?: string
          created_by?: string | null
          dias_reposo?: number | null
          en_reposo?: boolean
          fecha_fin_reposo?: string | null
          fecha_inicio_reposo?: string | null
          id?: string
          motivo_archivado?: string | null
          motivo_corte?: string | null
          nombre: string
          notas?: string | null
          perfiles_disponibles?: number
          perfiles_ocupados?: number
          plan_tipo_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          archivado_at?: string | null
          archivado_by?: string | null
          categoria_id?: string
          contrasena?: string
          correo?: string
          cortado_at?: string | null
          cortado_by?: string | null
          created_at?: string
          created_by?: string | null
          dias_reposo?: number | null
          en_reposo?: boolean
          fecha_fin_reposo?: string | null
          fecha_inicio_reposo?: string | null
          id?: string
          motivo_archivado?: string | null
          motivo_corte?: string | null
          nombre?: string
          notas?: string | null
          perfiles_disponibles?: number
          perfiles_ocupados?: number
          plan_tipo_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicios_archivado_by_fkey"
            columns: ["archivado_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "servicios_cortado_by_fkey"
            columns: ["cortado_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_plan_tipo_id_categoria_id_fkey"
            columns: ["plan_tipo_id", "categoria_id"]
            isOneToOne: false
            referencedRelation: "planes_tipos"
            referencedColumns: ["id", "categoria_id"]
          },
        ]
      }
      chat_saved_messages: {
        Row: {
          body: string
          button_label: string | null
          created_at: string
          created_by: string
          id: string
          kind: string
          options: Json
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          button_label?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kind: string
          options?: Json
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          button_label?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          options?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_saved_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_saved_stickers: {
        Row: {
          created_at: string
          created_by: string
          id: string
          media_id: string
          mime_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          media_id: string
          mime_type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          media_id?: string
          mime_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_saved_stickers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          activo: boolean
          contenido: string
          created_at: string
          id: string
          meta_button_actions: Json
          meta_param_map: Json
          meta_template_name: string | null
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_template_enum"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contenido: string
          created_at?: string
          id?: string
          meta_button_actions?: Json
          meta_param_map?: Json
          meta_template_name?: string | null
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_template_enum"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contenido?: string
          created_at?: string
          id?: string
          meta_button_actions?: Json
          meta_param_map?: Json
          meta_template_name?: string | null
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_template_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      terceros: {
        Row: {
          wa_id: string | null
          active: boolean
          apellido: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          metodo_pago_id: string | null
          nombre: string
          notas: string | null
          telefono: string
          tipo: Database["public"]["Enums"]["tercero_tipo_enum"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          apellido: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          metodo_pago_id?: string | null
          nombre: string
          notas?: string | null
          telefono: string
          tipo: Database["public"]["Enums"]["tercero_tipo_enum"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          apellido?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          metodo_pago_id?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string
          tipo?: Database["public"]["Enums"]["tercero_tipo_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terceros_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terceros_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_gasto: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      venta_periodos: {
        Row: {
          ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
          created_at: string
          created_by: string | null
          descuento: number
          exchange_rate: number | null
          fecha_fin: string
          fecha_inicio: string
          id: string
          moneda_original: string
          numero_periodo: number
          plan_id: string | null
          plan_nombre_snapshot: string
          plan_tipo_nombre_snapshot: string
          precio_original: number
          tipo: Database["public"]["Enums"]["periodo_tipo_enum"]
          total_original: number
          total_usd: number
          venta_id: string
        }
        Insert: {
          ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
          created_at?: string
          created_by?: string | null
          descuento?: number
          exchange_rate?: number | null
          fecha_fin: string
          fecha_inicio: string
          id?: string
          moneda_original: string
          numero_periodo: number
          plan_id?: string | null
          plan_nombre_snapshot?: string
          plan_tipo_nombre_snapshot?: string
          precio_original: number
          tipo: Database["public"]["Enums"]["periodo_tipo_enum"]
          total_original: number
          total_usd: number
          venta_id: string
        }
        Update: {
          ciclo_pago?: Database["public"]["Enums"]["ciclo_pago_enum"]
          created_at?: string
          created_by?: string | null
          descuento?: number
          exchange_rate?: number | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          moneda_original?: string
          numero_periodo?: number
          plan_id?: string | null
          plan_nombre_snapshot?: string
          plan_tipo_nombre_snapshot?: string
          precio_original?: number
          tipo?: Database["public"]["Enums"]["periodo_tipo_enum"]
          total_original?: number
          total_usd?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_periodos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_periodos_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "venta_periodos_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_periodos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_archivadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_periodos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_periodos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          respuesta_cliente: string | null
          respuesta_cliente_at: string | null
          archivado_at: string | null
          archivado_by: string | null
          categoria_id: string
          cliente_id: string | null
          codigo: string | null
          cortada_at: string | null
          cortada_by: string | null
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["venta_estado_enum"]
          id: string
          motivo_archivado: string | null
          motivo_corte: string | null
          notas: string | null
          perfil_nombre: string | null
          perfil_numero: number | null
          servicio_id: string
          updated_at: string
        }
        Insert: {
          respuesta_cliente?: string | null
          respuesta_cliente_at?: string | null
          archivado_at?: string | null
          archivado_by?: string | null
          categoria_id: string
          cliente_id?: string | null
          codigo?: string | null
          cortada_at?: string | null
          cortada_by?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["venta_estado_enum"]
          id?: string
          motivo_archivado?: string | null
          motivo_corte?: string | null
          notas?: string | null
          perfil_nombre?: string | null
          perfil_numero?: number | null
          servicio_id: string
          updated_at?: string
        }
        Update: {
          respuesta_cliente?: string | null
          respuesta_cliente_at?: string | null
          archivado_at?: string | null
          archivado_by?: string | null
          categoria_id?: string
          cliente_id?: string | null
          codigo?: string | null
          cortada_at?: string | null
          cortada_by?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["venta_estado_enum"]
          id?: string
          motivo_archivado?: string | null
          motivo_corte?: string | null
          notas?: string | null
          perfil_nombre?: string | null
          perfil_numero?: number | null
          servicio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_archivado_by_fkey"
            columns: ["archivado_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_terceros_servicios_activos"
            referencedColumns: ["tercero_id"]
          },
          {
            foreignKeyName: "ventas_cortada_by_fkey"
            columns: ["cortada_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_reads: {
        Row: {
          last_read_at: string
          updated_at: string
          wa_id: string
        }
        Insert: {
          last_read_at: string
          updated_at?: string
          wa_id: string
        }
        Update: {
          last_read_at?: string
          updated_at?: string
          wa_id?: string
        }
        Relationships: []
      }
      whatsapp_bot_config: {
        Row: {
          enabled: boolean
          id: string
          published_version: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id: string
          published_version?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          published_version?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_config_published_version_fkey"
            columns: ["published_version"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_versions"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "whatsapp_bot_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_events: {
        Row: {
          cliente_id: string | null
          created_at: string
          detail: Json
          id: string
          node_id: string | null
          option_id: string | null
          type: string
          wa_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          node_id?: string | null
          option_id?: string | null
          type: string
          wa_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          node_id?: string | null
          option_id?: string | null
          type?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_events_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_versions: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          note: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition: Json
          note?: string
          version?: never
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          note?: string
          version?: never
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_flags: {
        Row: {
          archived_at: string | null
          pinned_at: string | null
          updated_at: string
          wa_id: string
        }
        Insert: {
          archived_at?: string | null
          pinned_at?: string | null
          updated_at?: string
          wa_id: string
        }
        Update: {
          archived_at?: string | null
          pinned_at?: string | null
          updated_at?: string
          wa_id?: string
        }
        Relationships: []
      }
      auto_notice_runs: {
        Row: {
          id: string
          run_date: string
          started_at: string
          finished_at: string | null
          status: string
          sent: number
          failed: number
          skipped: number
          already_sent: number
          details: Json
        }
        Insert: {
          id?: string
          run_date: string
          started_at?: string
          finished_at?: string | null
          status?: string
          sent?: number
          failed?: number
          skipped?: number
          already_sent?: number
          details?: Json
        }
        Update: {
          id?: string
          run_date?: string
          started_at?: string
          finished_at?: string | null
          status?: string
          sent?: number
          failed?: number
          skipped?: number
          already_sent?: number
          details?: Json
        }
        Relationships: []
      }
      whatsapp_notices: {
        Row: {
          id: string
          dedupe_key: string
          tipo: Database["public"]["Enums"]["tipo_template_enum"]
          tercero_id: string
          wa_id: string
          channel: string
          meta_template_name: string | null
          fecha_vencimiento: string | null
          origin: string
          status: string
          skip_reason: string | null
          idempotency_key: string
          outbound_message_id: string | null
          wa_message_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dedupe_key: string
          tipo: Database["public"]["Enums"]["tipo_template_enum"]
          tercero_id: string
          wa_id: string
          channel: string
          meta_template_name?: string | null
          fecha_vencimiento?: string | null
          origin: string
          status?: string
          skip_reason?: string | null
          idempotency_key: string
          outbound_message_id?: string | null
          wa_message_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dedupe_key?: string
          tipo?: Database["public"]["Enums"]["tipo_template_enum"]
          tercero_id?: string
          wa_id?: string
          channel?: string
          meta_template_name?: string | null
          fecha_vencimiento?: string | null
          origin?: string
          status?: string
          skip_reason?: string | null
          idempotency_key?: string
          outbound_message_id?: string | null
          wa_message_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_notices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_notices_outbound_message_id_fkey"
            columns: ["outbound_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_outbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_notices_tercero_id_fkey"
            columns: ["tercero_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_notice_ventas: {
        Row: {
          notice_id: string
          venta_id: string
        }
        Insert: {
          notice_id: string
          venta_id: string
        }
        Update: {
          notice_id?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_notice_ventas_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_notice_ventas_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_waits: {
        Row: {
          wa_id: string
          node_id: string
          expires_at: string
          created_at: string
        }
        Insert: {
          wa_id: string
          node_id: string
          expires_at: string
          created_at?: string
        }
        Update: {
          wa_id?: string
          node_id?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      netflix_code_claims: {
        Row: {
          mail_key: string
          wa_id: string
          created_at: string
        }
        Insert: {
          mail_key: string
          wa_id: string
          created_at?: string
        }
        Update: {
          mail_key?: string
          wa_id?: string
          created_at?: string
        }
        Relationships: []
      }
      whatsapp_notice_replies: {
        Row: {
          id: number
          notice_id: string
          action: string
          inbound_wa_message_id: string
          handled_at: string
          result: string
          attempts: number
          locked_until: string | null
          next_attempt_at: string | null
          last_error: string | null
        }
        Insert: {
          id?: number
          notice_id: string
          action: string
          inbound_wa_message_id: string
          handled_at?: string
          result?: string
          attempts?: number
          locked_until?: string | null
          next_attempt_at?: string | null
          last_error?: string | null
        }
        Update: {
          id?: number
          notice_id?: string
          action?: string
          inbound_wa_message_id?: string
          handled_at?: string
          result?: string
          attempts?: number
          locked_until?: string | null
          next_attempt_at?: string | null
          last_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_notice_replies_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_meta_templates: {
        Row: {
          id: string
          name: string
          language: string
          status: string
          category: string
          body: string
          header: string | null
          footer: string | null
          buttons: Json
          param_count: number
          meta_template_id: string
          retired: boolean
          synced_at: string
        }
        Insert: {
          id?: string
          name: string
          language: string
          status: string
          category: string
          body: string
          header?: string | null
          footer?: string | null
          buttons?: Json
          param_count: number
          meta_template_id: string
          retired?: boolean
          synced_at: string
        }
        Update: {
          id?: string
          name?: string
          language?: string
          status?: string
          category?: string
          body?: string
          header?: string | null
          footer?: string | null
          buttons?: Json
          param_count?: number
          meta_template_id?: string
          retired?: boolean
          synced_at?: string
        }
        Relationships: []
      }
      whatsapp_outbound_messages: {
        Row: {
          context_wa_message_id: string | null
          media_filename: string | null
          media_id: string | null
          media_mime_type: string | null
          payload: Json
          created_at: string
          error_code: number | null
          error_title: string | null
          id: string
          idempotency_key: string
          message_kind: string
          send_status: string
          sent_by: string | null
          template_name: string | null
          template_params: Json
          text_body: string | null
          to_wa_id: string
          updated_at: string
          hidden_at: string | null
          hidden_by: string | null
          wa_message_id: string | null
        }
        Insert: {
          context_wa_message_id?: string | null
          media_filename?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          payload?: Json
          created_at?: string
          error_code?: number | null
          error_title?: string | null
          id?: string
          idempotency_key: string
          message_kind: string
          send_status?: string
          sent_by?: string | null
          template_name?: string | null
          template_params?: Json
          text_body?: string | null
          to_wa_id: string
          updated_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          wa_message_id?: string | null
        }
        Update: {
          context_wa_message_id?: string | null
          media_filename?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          payload?: Json
          created_at?: string
          error_code?: number | null
          error_title?: string | null
          id?: string
          idempotency_key?: string
          message_kind?: string
          send_status?: string
          sent_by?: string | null
          template_name?: string | null
          template_params?: Json
          text_body?: string | null
          to_wa_id?: string
          updated_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          wa_message_id?: string | null
        }
        Relationships: []
      }
      whatsapp_inbound_messages: {
        Row: {
          context_wa_message_id: string | null
          payload: Json
          reaction_emoji: string | null
          contact_name: string | null
          media_filename: string | null
          media_id: string | null
          media_mime_type: string | null
          from_wa_id: string
          id: string
          message_type: string
          phone_number_id: string
          processed_at: string | null
          received_at: string
          sent_at: string
          text_body: string | null
          hidden_at: string | null
          hidden_by: string | null
          wa_message_id: string
        }
        Insert: {
          context_wa_message_id?: string | null
          payload?: Json
          reaction_emoji?: string | null
          contact_name?: string | null
          media_filename?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          from_wa_id: string
          id?: string
          message_type: string
          phone_number_id: string
          processed_at?: string | null
          received_at?: string
          sent_at: string
          text_body?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          wa_message_id: string
        }
        Update: {
          context_wa_message_id?: string | null
          payload?: Json
          reaction_emoji?: string | null
          contact_name?: string | null
          media_filename?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          from_wa_id?: string
          id?: string
          message_type?: string
          phone_number_id?: string
          processed_at?: string | null
          received_at?: string
          sent_at?: string
          text_body?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          wa_message_id?: string
        }
        Relationships: []
      }
      whatsapp_message_statuses: {
        Row: {
          error_code: number | null
          error_title: string | null
          id: string
          received_at: string
          recipient_wa_id: string
          status: string
          status_at: string
          wa_message_id: string
        }
        Insert: {
          error_code?: number | null
          error_title?: string | null
          id?: string
          received_at?: string
          recipient_wa_id: string
          status: string
          status_at: string
          wa_message_id: string
        }
        Update: {
          error_code?: number | null
          error_title?: string | null
          id?: string
          received_at?: string
          recipient_wa_id?: string
          status?: string
          status_at?: string
          wa_message_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_yappy_candidate_ventas: {
        Row: { id: string | null; cliente: string | null; servicio: string | null; perfil_numero: number | null; perfil_nombre: string | null; fecha_fin: string | null; total_original: number | null; moneda_original: string | null }
        Relationships: []
      }
      v_yappy_mail_sync_status: {
        Row: { mailbox: string | null; status: string | null; last_synced_at: string | null; last_error_code: string | null }
        Relationships: []
      }
      v_categoria_counters: {
        Row: {
          categoria_id: string | null
          categoria_nombre: string | null
          perfiles_disponibles_total: number | null
          servicios_activos: number | null
          total_servicios: number | null
        }
        Relationships: []
      }
      v_categoria_financial_metrics: {
        Row: {
          categoria_id: string | null
          categoria_nombre: string | null
          ganancia_usd: number | null
          gastos_usd: number | null
          ingresos_usd: number | null
        }
        Relationships: []
      }
      v_gastos_full: {
        Row: {
          created_at: string | null
          created_by: string | null
          detalle: string | null
          exchange_rate: number | null
          fecha: string | null
          id: string | null
          moneda_original: string | null
          monto_original: number | null
          monto_usd: number | null
          tipo_gasto_id: string | null
          tipo_gasto_nombre: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "gastos_tipo_gasto_id_fkey"
            columns: ["tipo_gasto_id"]
            isOneToOne: false
            referencedRelation: "tipos_gasto"
            referencedColumns: ["id"]
          },
        ]
      }
      v_notificaciones_reposo: {
        Row: {
          categoria_id: string | null
          categoria_nombre_snapshot: string | null
          created_at: string | null
          dedupe_key: string | null
          dias_reposo_snapshot: number | null
          dias_restantes: number | null
          dismissed_at: string | null
          entidad:
            | Database["public"]["Enums"]["notificacion_entidad_enum"]
            | null
          fecha_fin_reposo_snapshot: string | null
          fecha_inicio_reposo_snapshot: string | null
          id: string | null
          leida: boolean | null
          mensaje: string | null
          prioridad:
            | Database["public"]["Enums"]["notificacion_prioridad_enum"]
            | null
          read_at: string | null
          resaltada: boolean | null
          scheduled_for: string | null
          servicio_contrasena_snapshot: string | null
          servicio_correo_snapshot: string | null
          servicio_id: string | null
          servicio_nombre_snapshot: string | null
          tipo: string | null
          titulo: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_reposo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "notificaciones_reposo_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
        ]
      }
      v_notificaciones_servicio: {
        Row: {
          categoria_id: string | null
          categoria_nombre_snapshot: string | null
          ciclo_pago_snapshot:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          costo_servicio_snapshot: number | null
          created_at: string | null
          dedupe_key: string | null
          dias_restantes: number | null
          dismissed_at: string | null
          entidad:
            | Database["public"]["Enums"]["notificacion_entidad_enum"]
            | null
          fecha_inicio_snapshot: string | null
          fecha_vencimiento_snapshot: string | null
          id: string | null
          leida: boolean | null
          mensaje: string | null
          metodo_pago_alias_snapshot: string | null
          metodo_pago_nombre_snapshot: string | null
          metodo_pago_tarjeta_terminacion_snapshot: string | null
          moneda_snapshot: string | null
          prioridad:
            | Database["public"]["Enums"]["notificacion_prioridad_enum"]
            | null
          read_at: string | null
          renovacion_automatica_snapshot: boolean | null
          resaltada: boolean | null
          scheduled_for: string | null
          servicio_contrasena_snapshot: string | null
          servicio_correo_snapshot: string | null
          servicio_id: string | null
          servicio_nombre_snapshot: string | null
          servicio_periodo_id: string | null
          tipo: string | null
          titulo: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_servicio_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "servicio_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_servicio_periodos_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["ultimo_periodo_id"]
          },
        ]
      }
      v_notificaciones_venta: {
        Row: {
          categoria_id: string | null
          categoria_nombre_snapshot: string | null
          ciclo_pago_snapshot:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          cliente_id: string | null
          cliente_nombre_snapshot: string | null
          cliente_telefono_snapshot: string | null
          codigo_snapshot: string | null
          created_at: string | null
          dedupe_key: string | null
          dias_restantes: number | null
          dismissed_at: string | null
          entidad:
            | Database["public"]["Enums"]["notificacion_entidad_enum"]
            | null
          fecha_fin_snapshot: string | null
          fecha_inicio_snapshot: string | null
          fecha_prometida_pago: string | null
          id: string | null
          leida: boolean | null
          mensaje: string | null
          metodo_pago_nombre_snapshot: string | null
          moneda_snapshot: string | null
          notas: string | null
          perfil_nombre_snapshot: string | null
          precio_final_snapshot: number | null
          prioridad:
            | Database["public"]["Enums"]["notificacion_prioridad_enum"]
            | null
          read_at: string | null
          resaltada: boolean | null
          scheduled_for: string | null
          servicio_contrasena_snapshot: string | null
          servicio_correo_snapshot: string | null
          servicio_id: string | null
          servicio_nombre_snapshot: string | null
          tipo: string | null
          titulo: string | null
          updated_at: string | null
          venta_id: string | null
          venta_periodo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_venta_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_terceros_servicios_activos"
            referencedColumns: ["tercero_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_archivadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_venta_periodos_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["ultimo_periodo_id"]
          },
          {
            foreignKeyName: "notificaciones_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "venta_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pagos_servicio_full: {
        Row: {
          anulada_at: string | null
          anulada_by: string | null
          categoria_id: string | null
          categoria_id_snapshot: string | null
          categoria_nombre: string | null
          ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"] | null
          created_at: string | null
          created_by: string | null
          estado: Database["public"]["Enums"]["pago_estado_enum"] | null
          exchange_rate: number | null
          fecha_pago: string | null
          id: string | null
          metodo_pago_id: string | null
          metodo_pago_nombre_snapshot: string | null
          moneda_original: string | null
          monto_original: number | null
          monto_usd: number | null
          motivo_anulacion: string | null
          notas: string | null
          numero_periodo: number | null
          periodo_inicio: string | null
          periodo_vencimiento: string | null
          servicio_id: string | null
          servicio_nombre: string | null
          servicio_periodo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_servicio_anulada_by_fkey"
            columns: ["anulada_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_categoria_id_snapshot_fkey"
            columns: ["categoria_id_snapshot"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_categoria_id_snapshot_fkey"
            columns: ["categoria_id_snapshot"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "pagos_servicio_categoria_id_snapshot_fkey"
            columns: ["categoria_id_snapshot"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "pagos_servicio_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "servicio_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_servicio_periodos_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_servicio_servicio_periodo_id_fkey"
            columns: ["servicio_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["ultimo_periodo_id"]
          },
        ]
      }
      v_pagos_venta_full: {
        Row: {
          anulada_at: string | null
          anulada_by: string | null
          categoria_id: string | null
          categoria_nombre: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          created_at: string | null
          created_by: string | null
          descuento: number | null
          destino_reembolso: string | null
          estado: Database["public"]["Enums"]["pago_estado_enum"] | null
          exchange_rate: number | null
          fecha_pago: string | null
          id: string | null
          metodo_pago_id: string | null
          metodo_pago_nombre_snapshot: string | null
          moneda_original: string | null
          monto_original: number | null
          monto_usd: number | null
          motivo_anulacion: string | null
          notas: string | null
          numero_periodo: number | null
          periodo_ciclo_pago:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          periodo_fin: string | null
          periodo_inicio: string | null
          precio_original: number | null
          servicio_id: string | null
          servicio_nombre: string | null
          venta_id: string | null
          venta_periodo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_venta_anulada_by_fkey"
            columns: ["anulada_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_metodo_pago_id_fkey"
            columns: ["metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "pagos_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_archivadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_venta_periodos_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["ultimo_periodo_id"]
          },
          {
            foreignKeyName: "pagos_venta_venta_periodo_id_fkey"
            columns: ["venta_periodo_id"]
            isOneToOne: false
            referencedRelation: "venta_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_terceros_servicios_activos"
            referencedColumns: ["tercero_id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
        ]
      }
      v_servicio_periodos_full: {
        Row: {
          ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"] | null
          costo_original: number | null
          costo_usd: number | null
          created_at: string | null
          created_by: string | null
          estado_pago: string | null
          exchange_rate: number | null
          fecha_inicio: string | null
          fecha_vencimiento: string | null
          id: string | null
          moneda_original: string | null
          numero_periodo: number | null
          pagado_usd: number | null
          reembolsado_usd: number | null
          renovacion_automatica: boolean | null
          saldo_usd: number | null
          servicio_id: string | null
          tipo: Database["public"]["Enums"]["periodo_tipo_enum"] | null
        }
        Relationships: [
          {
            foreignKeyName: "servicio_periodos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_periodos_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "servicio_periodos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_periodos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_periodos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "servicio_periodos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
        ]
      }
      v_servicios_archivados: {
        Row: {
          activo: boolean | null
          archivado_at: string | null
          archivado_by: string | null
          categoria_id: string | null
          categoria_nombre: string | null
          contrasena: string | null
          correo: string | null
          cortado_at: string | null
          cortado_by: string | null
          created_at: string | null
          created_by: string | null
          dias_reposo: number | null
          en_reposo: boolean | null
          fecha_fin_reposo: string | null
          fecha_inicio_reposo: string | null
          id: string | null
          motivo_archivado: string | null
          motivo_corte: string | null
          nombre: string | null
          notas: string | null
          perfiles_disponibles: number | null
          perfiles_ocupados: number | null
          plan_tipo_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicios_archivado_by_fkey"
            columns: ["archivado_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "servicios_cortado_by_fkey"
            columns: ["cortado_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_plan_tipo_id_categoria_id_fkey"
            columns: ["plan_tipo_id", "categoria_id"]
            isOneToOne: false
            referencedRelation: "planes_tipos"
            referencedColumns: ["id", "categoria_id"]
          },
        ]
      }
      v_servicios_disponibilidad: {
        Row: {
          activo: boolean | null
          categoria_id: string | null
          en_reposo: boolean | null
          nombre: string | null
          perfiles_disponibles: number | null
          perfiles_libres: number | null
          perfiles_ocupados: number | null
          servicio_id: string | null
        }
        Insert: {
          activo?: boolean | null
          categoria_id?: string | null
          en_reposo?: boolean | null
          nombre?: string | null
          perfiles_disponibles?: number | null
          perfiles_libres?: never
          perfiles_ocupados?: number | null
          servicio_id?: string | null
        }
        Update: {
          activo?: boolean | null
          categoria_id?: string | null
          en_reposo?: boolean | null
          nombre?: string | null
          perfiles_disponibles?: number | null
          perfiles_libres?: never
          perfiles_ocupados?: number | null
          servicio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
        ]
      }
      v_servicios_full: {
        Row: {
          activo: boolean | null
          archivado_at: string | null
          archivado_by: string | null
          categoria_id: string | null
          categoria_nombre: string | null
          contrasena: string | null
          correo: string | null
          cortado_at: string | null
          cortado_by: string | null
          created_at: string | null
          created_by: string | null
          dias_reposo: number | null
          en_reposo: boolean | null
          fecha_fin_reposo: string | null
          fecha_inicio_reposo: string | null
          id: string | null
          motivo_archivado: string | null
          motivo_corte: string | null
          nombre: string | null
          notas: string | null
          perfiles_disponibles: number | null
          perfiles_libres: number | null
          perfiles_ocupados: number | null
          plan_tipo_id: string | null
          plan_tipo_nombre: string | null
          renovaciones: number | null
          ultima_fecha_inicio: string | null
          ultima_fecha_vencimiento: string | null
          ultima_moneda: string | null
          ultima_renovacion_automatica: boolean | null
          ultimo_ciclo_pago:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          ultimo_costo_original: number | null
          ultimo_costo_usd: number | null
          ultimo_metodo_pago_id: string | null
          ultimo_metodo_pago_nombre: string | null
          ultimo_numero_periodo: number | null
          ultimo_periodo_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_servicio_metodo_pago_id_fkey"
            columns: ["ultimo_metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicio_periodos_moneda_original_fkey"
            columns: ["ultima_moneda"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "servicios_archivado_by_fkey"
            columns: ["archivado_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "servicios_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "servicios_cortado_by_fkey"
            columns: ["cortado_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_plan_tipo_id_categoria_id_fkey"
            columns: ["plan_tipo_id", "categoria_id"]
            isOneToOne: false
            referencedRelation: "planes_tipos"
            referencedColumns: ["id", "categoria_id"]
          },
        ]
      }
      v_terceros_servicios_activos: {
        Row: {
          apellido: string | null
          nombre: string | null
          servicios_activos: number | null
          tercero_id: string | null
          tipo: Database["public"]["Enums"]["tercero_tipo_enum"] | null
        }
        Relationships: []
      }
      v_venta_periodos_full: {
        Row: {
          ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"] | null
          created_at: string | null
          created_by: string | null
          descuento: number | null
          estado_pago: string | null
          exchange_rate: number | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string | null
          moneda_original: string | null
          numero_periodo: number | null
          pagado_usd: number | null
          plan_id: string | null
          plan_nombre_snapshot: string | null
          plan_tipo_nombre_snapshot: string | null
          precio_original: number | null
          reembolsado_usd: number | null
          saldo_usd: number | null
          tipo: Database["public"]["Enums"]["periodo_tipo_enum"] | null
          total_original: number | null
          total_usd: number | null
          venta_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venta_periodos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_periodos_moneda_original_fkey"
            columns: ["moneda_original"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "venta_periodos_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_periodos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_archivadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_periodos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "v_ventas_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_periodos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ventas_archivadas: {
        Row: {
          archivado_at: string | null
          archivado_by: string | null
          categoria_id: string | null
          categoria_nombre: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          codigo: string | null
          cortada_at: string | null
          cortada_by: string | null
          created_at: string | null
          created_by: string | null
          estado: Database["public"]["Enums"]["venta_estado_enum"] | null
          id: string | null
          motivo_archivado: string | null
          motivo_corte: string | null
          notas: string | null
          perfil_nombre: string | null
          perfil_numero: number | null
          servicio_id: string | null
          servicio_nombre: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_archivado_by_fkey"
            columns: ["archivado_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_terceros_servicios_activos"
            referencedColumns: ["tercero_id"]
          },
          {
            foreignKeyName: "ventas_cortada_by_fkey"
            columns: ["cortada_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
        ]
      }
      v_venta_whatsapp_notice_status: {
        Row: {
          venta_id: string | null
          notice_id: string | null
          tipo: Database["public"]["Enums"]["tipo_template_enum"] | null
          origin: string | null
          notice_status: string | null
          delivery_status: string | null
          created_at: string | null
        }
        Relationships: []
      }
      v_ventas_full: {
        Row: {
          archivado_at: string | null
          archivado_by: string | null
          categoria_id: string | null
          categoria_nombre: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          codigo: string | null
          cortada_at: string | null
          cortada_by: string | null
          created_at: string | null
          created_by: string | null
          estado: Database["public"]["Enums"]["venta_estado_enum"] | null
          id: string | null
          motivo_archivado: string | null
          motivo_corte: string | null
          notas: string | null
          perfil_nombre: string | null
          perfil_numero: number | null
          renovaciones: number | null
          servicio_contrasena: string | null
          servicio_correo: string | null
          servicio_id: string | null
          servicio_nombre: string | null
          ultima_fecha_fin: string | null
          ultima_fecha_inicio: string | null
          ultima_moneda: string | null
          ultimo_ciclo_pago:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          ultimo_descuento: number | null
          ultimo_metodo_pago_id: string | null
          ultimo_metodo_pago_nombre: string | null
          ultimo_numero_periodo: number | null
          ultimo_periodo_id: string | null
          ultimo_plan_id: string | null
          ultimo_plan_nombre: string | null
          ultimo_plan_tipo_nombre: string | null
          ultimo_precio_original: number | null
          ultimo_total_original: number | null
          ultimo_total_usd: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_venta_metodo_pago_id_fkey"
            columns: ["ultimo_metodo_pago_id"]
            isOneToOne: false
            referencedRelation: "metodos_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_periodos_moneda_original_fkey"
            columns: ["ultima_moneda"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "venta_periodos_plan_id_fkey"
            columns: ["ultimo_plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_archivado_by_fkey"
            columns: ["archivado_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_counters"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "ventas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "v_categoria_financial_metrics"
            referencedColumns: ["categoria_id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "terceros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_terceros_servicios_activos"
            referencedColumns: ["tercero_id"]
          },
          {
            foreignKeyName: "ventas_cortada_by_fkey"
            columns: ["cortada_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_archivados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_disponibilidad"
            referencedColumns: ["servicio_id"]
          },
          {
            foreignKeyName: "ventas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "v_servicios_full"
            referencedColumns: ["id"]
          },
        ]
      }
      v_whatsapp_conversations: {
        Row: {
          archived: boolean | null
          categorias_activas: string[] | null
          contact_name: string | null
          last_direction: string | null
          last_inbound_at: string | null
          last_message_at: string | null
          last_preview: string | null
          pinned_at: string | null
          proxima_fecha_fin: string | null
          tercero_id: string | null
          tercero_nombre: string | null
          unread_count: number | null
          wa_id: string | null
        }
        Relationships: []
      }
      v_whatsapp_messages: {
        Row: {
          context_wa_message_id: string | null
          payload: Json | null
          reaction_emoji: string | null
          template_params: Json | null
          wa_message_id: string | null
          direction: string | null
          id: string | null
          media_filename: string | null
          media_id: string | null
          media_mime_type: string | null
          message_kind: string | null
          occurred_at: string | null
          status: string | null
          template_name: string | null
          text_body: string | null
          wa_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      mt_order_resolution_quote: { Args: { p_order_id: string }; Returns: Json }
      mt_resolve_order: { Args: { p_order_id: string; p_action: string; p_expected_amount: number; p_reference: string | null; p_items: string[] | null; p_idempotency_key: string }; Returns: string }
      mt_claim_order_delivery: { Args: { p_order_id?: string | null }; Returns: Json }
      mt_order_delivery_access: { Args: { p_id: string; p_token: string; p_fence: number }; Returns: Json }
      mt_finish_order_delivery: { Args: { p_id: string; p_token: string; p_fence: number; p_result: string; p_outbound_id?: string | null }; Returns: boolean }
      mt_retry_order_delivery: { Args: { p_order_id: string }; Returns: boolean }
      mt_resolve_access_sale: { Args: { p_wa_id: string; p_sale_id: string }; Returns: string | null }
      mt_resolve_excess: { Args: { p_order_id: string; p_action: string; p_reference: string; p_expected_amount: number; p_idempotency_key: string }; Returns: string }
      mt_retry_receipts: { Args: { p_limit: number }; Returns: number }
      mt_export_integration_events: { Args: { p_consumer: string }; Returns: Json }
      mt_ack_integration_event: { Args: { p_consumer: string; p_event_id: string; p_token: string }; Returns: boolean }
      mt_panel_checkout: { Args: { p_groups: Json; p_idempotency_key: string }; Returns: string }
      mt_list_orders: { Args: Record<string, never>; Returns: Json }
      mt_order_command: { Args: { p_order_id: string; p_action: string; p_idempotency_key: string; p_wa_id?: string | null }; Returns: string }
      mt_delete_order: { Args: { p_order_id: string; p_idempotency_key: string }; Returns: string }
      mt_register_order_payment: { Args: { p_order_id: string; p_amount: number; p_reference: string; p_idempotency_key: string }; Returns: string }
      mt_mark_order_delivered: { Args: { p_order_id: string; p_idempotency_key: string }; Returns: string }
      mt_reconcile_order: { Args: { p_order_id: string; p_code: string; p_wa_id: string | null; p_idempotency_key: string }; Returns: string }
      mt_match_order_payment: { Args: { p_order_id: string; p_last4: string | null; p_wa_id: string; p_idempotency_key: string }; Returns: string }
      mt_public_catalog: { Args: Record<string, never>; Returns: Json }
      mt_customer_sales: { Args: { p_wa_id: string }; Returns: Json }
      mt_create_commerce_order: { Args: { p_wa_id: string; p_ids: string[]; p_kind: string; p_idempotency_key: string; p_expected_total: number }; Returns: string }
      mt_get_commerce_order: { Args: { p_wa_id: string; p_order_id: string }; Returns: Json }
      mt_register_interest: { Args: { p_contact: string; p_category_id: string; p_plan_id: string | null; p_consent: boolean }; Returns: string }
      mt_claim_interest_notice: { Args: { p_id: string }; Returns: Json }
      mt_claim_automatic_interest: { Args: { p_id?: string | null; p_manual?: boolean }; Returns: Json }
      mt_check_interest_delivery: { Args: { p_id: string; p_token: string; p_fence: number }; Returns: boolean }
      mt_finish_automatic_interest: { Args: { p_id: string; p_token: string; p_fence: number; p_result: string; p_outbound_id?: string | null }; Returns: boolean }
      mt_finish_interest_notice: { Args: { p_id: string }; Returns: string }
      mt_set_service_access: { Args: { p_service_id: string; p_mode: string; p_rotation_confirmed: boolean }; Returns: string }
      mt_update_automation_settings: { Args: { p_settings: Json }; Returns: string }
      mt_set_commerce_copy: { Args: { p_key: string; p_text: string | null }; Returns: string }
      mt_manage_interest: { Args: { p_id: string; p_action: string }; Returns: string }
      mt_claim_ai_budget: { Args: { p_tokens: number }; Returns: boolean }
      mt_automation_metrics: { Args: Record<PropertyKey, never>; Returns: Json }
      claim_whatsapp_automation: { Args: { p_lease_seconds?: number }; Returns: Json }
      checkpoint_whatsapp_automation: { Args: { p_wa_id: string; p_token: string; p_fence: number; p_context: Json; p_process: string | null; p_order_id: string | null; p_flow_version: number | null }; Returns: boolean }
      check_whatsapp_automation_lease: { Args: { p_wa_id: string; p_token: string; p_fence: number }; Returns: boolean }
      finish_whatsapp_automation: { Args: { p_id: number; p_token: string; p_fence: number; p_outcome: string; p_context?: Json | null; p_process?: string | null; p_order_id?: string | null; p_flow_version?: number | null }; Returns: boolean }
      set_whatsapp_conversation_mode: { Args: { p_wa_id: string; p_mode: string; p_version: number }; Returns: boolean }
      resolve_whatsapp_automation_review: { Args: { p_wa_id: string; p_version: number }; Returns: boolean }
      publish_whatsapp_bot_version: { Args: { p_definition: Json; p_note: string }; Returns: number }
      set_whatsapp_bot_enabled: { Args: { p_enabled: boolean }; Returns: boolean }
      record_whatsapp_bot_event: { Args: { p_wa_id: string; p_cliente_id: string | null; p_type: string; p_node_id: string | null; p_option_id: string | null; p_detail: Json }; Returns: string }
      claim_netflix_code: { Args: { p_mail_key: string; p_wa_id: string }; Returns: string }
      release_netflix_code: { Args: { p_mail_key: string; p_wa_id: string }; Returns: boolean }
      claim_whatsapp_notice_reply: { Args: { p_notice_id: string; p_action: string; p_inbound_wa_message_id: string }; Returns: { reply_id: number; attempts: number; outcome: string }[] }
      finish_whatsapp_notice_reply: { Args: { p_reply_id: number; p_attempt: number; p_result: string; p_error_label?: string | null }; Returns: boolean }
      list_retryable_whatsapp_notice_replies: { Args: { p_limit: number }; Returns: { reply_id: number; notice_id: string; action: string; inbound_wa_message_id: string }[] }
      trigger_notice_reply_retries: { Args: never; Returns: number }
      trigger_auto_notices: { Args: never; Returns: number }
      ingest_yappy_payment: { Args: { p_uid_validity: number; p_imap_uid: number; p_internet_message_id: string | null; p_received_at: string; p_subject: string | null; p_dmarc_pass: boolean | null; p_parser_version: number; p_confirmation_code: string; p_amount: number; p_payer_name_short: string; p_payer_phone_last4: string; p_paid_at: string; p_reject_reason?: string | null }; Returns: { outcome: string; payment_id: string | null; match_status: string | null }[] }
      record_invalid_yappy_mail: { Args: { p_uid_validity: number; p_imap_uid: number; p_received_at: string; p_parser_version: number; p_failure_reason: string }; Returns: undefined }
      claim_yappy_mail_sync: { Args: never; Returns: boolean }
      match_yappy_payment: { Args: { p_payment_id: string }; Returns: string }
      resolve_yappy_payment: { Args: { p_payment_id: string; p_venta_id: string; p_note?: string | null }; Returns: string }
      dismiss_yappy_payment: { Args: { p_payment_id: string; p_note: string }; Returns: string }
      hide_whatsapp_message: { Args: { p_message_id: string; p_direction: string }; Returns: undefined }
      trigger_yappy_sync: { Args: never; Returns: number }
      assert_notification_integrity: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      check_doble_venta_perfil: {
        Args: never
        Returns: {
          conteo: number
          perfil_numero: number
          servicio_id: string
        }[]
      }
      check_pagos_servicio_sin_periodo: {
        Args: never
        Returns: {
          pago_id: string
          servicio_periodo_id: string
        }[]
      }
      check_pagos_venta_sin_periodo: {
        Args: never
        Returns: {
          pago_id: string
          venta_periodo_id: string
        }[]
      }
      check_perfiles_ocupados_inconsistentes: {
        Args: never
        Returns: {
          perfiles_ocupados_actual: number
          perfiles_ocupados_real: number
          servicio_id: string
        }[]
      }
      check_periodos_servicio_saldo_distinto: {
        Args: never
        Returns: {
          costo_usd: number
          pagado_usd: number
          servicio_id: string
          servicio_periodo_id: string
        }[]
      }
      check_periodos_venta_saldo_distinto: {
        Args: never
        Returns: {
          pagado_usd: number
          total_usd: number
          venta_id: string
          venta_periodo_id: string
        }[]
      }
      check_servicios_archivados_activos: {
        Args: never
        Returns: {
          servicio_id: string
        }[]
      }
      check_ventas_archivadas_activas: {
        Args: never
        Returns: {
          venta_id: string
        }[]
      }
      check_ventas_categoria_inconsistente: {
        Args: never
        Returns: {
          servicio_categoria_id: string
          venta_categoria_id: string
          venta_id: string
        }[]
      }
      check_ventas_sin_servicio: {
        Args: never
        Returns: {
          servicio_id: string
          venta_id: string
        }[]
      }
      claim_executive_push_due: { Args: never; Returns: string }
      create_servicio_payment:
        | {
            Args: {
              p_categoria_id_snapshot: string
              p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
              p_costo_original: number
              p_costo_usd: number
              p_created_by?: string
              p_exchange_rate: number
              p_fecha_inicio: string
              p_fecha_pago?: string
              p_fecha_vencimiento: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_pago_notas?: string
              p_renovacion_automatica: boolean
              p_servicio_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_categoria_id_snapshot: string
              p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
              p_costo_original: number
              p_costo_usd: number
              p_created_by?: string
              p_exchange_rate: number
              p_fecha_inicio: string
              p_fecha_pago?: string
              p_fecha_vencimiento: string
              p_idempotency_key?: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_pago_notas?: string
              p_renovacion_automatica: boolean
              p_servicio_id: string
            }
            Returns: string
          }
      create_servicio_with_initial_payment:
        | {
            Args: {
              p_activo: boolean
              p_categoria_id: string
              p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
              p_contrasena: string
              p_correo: string
              p_costo_original: number
              p_costo_usd: number
              p_created_by?: string
              p_dias_reposo: number
              p_en_reposo: boolean
              p_exchange_rate: number
              p_fecha_fin_reposo: string
              p_fecha_inicio: string
              p_fecha_inicio_reposo: string
              p_fecha_pago?: string
              p_fecha_vencimiento: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_nombre: string
              p_notas: string
              p_pago_notas?: string
              p_perfiles_disponibles: number
              p_perfiles_ocupados: number
              p_plan_tipo_id: string
              p_renovacion_automatica: boolean
            }
            Returns: string
          }
        | {
            Args: {
              p_activo: boolean
              p_categoria_id: string
              p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
              p_contrasena: string
              p_correo: string
              p_costo_original: number
              p_costo_usd: number
              p_created_by?: string
              p_dias_reposo: number
              p_en_reposo: boolean
              p_exchange_rate: number
              p_fecha_fin_reposo: string
              p_fecha_inicio: string
              p_fecha_inicio_reposo: string
              p_fecha_pago?: string
              p_fecha_vencimiento: string
              p_idempotency_key?: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_nombre: string
              p_notas: string
              p_pago_notas?: string
              p_perfiles_disponibles: number
              p_perfiles_ocupados: number
              p_plan_tipo_id: string
              p_renovacion_automatica: boolean
            }
            Returns: string
          }
      create_venta_payment:
        | {
            Args: {
              p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
              p_created_by?: string
              p_descuento: number
              p_exchange_rate: number
              p_fecha_fin: string
              p_fecha_inicio: string
              p_fecha_pago?: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_pago_notas?: string
              p_plan_id?: string
              p_plan_nombre_snapshot?: string
              p_plan_tipo_nombre_snapshot?: string
              p_precio_original: number
              p_total_original: number
              p_total_usd: number
              p_venta_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
              p_created_by?: string
              p_descuento: number
              p_exchange_rate: number
              p_fecha_fin: string
              p_fecha_inicio: string
              p_fecha_pago?: string
              p_idempotency_key?: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_pago_notas?: string
              p_plan_id?: string
              p_plan_nombre_snapshot?: string
              p_plan_tipo_nombre_snapshot?: string
              p_precio_original: number
              p_total_original: number
              p_total_usd: number
              p_venta_id: string
            }
            Returns: string
          }
      create_venta_refund:
        | {
            Args: {
              p_cortar?: boolean
              p_created_by?: string
              p_destino_reembolso?: string
              p_exchange_rate: number
              p_fecha_reembolso?: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_monto_original: number
              p_monto_usd: number
              p_motivo_corte?: string
              p_nota?: string
              p_venta_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_cortar?: boolean
              p_created_by?: string
              p_destino_reembolso?: string
              p_exchange_rate: number
              p_fecha_reembolso?: string
              p_idempotency_key?: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_monto_original: number
              p_monto_usd: number
              p_motivo_corte?: string
              p_nota?: string
              p_venta_id: string
            }
            Returns: string
          }
      create_venta_with_initial_payment:
        | {
            Args: {
              p_categoria_id: string
              p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
              p_cliente_id: string
              p_codigo: string
              p_created_by?: string
              p_descuento: number
              p_estado: Database["public"]["Enums"]["venta_estado_enum"]
              p_exchange_rate: number
              p_fecha_fin: string
              p_fecha_inicio: string
              p_fecha_pago?: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_notas: string
              p_pago_notas?: string
              p_perfil_nombre: string
              p_perfil_numero: number
              p_plan_id?: string
              p_plan_nombre_snapshot?: string
              p_plan_tipo_nombre_snapshot?: string
              p_precio_original: number
              p_servicio_id: string
              p_total_original: number
              p_total_usd: number
            }
            Returns: string
          }
        | {
            Args: {
              p_categoria_id: string
              p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
              p_cliente_id: string
              p_codigo: string
              p_created_by?: string
              p_descuento: number
              p_estado: Database["public"]["Enums"]["venta_estado_enum"]
              p_exchange_rate: number
              p_fecha_fin: string
              p_fecha_inicio: string
              p_fecha_pago?: string
              p_idempotency_key?: string
              p_metodo_pago_id: string
              p_metodo_pago_nombre_snapshot: string
              p_moneda_original: string
              p_notas: string
              p_pago_notas?: string
              p_perfil_nombre: string
              p_perfil_numero: number
              p_plan_id?: string
              p_plan_nombre_snapshot?: string
              p_plan_tipo_nombre_snapshot?: string
              p_precio_original: number
              p_servicio_id: string
              p_total_original: number
              p_total_usd: number
            }
            Returns: string
          }
      delete_categoria: { Args: { p_categoria_id: string }; Returns: undefined }
      delete_servicio_payment_and_empty_period: {
        Args: { p_pago_id: string }
        Returns: undefined
      }
      delete_servicio_with_payments: {
        Args: { p_delete_payments?: boolean; p_servicio_id: string }
        Returns: undefined
      }
      delete_venta_payment_and_empty_period: {
        Args: { p_pago_id: string }
        Returns: undefined
      }
      delete_venta_with_payments: {
        Args: { p_delete_payments?: boolean; p_venta_id: string }
        Returns: undefined
      }
      get_categorias_counts: { Args: never; Returns: Json }
      get_categorias_full: { Args: never; Returns: Json }
      get_dashboard_churn_stats: { Args: never; Returns: Json }
      get_dashboard_home: { Args: never; Returns: Json }
      get_dashboard_stats_live: {
        Args: never
        Returns: {
          gastos_total: number
          id: string
          ingresos_categorias_por_mes: Json
          ingresos_por_categoria: Json
          ingresos_por_dia: Json
          ingresos_por_mes: Json
          ingresos_total: number
          servicios_pronostico: Json
          terceros_por_dia: Json
          terceros_por_mes: Json
          updated_at: string
          ventas_pronostico: Json
        }[]
      }
      get_dashboard_stats_snapshot: {
        Args: never
        Returns: {
          churn_stats: Json
          gastos_total: number
          id: string
          ingresos_categorias_por_mes: Json
          ingresos_por_categoria: Json
          ingresos_por_dia: Json
          ingresos_por_mes: Json
          ingresos_total: number
          servicios_pronostico: Json
          terceros_por_dia: Json
          terceros_por_mes: Json
          updated_at: string
          ventas_pronostico: Json
        }[]
      }
      is_authenticated: { Args: never; Returns: boolean }
      reserve_whatsapp_notice: {
        Args: {
          p_dedupe_key: string
          p_tipo: Database["public"]["Enums"]["tipo_template_enum"]
          p_tercero_id: string
          p_wa_id: string
          p_channel: string
          p_meta_template_name: string | null
          p_fecha_vencimiento: string | null
          p_origin: string
          p_idempotency_key: string
          p_created_by: string | null
          p_venta_ids: string[]
        }
        Returns: Database["public"]["Tables"]["whatsapp_notices"]["Row"]
      }
      refresh_dashboard_stats_snapshot: {
        Args: { p_force?: boolean }
        Returns: boolean
      }
      run_all_validations: { Args: never; Returns: Json }
      run_security_audit_validations: { Args: never; Returns: Json }
      trigger_executive_push: { Args: never; Returns: string }
      update_servicio_payment_and_period: {
        Args: {
          p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
          p_costo_original: number
          p_costo_usd: number
          p_exchange_rate: number
          p_fecha_inicio: string
          p_fecha_vencimiento: string
          p_metodo_pago_id: string
          p_metodo_pago_nombre_snapshot: string
          p_moneda_original: string
          p_pago_id: string
          p_pago_notas?: string
          p_renovacion_automatica: boolean
        }
        Returns: undefined
      }
      update_venta_payment_and_period: {
        Args: {
          p_ciclo_pago: Database["public"]["Enums"]["ciclo_pago_enum"]
          p_descuento: number
          p_exchange_rate: number
          p_fecha_fin: string
          p_fecha_inicio: string
          p_metodo_pago_id: string
          p_metodo_pago_nombre_snapshot: string
          p_moneda_original: string
          p_pago_id: string
          p_pago_notas?: string
          p_precio_original: number
          p_total_original: number
          p_total_usd: number
        }
        Returns: undefined
      }
      upsert_notification_aggregate: {
        Args: {
          p_base: Json
          p_detail: Json
          p_preserve_existing_state: boolean
        }
        Returns: string
      }
    }
    Enums: {
      accion_log_enum:
        | "creacion"
        | "actualizacion"
        | "corte"
        | "eliminacion"
        | "renovacion"
        | "reembolso"
      asociado_a_enum: "tercero" | "servicio"
      categoria_tipo_cat_enum: "plataforma_streaming" | "otros"
      categoria_tipo_enum: "cliente" | "revendedor"
      ciclo_pago_enum: "mensual" | "trimestral" | "semestral" | "anual"
      entidad_log_enum:
        | "cliente"
        | "revendedor"
        | "servicio"
        | "tercero"
        | "categoria"
        | "metodo_pago"
        | "gasto"
        | "venta"
        | "template"
        | "bot"
      metodo_pago_tipo_enum:
        | "banco"
        | "yappy"
        | "paypal"
        | "binance"
        | "efectivo"
      notificacion_entidad_enum: "venta" | "servicio" | "reposo"
      notificacion_prioridad_enum: "baja" | "media" | "alta" | "critica"
      pago_estado_enum: "registrado" | "anulado" | "reembolsado"
      periodo_tipo_enum: "inicial" | "renovacion" | "ajuste"
      tercero_tipo_enum: "cliente" | "revendedor"
      tipo_cuenta_enum: "ahorro" | "corriente" | "wallet" | "telefono" | "email"
      tipo_template_enum:
        | "notificacion_regular"
        | "dia_pago"
        | "renovacion"
        | "suscripcion"
        | "cancelacion"
        | "actualizacion_credenciales"
        | "transferencia_servicio"
        | "datos_pago"
        | "datos_acceso"
        | "despedida"
      venta_estado_enum: "activo" | "inactivo"
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
      accion_log_enum: [
        "creacion",
        "actualizacion",
        "corte",
        "eliminacion",
        "renovacion",
        "reembolso",
      ],
      asociado_a_enum: ["tercero", "servicio"],
      categoria_tipo_cat_enum: ["plataforma_streaming", "otros"],
      categoria_tipo_enum: ["cliente", "revendedor"],
      ciclo_pago_enum: ["mensual", "trimestral", "semestral", "anual"],
      entidad_log_enum: [
        "cliente",
        "revendedor",
        "servicio",
        "tercero",
        "categoria",
        "metodo_pago",
        "gasto",
        "venta",
        "template",
        "bot",
      ],
      metodo_pago_tipo_enum: [
        "banco",
        "yappy",
        "paypal",
        "binance",
        "efectivo",
      ],
      notificacion_entidad_enum: ["venta", "servicio", "reposo"],
      notificacion_prioridad_enum: ["baja", "media", "alta", "critica"],
      pago_estado_enum: ["registrado", "anulado", "reembolsado"],
      periodo_tipo_enum: ["inicial", "renovacion", "ajuste"],
      tercero_tipo_enum: ["cliente", "revendedor"],
      tipo_cuenta_enum: ["ahorro", "corriente", "wallet", "telefono", "email"],
      tipo_template_enum: [
        "notificacion_regular",
        "dia_pago",
        "renovacion",
        "suscripcion",
        "cancelacion",
        "actualizacion_credenciales",
        "transferencia_servicio",
        "datos_pago",
        "datos_acceso",
        "despedida",
      ],
      venta_estado_enum: ["activo", "inactivo"],
    },
  },
} as const
