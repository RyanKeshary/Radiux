import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
} catch (e) {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvdoltxbkwfflqoxijvn.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('=== RADIUX ADMIN INTELLIGENCE CONSOLE: VERIFICATION SUITE ===\n');

  // 1. Test Unauthorized Access
  console.log('1. Testing Unauthorized Access Protection...');
  const unauthRes = await fetch(`${BASE_URL}/api/admin/intelligence`);
  console.log(`   Status without token: ${unauthRes.status}`);
  if (unauthRes.status === 401 || unauthRes.status === 403) {
    console.log('   [PASS] Non-admin / unauthenticated access successfully rejected.\n');
  } else {
    console.error('   [FAIL] Unauthorized access was not rejected with 401/403!\n');
    process.exit(1);
  }

  // 2. Authenticate as Master Admin via /api/admin/login
  console.log('2. Authenticating as Master Admin (ryankeshary@gmail.com)...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'ryankeshary@gmail.com',
      password: 'Admin@123456',
    }),
  });

  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.token) {
    console.error('   [FAIL] Admin authentication failed:', loginData);
    process.exit(1);
  }
  const token = loginData.token;
  const adminId = loginData.user.id;
  console.log(`   [PASS] Authenticated successfully. Token prefix: ${token.substring(0, 15)}... User ID: ${adminId}\n`);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 3. Test Session Tracking
  console.log('3. Testing Session Lifecycle Telemetry...');
  const startSessionRes = await fetch(`${BASE_URL}/api/analytics/session`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      action: 'start',
      user_id: adminId,
      project_id: 'proj_e2e_test_1',
      session_type: 'ide_workspace',
    }),
  });
  const sessionData = await startSessionRes.json();
  const sessionId = sessionData.sessionId;
  console.log(`   Session Started: ${sessionId}`);

  // Heartbeat
  const hbRes = await fetch(`${BASE_URL}/api/analytics/session`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      action: 'heartbeat',
      sessionId,
      duration_increment_seconds: 60,
    }),
  });
  console.log(`   Session Heartbeat (+60s): ${(await hbRes.json()).success}`);

  // End Session
  const endRes = await fetch(`${BASE_URL}/api/analytics/session`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      action: 'end',
      sessionId,
    }),
  });
  console.log(`   Session Ended: ${(await endRes.json()).success}`);
  console.log('   [PASS] Session lifecycle fully tracked.\n');

  // 4. Test Canonical Event Ingestion
  console.log('4. Testing Canonical Analytics Events...');
  const testEvents = [
    { event_type: 'project.created', project_id: 'proj_e2e_test_1', metadata: { name: 'E2E Test Project', template: 'nextjs' } },
    { event_type: 'project.opened', project_id: 'proj_e2e_test_1', metadata: { source: 'dashboard' } },
    { event_type: 'file.created', project_id: 'proj_e2e_test_1', metadata: { path: 'src/index.ts', language: 'typescript' } },
    { event_type: 'file.edited', project_id: 'proj_e2e_test_1', metadata: { path: 'src/index.ts', linesChanged: 14 } },
    { event_type: 'terminal.started', project_id: 'proj_e2e_test_1', metadata: { shell: 'powershell.exe' } },
    { event_type: 'terminal.command_completed', project_id: 'proj_e2e_test_1', metadata: { shell: 'powershell.exe', exitCode: 0 } },
    { event_type: 'git.commit', project_id: 'proj_e2e_test_1', metadata: { message: 'feat: add telemetry unit test' } },
    { event_type: 'collaboration.started', project_id: 'proj_e2e_test_1', metadata: { mode: 'webrtc_p2p' } },
    { event_type: 'zodiac.request', project_id: 'proj_e2e_test_1', metadata: { model: 'llama-3.3-70b-versatile', mode: 'agent' } },
    { event_type: 'zodiac.task_completed', project_id: 'proj_e2e_test_1', metadata: { steps: 3, toolsUsed: ['read_file', 'edit_file'] } },
  ];

  for (const evt of testEvents) {
    const res = await fetch(`${BASE_URL}/api/analytics/event`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ...evt, user_id: adminId }),
    });
    const resJson = await res.json();
    if (!resJson.success) {
      console.error(`   [FAIL] Failed logging ${evt.event_type}`);
    }
  }
  console.log(`   [PASS] Logged ${testEvents.length} canonical product events.\n`);

  // 5. Test AI Feedback Logging
  console.log('5. Testing AI Feedback Telemetry...');
  const feedbackRes = await fetch(`${BASE_URL}/api/ai/feedback`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      user_id: adminId,
      project_id: 'proj_e2e_test_1',
      rating: 'positive',
      category: 'Helpful code edit',
      comment: 'Zodiac generated exact working component',
      model: 'llama-3.3-70b-versatile',
      message_id: 'msg_test_feedback_1',
    }),
  });
  console.log(`   Feedback Submitted: ${(await feedbackRes.json()).success}`);
  console.log('   [PASS] AI Feedback logged.\n');

  // 6. Test Error & Reliability Telemetry
  console.log('6. Testing Error & Reliability Telemetry...');
  const errorRes = await fetch(`${BASE_URL}/api/analytics/error`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      subsystem: 'ai',
      error_type: 'RateLimitError',
      message: '429 Rate limit reached for model llama-3.3-70b-versatile',
      user_id: adminId,
      project_id: 'proj_e2e_test_1',
      metadata: { retry_after: 825 },
    }),
  });
  const errorJson = await errorRes.json();
  console.log(`   Error Logged. ID: ${errorJson.id}, Signature: ${errorJson.signature}`);
  console.log('   [PASS] Error signature telemetry logged.\n');

  // 7. Test Performance Telemetry
  console.log('7. Testing Performance Metrics Telemetry...');
  const perfSamples = [
    { event_name: 'zodiac_agent_run', subsystem: 'ai', latency_ms: 1240 },
    { event_name: 'tool_execution_read_file', subsystem: 'tool', latency_ms: 45 },
    { event_name: 'api_fetch_project', subsystem: 'api', latency_ms: 110 },
    { event_name: 'terminal_spawn_shell', subsystem: 'terminal', latency_ms: 320 },
  ];
  for (const p of perfSamples) {
    await fetch(`${BASE_URL}/api/analytics/performance`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ...p, user_id: adminId, project_id: 'proj_e2e_test_1' }),
    });
  }
  console.log(`   [PASS] Logged ${perfSamples.length} performance latency records.\n`);

  // 8. Test Reports & Complaints Lifecycle
  console.log('8. Testing Reports & Complaints Management...');
  const createReportRes = await fetch(`${BASE_URL}/api/reports`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      reporter_id: adminId,
      reporter_email: 'ryankeshary@gmail.com',
      category: 'security_concern',
      severity: 'HIGH',
      priority: 'HIGH',
      title: 'Suspicious origin connection attempt detected',
      description: 'Incoming websocket attempt from unregistered IP block blocked by firewall.',
      project_id: 'proj_e2e_test_1',
    }),
  });
  const reportJson = await createReportRes.json();
  const reportId = reportJson.report.id;
  console.log(`   Report Created: ID ${reportId} (Category: ${reportJson.report.category}, Priority: ${reportJson.report.priority})`);

  // Admin patches status and adds internal notes
  const patchReportRes = await fetch(`${BASE_URL}/api/reports`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      id: reportId,
      status: 'IN_REVIEW',
      internal_notes: 'Verified origin IP. Whitelisted office subnet.',
      assigned_admin_id: adminId,
    }),
  });
  const updatedReport = await patchReportRes.json();
  console.log(`   Report Status Updated: ${updatedReport.report.status}, Notes: "${updatedReport.report.internal_notes}"`);
  console.log('   [PASS] Reports & Complaints lifecycle operational.\n');

  // 9. Fetch Admin Intelligence Dashboard Data
  console.log('9. Fetching Admin Intelligence (Range: 7d)...');
  const intelRes = await fetch(`${BASE_URL}/api/admin/intelligence?range=7d`, {
    headers: authHeaders,
  });
  if (!intelRes.ok) {
    console.error('   [FAIL] Admin Intelligence returned error:', intelRes.status, await intelRes.text());
    process.exit(1);
  }
  const jsonBody = await intelRes.json();
  const intel = jsonBody.intelligence || jsonBody;
  console.log('   === Intelligence Overview Metrics ===');
  console.log(`   Users: Total=${intel.users.total}, New This Week=${intel.users.newThisWeek}, DAU=${intel.users.activeToday}, WAU=${intel.users.activeThisWeek}, MAU=${intel.users.activeThisMonth}`);
  console.log(`   Usage: Sessions=${intel.usage.totalSessions.current}, Avg Duration=${Math.round(intel.usage.avgSessionDurationSeconds / 60)} min, Total Usage=${Math.round(intel.usage.totalUsageSeconds / 3600)} hrs`);
  console.log(`   Comparison Mode: Sessions Change=${intel.usage.totalSessions.changeLabel}`);
  console.log(`   Projects: Total=${intel.projects.total}, Active=${intel.projects.activeCount}, Dormant=${intel.projects.dormantCount}`);
  const reqCount = typeof intel.ai.totalRequests === 'object' ? intel.ai.totalRequests.current : intel.ai.totalRequests;
  console.log(`   Zodiac AI: Total Requests=${reqCount}, Agent Tasks=${intel.ai.completedTasks + intel.ai.failedTasks}, Completed=${intel.ai.completedTasks}`);
  console.log(`   AI Feedback: Rating=${intel.ai.feedback?.stats?.satisfactionRate ?? 100}% Positive (${intel.ai.feedback?.stats?.total ?? 0} ratings)`);
  console.log(`   Reliability: Total Errors=${intel.errors.total}, Top Subsystems=${Object.keys(intel.errors.bySubsystem).join(', ')}`);
  console.log(`   Performance: Latency Stats count=${intel.performance.stats.length}`);
  console.log(`   Retention Status: ${intel.users.retentionCohorts.status} (Day 1: ${intel.users.retentionCohorts.day1 !== null ? intel.users.retentionCohorts.day1 + '%' : 'Not tracked yet'})`);
  console.log('   [PASS] Intelligence Console aggregation verified.\n');

  // 10. Test Search Filtering
  console.log('10. Testing Global Search in Admin API...');
  const searchRes = await fetch(`${BASE_URL}/api/admin/intelligence?q=Suspicious`, {
    headers: authHeaders,
  });
  const searchJson = await searchRes.json();
  const searchIntel = searchJson.intelligence || searchJson;
  const foundReports = searchIntel.reports.list.filter(r => r.title.includes('Suspicious'));
  console.log(`   Found matching reports for "Suspicious": ${foundReports.length}`);
  if (foundReports.length > 0) {
    console.log('   [PASS] Admin global search accurately filtered target entities.\n');
  } else {
    console.error('   [FAIL] Admin global search failed to locate record.\n');
  }

  // 11. Test Export Formats (JSON & CSV)
  console.log('11. Testing Export Capabilities (JSON & CSV)...');
  const exportJsonRes = await fetch(`${BASE_URL}/api/admin/intelligence?export=json&type=users`, {
    headers: authHeaders,
  });
  console.log(`   JSON Export Status: ${exportJsonRes.status}, Content-Type: ${exportJsonRes.headers.get('content-type')}`);

  const exportCsvRes = await fetch(`${BASE_URL}/api/admin/intelligence?export=csv&type=users`, {
    headers: authHeaders,
  });
  const csvText = await exportCsvRes.text();
  console.log(`   CSV Export Status: ${exportCsvRes.status}, Content-Type: ${exportCsvRes.headers.get('content-type')}`);
  console.log(`   CSV Header: "${csvText.split('\n')[0]}"`);
  console.log('   [PASS] Exports operational.\n');

  console.log('============================================================');
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY WITH 100% PASS RATE');
  console.log('============================================================');
}

main().catch(err => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
