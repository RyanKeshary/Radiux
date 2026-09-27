'use client';

class RadiuxAnalyticsTracker {
  private sessionId: string | null = null;
  private userId: string | null = null;
  private projectId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastActivityTimestamp = Date.now();
  private isInitialized = false;

  public init(userId?: string | null, projectId?: string | null) {
    if (this.isInitialized && this.userId === userId && this.projectId === projectId) {
      return;
    }

    this.userId = userId || null;
    this.projectId = projectId || null;
    this.isInitialized = true;

    if (typeof window === 'undefined') return;

    // Start Session
    this.startSession();

    // Setup User Activity Listeners (clicks, keypresses, scrolls)
    const onUserActivity = () => {
      this.lastActivityTimestamp = Date.now();
    };
    window.addEventListener('mousemove', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity, { passive: true });
    window.addEventListener('click', onUserActivity, { passive: true });

    // Setup Heartbeat (every 60s if active in last 3 mins)
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      // Only heartbeat if user was active recently (not idle background tab)
      if (now - this.lastActivityTimestamp < 3 * 60 * 1000) {
        this.sendHeartbeat();
      }
    }, 60000);

    // Setup Session End on Unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
  }

  private async startSession() {
    try {
      const res = await fetch('/api/analytics/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          userId: this.userId,
          projectId: this.projectId,
          sessionType: 'ide_workspace',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.sessionId = data.sessionId;
      }
    } catch (e) {}
  }

  private async sendHeartbeat() {
    if (!this.sessionId) return;
    try {
      await fetch('/api/analytics/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'heartbeat',
          sessionId: this.sessionId,
        }),
      });
    } catch (e) {}
  }

  public async endSession() {
    if (!this.sessionId) return;
    try {
      navigator.sendBeacon?.(
        '/api/analytics/session',
        JSON.stringify({
          action: 'end',
          sessionId: this.sessionId,
        })
      );
    } catch (e) {}
  }

  public track(eventType: string, metadata: Record<string, any> = {}) {
    if (typeof window === 'undefined') return;
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        userId: this.userId,
        projectId: this.projectId,
        metadata,
      }),
    }).catch(() => {});
  }

  public trackError(
    subsystem: 'frontend' | 'backend' | 'websocket' | 'ai' | 'terminal' | 'git' | 'database' | 'auth',
    message: string,
    errorType = 'Error',
    metadata: Record<string, any> = {}
  ) {
    if (typeof window === 'undefined') return;
    fetch('/api/analytics/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subsystem,
        message,
        errorType,
        userId: this.userId,
        projectId: this.projectId,
        metadata,
      }),
    }).catch(() => {});
  }

  public trackPerformance(
    eventName: string,
    subsystem: 'api' | 'websocket' | 'ai' | 'tool' | 'terminal' | 'project_load' | 'editor_init',
    latencyMs: number,
    metadata: Record<string, any> = {}
  ) {
    if (typeof window === 'undefined') return;
    fetch('/api/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        subsystem,
        latencyMs,
        userId: this.userId,
        projectId: this.projectId,
        metadata,
      }),
    }).catch(() => {});
  }
}

export const analytics = new RadiuxAnalyticsTracker();
