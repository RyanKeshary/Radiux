import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DATA_ROOT = path.resolve(process.cwd(), '.workspaces', 'data');
const PARTNERS_FILE = path.join(DATA_ROOT, 'partners.json');

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function loadLocalPartners(): any[] {
  try {
    if (fs.existsSync(PARTNERS_FILE)) {
      return JSON.parse(fs.readFileSync(PARTNERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[Partners API] Error reading local partners store:', e);
  }
  return [];
}

function saveLocalPartners(data: any[]) {
  try {
    if (!fs.existsSync(DATA_ROOT)) {
      fs.mkdirSync(DATA_ROOT, { recursive: true });
    }
    fs.writeFileSync(PARTNERS_FILE, JSON.stringify(data.slice(0, 500), null, 2), 'utf8');
  } catch (e) {
    console.error('[Partners API] Error saving local partners store:', e);
  }
}

// GET: fetch partners for a user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('coding_partners')
        .select('*, requester:profiles!requester_id(*), receiver:profiles!receiver_id(*)')
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);

      if (!error && data && data.length > 0) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          requester_id: d.requester_id,
          receiver_id: d.receiver_id,
          status: d.status,
          created_at: d.created_at,
          updated_at: d.updated_at,
          profile: d.requester_id === userId ? d.receiver : d.requester,
        }));
        return NextResponse.json({ partners: mapped });
      }
    } catch (e) {}
  }

  // Fallback to local server store
  const all = loadLocalPartners();
  const userPartners = all.filter(
    (p) => p.requester_id === userId || p.receiver_id === userId
  );

  return NextResponse.json({ partners: userPartners });
}

// POST: create partner request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const partner = body.partner;

    if (!partner || !partner.requester_id || !partner.receiver_id) {
      return NextResponse.json({ error: 'Missing partner payload' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('coding_partners').insert({
          id: partner.id,
          requester_id: partner.requester_id,
          receiver_id: partner.receiver_id,
          status: partner.status || 'pending',
          created_at: partner.created_at || new Date().toISOString(),
          updated_at: partner.updated_at || new Date().toISOString(),
        });
      } catch (e) {}
    }

    // Save in persistent server store
    const all = loadLocalPartners();
    const existingIdx = all.findIndex((p) => p.id === partner.id);
    if (existingIdx !== -1) {
      all[existingIdx] = { ...all[existingIdx], ...partner };
    } else {
      all.push(partner);
    }
    saveLocalPartners(all);

    return NextResponse.json({ success: true, partner });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save partner' }, { status: 500 });
  }
}

// PATCH: update partner request status (accept, decline, ignore, cancel)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json({ error: 'Missing requestId or status' }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('coding_partners')
          .update({ status, updated_at: updatedAt })
          .eq('id', requestId);
      } catch (e) {}
    }

    const all = loadLocalPartners();
    let updatedPartner: any = null;
    all.forEach((p) => {
      if (p.id === requestId) {
        p.status = status;
        p.updated_at = updatedAt;
        updatedPartner = p;
      }
    });
    saveLocalPartners(all);

    return NextResponse.json({ success: true, partner: updatedPartner });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update partner' }, { status: 500 });
  }
}

// DELETE: remove partner
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');

    if (!partnerId) {
      return NextResponse.json({ error: 'Missing partnerId' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('coding_partners').delete().eq('id', partnerId);
      } catch (e) {}
    }

    const all = loadLocalPartners();
    const filtered = all.filter((p) => p.id !== partnerId);
    saveLocalPartners(filtered);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete partner' }, { status: 500 });
  }
}
