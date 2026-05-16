// Auto-generated from Supabase project amvougsdkpyptzahtram.
// Re-generate with: supabase gen types typescript --project-id amvougsdkpyptzahtram
// Do not edit by hand.

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
      activity_log: {
        Row: {
          accion: Database["public"]["Enums"]["accion_log_enum"]
          cambios: Json | null
          detalles: string
          entidad: Database["public"]["Enums"]["entidad_log_enum"]
          entidad_id: string
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
          executive_push_block_order: Json | null
          executive_push_enabled: boolean
          executive_push_last_sent_at: string | null
          executive_push_last_sent_date: string | null
          executive_push_interval_hours: number
          executive_push_selected_blocks: Json | null
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
          executive_push_block_order?: Json | null
          executive_push_enabled?: boolean
          executive_push_last_sent_at?: string | null
          executive_push_last_sent_date?: string | null
          executive_push_interval_hours?: number
          executive_push_selected_blocks?: Json | null
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
          executive_push_block_order?: Json | null
          executive_push_enabled?: boolean
          executive_push_last_sent_at?: string | null
          executive_push_last_sent_date?: string | null
          executive_push_interval_hours?: number
          executive_push_selected_blocks?: Json | null
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
        Relationships: []
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
          metodo_pago_nombre_snapshot: string | null
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
          metodo_pago_nombre_snapshot?: string | null
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
          metodo_pago_nombre_snapshot?: string | null
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
          metodo_pago_nombre_snapshot: string | null
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
          metodo_pago_nombre_snapshot?: string | null
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
          metodo_pago_nombre_snapshot?: string | null
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
          metodo_pago_nombre_snapshot: string | null
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
          metodo_pago_nombre_snapshot?: string | null
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
          metodo_pago_nombre_snapshot?: string | null
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
        ]
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
      templates: {
        Row: {
          activo: boolean
          contenido: string
          created_at: string
          id: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_template_enum"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contenido: string
          created_at?: string
          id?: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_template_enum"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contenido?: string
          created_at?: string
          id?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_template_enum"]
          updated_at?: string
        }
        Relationships: []
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
      terceros: {
        Row: {
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
          plan_nombre_snapshot: string | null
          plan_tipo_nombre_snapshot: string | null
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
          plan_nombre_snapshot?: string | null
          plan_tipo_nombre_snapshot?: string | null
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
          plan_nombre_snapshot?: string | null
          plan_tipo_nombre_snapshot?: string | null
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
    }
    Views: {
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
          metodo_pago_nombre_snapshot: string | null
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
          id: string | null
          leida: boolean | null
          mensaje: string | null
          metodo_pago_nombre_snapshot: string | null
          moneda_snapshot: string | null
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
          periodo_fin: string | null
          periodo_inicio: string | null
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
          perfiles_libres: number | null
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
          tipo: Database["public"]["Enums"]["tercero_tipo_enum"] | null
          tercero_id: string | null
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
          servicio_correo: string | null
          servicio_id: string | null
          servicio_nombre: string | null
          ultima_fecha_fin: string | null
          ultima_fecha_inicio: string | null
          ultima_moneda: string | null
          ultimo_ciclo_pago:
            | Database["public"]["Enums"]["ciclo_pago_enum"]
            | null
          ultimo_numero_periodo: number | null
          ultimo_periodo_id: string | null
          ultimo_plan_id: string | null
          ultimo_plan_nombre: string | null
          ultimo_plan_tipo_nombre: string | null
          ultimo_precio_original: number | null
          ultimo_descuento: number | null
          ultimo_metodo_pago_id: string | null
          ultimo_metodo_pago_nombre: string | null
          ultimo_total_original: number | null
          ultimo_total_usd: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venta_periodos_moneda_original_fkey"
            columns: ["ultima_moneda"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
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
    }
    Functions: {
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
      delete_categoria: {
        Args: { p_categoria_id: string }
        Returns: undefined
      }
      delete_servicio_payment_and_empty_period: {
        Args: { p_pago_id: string }
        Returns: undefined
      }
      delete_venta_payment_and_empty_period: {
        Args: { p_pago_id: string }
        Returns: undefined
      }
      is_authenticated: { Args: never; Returns: boolean }
      get_dashboard_stats_live: {
        Args: never
        Returns: {
          id: string
          ingresos_total: number
          gastos_total: number
          terceros_por_mes: Json
          terceros_por_dia: Json
          ingresos_por_mes: Json
          ingresos_por_dia: Json
          ingresos_por_categoria: Json
          ingresos_categorias_por_mes: Json
          ventas_pronostico: Json
          servicios_pronostico: Json
          updated_at: string
        }[]
      }
      get_categorias_full: { Args: never; Returns: Json }
      get_categorias_counts: { Args: never; Returns: Json }
      get_dashboard_home: { Args: never; Returns: Json }
      delete_venta_with_payments: {
        Args: { p_venta_id: string; p_delete_payments?: boolean }
        Returns: undefined
      }
      create_venta_refund: {
        Args: {
          p_venta_id: string
          p_monto_original: number
          p_moneda_original: string
          p_monto_usd: number
          p_exchange_rate: number | null
          p_metodo_pago_id: string | null
          p_metodo_pago_nombre_snapshot: string | null
          p_destino_reembolso?: string | null
          p_fecha_reembolso?: string
          p_nota?: string | null
          p_cortar?: boolean
          p_motivo_corte?: string | null
          p_created_by?: string | null
        }
        Returns: string
      }
      delete_servicio_with_payments: {
        Args: { p_servicio_id: string; p_delete_payments?: boolean }
        Returns: undefined
      }
      run_all_validations: { Args: never; Returns: Json }
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
      tipo_cuenta_enum: "ahorro" | "corriente" | "wallet" | "telefono" | "email"
      tipo_template_enum:
        | "notificacion_regular"
        | "dia_pago"
        | "renovacion"
        | "suscripcion"
        | "cancelacion"
      tercero_tipo_enum: "cliente" | "revendedor"
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
      tipo_cuenta_enum: ["ahorro", "corriente", "wallet", "telefono", "email"],
      tipo_template_enum: [
        "notificacion_regular",
        "dia_pago",
        "renovacion",
        "suscripcion",
        "cancelacion",
      ],
      tercero_tipo_enum: ["cliente", "revendedor"],
      venta_estado_enum: ["activo", "inactivo"],
    },
  },
} as const
