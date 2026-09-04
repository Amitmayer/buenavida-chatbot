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
  created_at: string;
};

export type Team = {
  id: string;
  slug: string;
  name: string;
  areas: string[];
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
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "completed_at"> & {
          id?: string;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Task>;
        Relationships: [
          Rel<"tasks_team_id_fkey", "team_id", "teams">,
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
        Insert: Omit<ChatMessage, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ChatMessage>;
        Relationships: [
          Rel<"chat_messages_chat_id_fkey", "chat_id", "chats">,
          Rel<"chat_messages_sender_id_fkey", "sender_id", "profiles">,
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_team_member: { Args: { t: string }; Returns: boolean };
      has_role: { Args: { r: UserRole }; Returns: boolean };
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
