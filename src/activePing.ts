/**
 * アプリ起動ping（アクティブ計測）
 *
 * 2026-08-21: 旧実装は localStorage に customerId も email も無いと ping 自体を
 * 送らずに return していた。その結果、登録85人に対して last_seen_at が付いたのは
 * 1人だけという状態になっていた。別端末で開いた人、履歴を消した人、customerId を
 * 保存する前（2026-08-06 の修復前）に登録した人が、まるごと計測から抜けていた。
 *
 * 「誰が」までは分からなくてよいので「何人が開いたか」だけは必ず取れるようにする。
 * 身元が分かるときは今までどおり customers.last_seen_at を更新する。
 */

export const REGISTRATION_KEY = 'consche_registration'
export const ANON_KEY = 'consche_anon'

type RegistrationState = { customerId?: string; email?: string }
type PingResponse = { customerId?: string; anonId?: string }

/** localStorage は環境によって参照そのものが例外を投げるので、必ず包んで読む */
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 保存できなくても計測以外に影響しないので黙って諦める
  }
}

function readRegistration(): RegistrationState {
  const raw = readStorage(REGISTRATION_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as RegistrationState
  } catch {
    return {}
  }
}

/**
 * 起動を1回だけサーバーに知らせる。
 * 失敗しても画面側を巻き込まないよう、例外は投げない。
 */
export async function sendActivePing(apiBase: string): Promise<void> {
  try {
    const state = readRegistration()
    const anonId = readStorage(ANON_KEY)

    const headers: Record<string, string> = {}
    if (state.customerId) {
      headers['X-Consche-Id'] = state.customerId
    } else if (state.email) {
      headers['X-Consche-Email'] = state.email
    }
    if (anonId) {
      headers['X-Consche-Anon'] = anonId
    }

    const res = await fetch(`${apiBase}/api/ping`, { method: 'POST', headers })
    if (!res?.ok) return

    const body = (await res.json()) as PingResponse | null
    if (!body) return

    // メール照合で身元が判明したら次回から customerId で送れるようにする
    if (body.customerId && !state.customerId) {
      writeStorage(REGISTRATION_KEY, JSON.stringify({ ...state, customerId: body.customerId }))
    }
    // 匿名IDは一度決まったら変えない。変えると同じ人を二重に数えてしまう
    if (body.anonId && !anonId) {
      writeStorage(ANON_KEY, body.anonId)
    }
  } catch {
    // fire-and-forget
  }
}
