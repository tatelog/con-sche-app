/**
 * お知らせ機能のロジック
 * 配信はWorkerの GET /api/announcements（D1のannouncementsテーブル）。
 * 未読判定は「最新お知らせの日時 > この端末で最後に一覧を開いた日時（localStorage）」。
 */

export const NEWS_READ_STORAGE_KEY = 'consche_news_read_at';
const API_BASE = (import.meta.env?.VITE_API_BASE as string | undefined) ?? '';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

/** 最新お知らせ日時と最終既読日時から未読の有無を判定する。日時が壊れている場合は安全側（false） */
export function hasUnread(latestCreatedAt: string | null, lastReadAt: string | null): boolean {
  if (!latestCreatedAt) return false;
  const latest = Date.parse(latestCreatedAt);
  if (Number.isNaN(latest)) return false;
  if (!lastReadAt) return true;
  const read = Date.parse(lastReadAt);
  if (Number.isNaN(read)) return true;
  return latest > read;
}

export function loadLastReadAt(): string | null {
  try {
    return localStorage.getItem(NEWS_READ_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markAllRead(): void {
  try {
    localStorage.setItem(NEWS_READ_STORAGE_KEY, new Date().toISOString());
  } catch {
    // localStorage不可の環境ではドットが消えないだけで実害なし
  }
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await fetch(`${API_BASE}/api/announcements`);
  if (!res.ok) throw new Error(`announcements fetch failed: ${res.status}`);
  const body = (await res.json()) as { announcements?: Announcement[] };
  return body.announcements ?? [];
}
