export type NotificationType = 'action' | 'information' | 'collaboration';

export type NotificationCategory = 
  | 'project_invitation' 
  | 'join_request'
  | 'partner_request'
  | 'partner_response'
  | 'direct_message'
  | 'chat_message'
  | 'review_request' 
  | 'permission_request' 
  | 'deployment' 
  | 'system' 
  | 'collaborator_joined'
  | 'role_updated';

export type ActionState = 'pending' | 'accepted' | 'declined' | 'dismissed';

export interface AppNotification {
  id: string;
  recipient_id: string;
  actor_id?: string;
  actor_name?: string;
  project_id?: string;
  project_name?: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  metadata?: {
    dedup_key?: string;
    role?: 'editor' | 'visitor';
    projectId?: string;
    projectName?: string;
    senderEmail?: string;
    [key: string]: any;
  };
  action_state?: ActionState | null;
  read_at?: string | null;
  created_at: string;
}
