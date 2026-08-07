/**
 * WebMCPツール利用テレメトリ
 *
 * ツール実行時に「誰が・どのツールを・いつ」だけをAPIへ送る。
 * 工程表データは一切送らない（ローカルファースト維持）。
 * fire-and-forget: 送信失敗してもツール実行には影響させない。
 */

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export const REGISTRATION_KEY = 'consche_registration'

export function trackToolUse(toolName: string): void {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const raw = localStorage.getItem(REGISTRATION_KEY)
      const state = raw ? (JSON.parse(raw) as { customerId?: string }) : {}
      if (state.customerId) headers['X-Consche-Id'] = state.customerId
    } catch {
      // 登録情報が読めなくても匿名で送る
    }
    fetch(`${API_BASE}/api/webmcp-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool: toolName }),
    }).catch(() => {})
  } catch {
    // テレメトリの失敗はツール実行に影響させない
  }
}
