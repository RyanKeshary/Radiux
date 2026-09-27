import { createClient } from '@supabase/supabase-js';

export interface AIFeedbackItem {
  id: string;
  messageId: string;
  type: 'like' | 'dislike' | 'revert' | 'copy';
  userEmail?: string;
  userName?: string;
  contentPreview?: string;
  filePath?: string;
  model?: string;
  timestamp: string;
}

// Global in-memory cache to ensure immediate persistence across hot-reloads & dev runs
const globalRef = globalThis as unknown as {
  __radiux_ai_feedback?: AIFeedbackItem[];
};

if (!globalRef.__radiux_ai_feedback) {
  globalRef.__radiux_ai_feedback = [];
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function recordFeedback(
  item: Omit<AIFeedbackItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<AIFeedbackItem> {
  const feedbackItem: AIFeedbackItem = {
    id: item.id || `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    messageId: item.messageId,
    type: item.type,
    userEmail: item.userEmail || 'developer@radiux.dev',
    userName: item.userName || 'Developer',
    contentPreview: item.contentPreview ? item.contentPreview.slice(0, 300) : '',
    filePath: item.filePath || '',
    model: item.model || 'openai/gpt-oss-20b',
    timestamp: item.timestamp || new Date().toISOString(),
  };

  // 1. Save to in-memory store
  globalRef.__radiux_ai_feedback!.unshift(feedbackItem);
  if (globalRef.__radiux_ai_feedback!.length > 500) {
    globalRef.__radiux_ai_feedback = globalRef.__radiux_ai_feedback!.slice(0, 500);
  }

  // 2. Best-effort async save to Supabase
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('ai_feedback').insert({
        id: feedbackItem.id,
        message_id: feedbackItem.messageId,
        feedback_type: feedbackItem.type,
        user_email: feedbackItem.userEmail,
        user_name: feedbackItem.userName,
        content_preview: feedbackItem.contentPreview,
        file_path: feedbackItem.filePath,
        model: feedbackItem.model,
        created_at: feedbackItem.timestamp,
      });
    }
  } catch (e) {
    // Non-fatal if table not yet created
  }

  return feedbackItem;
}

export async function getFeedbackStats() {
  const items = globalRef.__radiux_ai_feedback || [];

  let likes = 0;
  let dislikes = 0;
  let reverts = 0;
  let copies = 0;

  for (const item of items) {
    if (item.type === 'like') likes++;
    else if (item.type === 'dislike') dislikes++;
    else if (item.type === 'revert') reverts++;
    else if (item.type === 'copy') copies++;
  }

  const ratedTotal = likes + dislikes;
  const satisfactionRate = ratedTotal > 0 ? Math.round((likes / ratedTotal) * 100) : 100;

  return {
    totalFeedback: items.length,
    likes,
    dislikes,
    reverts,
    copies,
    satisfactionRate,
    recent: items.slice(0, 50),
  };
}

export function getAllFeedback(limit = 100): AIFeedbackItem[] {
  return (globalRef.__radiux_ai_feedback || []).slice(0, limit);
}
