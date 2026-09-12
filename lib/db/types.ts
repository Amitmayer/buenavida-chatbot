export type UserRole = "owner" | "admin" | "member" | "guest";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskVisibility = "team" | "restricted";
export type ToolCallStatus = "pending" | "ok" | "error";
export type MessageRole = "user" | "assistant";
export type ChatKind = "dm" | "team" | "group" | "channel";
export type ChannelSection = "strategic" | "ops" | "company";

export type Chat = {
  id: string;
  kind: ChatKind;
  team_id: string | null;
  title: string | null;
  dm_key: string | null;
  slug: string | null;
  section: ChannelSection | null;
  purpose: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
};

export type ChatMember = {
  chat_id: string;
  user_id: string;
  last_read_at: string;
  joined_at: string;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  via_assistant: boolean;
  task_id: string | null;
  attachment_id: string | null;
};

export type EmailAccount = {
  id: string;
  user_id: string;
  provider: string;
  email: string;
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_expires_at: string | null;
  scope: string | null;
  created_at: string;
  updated_at: string;
};

export type Email = {
  id: string;
  account_id: string;
  user_id: string;
  gmail_id: string;
  thread_id: string;
  rfc_message_id: string | null;
  from_address: string;
  to_addresses: string[];
  subject: string;
  snippet: string;
  body_text: string;
  body_html: string | null;
  occurred_at: string;
  unread: boolean;
  inbound: boolean;
  archived: boolean;
  is_draft: boolean;
  summary: string | null;
  draft_reply: string | null;
  task_id: string | null;
  created_at: string;
};


export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Profile = {
  id: string;
  full_name: string;
  title: string | null;
  role: UserRole;
  reports_to: string | null;
  default_team: string | null;
  full_access: boolean;
  created_at: string;
};

export type Team = {
  id: string;
  slug: string;
  name: string;
  areas: string[];
  is_private?: boolean;
};

export type Project = {
  id: string;
  team_id: string;
  name: string;
  created_by: string;
  created_at: string;
  archived_at: string | null;
};

export type TeamMember = {
  team_id: string;
  user_id: string;
  is_lead: boolean;
};

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  team_id: string;
  area: string | null;
  project_id: string | null;
  owner_id: string;
  assignee_id: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  visibility: TaskVisibility;
  created_by: string;
  created_at: string;
  completed_at: string | null;
};

export type TaskEvent = {
  id: string;
  task_id: string;
  actor_id: string;
  kind: string;
  diff: Json;
  source: string;
  created_at: string;
};

export type Attachment = {
  id: string;
  task_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  client_message_id: string | null;
  created_at: string;
};

export type ToolCall = {
  id: string;
  message_id: string;
  name: string;
  input: Json;
  status: ToolCallStatus;
  result: Json | null;
  error_code: string | null;
  task_id: string | null;
  created_at: string;
};

export type BrandFile = {
  id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  folder: string;
  uploaded_by: string;
  created_at: string;
};

export type ChannelFile = {
  id: string;
  chat_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
};

type Rel<
  Name extends string,
  Col extends string,
  To extends string,
  One extends boolean = false,
> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: One;
  referencedRelation: To;
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "full_name">;
        Update: Partial<Profile>;
        Relationships: [
          Rel<"profiles_reports_to_fkey", "reports_to", "profiles">,
          Rel<"profiles_default_team_fkey", "default_team", "teams">,
        ];
      };
      teams: {
        Row: Team;
        Insert: Partial<Team> & Pick<Team, "slug" | "name">;
        Update: Partial<Team>;
        Relationships: [];
      };
      team_members: {
        Row: TeamMember;
        Insert: TeamMember;
        Update: Partial<TeamMember>;
        Relationships: [
          Rel<"team_members_team_id_fkey", "team_id", "teams">,
          Rel<"team_members_user_id_fkey", "user_id", "profiles">,
        ];
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at" | "archived_at"> & {
          id?: string;
          created_at?: string;
          archived_at?: string | null;
        };
        Update: Partial<Project>;
        Relationships: [
          Rel<"projects_team_id_fkey", "team_id", "teams">,
          Rel<"projects_created_by_fkey", "created_by", "profiles">,
        ];
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "completed_at" | "project_id"> & {
          id?: string;
          created_at?: string;
          completed_at?: string | null;
          project_id?: string | null;
        };
        Update: Partial<Task>;
        Relationships: [
          Rel<"tasks_team_id_fkey", "team_id", "teams">,
          Rel<"tasks_project_id_fkey", "project_id", "projects">,
          Rel<"tasks_owner_id_fkey", "owner_id", "profiles">,
          Rel<"tasks_assignee_id_fkey", "assignee_id", "profiles">,
          Rel<"tasks_created_by_fkey", "created_by", "profiles">,
        ];
      };
      task_events: {
        Row: TaskEvent;
        Insert: Omit<TaskEvent, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<TaskEvent>;
        Relationships: [
          Rel<"task_events_task_id_fkey", "task_id", "tasks">,
          Rel<"task_events_actor_id_fkey", "actor_id", "profiles">,
        ];
      };
      attachments: {
        Row: Attachment;
        Insert: Omit<Attachment, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Attachment>;
        Relationships: [
          Rel<"attachments_task_id_fkey", "task_id", "tasks">,
          Rel<"attachments_uploaded_by_fkey", "uploaded_by", "profiles">,
        ];
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Conversation>;
        Relationships: [Rel<"conversations_user_id_fkey", "user_id", "profiles">];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at" | "client_message_id"> & {
          id?: string;
          created_at?: string;
          client_message_id?: string | null;
        };
        Update: Partial<Message>;
        Relationships: [Rel<"messages_conversation_id_fkey", "conversation_id", "conversations">];
      };
      tool_calls: {
        Row: ToolCall;
        Insert: Omit<ToolCall, "id" | "created_at" | "result" | "error_code" | "task_id"> & {
          id?: string;
          created_at?: string;
          result?: Json | null;
          error_code?: string | null;
          task_id?: string | null;
        };
        Update: Partial<ToolCall>;
        Relationships: [
          Rel<"tool_calls_message_id_fkey", "message_id", "messages">,
          Rel<"tool_calls_task_id_fkey", "task_id", "tasks">,
        ];
      };
      digest_runs: {
        Row: {
          id: string;
          user_id: string;
          run_date: string;
          status: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          run_date: string;
          status: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          status: string;
          detail: string | null;
        }>;
        Relationships: [Rel<"digest_runs_user_id_fkey", "user_id", "profiles">];
      };
      brand_files: {
        Row: BrandFile;
        Insert: Omit<BrandFile, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<BrandFile>;
        Relationships: [Rel<"brand_files_uploaded_by_fkey", "uploaded_by", "profiles">];
      };
      channel_files: {
        Row: ChannelFile;
        Insert: Omit<ChannelFile, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ChannelFile>;
        Relationships: [
          Rel<"channel_files_chat_id_fkey", "chat_id", "chats">,
          Rel<"channel_files_uploaded_by_fkey", "uploaded_by", "profiles">,
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: Partial<{
          endpoint: string;
          p256dh: string;
          auth: string;
        }>;
        Relationships: [Rel<"push_subscriptions_user_id_fkey", "user_id", "profiles">];
      };
      chats: {
        Row: Chat;
        Insert: Partial<Chat> & Pick<Chat, "kind">;
        Update: Partial<Chat>;
        Relationships: [
          Rel<"chats_team_id_fkey", "team_id", "teams">,
          Rel<"chats_created_by_fkey", "created_by", "profiles">,
        ];
      };
      chat_members: {
        Row: ChatMember;
        Insert: Pick<ChatMember, "chat_id" | "user_id"> & Partial<ChatMember>;
        Update: Partial<Pick<ChatMember, "last_read_at">>;
        Relationships: [
          Rel<"chat_members_chat_id_fkey", "chat_id", "chats">,
          Rel<"chat_members_user_id_fkey", "user_id", "profiles">,
        ];
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Omit<
          ChatMessage,
          | "id"
          | "created_at"
          | "via_assistant"
          | "task_id"
          | "edited_at"
          | "deleted_at"
          | "attachment_id"
        > & {
          id?: string;
          created_at?: string;
          via_assistant?: boolean;
          task_id?: string | null;
          edited_at?: string | null;
          deleted_at?: string | null;
          attachment_id?: string | null;
        };
        Update: Partial<ChatMessage>;
        Relationships: [
          Rel<"chat_messages_chat_id_fkey", "chat_id", "chats">,
          Rel<"chat_messages_sender_id_fkey", "sender_id", "profiles">,
          Rel<"chat_messages_task_id_fkey", "task_id", "tasks">,
          Rel<"chat_messages_attachment_id_fkey", "attachment_id", "channel_files">,
        ];
      };
      email_accounts: {
        Row: EmailAccount;
        Insert: Omit<EmailAccount, "id" | "created_at" | "updated_at" | "access_token_enc" | "access_expires_at" | "scope"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          access_token_enc?: string | null;
          access_expires_at?: string | null;
          scope?: string | null;
          provider?: string;
        };
        Update: Partial<EmailAccount>;
        Relationships: [Rel<"email_accounts_user_id_fkey", "user_id", "profiles">];
      };
      emails: {
        Row: Email;
        Insert: Omit<
          Email,
          | "id"
          | "created_at"
          | "summary"
          | "draft_reply"
          | "task_id"
          | "rfc_message_id"
          | "archived"
          | "is_draft"
          | "body_html"
        > & {
          id?: string;
          created_at?: string;
          summary?: string | null;
          draft_reply?: string | null;
          task_id?: string | null;
          rfc_message_id?: string | null;
          archived?: boolean;
          is_draft?: boolean;
          body_html?: string | null;
        };
        Update: Partial<Email>;
        Relationships: [
          Rel<"emails_account_id_fkey", "account_id", "email_accounts">,
          Rel<"emails_user_id_fkey", "user_id", "profiles">,
          Rel<"emails_task_id_fkey", "task_id", "tasks">,
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_team_member: { Args: { t: string }; Returns: boolean };
      has_role: { Args: { r: UserRole }; Returns: boolean };
      has_full_access: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_owner_or_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      create_task_with_event: {
        Args: {
          p_title: string;
          p_notes: string | null;
          p_team_id: string;
          p_area: string | null;
          p_owner_id: string;
          p_assignee_id: string | null;
          p_due_date: string | null;
          p_priority: TaskPriority;
          p_visibility: TaskVisibility;
          p_source: string;
          p_project_id?: string | null;
        };
        Returns: Task;
      };
      update_task_with_event: {
        Args: {
          p_task_id: string;
          p_patch: Json;
          p_source: string;
        };
        Returns: Task;
      };
      is_chat_member: { Args: { c: string }; Returns: boolean };
      open_or_get_dm: { Args: { p_other: string }; Returns: string };
      profile_directory: { Args: { p_id: string }; Returns: Json };
      create_group_chat: {
        Args: { p_title: string; p_member_ids: string[] };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      task_priority: TaskPriority;
      task_status: TaskStatus;
      task_visibility: TaskVisibility;
      chat_kind: ChatKind;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
