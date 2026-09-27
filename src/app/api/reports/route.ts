import { NextRequest, NextResponse } from 'next/server';
import { createReport, updateReport, getRawAnalyticsState } from '@/lib/analytics/store';
import { verifyAdminRequest } from '@/lib/admin/admin-auth';

// GET reports (Admin gets all, regular user gets own)
export async function GET(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  const state = getRawAnalyticsState();

  if (adminAuth.isAdmin) {
    return NextResponse.json({ reports: state.reports });
  }

  // Non-admin can only view their own reports
  const { searchParams } = new URL(req.url);
  const reporterEmail = searchParams.get('email');
  if (reporterEmail) {
    const own = state.reports.filter((r) => r.reporter_email?.toLowerCase() === reporterEmail.toLowerCase());
    return NextResponse.json({ reports: own });
  }

  return NextResponse.json({ reports: [] });
}

// POST new report or complaint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const reporterId = body.reporterId || body.reporter_id;
    const reporterEmail = body.reporterEmail || body.reporter_email;
    const category = body.category;
    const severity = body.severity || 'MEDIUM';
    const title = body.title;
    const description = body.description;
    const projectId = body.projectId || body.project_id;
    const priority = body.priority || 'MEDIUM';

    if (!category || !title || !description) {
      return NextResponse.json({ error: 'category, title, and description are required' }, { status: 400 });
    }

    const report = await createReport({
      reporterId,
      reporterEmail,
      category,
      severity,
      title,
      description,
      projectId,
      priority,
    });

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH report (Admin only: update status, priority, admin notes, resolution)
export async function PATCH(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const reportId = body.reportId || body.id;
    const status = body.status;
    const priority = body.priority;
    const assigned_admin_id = body.assigned_admin_id || body.assignedAdminId;
    const resolution = body.resolution;
    const internal_notes = body.internal_notes || body.internalNotes;

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
    }

    const updated = await updateReport(reportId, {
      status,
      priority,
      assigned_admin_id,
      resolution,
      internal_notes,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, report: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
