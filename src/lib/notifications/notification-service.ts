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

// Supabase Realtime Broadcast Channel Singleton & Event Bus
let realtimeBroadcastChannel: any = null;
type NotificationListener = (notification: AppNotification) => void;
const broadcastListeners = new Set<{ userId: string; callback: NotificationListener }>();

function getRealtimeChannel() {
  if (realtimeBroadcastChannel) return realtimeBroadcastChannel;
  if (isSupabaseConfigured && supabase) {
    try {
      realtimeBroadcastChannel = supabase.channel('radiux_notifications_realtime');
      realtimeBroadcastChannel
        .on('broadcast', { event: 'notification' }, ({ payload }: any) => {
          if (!payload) return;
          broadcastListeners.forEach(({ userId, callback }) => {
            if (payload.recipient_id === userId) {
              try {
                callback(payload as AppNotification);
              } catch (e) {}
            }
          });
        })
        .on('broadcast', { event: 'notification_update' }, ({ payload }: any) => {
          if (!payload) return;
          broadcastListeners.forEach(({ userId, callback }) => {
            if (payload.recipient_id === userId || payload.actor_id === userId) {
              try {
                callback(payload as AppNotification);
              } catch (e) {}
            }
          });
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('[NotificationService] Connected to radiux_notifications_realtime broadcast channel');
          }
        });
    } catch (e) {
      console.warn('[NotificationService] Failed to initialize Realtime channel:', e);
    }
  }
  return realtimeBroadcastChannel;
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
      } catch (err) {}
    }

    return getLocalNotifications(userId);
  },

  /**
   * Send a new notification to a recipient with idempotency deduplication and instant broadcast
   */
  async sendNotification(
    payload: Omit<AppNotification, 'id' | 'created_at'>
  ): Promise<AppNotification | null> {
    const dedupKey = payload.metadata?.dedup_key;
    if (isDuplicate(dedupKey)) {
      console.log(`[NotificationService] Deduplicated notification: ${dedupKey}`);
      return null;
    }

    let createdRecord: AppNotification | null = null;

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
          createdRecord = data.notification;
        }
      }
    } catch (e) {}

    if (!createdRecord) {
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
            createdRecord = data as AppNotification;
          }
        } catch (err) {}
      }

      if (!createdRecord) {
        // 3. Local fallback
        const local = getLocalNotifications(payload.recipient_id);
        local.unshift(newRecord);
        saveLocalNotifications(payload.recipient_id, local);
        createdRecord = newRecord;
      }
    }

    // 4. Instant Realtime Delivery via Supabase Realtime Broadcast
    if (createdRecord) {
      const ch = getRealtimeChannel();
      if (ch) {
        try {
          ch.send({
            type: 'broadcast',
            event: 'notification',
            payload: createdRecord,
          });
        } catch (e) {}
      }
    }

    return createdRecord;
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
   * Action handler: Accept or Decline an actionable notification (mutates real state and sends instant response)
   */
  async respondToAction(
    notification: AppNotification,
    action: 'accept' | 'decline'
  ): Promise<boolean> {
    const newState: ActionState = action === 'accept' ? 'accepted' : 'declined';
    const readAt = new Date().toISOString();

    // 1. Call server API to handle mutation, membership grant, partner updates, and feedback notification
    try {
      const res = await fetch('/api/notifications/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification, action }),
      });
      if (res.ok) {
        // Broadcast local update
        const ch = getRealtimeChannel();
        if (ch) {
          try {
            ch.send({
              type: 'broadcast',
              event: 'notification_update',
              payload: { ...notification, action_state: newState, read_at: readAt },
            });
          } catch (e) {}
        }
        return true;
      }
    } catch (e) {
      console.warn('[NotificationService] Server respondToAction failed, attempting client fallback:', e);
    }

    // 2. Direct client fallback for project members
    if (action === 'accept' && notification.project_id && isSupabaseConfigured && supabase) {
      const isJoinRequest = notification.category === 'join_request' || notification.category === 'permission_request';
      const targetUserId = isJoinRequest
        ? (notification.actor_id || notification.metadata?.requesterId)
        : notification.recipient_id;

      if (targetUserId) {
        try {
          const res = await supabase.from('project_members').insert({
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

    // Direct client fallback for partner requests
    if (notification.category === 'partner_request' && notification.metadata?.partnerRequestId && isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('coding_partners')
          .update({ status: newState, updated_at: readAt })
          .eq('id', notification.metadata.partnerRequestId);
      } catch (err) {}
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

    // Broadcast update
    const ch = getRealtimeChannel();
    if (ch) {
      try {
        ch.send({
          type: 'broadcast',
          event: 'notification_update',
          payload: { ...notification, action_state: newState, read_at: readAt },
        });
      } catch (e) {}
    }

    return true;
  },

  /**
   * Realtime subscription for instant event delivery without delay
   */
  subscribe(
    userId: string,
    onEvent: (notification: AppNotification) => void
  ): () => void {
    if (!userId || userId === 'guest') {
      return () => {};
    }

    const knownState = new Map<string, string>();
    let isInitialLoad = true;

    // 1. Supabase Realtime Broadcast Listener (< 50ms instant cross-device delivery)
    const listenerEntry = {
      userId,
      callback: (payload: AppNotification) => {
        const stateKey = `${payload.action_state}_${payload.read_at}`;
        knownState.set(payload.id, stateKey);
        onEvent(payload);
      },
    };
    broadcastListeners.add(listenerEntry);
    getRealtimeChannel();

    // 2. High-frequency Polling Fallback (every 2.5s) to guarantee delivery even if WebSockets are offline
    const checkSync = async () => {
      try {
        const notifs = await NotificationService.fetchNotifications(userId);
        if (Array.isArray(notifs)) {
          for (const notif of notifs) {
            const stateKey = `${notif.action_state}_${notif.read_at}`;
            const prev = knownState.get(notif.id);
            if (!prev) {
              knownState.set(notif.id, stateKey);
              if (!isInitialLoad) {
                onEvent(notif);
              }
            } else if (prev !== stateKey) {
              knownState.set(notif.id, stateKey);
              onEvent(notif);
            }
          }
          isInitialLoad = false;
        }
      } catch (e) {}
    };

    checkSync();
    const interval = setInterval(checkSync, 2500);

    return () => {
      clearInterval(interval);
      broadcastListeners.delete(listenerEntry);
    };
  },
};
