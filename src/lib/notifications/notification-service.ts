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

    // 1. Try unified Server API first (cross-device persistent)
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          return data.notifications;
        }
      }
    } catch (e) {
      // Server fetch failed, try direct Supabase or local storage
    }

    // 2. Direct Supabase fallback
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
        console.warn('[NotificationService] Supabase direct fetch failed:', err);
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

    // 1. Try server API first for guaranteed cross-device delivery
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.notification) {
          return data.notification;
        }
      }
    } catch (e) {}

    const newRecord: AppNotification = {
      ...payload,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif_${Date.now()}`,
      created_at: new Date().toISOString(),
      read_at: null,
      action_state: payload.action_state ?? (payload.type === 'action' ? 'pending' : null),
    };

    // 2. Direct Supabase fallback
    if (isSupabaseConfigured && supabase) {
      try {
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
        console.warn('[NotificationService] Supabase direct insert failed, saving locally:', err);
      }
    }

    // 3. Local fallback
    const local = getLocalNotifications(payload.recipient_id);
    local.unshift(newRecord);
    saveLocalNotifications(payload.recipient_id, local);
    return newRecord;
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, userId }),
      }).catch(() => {});
    } catch (e) {}

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notificationId)
          .eq('recipient_id', userId);
      } catch (err) {}
    }

    const local = getLocalNotifications(userId);
    const item = local.find(n => n.id === notificationId);
    if (item) {
      item.read_at = new Date().toISOString();
      saveLocalNotifications(userId, local);
    }
    return true;
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    if (!userId || userId === 'guest') return false;

    try {
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, markAll: true }),
      }).catch(() => {});
    } catch (e) {}

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('recipient_id', userId)
          .is('read_at', null);
      } catch (err) {}
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
    // 1. Call server API to handle mutation, membership grant, and feedback notification
    try {
      const res = await fetch('/api/notifications/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification, action }),
      });
      if (res.ok) {
        return true;
      }
    } catch (e) {
      console.warn('[NotificationService] Server respondToAction failed, attempting client fallback:', e);
    }

    // 2. Direct client fallback
    const newState: ActionState = action === 'accept' ? 'accepted' : 'declined';
    const readAt = new Date().toISOString();

    if (action === 'accept' && notification.project_id && isSupabaseConfigured && supabase) {
      const isJoinRequest = notification.category === 'join_request' || notification.category === 'permission_request';
      const targetUserId = isJoinRequest
        ? (notification.actor_id || notification.metadata?.requesterId)
        : notification.recipient_id;

      if (targetUserId) {
        try {
          let res = await supabase.from('project_members').insert({
            project_id: notification.project_id,
            user_id: targetUserId,
            role: 'member',
          });
          if (res.error && res.error.code !== '23505') {
            console.error('[NotificationService] Client direct add member failed:', res.error);
          }
        } catch (err) {
          console.error('[NotificationService] Failed to add member on accept:', err);
        }
      }
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('notifications')
          .update({
            action_state: newState,
            read_at: readAt,
          })
          .eq('id', notification.id);
      } catch (err) {}
    }

    const local = getLocalNotifications(notification.recipient_id);
    const target = local.find(n => n.id === notification.id);
    if (target) {
      target.action_state = newState;
      target.read_at = readAt;
      saveLocalNotifications(notification.recipient_id, local);
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
    if (!userId || userId === 'guest') {
      return () => {};
    }

    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        channel = supabase
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
      } catch (e) {}
    }

    // Periodic check for new notifications (every 8 seconds) to support polling fallback
    const interval = setInterval(async () => {
      try {
        const notifs = await NotificationService.fetchNotifications(userId);
        if (notifs && notifs.length > 0) {
          // If first notification was created in last 10 seconds
          const newest = notifs[0];
          const diffMs = Date.now() - new Date(newest.created_at).getTime();
          if (diffMs < 12000) {
            onEvent(newest);
          }
        }
      } catch (e) {}
    }, 8000);

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  },
};
