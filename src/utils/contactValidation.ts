/**
 * アプリ内お問い合わせフォームの入力検証
 * 上限値はWorker側（handleContact）のDB格納上限と揃えている
 */

export interface ContactInput {
  company: string;
  name: string;
  email: string;
  message: string;
}

export function validateContact(input: ContactInput): string | null {
  const company = input.company.trim();
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();

  if (!company || !name || !email || !message) {
    return 'すべての項目を入力してください。';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'メールアドレスの形式が正しくありません。';
  }
  if (message.length > 4000) {
    return '本文は4000文字以内で入力してください。';
  }
  return null;
}
