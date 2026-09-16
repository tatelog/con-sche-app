/**
 * 登録済み照合（別端末から入り直す）の仕様テスト
 *
 * 会社のPCで登録した人が、現場のタブレットで開くと毎回「はじめる前に」が出る。
 * 登録の有無は端末のlocalStorageにしか無いため。メールアドレスだけで確かめられるようにする。
 *
 * 仕様:
 * - 登録が見つかった: 'found' を返し、端末に customerId とメールを覚えさせる
 *   （次回からは照合すら不要になり、利用計測でも同一人物として数えられる）
 * - 見つからない: 'not_found'。端末には何も保存しない
 * - 形式が不正（400）: 'invalid'
 * - 回数の上限（429）: 'rate_limited'
 * - 通信できない・その他: 'error'。ここで例外を投げてはいけない
 *   （照合に失敗しても、利用者は通常の新規登録に進めなければならない）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupRegistration, REGISTRATION_STORAGE_KEY } from '@/lib/registrationLookup';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('lookupRegistration', () => {
  it('登録が見つかれば found を返す', async () => {
    mockFetch(200, { found: true, customerId: 'c-123' });
    expect(await lookupRegistration('taro@example.co.jp', '')).toBe('found');
  });

  it('見つかったら端末に customerId とメールを覚えさせる', async () => {
    mockFetch(200, { found: true, customerId: 'c-123' });
    await lookupRegistration('Taro@Example.co.jp', '');
    const saved = JSON.parse(store.get(REGISTRATION_STORAGE_KEY) ?? '{}');
    expect(saved.customerId).toBe('c-123');
    expect(saved.email).toBe('taro@example.co.jp'); // 小文字に揃えて保存する
    expect(saved.registeredAt).toBeTruthy();
  });

  it('見つからなければ not_found を返し、端末には何も保存しない', async () => {
    mockFetch(200, { found: false });
    expect(await lookupRegistration('nobody@example.co.jp', '')).toBe('not_found');
    expect(store.get(REGISTRATION_STORAGE_KEY)).toBeUndefined();
  });

  it('形式が不正なら invalid', async () => {
    mockFetch(400, { error: 'メールアドレスの形式が正しくありません。' });
    expect(await lookupRegistration('taro', '')).toBe('invalid');
  });

  it('回数の上限に達したら rate_limited', async () => {
    mockFetch(429, { error: '確認の回数が上限に達しました。' });
    expect(await lookupRegistration('taro@example.co.jp', '')).toBe('rate_limited');
  });

  it('通信できないときは例外を投げず error を返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await lookupRegistration('taro@example.co.jp', '')).toBe('error');
  });

  it('見つかったのに customerId が無い応答は error として扱う', async () => {
    // 保存すべきものが無いのに「入れた」ことにすると、次の端末で辻褄が合わなくなる
    mockFetch(200, { found: true });
    expect(await lookupRegistration('taro@example.co.jp', '')).toBe('error');
    expect(store.get(REGISTRATION_STORAGE_KEY)).toBeUndefined();
  });

  it('APIのベースURLを前置きして /api/lookup を呼ぶ', async () => {
    const fn = mockFetch(200, { found: false });
    await lookupRegistration('taro@example.co.jp', 'https://api.example.com');
    expect(fn.mock.calls[0][0]).toBe('https://api.example.com/api/lookup');
  });
});
