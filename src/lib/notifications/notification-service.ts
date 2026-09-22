import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { AppNotification, ActionState, NotificationCategory, NotificationType } from './types';

// In-memory deduplication cache: dedupKey -> timestamp
const dedupCache = new Map<string, number>();
const DEDUP_TTL_MS = 60 * 1000; // 1 minute window

function isDuplicate(dedupKey?: string): boolean {
  if (!dedupKey) return false;
  const now = Date.now();
  const existing = dedupCache.get(dedupKey);
  if (existing && now - existing < DEDUP_TTL_MS) {
    return true;
  }
  dedupCache.set(dedupKey, now);
  // Cleanup old keys
  if (dedupCache.size > 200) {
    dedupCache.forEach((time, key) => {
      if (now - time > DEDUP_TTL_MS) dedupCache.delete(key);
    });
  }
  return false;
}

// Local storage fallback for offline/development mode
const LOCAL_NOTIFICATIONS_KEY = 'radiux_notifications';

function getLocalNotifications(userId: string): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_NOTIFICATIONS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalNotifications(userId: string, notifications: AppNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LOCAL_NOTIFICATIONS_KEY}_${userId}`, JSON.stringify(notifications.slice(0, 100)));
  } catch (e) {}
}

export const NotificationService = {
  /**
   * Fetch persistent notifications for a user (ordered newest first)
   */
  async fetchNotifications(userId: string): Promise<AppNotification[]> {
    if (!userId || userId === 'guest') return [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data) {
          return data as AppNotification[];
        }
      } catch (err) {
        console.warn('[NotificationService] Supabase fetch failed, falling back to local store:', err);
      }
    }

    return getLocalNotifications(userId);
  },

  /**
   * Send a new notification to a recipient with idempotency deduplication
   */
  async sendNotification(
    payload: Omit<AppNotification, 'id' | 'created_at'>
  ): Promise<AppNotification | null> {
    const dedupKey = payload.metadata?.dedup_key;
    if (isDuplicate(dedupKey)) {
      console.log(`[NotificationService] Deduplicated notification: ${dedupKey}`);
      return null;
    }

    const newRecord: AppNotification = {
      ...payload,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif_${Date.now()}`,
      created_at: new Date().toISOString(),
      read_at: null,
      action_state: payload.action_state ?? (payload.type === 'action' ? 'pending' : null),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        // Double-check DB-level deduplication for actionable invitations
        if (dedupKey) {
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('recipient_id', payload.recipient_id)
            .eq('metadata->>dedup_key', dedupKey)
            .limit(1);

          if (existing && existing.length > 0) {
            console.log(`[NotificationService] DB deduplicated notification: ${dedupKey}`);
            return null;
          }
        }

        const { data, error } = await supabase
          .from('notifications')
          .insert({
            recipient_id: payload.recipient_id,
            actor_id: payload.actor_id || null,
            project_id: payload.project_id || null,
            type: payload.type,
            category: payload.category,
            title: payload.title,
            body: payload.body,
            metadata: payload.metadata || {},
            action_state: newRecord.action_state,
          })
          .select()
          .single();

        if (!error && data) {
          return data as AppNotification;
        }
      } catch (err) {
        console.warn('[NotificationService] Supabase insert failed, saving locally:', err);
      }
    }

    // Local fallback
    const local = getLocalNotifications(payload.recipient_id);
    local.unshift(newRecord);
    saveLocalNotifications(payload.recipient_id, local);
    return newRecord;
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notificationId)
          .eq('recipient_id', userId);

        if (!error) return true;
      } catch (err) {
        console.warn('[NotificationService] Supabase markAsRead failed:', err);
      }
    }

    const local = getLocalNotifications(userId);
    const item = local.find(n => n.id === notificationId);
    if (item) {
      item.read_at = new Date().toISOString();
      saveLocalNotifications(userId, local);
      return true;
    }
    return false;
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    if (!userId || userId === 'guest') return false;

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('recipient_id', userId)
          .is('read_at', null);

        if (!error) return true;
      } catch (err) {
        console.warn('[NotificationService] Supabase markAllAsRead failed:', err);
      }
    }

    const local = getLocalNotifications(userId);
    const now = new Date().toISOString();
    local.forEach(n => {
      if (!n.read_at) n.read_at = now;
    });
    saveLocalNotifications(userId, local);
    return true;
  },

  /**
   * Action handler: Accept or Decline an actionable notification (mutates real state)
   */
  async respondToAction(
    notification: AppNotification,
    action: 'accept' | 'decline'
  ): Promise<boolean> {
    const newState: ActionState = action === 'accept' ? 'accepted' : 'declined';
    const readAt = new Date().toISOString();

    // 1. Mutate underlying system state based on category
    if (notification.category === 'project_invitation' && notification.project_id) {
      if (action === 'accept') {
        const role = notification.metadata?.role || 'editor';
        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('project_members').upsert({
              project_id: notification.project_id,
              user_id: notification.recipient_id,
              role,
            });
          } catch (err) {
            console.error('[NotificationService] Failed to add member on accept:', err);
            return false;
          }
        }
      }
    }

    // 2. Update notification record
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({
            action_state: newState,
            read_at: readAt,
          })
          .eq('id', notification.id)
          .eq('recipient_id', notification.recipient_id);

        if (!error) return true;
      } catch (err) {
        console.warn('[NotificationService] Supabase respondToAction update failed:', err);
      }
    }

    // Local fallback update
    const local = getLocalNotifications(notification.recipient_id);
    const target = local.find(n => n.id === notification.id);
    if (target) {
      target.action_state = newState;
      target.read_at = readAt;
      saveLocalNotifications(notification.recipient_id, local);
      return true;
    }
    return true;
  },

  /**
   * Realtime subscription for instant event delivery without polling
   */
  subscribe(
    userId: string,
    onEvent: (notification: AppNotification) => void
  ): () => void {
    if (!userId || userId === 'guest' || !isSupabaseConfigured || !supabase) {
      return () => {};
    }

    const channel = supabase
      .channel(`realtime:notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onEvent(payload.new as AppNotification);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onEvent(payload.new as AppNotification);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  },
};
