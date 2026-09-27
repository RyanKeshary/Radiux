import { createClient } from '@supabase/supabase-js';
import { getRawAnalyticsState, UserSessionRecord } from './store';
import { getFeedbackStats, getAllFeedback } from '@/lib/ai/feedback-store';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type DateRangePreset = 'today' | '7d' | '30d' | '90d' | 'all';

export interface DateWindow {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}

export function parseDateWindow(range: DateRangePreset, customStart?: string, customEnd?: string): DateWindow {
  const now = new Date();
  let currentStart: Date;
  let currentEnd: Date = now;
  let previousStart: Date;
  let previousEnd: Date;

  if (range === 'today') {
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    previousStart = new Date(currentStart.getTime() - dayMs);
    previousEnd = new Date(currentStart.getTime() - 1);
  } else if (range === '7d') {
    const diff = 7 * 24 * 60 * 60 * 1000;
    currentStart = new Date(now.getTime() - diff);
    previousStart = new Date(currentStart.getTime() - diff);
    previousEnd = new Date(currentStart.getTime() - 1);
  } else if (range === '30d') {
    const diff = 30 * 24 * 60 * 60 * 1000;
    currentStart = new Date(now.getTime() - diff);
    previousStart = new Date(currentStart.getTime() - diff);
    previousEnd = new Date(currentStart.getTime() - 1);
  } else if (range === '90d') {
    const diff = 90 * 24 * 60 * 60 * 1000;
    currentStart = new Date(now.getTime() - diff);
    previousStart = new Date(currentStart.getTime() - diff);
    previousEnd = new Date(currentStart.getTime() - 1);
  } else {
    // all or custom
    if (customStart && customEnd) {
      currentStart = new Date(customStart);
      currentEnd = new Date(customEnd);
      const span = currentEnd.getTime() - currentStart.getTime();
      previousStart = new Date(currentStart.getTime() - span);
      previousEnd = new Date(currentStart.getTime() - 1);
    } else {
      currentStart = new Date(0);
      previousStart = new Date(0);
      previousEnd = new Date(0);
    }
  }

  return { currentStart, currentEnd, previousStart, previousEnd };
}

export interface MetricComparison {
  current: number;
  previous: number;
  diff: number;
  percentageChange: number | null;
  changeLabel: string;
}

export function computeComparison(current: number, previous: number): MetricComparison {
  const diff = current - previous;
  if (previous <= 0) {
    return {
      current,
      previous,
      diff,
      percentageChange: null,
      changeLabel: 'No comparable baseline',
    };
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  return {
    current,
    previous,
    diff,
    percentageChange: pct,
    changeLabel: `${pct >= 0 ? '+' : ''}${pct}% vs previous period`,
  };
}

export async function getFullAdminIntelligence(
  range: DateRangePreset = '7d',
  customStart?: string,
  customEnd?: string
) {
  const supabase = getSupabaseAdmin();
  const rawState = getRawAnalyticsState();
  const dateWindow = parseDateWindow(range, customStart, customEnd);

  // 1. Fetch real users from Supabase / Mock
  let allUsers: any[] = [];
  try {
    if (supabase) {
      const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (profiles && profiles.length > 0) {
        allUsers = profiles;
      }
    }
  } catch (e) {}

  // 2. Fetch real projects from Supabase / Mock
  let allProjects: any[] = [];
  try {
    if (supabase) {
      const { data: projects } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (projects && projects.length > 0) {
        allProjects = projects;
      }
    }
  } catch (e) {}

  // 3. Filter sessions by date window
  const sessionsInCurrent = rawState.sessions.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= dateWindow.currentStart.getTime() && t <= dateWindow.currentEnd.getTime();
  });
  const sessionsInPrevious = rawState.sessions.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= dateWindow.previousStart.getTime() && t <= dateWindow.previousEnd.getTime();
  });

  // 4. Filter events by date window
  const eventsInCurrent = rawState.events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return t >= dateWindow.currentStart.getTime() && t <= dateWindow.currentEnd.getTime();
  });
  const eventsInPrevious = rawState.events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return t >= dateWindow.previousStart.getTime() && t <= dateWindow.previousEnd.getTime();
  });

  // ==========================================
  // USERS METRICS (Genuine, un-fabricated)
  // ==========================================
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
  const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const monthStart = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  const totalUsersCount = allUsers.length;
  const newUsersToday = allUsers.filter((u) => new Date(u.created_at).getTime() >= todayStart).length;
  const newUsersThisWeek = allUsers.filter((u) => new Date(u.created_at).getTime() >= weekStart).length;
  const newUsersThisMonth = allUsers.filter((u) => new Date(u.created_at).getTime() >= monthStart).length;

  // Active users: Distinct user IDs with genuine session or activity event
  const activeUserIdsToday = new Set(
    rawState.sessions
      .filter((s) => s.user_id && new Date(s.last_heartbeat).getTime() >= todayStart)
      .map((s) => s.user_id!)
  );
  rawState.events
    .filter((e) => e.user_id && new Date(e.timestamp).getTime() >= todayStart)
    .forEach((e) => activeUserIdsToday.add(e.user_id!));

  const activeUserIdsWeek = new Set(
    rawState.sessions
      .filter((s) => s.user_id && new Date(s.last_heartbeat).getTime() >= weekStart)
      .map((s) => s.user_id!)
  );
  rawState.events
    .filter((e) => e.user_id && new Date(e.timestamp).getTime() >= weekStart)
    .forEach((e) => activeUserIdsWeek.add(e.user_id!));

  const activeUserIdsMonth = new Set(
    rawState.sessions
      .filter((s) => s.user_id && new Date(s.last_heartbeat).getTime() >= monthStart)
      .map((s) => s.user_id!)
  );
  rawState.events
    .filter((e) => e.user_id && new Date(e.timestamp).getTime() >= monthStart)
    .forEach((e) => activeUserIdsMonth.add(e.user_id!));

  const dau = activeUserIdsToday.size;
  const wau = activeUserIdsWeek.size;
  const mau = activeUserIdsMonth.size;

  // Returning users: active in current period who had earlier activity before currentStart
  const returningUsers = Array.from(activeUserIdsWeek).filter((uid) => {
    return rawState.sessions.some(
      (s) => s.user_id === uid && new Date(s.started_at).getTime() < weekStart
    );
  }).length;

  // Dormant users: registered > 14 days ago with 0 activity in last 14 days
  const fourteenDaysAgo = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const dormantUsers = allUsers.filter((u) => {
    const created = new Date(u.created_at).getTime();
    if (created >= fourteenDaysAgo) return false;
    const hasRecentActivity = rawState.sessions.some(
      (s) => s.user_id === u.id && new Date(s.last_heartbeat).getTime() >= fourteenDaysAgo
    );
    return !hasRecentActivity;
  }).length;

  // Retention: Day 1, Day 7, Day 30 calculation based on real session logs
  const retentionCohorts = computeRealRetention(allUsers, rawState.sessions);

  // ==========================================
  // SESSIONS & USAGE METRICS
  // ==========================================
  const totalSessionsCount = rawState.sessions.length;
  const sessionsToday = rawState.sessions.filter((s) => new Date(s.started_at).getTime() >= todayStart).length;

  const totalUsageSeconds = rawState.sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
  const avgSessionDurationSeconds =
    totalSessionsCount > 0 ? Math.round(totalUsageSeconds / totalSessionsCount) : 0;

  const avgUsagePerActiveUserSeconds =
    activeUserIdsMonth.size > 0 ? Math.round(totalUsageSeconds / activeUserIdsMonth.size) : 0;

  // Project & File actions from canonical events
  const filesCreated = rawState.events.filter((e) => e.event_type === 'file.created').length;
  const filesEdited = rawState.events.filter((e) => e.event_type === 'file.edited').length;
  const terminalSessions = rawState.events.filter((e) => e.event_type === 'terminal.started').length;
  const gitOperations = rawState.events.filter((e) => e.event_type.startsWith('git.')).length;
  const collaborationSessions = rawState.events.filter((e) => e.event_type === 'collaboration.started').length;

  // Usage by Hour of Day (0-23)
  const usageByHour: Record<number, number> = {};
  for (let i = 0; i < 24; i++) usageByHour[i] = 0;
  for (const s of rawState.sessions) {
    const hour = new Date(s.started_at).getHours();
    usageByHour[hour] = (usageByHour[hour] || 0) + 1;
  }

  // ==========================================
  // ZODIAC AI METRICS
  // ==========================================
  let aiUsageRows: any[] = [];
  try {
    if (supabase) {
      const { data: usage } = await supabase.from('ai_usage').select('*').order('created_at', { ascending: false }).limit(200);
      if (usage) aiUsageRows = usage;
    }
  } catch (e) {}

  const aiEvents = rawState.events.filter((e) => e.event_type.startsWith('zodiac.'));
  const totalAIRequests = Math.max(aiUsageRows.length, aiEvents.length);
  const completedTasks = aiUsageRows.filter((r) => r.status === 'success').length;
  const failedTasks = aiUsageRows.filter((r) => r.status === 'error').length;

  let totalLatency = 0;
  const modelBreakdown: Record<string, { requests: number; tokens: number; errors: number }> = {};
  for (const row of aiUsageRows) {
    totalLatency += row.latency_ms || 0;
    const model = row.model || 'openai/gpt-oss-20b';
    if (!modelBreakdown[model]) {
      modelBreakdown[model] = { requests: 0, tokens: 0, errors: 0 };
    }
    modelBreakdown[model].requests++;
    modelBreakdown[model].tokens += (row.prompt_tokens || 0) + (row.completion_tokens || 0);
    if (row.status === 'error') modelBreakdown[model].errors++;
  }

  const avgAILatencyMs = totalAIRequests > 0 ? Math.round(totalLatency / Math.max(1, aiUsageRows.length)) : 0;

  // Tool Usage Breakdown
  const toolBreakdown: Record<string, { calls: number; success: number; failure: number }> = {
    read_file: { calls: 0, success: 0, failure: 0 },
    search_files: { calls: 0, success: 0, failure: 0 },
    edit_file: { calls: 0, success: 0, failure: 0 },
    write_file: { calls: 0, success: 0, failure: 0 },
    terminal: { calls: 0, success: 0, failure: 0 },
    git: { calls: 0, success: 0, failure: 0 },
    diagnostics: { calls: 0, success: 0, failure: 0 },
    other: { calls: 0, success: 0, failure: 0 },
  };

  for (const ev of rawState.events) {
    if (ev.event_type === 'zodiac.tool_call') {
      const toolName = ev.metadata?.tool || 'other';
      const key = toolBreakdown[toolName] ? toolName : 'other';
      toolBreakdown[key].calls++;
      if (ev.metadata?.error) toolBreakdown[key].failure++;
      else toolBreakdown[key].success++;
    }
  }

  // AI Feedback
  const aiFeedbackStats = await getFeedbackStats();
  const aiFeedbackList = getAllFeedback(100);

  // Category breakdown for negative feedback
  const feedbackCategories: Record<string, number> = {
    'Incorrect': 0,
    "Didn't understand request": 0,
    'Bad code': 0,
    'Too verbose': 0,
    "Didn't solve problem": 0,
    'Tool failure': 0,
    'Slow': 0,
    'Other': 0,
  };

  for (const item of aiFeedbackList) {
    if (item.type === 'dislike') {
      const cat = (item as any).category || 'Other';
      feedbackCategories[cat] = (feedbackCategories[cat] || 0) + 1;
    }
  }

  // ==========================================
  // REPORTS & COMPLAINTS
  // ==========================================
  const reports = rawState.reports;
  const openReports = reports.filter((r) => r.status === 'OPEN').length;
  const inReviewReports = reports.filter((r) => r.status === 'IN_REVIEW').length;
  const resolvedReports = reports.filter((r) => r.status === 'RESOLVED').length;
  const closedReports = reports.filter((r) => r.status === 'CLOSED').length;
  const securityReports = reports.filter((r) => r.category === 'security_concern');

  // ==========================================
  // ERRORS & RELIABILITY
  // ==========================================
  const errors = rawState.errors;
  const errorsBySubsystem: Record<string, number> = {
    frontend: 0,
    backend: 0,
    websocket: 0,
    ai: 0,
    terminal: 0,
    git: 0,
    database: 0,
    auth: 0,
  };
  for (const err of errors) {
    errorsBySubsystem[err.subsystem] = (errorsBySubsystem[err.subsystem] || 0) + err.occurrence_count;
  }

  // ==========================================
  // PERFORMANCE TELEMETRY
  // ==========================================
  const performanceLogs = rawState.performance;
  const perfBySubsystem: Record<string, number[]> = {
    api: [],
    websocket: [],
    ai: [],
    tool: [],
    terminal: [],
    project_load: [],
    editor_init: [],
  };
  for (const p of performanceLogs) {
    if (perfBySubsystem[p.subsystem]) {
      perfBySubsystem[p.subsystem].push(p.latency_ms);
    }
  }

  const performanceStats: Record<string, { avg: number; p50: number; p95: number; samples: number }> = {};
  for (const [sub, latencies] of Object.entries(perfBySubsystem)) {
    if (latencies.length === 0) {
      performanceStats[sub] = { avg: 0, p50: 0, p95: 0, samples: 0 };
    } else {
      latencies.sort((a, b) => a - b);
      const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)] || p50;
      performanceStats[sub] = { avg, p50, p95, samples: latencies.length };
    }
  }

  // ==========================================
  // FEATURE CONVERSION FUNNEL
  // ==========================================
  const totalTrackedUsers = Math.max(1, allUsers.length);
  const usersWithProject = new Set(rawState.events.filter((e) => e.event_type === 'project.created' && e.user_id).map((e) => e.user_id!)).size;
  const usersWithEdit = new Set(rawState.events.filter((e) => e.event_type === 'file.edited' && e.user_id).map((e) => e.user_id!)).size;
  const usersWithTerminal = new Set(rawState.events.filter((e) => e.event_type === 'terminal.started' && e.user_id).map((e) => e.user_id!)).size;
  const usersWithZodiac = new Set(rawState.events.filter((e) => e.event_type === 'zodiac.request' && e.user_id).map((e) => e.user_id!)).size;
  const usersWithCollab = new Set(rawState.events.filter((e) => e.event_type === 'collaboration.started' && e.user_id).map((e) => e.user_id!)).size;

  const funnel = [
    { stage: '1. Registered Users', count: totalTrackedUsers, percent: 100 },
    { stage: '2. Created Project', count: usersWithProject, percent: Math.round((usersWithProject / totalTrackedUsers) * 100) },
    { stage: '3. Edited Code', count: usersWithEdit, percent: Math.round((usersWithEdit / totalTrackedUsers) * 100) },
    { stage: '4. Used Terminal', count: usersWithTerminal, percent: Math.round((usersWithTerminal / totalTrackedUsers) * 100) },
    { stage: '5. Invoked Zodiac 1.0', count: usersWithZodiac, percent: Math.round((usersWithZodiac / totalTrackedUsers) * 100) },
    { stage: '6. Collaborated', count: usersWithCollab, percent: Math.round((usersWithCollab / totalTrackedUsers) * 100) },
  ];

  return {
    range,
    dateWindow: {
      currentStart: dateWindow.currentStart.toISOString(),
      currentEnd: dateWindow.currentEnd.toISOString(),
      previousStart: dateWindow.previousStart.toISOString(),
      previousEnd: dateWindow.previousEnd.toISOString(),
    },
    users: {
      total: totalUsersCount,
      newToday: newUsersToday,
      newThisWeek: newUsersThisWeek,
      newThisMonth: newUsersThisMonth,
      activeToday: dau,
      activeThisWeek: wau,
      activeThisMonth: mau,
      returningUsers,
      dormantUsers,
      retentionCohorts,
      list: allUsers,
    },
    usage: {
      totalSessions: computeComparison(sessionsInCurrent.length, sessionsInPrevious.length),
      sessionsToday,
      avgSessionDurationSeconds,
      totalUsageSeconds,
      avgUsagePerActiveUserSeconds,
      filesCreated,
      filesEdited,
      terminalSessions,
      gitOperations,
      collaborationSessions,
      usageByHour,
      recentSessions: rawState.sessions.slice(0, 100),
    },
    projects: {
      total: allProjects.length,
      list: allProjects,
      activeCount: allProjects.filter((p) => {
        const last = new Date(p.updated_at || p.created_at).getTime();
        return last >= weekStart;
      }).length,
      dormantCount: allProjects.filter((p) => {
        const last = new Date(p.updated_at || p.created_at).getTime();
        return last < fourteenDaysAgo;
      }).length,
    },
    ai: {
      totalRequests: totalAIRequests,
      completedTasks,
      failedTasks,
      avgLatencyMs: avgAILatencyMs,
      toolBreakdown,
      modelBreakdown,
      feedback: {
        stats: aiFeedbackStats,
        categories: feedbackCategories,
        recent: aiFeedbackList,
      },
    },
    reports: {
      total: reports.length,
      open: openReports,
      inReview: inReviewReports,
      resolved: resolvedReports,
      closed: closedReports,
      security: securityReports,
      list: reports,
    },
    errors: {
      total: errors.reduce((acc, e) => acc + e.occurrence_count, 0),
      bySubsystem: errorsBySubsystem,
      list: errors,
    },
    performance: {
      stats: performanceStats,
      recent: performanceLogs.slice(0, 50),
    },
    announcements: rawState.announcements,
    funnel,
  };
}

// Compute real cohort retention if sufficient data exists
function computeRealRetention(users: any[], sessions: UserSessionRecord[]) {
  if (users.length === 0 || sessions.length === 0) {
    return {
      status: 'insufficient_data',
      message: 'Not enough historical activity to establish cohort baseline.',
      day1: null,
      day7: null,
      day30: null,
    };
  }

  let day1Success = 0;
  let day1Eligible = 0;
  let day7Success = 0;
  let day7Eligible = 0;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const u of users) {
    const signupTime = new Date(u.created_at).getTime();
    const userSessions = sessions.filter((s) => s.user_id === u.id);

    // Day 1
    if (now - signupTime >= dayMs * 2) {
      day1Eligible++;
      const hasD1 = userSessions.some((s) => {
        const t = new Date(s.started_at).getTime();
        return t >= signupTime + dayMs && t < signupTime + dayMs * 2;
      });
      if (hasD1) day1Success++;
    }

    // Day 7
    if (now - signupTime >= dayMs * 8) {
      day7Eligible++;
      const hasD7 = userSessions.some((s) => {
        const t = new Date(s.started_at).getTime();
        return t >= signupTime + dayMs * 7 && t < signupTime + dayMs * 8;
      });
      if (hasD7) day7Success++;
    }
  }

  return {
    status: 'calculated',
    day1: day1Eligible > 0 ? Math.round((day1Success / day1Eligible) * 100) : null,
    day7: day7Eligible > 0 ? Math.round((day7Success / day7Eligible) * 100) : null,
    day30: null, // Display "Not tracked yet" if insufficient 30-day cohort samples
    message: 'Calculated from genuine user return sessions.',
  };
}
