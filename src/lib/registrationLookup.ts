/**
 * 登録済みの照合（別の端末から入り直す）
 *
 * 登録したかどうかは端末のlocalStorageにしか無い。だから会社のPCで登録した人でも、
 * 現場のタブレットで開けば毎回「はじめる前に」の画面が出て、氏名と会社名を打ち直すことになる。
 * メールアドレスだけで登録の有無を確かめて、そのまま使えるようにする。
 *
 * 照合が失敗しても例外は投げない。何が起きても、利用者は通常の新規登録に進めなければならない。
 */

export { REGISTRATION_STORAGE_KEY } from '@/components/RegistrationGate';
import { REGISTRATION_STORAGE_KEY as KEY } from '@/components/RegistrationGate';

export type LookupResult = 'found' | 'not_found' | 'invalid' | 'rate_limited' | 'error';

interface LookupBody {
  found?: boolean;
  customerId?: string;
}

/** 照合できた登録を端末に覚えさせる。次回からは照合すら不要になる */
function remember(email: string, customerId: string): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        registeredAt: new Date().toISOString(),
        customerId,
        email,
      })
    );
  } catch {
    // 保存できなくても、この場では使える状態にする
  }
}

export async function lookupRegistration(email: string, apiBase: string): Promise<LookupResult> {
  const normalized = email.trim().toLowerCase();
  try {
    const res = await fetch(`${apiBase}/api/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized }),
    });

    if (res.status === 429) return 'rate_limited';
    if (res.status === 400) return 'invalid';
    if (!res.ok) return 'error';

    const body = (await res.json().catch(() => ({}))) as LookupBody;
    if (!body.found) return 'not_found';
    // 保存すべきIDが無いのに通してしまうと、次の端末で辻褄が合わなくなる
    if (!body.customerId) return 'error';

    remember(normalized, body.customerId);
    return 'found';
  } catch {
    return 'error';
  }
}
