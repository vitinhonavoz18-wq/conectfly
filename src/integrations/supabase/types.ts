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
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          badge: string | null
          created_at: string
          group_id: string
          id: string
          items: string[]
          name: string
          price: number
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          badge?: string | null
          created_at?: string
          group_id: string
          id?: string
          items?: string[]
          name: string
          price?: number
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          badge?: string | null
          created_at?: string
          group_id?: string
          id?: string
          items?: string[]
          name?: string
          price?: number
          restaurant_id?: string
          sort_order?: number
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
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          created_at: string
          fee: number
          id: string
          neighborhood: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          fee?: number
          id?: string
          neighborhood: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          fee?: number
          id?: string
          neighborhood?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      menu_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          image_url: string | null
          is_pizza: boolean
          name: string
          pizza_sizes: Json | null
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_pizza?: boolean
          name: string
          pizza_sizes?: Json | null
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_pizza?: boolean
          name?: string
          pizza_sizes?: Json | null
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
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
          id: string
          image_url: string | null
          is_special: boolean
          name: string
          price: number
          restaurant_id: string
          sizes: Json | null
          sort_order: number
          special_extra: number
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_special?: boolean
          name: string
          price?: number
          restaurant_id: string
          sizes?: Json | null
          sort_order?: number
          special_extra?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_special?: boolean
          name?: string
          price?: number
          restaurant_id?: string
          sizes?: Json | null
          sort_order?: number
          special_extra?: number
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
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      pizzeria_beverages: {
        Row: {
          brand: string | null
          created_at: string | null
          id: string
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
          created_at?: string | null
          id?: string
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
          created_at?: string | null
          id?: string
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
            foreignKeyName: "pizzeria_beverages_pizzeria_id_fkey"
            columns: ["pizzeria_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          description: string | null
          flycontrol_api_key: string | null
          flycontrol_api_url: string | null
          flycontrol_base_url: string | null
          flycontrol_enabled: boolean
          flycontrol_register_url: string | null
          flycontrol_tenant_id: string | null
          hero_image_url: string | null
          hero_media_type: string
          hero_video_url: string | null
          hours: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          primary_color: string
          published: boolean
          secondary_color: string
          show_item_images: boolean | null
          slug: string
          tagline: string | null
          updated_at: string
          whatsapp_display: string | null
          whatsapp_enabled: boolean
          whatsapp_number: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          flycontrol_api_key?: string | null
          flycontrol_api_url?: string | null
          flycontrol_base_url?: string | null
          flycontrol_enabled?: boolean
          flycontrol_register_url?: string | null
          flycontrol_tenant_id?: string | null
          hero_image_url?: string | null
          hero_media_type?: string
          hero_video_url?: string | null
          hours?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          primary_color?: string
          published?: boolean
          secondary_color?: string
          show_item_images?: boolean | null
          slug: string
          tagline?: string | null
          updated_at?: string
          whatsapp_display?: string | null
          whatsapp_enabled?: boolean
          whatsapp_number?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          flycontrol_api_key?: string | null
          flycontrol_api_url?: string | null
          flycontrol_base_url?: string | null
          flycontrol_enabled?: boolean
          flycontrol_register_url?: string | null
          flycontrol_tenant_id?: string | null
          hero_image_url?: string | null
          hero_media_type?: string
          hero_video_url?: string | null
          hours?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          primary_color?: string
          published?: boolean
          secondary_color?: string
          show_item_images?: boolean | null
          slug?: string
          tagline?: string | null
          updated_at?: string
          whatsapp_display?: string | null
          whatsapp_enabled?: boolean
          whatsapp_number?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "owner"
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
    },
  },
} as const
