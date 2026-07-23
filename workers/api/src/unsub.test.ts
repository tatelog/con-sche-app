/**
 * ワンクリック配信停止リンクの署名仕様テスト
 * - 同じメール+同じ秘密鍵 → 常に同じ署名（リンクの安定性）
 * - 署名はメール・秘密鍵のどちらが変わっても不一致
 * - 検証は改ざん署名を拒否する
 * - URLはメールをエンコードし署名を含む
 */
import { describe, it, expect } from 'vitest';
import { unsubSignature, verifyUnsubSignature, buildUnsubUrl } from './unsub';

const SECRET = 'test-secret-key';

describe('unsubSignature / verifyUnsubSignature', () => {
  it('同じ入力からは常に同じ署名が出る', async () => {
    const a = await unsubSignature('user@example.co.jp', SECRET);
    const b = await unsubSignature('user@example.co.jp', SECRET);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('メールが違えば署名も違う', async () => {
    const a = await unsubSignature('user@example.co.jp', SECRET);
    const b = await unsubSignature('other@example.co.jp', SECRET);
    expect(a).not.toBe(b);
  });

  it('秘密鍵が違えば署名も違う', async () => {
    const a = await unsubSignature('user@example.co.jp', SECRET);
    const b = await unsubSignature('user@example.co.jp', 'another-secret');
    expect(a).not.toBe(b);
  });

  it('正しい署名は検証を通る', async () => {
    const sig = await unsubSignature('user@example.co.jp', SECRET);
    expect(await verifyUnsubSignature('user@example.co.jp', sig, SECRET)).toBe(true);
  });

  it('改ざんされた署名・別人のメールは拒否する', async () => {
    const sig = await unsubSignature('user@example.co.jp', SECRET);
    expect(await verifyUnsubSignature('victim@example.co.jp', sig, SECRET)).toBe(false);
    expect(await verifyUnsubSignature('user@example.co.jp', sig.replace(/^./, '0'), SECRET)).toBe(false);
    expect(await verifyUnsubSignature('user@example.co.jp', '', SECRET)).toBe(false);
  });
});

describe('buildUnsubUrl', () => {
  it('メールをURLエンコードし署名を付与する', async () => {
    const sig = await unsubSignature('user+tag@example.co.jp', SECRET);
    const url = buildUnsubUrl('https://api.example.com', 'user+tag@example.co.jp', sig);
    expect(url).toBe(`https://api.example.com/api/unsubscribe?e=user%2Btag%40example.co.jp&sig=${sig}`);
  });
});
