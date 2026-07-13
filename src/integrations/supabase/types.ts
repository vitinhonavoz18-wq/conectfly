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
      beverage_catalogs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beverage_catalogs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beverage_catalogs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_groups: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          badge: string | null
          created_at: string
          external_id: string | null
          group_id: string
          id: string
          is_active: boolean | null
          is_highlighted: boolean | null
          items: string[]
          name: string
          price: number
          restaurant_id: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          badge?: string | null
          created_at?: string
          external_id?: string | null
          group_id: string
          id?: string
          is_active?: boolean | null
          is_highlighted?: boolean | null
          items?: string[]
          name: string
          price?: number
          restaurant_id: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          badge?: string | null
          created_at?: string
          external_id?: string | null
          group_id?: string
          id?: string
          is_active?: boolean | null
          is_highlighted?: boolean | null
          items?: string[]
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "combo_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combos_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          created_at: string
          external_id: string | null
          fee: number
          id: string
          neighborhood: string
          restaurant_id: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          fee?: number
          id?: string
          neighborhood: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string | null
          fee?: number
          id?: string
          neighborhood?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      dining_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          customer_token: string
          fl_session_id: string | null
          id: string
          last_activity_at: string
          legacy_table_session_id: string | null
          metadata: Json
          opened_at: string
          restaurant_id: string
          status: Database["public"]["Enums"]["dining_session_status"]
          table_id: string | null
          table_number: string
          table_token: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          customer_token?: string
          fl_session_id?: string | null
          id?: string
          last_activity_at?: string
          legacy_table_session_id?: string | null
          metadata?: Json
          opened_at?: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["dining_session_status"]
          table_id?: string | null
          table_number: string
          table_token?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          customer_token?: string
          fl_session_id?: string | null
          id?: string
          last_activity_at?: string
          legacy_table_session_id?: string | null
          metadata?: Json
          opened_at?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["dining_session_status"]
          table_id?: string | null
          table_number?: string
          table_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dining_sessions_legacy_table_session_id_fkey"
            columns: ["legacy_table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      flycontrol_order_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          payload: Json
          response_body: string | null
          restaurant_id: string
          status_code: number | null
          success: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          payload: Json
          response_body?: string | null
          restaurant_id: string
          status_code?: number | null
          success?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          payload?: Json
          response_body?: string | null
          restaurant_id?: string
          status_code?: number | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "flycontrol_order_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flycontrol_order_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          allow_cart_addition: boolean | null
          created_at: string
          description: string | null
          external_id: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_pizza: boolean
          name: string
          pizza_sizes: Json | null
          restaurant_id: string
          show_as_clickable_category: boolean | null
          show_directly_in_menu: boolean | null
          show_on_public_site: boolean | null
          sort_order: number
          type: string | null
          updated_at: string | null
        }
        Insert: {
          allow_cart_addition?: boolean | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_pizza?: boolean
          name: string
          pizza_sizes?: Json | null
          restaurant_id: string
          show_as_clickable_category?: boolean | null
          show_directly_in_menu?: boolean | null
          show_on_public_site?: boolean | null
          sort_order?: number
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_cart_addition?: boolean | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_pizza?: boolean
          name?: string
          pizza_sizes?: Json | null
          restaurant_id?: string
          show_as_clickable_category?: boolean | null
          show_directly_in_menu?: boolean | null
          show_on_public_site?: boolean | null
          sort_order?: number
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_special: boolean
          name: string
          price: number
          restaurant_id: string
          sizes: Json | null
          sort_order: number
          special_extra: number
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_special?: boolean
          name: string
          price?: number
          restaurant_id: string
          sizes?: Json | null
          sort_order?: number
          special_extra?: number
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_special?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          sizes?: Json | null
          sort_order?: number
          special_extra?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          name: string
          options: Json | null
          order_id: string
          product_id: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          options?: Json | null
          order_id: string
          product_id?: string | null
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          options?: Json | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_logs: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          restaurant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          restaurant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_submission_logs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          payload: Json | null
          response: Json | null
          restaurant_id: string | null
          source: string
          status: number | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          response?: Json | null
          restaurant_id?: string | null
          source: string
          status?: number | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          response?: Json | null
          restaurant_id?: string | null
          source?: string
          status?: number | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_submission_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_submission_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string
          customer_phone: string | null
          customer_token: string | null
          delivery_fee: number | null
          dining_session_id: string | null
          id: string
          is_test_order: boolean | null
          notes: string | null
          order_type: string | null
          payment_method: string
          payment_status: string | null
          restaurant_id: string
          service_mode: string | null
          status: string | null
          table_id: string | null
          table_number: string | null
          table_token: string | null
          ticket_number: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_token?: string | null
          delivery_fee?: number | null
          dining_session_id?: string | null
          id?: string
          is_test_order?: boolean | null
          notes?: string | null
          order_type?: string | null
          payment_method: string
          payment_status?: string | null
          restaurant_id: string
          service_mode?: string | null
          status?: string | null
          table_id?: string | null
          table_number?: string | null
          table_token?: string | null
          ticket_number?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_token?: string | null
          delivery_fee?: number | null
          dining_session_id?: string | null
          id?: string
          is_test_order?: boolean | null
          notes?: string | null
          order_type?: string | null
          payment_method?: string
          payment_status?: string | null
          restaurant_id?: string
          service_mode?: string | null
          status?: string | null
          table_id?: string | null
          table_number?: string | null
          table_token?: string | null
          ticket_number?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      pizzeria_beverages: {
        Row: {
          brand: string | null
          catalog_id: string | null
          category: string | null
          created_at: string | null
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          pizzeria_id: string
          price: number
          size: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          catalog_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          pizzeria_id: string
          price?: number
          size?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          catalog_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          pizzeria_id?: string
          price?: number
          size?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pizzeria_beverages_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "beverage_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizzeria_beverages_pizzeria_id_fkey"
            columns: ["pizzeria_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizzeria_beverages_pizzeria_id_fkey"
            columns: ["pizzeria_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pizzeria_pizza_sizes: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          is_active: boolean
          max_flavors: number
          name: string
          pizzeria_id: string
          price: number
          slices: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          max_flavors?: number
          name: string
          pizzeria_id: string
          price?: number
          slices?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          max_flavors?: number
          name?: string
          pizzeria_id?: string
          price?: number
          slices?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizzeria_pizza_sizes_pizzeria_id_fkey"
            columns: ["pizzeria_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizzeria_pizza_sizes_pizzeria_id_fkey"
            columns: ["pizzeria_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          public_token: string
          restaurant_id: string
          table_name: string | null
          table_number: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          public_token?: string
          restaurant_id: string
          table_name?: string | null
          table_number: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          public_token?: string
          restaurant_id?: string
          table_name?: string | null
          table_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          allow_dual_send: boolean | null
          business_type: string | null
          checkout_settings: Json | null
          city: string | null
          continue_opening_whatsapp: boolean | null
          created_at: string
          custom_subdomain: string | null
          delivery_enabled: boolean | null
          delivery_settings: Json | null
          description: string | null
          fiqon_webhook_url: string | null
          flycontrol_api_key: string | null
          flycontrol_api_url: string | null
          flycontrol_base_url: string | null
          flycontrol_direct_url: string | null
          flycontrol_enabled: boolean
          flycontrol_id: string | null
          flycontrol_register_url: string | null
          flycontrol_tenant_id: string | null
          hero_image_url: string | null
          hero_media_type: string
          hero_video_url: string | null
          hours: string | null
          id: string
          logo_url: string | null
          menu_sync_endpoint: string | null
          menu_sync_token: string | null
          name: string
          order_flow_mode: string | null
          owner_id: string | null
          pickup_enabled: boolean | null
          primary_color: string
          published: boolean
          secondary_color: string
          selected_template: string
          seo_settings: Json | null
          show_item_images: boolean | null
          site_settings: Json | null
          slug: string
          table_enabled: boolean | null
          tagline: string | null
          theme_settings: Json | null
          updated_at: string
          whatsapp_display: string | null
          whatsapp_enabled: boolean
          whatsapp_number: string
        }
        Insert: {
          address?: string | null
          allow_dual_send?: boolean | null
          business_type?: string | null
          checkout_settings?: Json | null
          city?: string | null
          continue_opening_whatsapp?: boolean | null
          created_at?: string
          custom_subdomain?: string | null
          delivery_enabled?: boolean | null
          delivery_settings?: Json | null
          description?: string | null
          fiqon_webhook_url?: string | null
          flycontrol_api_key?: string | null
          flycontrol_api_url?: string | null
          flycontrol_base_url?: string | null
          flycontrol_direct_url?: string | null
          flycontrol_enabled?: boolean
          flycontrol_id?: string | null
          flycontrol_register_url?: string | null
          flycontrol_tenant_id?: string | null
          hero_image_url?: string | null
          hero_media_type?: string
          hero_video_url?: string | null
          hours?: string | null
          id?: string
          logo_url?: string | null
          menu_sync_endpoint?: string | null
          menu_sync_token?: string | null
          name: string
          order_flow_mode?: string | null
          owner_id?: string | null
          pickup_enabled?: boolean | null
          primary_color?: string
          published?: boolean
          secondary_color?: string
          selected_template?: string
          seo_settings?: Json | null
          show_item_images?: boolean | null
          site_settings?: Json | null
          slug: string
          table_enabled?: boolean | null
          tagline?: string | null
          theme_settings?: Json | null
          updated_at?: string
          whatsapp_display?: string | null
          whatsapp_enabled?: boolean
          whatsapp_number?: string
        }
        Update: {
          address?: string | null
          allow_dual_send?: boolean | null
          business_type?: string | null
          checkout_settings?: Json | null
          city?: string | null
          continue_opening_whatsapp?: boolean | null
          created_at?: string
          custom_subdomain?: string | null
          delivery_enabled?: boolean | null
          delivery_settings?: Json | null
          description?: string | null
          fiqon_webhook_url?: string | null
          flycontrol_api_key?: string | null
          flycontrol_api_url?: string | null
          flycontrol_base_url?: string | null
          flycontrol_direct_url?: string | null
          flycontrol_enabled?: boolean
          flycontrol_id?: string | null
          flycontrol_register_url?: string | null
          flycontrol_tenant_id?: string | null
          hero_image_url?: string | null
          hero_media_type?: string
          hero_video_url?: string | null
          hours?: string | null
          id?: string
          logo_url?: string | null
          menu_sync_endpoint?: string | null
          menu_sync_token?: string | null
          name?: string
          order_flow_mode?: string | null
          owner_id?: string | null
          pickup_enabled?: boolean | null
          primary_color?: string
          published?: boolean
          secondary_color?: string
          selected_template?: string
          seo_settings?: Json | null
          show_item_images?: boolean | null
          site_settings?: Json | null
          slug?: string
          table_enabled?: boolean | null
          tagline?: string | null
          theme_settings?: Json | null
          updated_at?: string
          whatsapp_display?: string | null
          whatsapp_enabled?: boolean
          whatsapp_number?: string
        }
        Relationships: []
      }
      table_close_requests: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          allow_additional_orders: boolean
          created_at: string
          current_total: number
          customer_name: string | null
          customer_phone: string | null
          customer_token: string | null
          dining_session_id: string | null
          id: string
          notes: string | null
          order_count: number
          requested_at: string
          requested_by_ip: string | null
          restaurant_id: string
          status: string
          table_id: string
          table_number: string
          table_session_id: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          allow_additional_orders?: boolean
          created_at?: string
          current_total?: number
          customer_name?: string | null
          customer_phone?: string | null
          customer_token?: string | null
          dining_session_id?: string | null
          id?: string
          notes?: string | null
          order_count?: number
          requested_at?: string
          requested_by_ip?: string | null
          restaurant_id: string
          status?: string
          table_id: string
          table_number: string
          table_session_id?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          allow_additional_orders?: boolean
          created_at?: string
          current_total?: number
          customer_name?: string | null
          customer_phone?: string | null
          customer_token?: string | null
          dining_session_id?: string | null
          id?: string
          notes?: string | null
          order_count?: number
          requested_at?: string
          requested_by_ip?: string | null
          restaurant_id?: string
          status?: string
          table_id?: string
          table_number?: string
          table_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_close_requests_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_close_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_close_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_close_requests_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_close_requests_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      table_session_orders: {
        Row: {
          created_at: string
          id: string
          order_id: string
          table_session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          table_session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          table_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_session_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_session_orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          dining_session_id: string | null
          id: string
          opened_at: string
          restaurant_id: string
          status: string
          table_id: string
          table_number: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          dining_session_id?: string | null
          id?: string
          opened_at?: string
          restaurant_id: string
          status?: string
          table_id: string
          table_number: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          dining_session_id?: string | null
          id?: string
          opened_at?: string
          restaurant_id?: string
          status?: string
          table_id?: string
          table_number?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "pizzerias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      pizzerias_public: {
        Row: {
          address: string | null
          allow_dual_send: boolean | null
          business_type: string | null
          checkout_settings: Json | null
          city: string | null
          continue_opening_whatsapp: boolean | null
          custom_subdomain: string | null
          delivery_enabled: boolean | null
          delivery_settings: Json | null
          description: string | null
          fiqon_webhook_url: string | null
          flycontrol_api_url: string | null
          flycontrol_base_url: string | null
          flycontrol_direct_url: string | null
          flycontrol_enabled: boolean | null
          flycontrol_register_url: string | null
          flycontrol_tenant_id: string | null
          hero_image_url: string | null
          hero_media_type: string | null
          hero_video_url: string | null
          hours: string | null
          id: string | null
          logo_url: string | null
          menu_sync_endpoint: string | null
          name: string | null
          order_flow_mode: string | null
          owner_id: string | null
          pickup_enabled: boolean | null
          primary_color: string | null
          published: boolean | null
          secondary_color: string | null
          selected_template: string | null
          seo_settings: Json | null
          show_item_images: boolean | null
          site_settings: Json | null
          slug: string | null
          table_enabled: boolean | null
          tagline: string | null
          theme_settings: Json | null
          whatsapp_display: string | null
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          allow_dual_send?: boolean | null
          business_type?: string | null
          checkout_settings?: Json | null
          city?: string | null
          continue_opening_whatsapp?: boolean | null
          custom_subdomain?: string | null
          delivery_enabled?: boolean | null
          delivery_settings?: Json | null
          description?: string | null
          fiqon_webhook_url?: string | null
          flycontrol_api_url?: string | null
          flycontrol_base_url?: string | null
          flycontrol_direct_url?: string | null
          flycontrol_enabled?: boolean | null
          flycontrol_register_url?: string | null
          flycontrol_tenant_id?: string | null
          hero_image_url?: string | null
          hero_media_type?: string | null
          hero_video_url?: string | null
          hours?: string | null
          id?: string | null
          logo_url?: string | null
          menu_sync_endpoint?: string | null
          name?: string | null
          order_flow_mode?: string | null
          owner_id?: string | null
          pickup_enabled?: boolean | null
          primary_color?: string | null
          published?: boolean | null
          secondary_color?: string | null
          selected_template?: string | null
          seo_settings?: Json | null
          show_item_images?: boolean | null
          site_settings?: Json | null
          slug?: string | null
          table_enabled?: boolean | null
          tagline?: string | null
          theme_settings?: Json | null
          whatsapp_display?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          allow_dual_send?: boolean | null
          business_type?: string | null
          checkout_settings?: Json | null
          city?: string | null
          continue_opening_whatsapp?: boolean | null
          custom_subdomain?: string | null
          delivery_enabled?: boolean | null
          delivery_settings?: Json | null
          description?: string | null
          fiqon_webhook_url?: string | null
          flycontrol_api_url?: string | null
          flycontrol_base_url?: string | null
          flycontrol_direct_url?: string | null
          flycontrol_enabled?: boolean | null
          flycontrol_register_url?: string | null
          flycontrol_tenant_id?: string | null
          hero_image_url?: string | null
          hero_media_type?: string | null
          hero_video_url?: string | null
          hours?: string | null
          id?: string | null
          logo_url?: string | null
          menu_sync_endpoint?: string | null
          name?: string | null
          order_flow_mode?: string | null
          owner_id?: string | null
          pickup_enabled?: boolean | null
          primary_color?: string | null
          published?: boolean | null
          secondary_color?: string | null
          selected_template?: string | null
          seo_settings?: Json | null
          show_item_images?: boolean | null
          site_settings?: Json | null
          slug?: string | null
          table_enabled?: boolean | null
          tagline?: string | null
          theme_settings?: Json | null
          whatsapp_display?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_order_rate_limit: {
        Args: { p_ip: string; p_restaurant_id: string }
        Returns: boolean
      }
      generate_clean_subdomain: {
        Args: { input_text: string }
        Returns: string
      }
      get_restaurant_flycontrol_key: {
        Args: { p_restaurant_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      owns_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "owner"
      dining_session_status:
        | "active"
        | "requested_close"
        | "closing"
        | "closed"
        | "archived"
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
      app_role: ["admin", "owner"],
      dining_session_status: [
        "active",
        "requested_close",
        "closing",
        "closed",
        "archived",
      ],
    },
  },
} as const
