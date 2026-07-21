/**
 * アプリ内お問い合わせフォームの入力検証の仕様テスト
 * - 会社名・氏名・メール・本文はすべて必須
 * - メールは形式チェック
 * - 本文はWorker側DB上限（4000字）以内
 * - 正常入力ではエラーなし（null）
 */
import { describe, it, expect } from 'vitest';
import { validateContact } from '@/utils/contactValidation';

const valid = {
  company: '株式会社テスト工務店',
  name: '建設 太郎',
  email: 'taro@example.co.jp',
  message: 'お問い合わせ本文です。',
};

describe('validateContact', () => {
  it('正常入力ではnullを返す', () => {
    expect(validateContact(valid)).toBeNull();
  });

  it('会社名が空ならエラー', () => {
    expect(validateContact({ ...valid, company: '  ' })).toMatch(/入力/);
  });

  it('氏名が空ならエラー', () => {
    expect(validateContact({ ...valid, name: '' })).toMatch(/入力/);
  });

  it('メールが空ならエラー', () => {
    expect(validateContact({ ...valid, email: '' })).toMatch(/入力/);
  });

  it('本文が空ならエラー', () => {
    expect(validateContact({ ...valid, message: '' })).toMatch(/入力/);
  });

  it('メール形式が不正ならエラー', () => {
    expect(validateContact({ ...valid, email: 'taro@' })).toMatch(/メールアドレス/);
  });

  it('本文が4000字を超えたらエラー', () => {
    expect(validateContact({ ...valid, message: 'あ'.repeat(4001) })).toMatch(/4000/);
    expect(validateContact({ ...valid, message: 'あ'.repeat(4000) })).toBeNull();
  });
});
