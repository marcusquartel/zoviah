/**
 * Types for the Zoviah schema (Phase 0 + Phase 1).
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

export type OrganizationStatus = "active" | "inactive" | "suspended";
export type OrganizationRole = "owner" | "admin" | "analyst";

export type PlanCode =
  | "founding"
  | "starter"
  | "pro"
  | "agency"
  | "enterprise";
export type OrgInviteStatus = "pending" | "accepted" | "expired" | "revoked";

// --- Phase 6B: support + product feedback -----------------------------------
export type HelpArticleStatus = "draft" | "published" | "archived";
export type SupportConversationStatus = "open" | "resolved" | "escalated";
export type SupportMessageRole = "user" | "assistant" | "system_event";
export type SupportTicketType =
  | "question"
  | "account"
  | "bug"
  | "feature_request"
  | "other";
export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";
export type SupportTicketPriority = "low" | "normal" | "high" | "critical";
export type FeatureRequestFrequency =
  | "rarely"
  | "sometimes"
  | "often"
  | "daily";
export type FeatureRequestImportance =
  | "nice_to_have"
  | "important"
  | "essential";
export type FeatureRequestStatus =
  | "submitted"
  | "under_review"
  | "planned"
  | "in_progress"
  | "released"
  | "declined";
export type RoadmapItemStatus =
  | "under_consideration"
  | "planned"
  | "in_progress"
  | "released";
export type ChangelogStatus = "draft" | "published";

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
  | "tiktok"
  | "br_state"
  | "br_city";

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
  | "awaiting_address"
  | "completed"
  | "archived";

export type AddressRequestType = "shipping_address";
export type AddressRequestStatus =
  | "pending"
  | "completed"
  | "expired"
  | "revoked";

export type ShipmentStatus =
  | "draft"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

/** Frozen copy of a creator_addresses row at the moment a shipment was built. */
export interface AddressSnapshot {
  recipient_name: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
}

export type AnalysisRunStatus = "processing" | "completed" | "failed";
export type ApplicationAnalysisStatus =
  | "not_analyzed"
  | "processing"
  | "completed"
  | "failed";
export type AnalysisTier = "A" | "B" | "C" | "D";
export type AnalysisConfidence = "low" | "medium" | "high";

export type MetricSource =
  | "declared"
  | "admin_manual"
  | "creator_provided"
  | "import"
  | "api";

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
          /** Tenant host label: `<subdomain>.zoviah.app`. Distinct from slug. */
          subdomain: string | null;
          status: OrganizationStatus;
        } & Timestamps;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          subdomain?: string | null;
          status?: OrganizationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          subdomain?: string | null;
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
      platform_admins: {
        Row: { user_id: string; created_by: string | null; created_at: string };
        Insert: { user_id: string; created_by?: string | null };
        Update: { created_by?: string | null };
        Relationships: [];
      };
      organization_subscriptions: {
        Row: {
          organization_id: string;
          plan_code: PlanCode;
          started_at: string;
          expires_at: string | null;
          notes: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { organization_id: string; plan_code?: PlanCode };
        Update: {
          plan_code?: PlanCode;
          expires_at?: string | null;
          notes?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_invites: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: OrganizationRole;
          token_hash: string;
          status: OrgInviteStatus;
          expires_at: string;
          invited_by: string | null;
          accepted_at: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: OrganizationRole;
          token_hash: string;
          status: OrgInviteStatus;
          expires_at: string;
        };
        Update: {
          status?: OrgInviteStatus;
          accepted_at?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_audit_events: {
        Row: {
          id: string;
          actor_user_id: string | null;
          organization_id: string | null;
          event_type: string;
          metadata: Record<string, Json>;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          organization_id?: string | null;
          event_type: string;
          metadata?: Record<string, Json>;
        };
        Update: { metadata?: Record<string, Json> };
        Relationships: [];
      };
      help_articles: {
        Row: {
          id: string;
          category: string;
          title: string;
          slug: string;
          summary: string | null;
          content: string;
          keywords: string[];
          status: HelpArticleStatus;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          title: string;
          slug: string;
          summary?: string | null;
          content: string;
          keywords?: string[];
          status?: HelpArticleStatus;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          category?: string;
          title?: string;
          slug?: string;
          summary?: string | null;
          content?: string;
          keywords?: string[];
          status?: HelpArticleStatus;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      support_conversations: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          status: SupportConversationStatus;
          current_route: string | null;
          module: string | null;
          ai_resolved: boolean;
          created_at: string;
          updated_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          status?: SupportConversationStatus;
          current_route?: string | null;
          module?: string | null;
        };
        Update: {
          status?: SupportConversationStatus;
          ai_resolved?: boolean;
          closed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "support_conversations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      support_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: SupportMessageRole;
          content: string;
          article_refs: string[];
          model: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          latency_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: SupportMessageRole;
          content: string;
          article_refs?: string[];
          model?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          latency_ms?: number | null;
        };
        Update: { content?: string };
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "support_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      support_tickets: {
        Row: {
          id: string;
          organization_id: string;
          conversation_id: string | null;
          user_id: string;
          type: SupportTicketType;
          status: SupportTicketStatus;
          priority: SupportTicketPriority;
          subject: string;
          description: string;
          current_route: string | null;
          module: string | null;
          classification: Record<string, Json>;
          assigned_to: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          conversation_id?: string | null;
          user_id: string;
          type?: SupportTicketType;
          status?: SupportTicketStatus;
          priority?: SupportTicketPriority;
          subject: string;
          description: string;
          current_route?: string | null;
          module?: string | null;
          classification?: Record<string, Json>;
        };
        Update: {
          status?: SupportTicketStatus;
          priority?: SupportTicketPriority;
          assigned_to?: string | null;
          admin_notes?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_requests: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          title: string;
          problem: string;
          use_case: string | null;
          frequency: FeatureRequestFrequency;
          importance: FeatureRequestImportance;
          status: FeatureRequestStatus;
          canonical_request_id: string | null;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by?: string | null;
          title: string;
          problem: string;
          use_case?: string | null;
          frequency?: FeatureRequestFrequency;
          importance?: FeatureRequestImportance;
          status?: FeatureRequestStatus;
          canonical_request_id?: string | null;
        };
        Update: {
          status?: FeatureRequestStatus;
          canonical_request_id?: string | null;
          admin_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "feature_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_request_votes: {
        Row: {
          id: string;
          request_id: string;
          organization_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          organization_id: string;
          user_id: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "feature_request_votes_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "feature_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_items: {
        Row: {
          id: string;
          title: string;
          summary: string | null;
          status: RoadmapItemStatus;
          sort_order: number;
          feature_request_id: string | null;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          summary?: string | null;
          status?: RoadmapItemStatus;
          sort_order?: number;
          feature_request_id?: string | null;
          published?: boolean;
        };
        Update: {
          title?: string;
          summary?: string | null;
          status?: RoadmapItemStatus;
          sort_order?: number;
          feature_request_id?: string | null;
          published?: boolean;
        };
        Relationships: [];
      };
      changelog_entries: {
        Row: {
          id: string;
          title: string;
          summary: string | null;
          content: string;
          status: ChangelogStatus;
          published_at: string | null;
          related_roadmap_item_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          summary?: string | null;
          content: string;
          status?: ChangelogStatus;
          published_at?: string | null;
          related_roadmap_item_id?: string | null;
          created_by?: string | null;
        };
        Update: {
          title?: string;
          summary?: string | null;
          content?: string;
          status?: ChangelogStatus;
          published_at?: string | null;
          related_roadmap_item_id?: string | null;
        };
        Relationships: [];
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
          current_analysis_id: string | null;
          current_score: number | null;
          current_tier: AnalysisTier | null;
          analysis_status: ApplicationAnalysisStatus;
          analysis_confidence: AnalysisConfidence | null;
          analysis_coverage: number | null;
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
      creator_analyses: {
        Row: {
          id: string;
          organization_id: string;
          creator_id: string;
          application_id: string;
          status: AnalysisRunStatus;
          provider: string;
          model: string | null;
          prompt_version: string;
          scoring_version: string;
          score: number | null;
          tier: AnalysisTier | null;
          confidence: AnalysisConfidence | null;
          evidence_coverage: number | null;
          subscores: Record<string, Json>;
          summary: string | null;
          strengths: string[] | null;
          attention_points: string[] | null;
          suggested_tags: string[] | null;
          input_snapshot: Record<string, Json> | null;
          raw_result: Record<string, Json> | null;
          input_tokens: number | null;
          output_tokens: number | null;
          latency_ms: number | null;
          error_code: string | null;
          error_message: string | null;
          used_snapshot_ids: string[];
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          creator_id: string;
          application_id: string;
          status?: AnalysisRunStatus;
          provider: string;
          model?: string | null;
          prompt_version: string;
          scoring_version: string;
        };
        Update: {
          status?: AnalysisRunStatus;
        };
        Relationships: [
          {
            foreignKeyName: "creator_analyses_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "creator_analyses_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      social_metric_snapshots: {
        Row: {
          id: string;
          organization_id: string;
          creator_id: string;
          social_profile_id: string;
          source: MetricSource;
          observed_at: string;
          period_days: number | null;
          followers: number | null;
          average_views: number | null;
          median_views: number | null;
          views_sample: number[] | null;
          average_likes: number | null;
          average_comments: number | null;
          average_shares: number | null;
          average_saves: number | null;
          reach: number | null;
          interactions: number | null;
          posts_count: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          creator_id: string;
          social_profile_id: string;
          source: MetricSource;
          observed_at?: string;
        };
        Update: {
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "social_metric_snapshots_social_profile_id_fkey";
            columns: ["social_profile_id"];
            isOneToOne: false;
            referencedRelation: "creator_social_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      application_requests: {
        Row: {
          id: string;
          organization_id: string;
          application_id: string;
          creator_id: string;
          request_type: AddressRequestType;
          status: AddressRequestStatus;
          token_hash: string;
          expires_at: string;
          completed_at: string | null;
          revoked_at: string | null;
          consent_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          application_id: string;
          creator_id: string;
          request_type: AddressRequestType;
          status: AddressRequestStatus;
          token_hash: string;
          expires_at: string;
        };
        Update: {
          status?: AddressRequestStatus;
          completed_at?: string | null;
          revoked_at?: string | null;
          consent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "application_requests_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_addresses: {
        Row: {
          id: string;
          organization_id: string;
          creator_id: string;
          recipient_name: string;
          postal_code: string;
          street: string;
          number: string;
          complement: string | null;
          neighborhood: string;
          city: string;
          state: string;
          country: string;
          source_request_id: string;
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          creator_id: string;
          recipient_name: string;
          postal_code: string;
          street: string;
          number: string;
          complement?: string | null;
          neighborhood: string;
          city: string;
          state: string;
          country?: string;
          source_request_id: string;
          is_current?: boolean;
        };
        Update: {
          is_current?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "creator_addresses_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      shipments: {
        Row: {
          id: string;
          organization_id: string;
          creator_id: string;
          application_id: string;
          source_address_id: string;
          address_snapshot: AddressSnapshot;
          status: ShipmentStatus;
          carrier: string | null;
          tracking_code: string | null;
          tracking_url: string | null;
          internal_notes: string | null;
          shipped_at: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          creator_id: string;
          application_id: string;
          source_address_id: string;
          address_snapshot: AddressSnapshot;
          status: ShipmentStatus;
        };
        Update: {
          status?: ShipmentStatus;
          carrier?: string | null;
          tracking_code?: string | null;
          tracking_url?: string | null;
          internal_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shipments_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shipments_creator_id_fkey";
            columns: ["creator_id"];
            isOneToOne: false;
            referencedRelation: "creators";
            referencedColumns: ["id"];
          },
        ];
      };
      shipment_items: {
        Row: {
          id: string;
          shipment_id: string;
          organization_id: string;
          item_name: string;
          sku: string | null;
          quantity: number;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          shipment_id: string;
          organization_id: string;
          item_name: string;
          sku?: string | null;
          quantity: number;
          position: number;
        };
        Update: {
          item_name?: string;
          sku?: string | null;
          quantity?: number;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "shipment_items_shipment_id_fkey";
            columns: ["shipment_id"];
            isOneToOne: false;
            referencedRelation: "shipments";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      latest_metric_snapshots: {
        Row: Database["public"]["Tables"]["social_metric_snapshots"]["Row"];
        Relationships: [];
      };
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
          current_score: number | null;
          current_tier: AnalysisTier | null;
          analysis_status: ApplicationAnalysisStatus;
          analysis_confidence: AnalysisConfidence | null;
          analysis_coverage: number | null;
        };
        Relationships: [];
      };
      shipment_list_items: {
        Row: {
          id: string;
          organization_id: string;
          creator_id: string;
          application_id: string;
          status: ShipmentStatus;
          carrier: string | null;
          tracking_code: string | null;
          tracking_url: string | null;
          created_at: string;
          shipped_at: string | null;
          delivered_at: string | null;
          program_id: string;
          program_name: string;
          creator_name: string;
          creator_email: string | null;
          item_count: number;
          total_quantity: number;
          first_item_name: string | null;
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
      start_creator_analysis: {
        Args: {
          p_application_id: string;
          p_provider: string;
          p_model: string;
          p_prompt_version: string;
          p_scoring_version: string;
        };
        Returns: Json;
      };
      complete_creator_analysis: {
        Args: { p_analysis_id: string; p_result: Json };
        Returns: Json;
      };
      fail_creator_analysis: {
        Args: {
          p_analysis_id: string;
          p_error_code: string;
          p_error_message: string;
        };
        Returns: Json;
      };
      analysis_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      create_metric_snapshot: {
        Args: { p_social_profile_id: string; p_payload: Json };
        Returns: Json;
      };
      update_metric_snapshot: {
        Args: { p_snapshot_id: string; p_payload: Json };
        Returns: Json;
      };
      evidence_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      create_address_request: {
        Args: { p_application_id: string; p_token_hash: string };
        Returns: Json;
      };
      regenerate_address_request: {
        Args: { p_application_id: string; p_token_hash: string };
        Returns: Json;
      };
      revoke_address_request: {
        Args: { p_application_id: string };
        Returns: Json;
      };
      get_public_address_request: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      complete_address_request: {
        Args: { p_token_hash: string; p_payload: Json };
        Returns: Json;
      };
      is_valid_shipment_transition: {
        Args: { p_from: string; p_to: string };
        Returns: boolean;
      };
      shipment_counts: {
        Args: { p_program_id?: string | null };
        Returns: Json;
      };
      create_shipment: {
        Args: {
          p_application_id: string;
          p_items: Json;
          p_internal_notes?: string | null;
        };
        Returns: Json;
      };
      update_shipment_items: {
        Args: { p_shipment_id: string; p_items: Json };
        Returns: Json;
      };
      update_shipment_tracking: {
        Args: {
          p_shipment_id: string;
          p_carrier: string | null;
          p_tracking_code: string | null;
          p_tracking_url: string | null;
          p_internal_notes: string | null;
        };
        Returns: Json;
      };
      transition_shipment_status: {
        Args: { p_shipment_id: string; p_to_status: string };
        Returns: Json;
      };
      refresh_shipment_address: {
        Args: { p_shipment_id: string };
        Returns: Json;
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      admin_create_organization: {
        Args: {
          p_name: string;
          p_slug: string;
          p_owner_email: string;
          p_plan_code: string;
          p_status: string;
          p_owner_token_hash: string;
          p_subdomain?: string | null;
        };
        Returns: Json;
      };
      admin_set_organization_subdomain: {
        Args: { p_organization_id: string; p_subdomain: string | null };
        Returns: Json;
      };
      admin_list_organizations: {
        Args: { p_search?: string | null; p_limit?: number; p_offset?: number };
        Returns: Json;
      };
      admin_get_organization: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      admin_set_organization_status: {
        Args: { p_organization_id: string; p_status: string };
        Returns: Json;
      };
      admin_set_organization_plan: {
        Args: {
          p_organization_id: string;
          p_plan_code: string;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      admin_list_platform_audit: {
        Args: { p_limit?: number; p_offset?: number };
        Returns: Json;
      };
      create_org_invite: {
        Args: {
          p_organization_id: string;
          p_email: string;
          p_role: string;
          p_token_hash: string;
        };
        Returns: Json;
      };
      revoke_org_invite: {
        Args: { p_invite_id: string };
        Returns: Json;
      };
      get_public_org_invite: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      accept_org_invite: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      remove_org_member: {
        Args: { p_organization_id: string; p_user_id: string };
        Returns: Json;
      };
      set_org_member_role: {
        Args: {
          p_organization_id: string;
          p_user_id: string;
          p_role: string;
        };
        Returns: Json;
      };
      list_org_members: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      search_help_articles: {
        Args: { p_query: string; p_limit?: number };
        Returns: Json;
      };
      support_start_conversation: {
        Args: { p_organization_id: string; p_route: string; p_module: string };
        Returns: Json;
      };
      support_append_message: {
        Args: {
          p_conversation_id: string;
          p_user_content: string;
          p_assistant_content: string;
          p_article_refs: string[];
          p_model: string | null;
          p_input_tokens: number | null;
          p_output_tokens: number | null;
          p_latency_ms: number | null;
        };
        Returns: Json;
      };
      support_record_failure: {
        Args: { p_conversation_id: string; p_user_content: string };
        Returns: Json;
      };
      support_feedback: {
        Args: { p_conversation_id: string; p_resolved: boolean };
        Returns: Json;
      };
      support_escalate: {
        Args: {
          p_conversation_id: string;
          p_type: string;
          p_subject: string;
          p_description: string;
          p_classification?: Json;
        };
        Returns: Json;
      };
      admin_support_overview: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_list_support_tickets: {
        Args: {
          p_status?: string | null;
          p_priority?: string | null;
          p_type?: string | null;
          p_organization_id?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      admin_get_support_ticket: {
        Args: { p_ticket_id: string };
        Returns: Json;
      };
      admin_update_support_ticket: {
        Args: {
          p_ticket_id: string;
          p_status?: string | null;
          p_priority?: string | null;
          p_assign_self?: boolean | null;
          p_admin_notes?: string | null;
        };
        Returns: Json;
      };
      admin_list_help_articles: {
        Args: { p_status?: string | null };
        Returns: Json;
      };
      admin_upsert_help_article: {
        Args: {
          p_id: string | null;
          p_category: string;
          p_title: string;
          p_slug: string;
          p_summary: string | null;
          p_content: string;
          p_keywords: string[];
          p_status: string;
        };
        Returns: Json;
      };
      list_feature_requests: {
        Args: { p_organization_id: string; p_status?: string | null };
        Returns: Json;
      };
      submit_feature_request: {
        Args: {
          p_organization_id: string;
          p_title: string;
          p_problem: string;
          p_use_case: string | null;
          p_frequency: string;
          p_importance: string;
        };
        Returns: Json;
      };
      vote_feature_request: {
        Args: {
          p_organization_id: string;
          p_request_id: string;
          p_vote: boolean;
        };
        Returns: Json;
      };
      get_roadmap: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_changelog: {
        Args: { p_limit?: number };
        Returns: Json;
      };
      admin_list_feature_requests: {
        Args: { p_status?: string | null };
        Returns: Json;
      };
      admin_update_feature_request: {
        Args: {
          p_request_id: string;
          p_status?: string | null;
          p_canonical_request_id?: string | null;
          p_admin_note?: string | null;
          p_clear_canonical?: boolean;
        };
        Returns: Json;
      };
      admin_upsert_roadmap_item: {
        Args: {
          p_id: string | null;
          p_title: string;
          p_summary: string | null;
          p_status: string;
          p_sort_order: number;
          p_feature_request_id: string | null;
          p_published: boolean;
        };
        Returns: Json;
      };
      admin_list_roadmap_items: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_upsert_changelog_entry: {
        Args: {
          p_id: string | null;
          p_title: string;
          p_summary: string | null;
          p_content: string;
          p_status: string;
          p_related_roadmap_item_id: string | null;
        };
        Returns: Json;
      };
      admin_list_changelog_entries: {
        Args: Record<string, never>;
        Returns: Json;
      };
      prepare_invite_signup: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      rate_limit_public_submission: {
        Args: { p_ip_hash: string; p_max?: number; p_window_secs?: number };
        Returns: Json;
      };
      admin_set_organization_branding: {
        Args: {
          p_organization_id: string;
          p_logo_url: string | null;
          p_favicon_url: string | null;
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
export type CreatorAnalysis =
  Database["public"]["Tables"]["creator_analyses"]["Row"];
export type SocialMetricSnapshot =
  Database["public"]["Tables"]["social_metric_snapshots"]["Row"];
export type ApplicationRequest =
  Database["public"]["Tables"]["application_requests"]["Row"];
export type CreatorAddress =
  Database["public"]["Tables"]["creator_addresses"]["Row"];
export type Shipment = Database["public"]["Tables"]["shipments"]["Row"];
export type ShipmentItem =
  Database["public"]["Tables"]["shipment_items"]["Row"];
export type ApplicationListItem =
  Database["public"]["Views"]["application_list_items"]["Row"];
export type ShipmentListItem =
  Database["public"]["Views"]["shipment_list_items"]["Row"];
export type OrganizationSubscription =
  Database["public"]["Tables"]["organization_subscriptions"]["Row"];
export type OrganizationInvite =
  Database["public"]["Tables"]["organization_invites"]["Row"];
export type PlatformAuditEvent =
  Database["public"]["Tables"]["platform_audit_events"]["Row"];
export type HelpArticle = Database["public"]["Tables"]["help_articles"]["Row"];
export type SupportConversation =
  Database["public"]["Tables"]["support_conversations"]["Row"];
export type SupportMessage =
  Database["public"]["Tables"]["support_messages"]["Row"];
export type SupportTicket =
  Database["public"]["Tables"]["support_tickets"]["Row"];
export type FeatureRequest =
  Database["public"]["Tables"]["feature_requests"]["Row"];
export type FeatureRequestVote =
  Database["public"]["Tables"]["feature_request_votes"]["Row"];
export type RoadmapItem =
  Database["public"]["Tables"]["roadmap_items"]["Row"];
export type ChangelogEntry =
  Database["public"]["Tables"]["changelog_entries"]["Row"];
