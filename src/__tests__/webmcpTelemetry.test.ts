/**
 * WebMCPツール利用テレメトリの仕様テスト
 *
 * 仕様:
 * - trackToolUse(toolName) は POST /api/webmcp-event に {tool} を送る
 * - localStorage の consche_registration に customerId があれば X-Consche-Id ヘッダーで送る
 * - customerId が無ければヘッダー無し（匿名）で送る
 * - fetch が失敗しても例外を投げない（ツール実行を巻き込まない fire-and-forget）
 * - 登録ツールは execute 実行時に trackToolUse が呼ばれるようラップされる
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackToolUse, REGISTRATION_KEY } from '@/webmcp/telemetry'
import { registerConScheTools, CON_SCHE_TOOL_NAMES } from '@/webmcp/register'

const CUSTOMER_ID = '12345678-1234-1234-1234-123456789abc'

let fetchMock: ReturnType<typeof vi.fn>
let store: Record<string, string>

beforeEach(() => {
  store = {}
  fetchMock = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('trackToolUse', () => {
  it('customerId があれば X-Consche-Id ヘッダー付きで /api/webmcp-event に送る', () => {
    store[REGISTRATION_KEY] = JSON.stringify({ customerId: CUSTOMER_ID, email: 'a@b.jp' })
    trackToolUse('get_schedule')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/webmcp-event')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Consche-Id']).toBe(CUSTOMER_ID)
    expect(JSON.parse(init.body)).toEqual({ tool: 'get_schedule' })
  })

  it('customerId が無ければ匿名（ヘッダー無し）で送る', () => {
    trackToolUse('find_activities')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-Consche-Id']).toBeUndefined()
  })

  it('fetch が reject しても例外を投げない', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    expect(() => trackToolUse('get_schedule')).not.toThrow()
    await Promise.resolve() // rejection が未処理にならないことの確認を flush
  })

  it('localStorage が壊れたJSONでも例外を投げず匿名で送る', () => {
    store[REGISTRATION_KEY] = '{broken'
    expect(() => trackToolUse('get_schedule')).not.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('registerConScheTools のテレメトリ組み込み', () => {
  it('登録されたツールの execute を呼ぶと利用イベントが送信される', async () => {
    const registered: any[] = []
    ;(globalThis as any).document = {
      modelContext: { registerTool: (t: any) => registered.push(t) },
    }
    try {
      registerConScheTools()
      expect(registered).toHaveLength(CON_SCHE_TOOL_NAMES.length)

      const tool = registered.find((t) => t.name === 'get_schedule')
      await tool.execute({})

      const urls = fetchMock.mock.calls.map((c) => String(c[0]))
      expect(urls.some((u) => u.includes('/api/webmcp-event'))).toBe(true)
      const eventCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/webmcp-event'))!
      expect(JSON.parse(eventCall[1].body)).toEqual({ tool: 'get_schedule' })
    } finally {
      delete (globalThis as any).document
    }
  })
})
