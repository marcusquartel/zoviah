/**
 * Types for the Creator Hub schema (Phase 0 + Phase 1).
 *
 * Hand-written, mirroring the shape `supabase gen types typescript` emits
 * (Tables/Views/Functions/Enums/CompositeTypes + per-table Relationships), so
 * it can be swapped for generated output once the CLI is wired up:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrganizationStatus = "active" | "inactive";
export type OrganizationRole = "owner" | "admin" | "analyst";

export type ProgramStatus = "draft" | "active" | "paused" | "archived";

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "url"
  | "date"
  | "single_select"
  | "multi_select"
  | "checkbox"
  | "instagram"
  | "tiktok";

export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "twitch"
  | "kwai"
  | "x"
  | "facebook"
  | "other";

export type ApplicationStatus =
  | "new"
  | "awaiting_review"
  | "information_requested"
  | "approved"
  | "archived";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldConfiguration {
  /** Which structured column this field feeds, if any. */
  mapping?: FieldMapping;
}

export type FieldMapping =
  | "full_name"
  | "preferred_name"
  | "birth_date"
  | "email"
  | "phone"
  | "city"
  | "state"
  | "postal_code"
  | "instagram"
  | "instagram_followers"
  | "tiktok"
  | "tiktok_followers";

type Timestamps = { created_at: string; updated_at: string };

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: OrganizationStatus;
        } & Timestamps;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status?: OrganizationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          status?: OrganizationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: OrganizationRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_settings: {
        Row: {
          organization_id: string;
          logo_url: string | null;
          favicon_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
        } & Timestamps;
        Insert: {
          organization_id: string;
          logo_url?: string | null;
          favicon_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          logo_url?: string | null;
          favicon_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      programs: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          description: string | null;
          status: ProgramStatus;
          public_title: string | null;
          public_description: string | null;
          success_message: string | null;
          form_version: number;
          archived_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug: string;
          description?: string | null;
          status?: ProgramStatus;
          public_title?: string | null;
          public_description?: string | null;
          success_message?: string | null;
          form_version?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          status?: ProgramStatus;
          public_title?: string | null;
          public_description?: string | null;
          success_message?: string | null;
          form_version?: number;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      form_fields: {
        Row: {
          id: string;
          organization_id: string;
          program_id: string;
          field_key: string;
          label: string;
          field_type: FieldType;
          placeholder: string | null;
          help_text: string | null;
          required: boolean;
          options: FieldOption[] | null;
          configuration: FieldConfiguration;
          position: number;
          active: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          organization_id: string;
          program_id: string;
          field_key: string;
          label: string;
          field_type: FieldType;
          placeholder?: string | null;
          help_text?: string | null;
          required?: boolean;
          options?: FieldOption[] | null;
          configuration?: FieldConfiguration;
          position?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          field_key?: string;
          label?: string;
          field_type?: FieldType;
          placeholder?: string | null;
          help_text?: string | null;
          required?: boolean;
          options?: FieldOption[] | null;
          configuration?: FieldConfiguration;
          position?: number;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "form_fields_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      creators: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          preferred_name: string | null;
          birth_date: string | null;
          email: string | null;
          phone_e164: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          archived_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          organization_id: string;
          full_name: string;
          preferred_name?: string | null;
          birth_date?: string | null;
          email?: string | null;
          phone_e164?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          preferred_name?: string | null;
          birth_date?: string | null;
          email?: string | null;
          phone_e164?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creators_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_social_profiles: {
        Row: {
          id: string;
          organization_id: string;
          creator_id: string;
          platform: SocialPlatform;
          handle: string;
          handle_normalized: string;
          profile_url: string | null;
          followers_declared: number | null;
          average_views_declared: number | null;
        } & Timestamps;
        Insert: {
          id?: string;
          organization_id: string;
          creator_id: string;
          platform: SocialPlatform;
          handle: string;
          handle_normalized: string;
          profile_url?: string | null;
          followers_declared?: number | null;
          average_views_declared?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          platform?: SocialPlatform;
          handle?: string;
          handle_normalized?: string;
          profile_url?: string | null;
          followers_declared?: number | null;
          average_views_declared?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creator_social_profiles_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          id: string;
          organization_id: string;
          program_id: string;
          creator_id: string;
          status: ApplicationStatus;
          form_version: number;
          answers: Record<string, Json>;
          field_snapshot: Array<{
            field_key: string;
            label: string;
            field_type: FieldType;
          }>;
          possible_duplicate: boolean;
          source: string | null;
          referrer: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_term: string | null;
          submitted_at: string;
          approved_at: string | null;
          archived_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          organization_id: string;
          program_id: string;
          creator_id: string;
          status?: ApplicationStatus;
          form_version: number;
          answers?: Record<string, Json>;
          field_snapshot?: Array<{
            field_key: string;
            label: string;
            field_type: FieldType;
          }>;
          possible_duplicate?: boolean;
          source?: string | null;
          referrer?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
          submitted_at?: string;
          approved_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: ApplicationStatus;
          possible_duplicate?: boolean;
          approved_at?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_events: {
        Row: {
          id: string;
          organization_id: string;
          creator_id: string;
          application_id: string | null;
          type: string;
          actor_user_id: string | null;
          data: Record<string, Json>;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          creator_id: string;
          application_id?: string | null;
          type: string;
          actor_user_id?: string | null;
          data?: Record<string, Json>;
          created_at?: string;
        };
        Update: {
          data?: Record<string, Json>;
        };
        Relationships: [
          {
            foreignKeyName: "creator_events_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      application_list_items: {
        Row: {
          id: string;
          organization_id: string;
          program_id: string;
          creator_id: string;
          status: ApplicationStatus;
          possible_duplicate: boolean;
          submitted_at: string;
          created_at: string;
          program_name: string;
          creator_name: string;
          creator_preferred_name: string | null;
          creator_email: string | null;
          creator_phone: string | null;
          creator_city: string | null;
          creator_state: string | null;
          instagram_handle: string | null;
          instagram_handle_normalized: string | null;
          instagram_url: string | null;
          instagram_followers: number | null;
          tiktok_handle: string | null;
          tiktok_handle_normalized: string | null;
          tiktok_url: string | null;
          tiktok_followers: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_organization_member: {
        Args: { org_id: string };
        Returns: boolean;
      };
      is_organization_admin: {
        Args: { org_id: string };
        Returns: boolean;
      };
      get_public_program: {
        Args: { p_org_slug: string; p_program_slug: string };
        Returns: Json;
      };
      submit_application: {
        Args: {
          p_org_slug: string;
          p_program_slug: string;
          p_form_version: number;
          p_answers: Json;
          p_field_snapshot: Json;
          p_creator: Json;
          p_socials: Json;
          p_utm: Json;
          p_referrer: string | null;
          p_source: string | null;
        };
        Returns: Json;
      };
      crm_counts: {
        Args: { p_program_id?: string | null };
        Returns: Json;
      };
      is_valid_application_transition: {
        Args: { p_from: string; p_to: string };
        Returns: boolean;
      };
      transition_application_status: {
        Args: {
          p_application_id: string;
          p_to_status: string;
          p_note?: string | null;
        };
        Returns: Json;
      };
      add_creator_note: {
        Args: {
          p_creator_id: string;
          p_text: string;
          p_application_id?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationMember =
  Database["public"]["Tables"]["organization_members"]["Row"];
export type OrganizationSettings =
  Database["public"]["Tables"]["organization_settings"]["Row"];
export type Program = Database["public"]["Tables"]["programs"]["Row"];
export type FormField = Database["public"]["Tables"]["form_fields"]["Row"];
export type Creator = Database["public"]["Tables"]["creators"]["Row"];
export type CreatorSocialProfile =
  Database["public"]["Tables"]["creator_social_profiles"]["Row"];
export type Application = Database["public"]["Tables"]["applications"]["Row"];
export type CreatorEvent =
  Database["public"]["Tables"]["creator_events"]["Row"];
export type ApplicationListItem =
  Database["public"]["Views"]["application_list_items"]["Row"];
