/**
 * クライアントエラー記録の仕様テスト
 *
 * 目的:
 * 「エラーが出ます」という問い合わせだけが届いて、何が起きたか分からない状態をなくす。
 * ブラウザ側で起きた例外・Promise拒否・API呼び出し失敗を client_errors に蓄積し、
 * GET /api/admin/errors で確認できるようにする。
 *
 * 仕様:
 * - 入力の正規化 normalizeClientError:
 *   - message は必須。空・非文字列は 'missing_message' で拒否する（記録しない）
 *   - message 500 / stack 2000 / pageUrl 500 / userAgent 500 / appVersion 50 / swState 30 文字で切り詰める
 *   - source はホワイトリストのみ採用し、それ以外・未指定は 'unknown' に丸める（弾かない。
 *     エラー報告は取りこぼすほうが損なので、素性が怪しくても受ける）
 * - 指紋 errorFingerprint:
 *   - 同じ message × source からは常に同じ指紋が出る（決定的）
 *   - message 中の数字列・ビルドハッシュ・URLのクエリは伏せてから指紋を取る。
 *     デプロイのたびにファイル名が変わる「チャンク取得失敗」を1件に束ねるため
 *   - source が違えば別の指紋になる
 * - 時間バケツ hourBucket: ISO時刻から UTC の YYYY-MM-DDTHH を返す
 *   （同一visitor × 同一指紋 × 同一時間で1行にまとめ、ループする端末にDBを埋められないようにする）
 * - 行の組み立て buildClientErrorRow: visitor_id は customerId > anonId > 'unknown' の順で決まる
 * - 管理クエリ parseErrorQuery: days は 1..90（既定7）、limit は 1..200（既定50）に収める
 */
import { describe, it, expect } from 'vitest';
import {
  CLIENT_ERROR_SOURCES,
  normalizeClientError,
  errorFingerprint,
  hourBucket,
  buildClientErrorRow,
  parseErrorQuery,
} from './clientError';

const NOW = '2026-09-16T05:24:00.000Z';
const CUSTOMER_ID = '12345678-1234-1234-1234-123456789abc';

describe('CLIENT_ERROR_SOURCES', () => {
  it('拾う経路を網羅している', () => {
    expect([...CLIENT_ERROR_SOURCES].sort()).toEqual(
      ['window.onerror', 'unhandledrejection', 'react', 'fetch', 'manual', 'boot'].sort()
    );
  });

  it('boot（アプリが起動すらできなかった場合）を受け付ける', () => {
    // index.html に直接書いた見張り役から届く。バンドルが404でも送れる唯一の経路
    const r = normalizeClientError({ message: '起動に必要なファイルを読み込めませんでした', source: 'boot' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.source).toBe('boot');
  });
});

describe('normalizeClientError', () => {
  it('message があれば採用する', () => {
    const r = normalizeClientError({ message: 'Failed to fetch', source: 'fetch' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.message).toBe('Failed to fetch');
    expect(r.value.source).toBe('fetch');
  });

  it('message が空なら missing_message で拒否する', () => {
    const r = normalizeClientError({ message: '   ', source: 'fetch' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('missing_message');
  });

  it('message が文字列でないなら missing_message で拒否する', () => {
    expect(normalizeClientError({ message: 42 }).ok).toBe(false);
    expect(normalizeClientError({}).ok).toBe(false);
    expect(normalizeClientError(null).ok).toBe(false);
  });

  it('ホワイトリスト外の source は unknown に丸める（拒否はしない）', () => {
    const r = normalizeClientError({ message: 'boom', source: 'drop_tables' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.source).toBe('unknown');
  });

  it('source 未指定も unknown になる', () => {
    const r = normalizeClientError({ message: 'boom' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.source).toBe('unknown');
  });

  it('長すぎる値は上限で切り詰める', () => {
    const r = normalizeClientError({
      message: 'm'.repeat(1000),
      stack: 's'.repeat(5000),
      pageUrl: 'u'.repeat(1000),
      userAgent: 'a'.repeat(1000),
      appVersion: 'v'.repeat(200),
      swState: 'w'.repeat(200),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.message).toHaveLength(500);
    expect(r.value.stack).toHaveLength(2000);
    expect(r.value.pageUrl).toHaveLength(500);
    expect(r.value.userAgent).toHaveLength(500);
    expect(r.value.appVersion).toHaveLength(50);
    expect(r.value.swState).toHaveLength(30);
  });

  it('省略された任意項目は空文字になる', () => {
    const r = normalizeClientError({ message: 'boom' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.stack).toBe('');
    expect(r.value.pageUrl).toBe('');
  });
});

describe('errorFingerprint', () => {
  it('同じ message × source からは同じ指紋が出る', () => {
    expect(errorFingerprint('Failed to fetch', 'fetch')).toBe(
      errorFingerprint('Failed to fetch', 'fetch')
    );
  });

  it('source が違えば別の指紋になる', () => {
    expect(errorFingerprint('boom', 'fetch')).not.toBe(errorFingerprint('boom', 'react'));
  });

  it('message が違えば別の指紋になる', () => {
    expect(errorFingerprint('boom', 'fetch')).not.toBe(errorFingerprint('bang', 'fetch'));
  });

  it('ビルドハッシュ違いのチャンク取得失敗は同じ指紋に束ねる', () => {
    const a = errorFingerprint(
      'Failed to fetch dynamically imported module: https://con-sche.tatelog.biz/assets/AppPage-leXcEGVB.js',
      'window.onerror'
    );
    const b = errorFingerprint(
      'Failed to fetch dynamically imported module: https://con-sche.tatelog.biz/assets/AppPage-B7xK1c2q.js',
      'window.onerror'
    );
    expect(a).toBe(b);
  });

  it('行番号や件数だけが違うエラーも同じ指紋に束ねる', () => {
    expect(errorFingerprint('Cannot read x of undefined at line 120', 'react')).toBe(
      errorFingerprint('Cannot read x of undefined at line 993', 'react')
    );
  });

  it('URLのクエリ文字列は指紋に影響しない', () => {
    expect(errorFingerprint('request failed: /api/ping?t=abc', 'fetch')).toBe(
      errorFingerprint('request failed: /api/ping?t=zzz', 'fetch')
    );
  });

  it('指紋は16桁の16進文字列', () => {
    expect(errorFingerprint('boom', 'fetch')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('hourBucket', () => {
  it('ISO時刻から UTC の時間バケツを作る', () => {
    expect(hourBucket('2026-09-16T05:24:00.000Z')).toBe('2026-09-16T05');
  });

  it('同じ時間内の別の分は同じバケツになる', () => {
    expect(hourBucket('2026-09-16T05:00:00.000Z')).toBe(hourBucket('2026-09-16T05:59:59.999Z'));
  });

  it('時間をまたぐと別のバケツになる', () => {
    expect(hourBucket('2026-09-16T05:59:59.999Z')).not.toBe(hourBucket('2026-09-16T06:00:00.000Z'));
  });
});

describe('buildClientErrorRow', () => {
  const normalized = {
    message: 'Failed to fetch',
    stack: 'at fn (app.js:1:1)',
    source: 'fetch' as const,
    pageUrl: 'https://con-sche.tatelog.biz/app',
    userAgent: 'Mozilla/5.0',
    appVersion: '2026-09-09',
    swState: 'activated',
  };

  it('customerId があれば visitor_id は customerId になる', () => {
    const row = buildClientErrorRow(normalized, CUSTOMER_ID, 'anon-abc', '203.0.113.1', NOW);
    expect(row.visitor_id).toBe(CUSTOMER_ID);
    expect(row.customer_id).toBe(CUSTOMER_ID);
  });

  it('customerId が無ければ anonId を visitor_id に使い、customer_id は null', () => {
    const row = buildClientErrorRow(normalized, '', 'anon-abc', '203.0.113.1', NOW);
    expect(row.visitor_id).toBe('anon-abc');
    expect(row.customer_id).toBeNull();
  });

  it('どちらも無ければ visitor_id は unknown', () => {
    const row = buildClientErrorRow(normalized, '', '', 'unknown', NOW);
    expect(row.visitor_id).toBe('unknown');
  });

  it('時間バケツと指紋と時刻が入る', () => {
    const row = buildClientErrorRow(normalized, CUSTOMER_ID, '', '203.0.113.1', NOW);
    expect(row.hour).toBe('2026-09-16T05');
    expect(row.fingerprint).toBe(errorFingerprint(normalized.message, normalized.source));
    expect(row.first_at).toBe(NOW);
    expect(row.last_at).toBe(NOW);
    expect(row.ip).toBe('203.0.113.1');
  });
});

describe('parseErrorQuery', () => {
  const q = (search: string) => parseErrorQuery(new URL(`https://api.example.com/api/admin/errors${search}`));

  it('既定は7日・50件', () => {
    expect(q('')).toEqual({ days: 7, limit: 50 });
  });

  it('指定された値を使う', () => {
    expect(q('?days=30&limit=100')).toEqual({ days: 30, limit: 100 });
  });

  it('範囲外は上下限に収める', () => {
    expect(q('?days=999&limit=9999')).toEqual({ days: 90, limit: 200 });
    expect(q('?days=0&limit=0')).toEqual({ days: 1, limit: 1 });
  });

  it('数値でない指定は既定値に戻す', () => {
    expect(q('?days=abc&limit=xyz')).toEqual({ days: 7, limit: 50 });
  });
});
