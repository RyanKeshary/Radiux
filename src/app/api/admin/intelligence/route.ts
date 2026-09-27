import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin/admin-auth';
import { getFullAdminIntelligence, DateRangePreset } from '@/lib/analytics/admin-engine';

export async function GET(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const range = (searchParams.get('range') || '7d') as DateRangePreset;
  const start = searchParams.get('start') || undefined;
  const end = searchParams.get('end') || undefined;
  const search = (searchParams.get('search') || '').trim().toLowerCase();
  const exportFormat = searchParams.get('export'); // 'csv' or 'json'

  try {
    const intelligence = await getFullAdminIntelligence(range, start, end);

    // Global Search Filter if search query is provided
    if (search) {
      intelligence.users.list = intelligence.users.list.filter(
        (u) =>
          u.email?.toLowerCase().includes(search) ||
          u.full_name?.toLowerCase().includes(search) ||
          u.username?.toLowerCase().includes(search)
      );

      intelligence.projects.list = intelligence.projects.list.filter(
        (p) =>
          p.name?.toLowerCase().includes(search) ||
          p.description?.toLowerCase().includes(search)
      );

      intelligence.reports.list = intelligence.reports.list.filter(
        (r) =>
          r.title?.toLowerCase().includes(search) ||
          r.description?.toLowerCase().includes(search) ||
          r.reporter_email?.toLowerCase().includes(search)
      );
    }

    // CSV / JSON Export Handler
    if (exportFormat === 'json') {
      return new NextResponse(JSON.stringify(intelligence, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="radiux-intelligence-${range}-${Date.now()}.json"`,
        },
      });
    }

    if (exportFormat === 'csv') {
      let csv = 'Category,Metric,Value\n';
      csv += `Users,Total Registered,${intelligence.users.total}\n`;
      csv += `Users,Active Today (DAU),${intelligence.users.activeToday}\n`;
      csv += `Users,Active 7-Day (WAU),${intelligence.users.activeThisWeek}\n`;
      csv += `Users,Active 30-Day (MAU),${intelligence.users.activeThisMonth}\n`;
      csv += `Usage,Total Sessions,${intelligence.usage.totalSessions.current}\n`;
      csv += `Usage,Total Usage Seconds,${intelligence.usage.totalUsageSeconds}\n`;
      csv += `Projects,Total Workspaces,${intelligence.projects.total}\n`;
      const aiReqVal = typeof intelligence.ai.totalRequests === 'object' ? (intelligence.ai.totalRequests as any).current : intelligence.ai.totalRequests;
      csv += `AI,Total Requests,${aiReqVal}\n`;
      csv += `AI,Average Latency (ms),${intelligence.ai.avgLatencyMs}\n`;
      csv += `AI,Satisfaction Rate (%),${intelligence.ai.feedback?.stats?.satisfactionRate ?? 100}\n`;
      csv += `Reports,Open Reports,${intelligence.reports.open}\n`;
      csv += `Errors,Total Errors Logged,${intelligence.errors.total}\n`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="radiux-metrics-${range}-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, intelligence });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
