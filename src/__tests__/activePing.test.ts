/**
 * アプリ起動ping（アクティブ計測）の仕様テスト
 *
 * 背景:
 * 2026-08-21 時点で登録85人に対し last_seen_at が入っているのは1人だけだった。
 * 旧実装は localStorage に customerId も email も無いと ping 自体を送らず return して
 * いたため、別端末・別ブラウザ・履歴削除・8/6の修復前に登録した人が丸ごと計測から
 * 抜け落ちていた。「誰が」は分からなくても「何人が開いたか」は取れるようにする。
 *
 * 仕様:
 * - customerId があれば X-Consche-Id を付けて POST /api/ping に送る
 * - customerId が無く email があれば X-Consche-Email を付けて送る
 * - どちらも無くても送る（匿名ping）。ここが旧実装との違い
 * - 匿名IDが localStorage にあれば X-Consche-Anon を付けて送り、同じ人を数え直さない
 * - サーバーが customerId を返したら localStorage に保存する（既存ユーザーの自己修復）
 * - サーバーが anonId を返したら localStorage に保存する（次回から同一visitorとして数える）
 * - fetch が失敗しても例外を投げない（画面表示を巻き込まない fire-and-forget）
 * - localStorage が読めない環境でも例外を投げず、匿名pingは送る
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendActivePing, REGISTRATION_KEY, ANON_KEY } from '@/activePing'

const API_BASE = 'https://api.example.test'
const CUSTOMER_ID = '12345678-1234-1234-1234-123456789abc'
const ANON_ID = 'anon-abcdef0123456789'

let fetchMock: ReturnType<typeof vi.fn>
let store: Record<string, string>

function stubStorage(impl?: Partial<Storage>) {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    ...impl,
  })
}

beforeEach(() => {
  store = {}
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
  stubStorage()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function headersOf(callIndex = 0): Record<string, string> {
  const [, init] = fetchMock.mock.calls[callIndex]
  return (init?.headers ?? {}) as Record<string, string>
}

describe('sendActivePing', () => {
  it('customerId があれば X-Consche-Id を付けて /api/ping に POST する', async () => {
    store[REGISTRATION_KEY] = JSON.stringify({ customerId: CUSTOMER_ID, email: 'a@b.jp' })

    await sendActivePing(API_BASE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/ping`)
    expect(init.method).toBe('POST')
    expect(headersOf()['X-Consche-Id']).toBe(CUSTOMER_ID)
  })

  it('customerId が無く email があれば X-Consche-Email を付けて送る', async () => {
    store[REGISTRATION_KEY] = JSON.stringify({ email: 'a@b.jp' })

    await sendActivePing(API_BASE)

    expect(headersOf()['X-Consche-Email']).toBe('a@b.jp')
    expect(headersOf()['X-Consche-Id']).toBeUndefined()
  })

  it('customerId も email も無くても匿名で送る（旧実装は送っていなかった）', async () => {
    await sendActivePing(API_BASE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE}/api/ping`)
  })

  it('匿名IDが保存済みなら X-Consche-Anon を付けて送る', async () => {
    store[ANON_KEY] = ANON_ID

    await sendActivePing(API_BASE)

    expect(headersOf()['X-Consche-Anon']).toBe(ANON_ID)
  })

  it('サーバーが customerId を返したら localStorage に保存する', async () => {
    store[REGISTRATION_KEY] = JSON.stringify({ email: 'a@b.jp' })
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ customerId: CUSTOMER_ID }) })

    await sendActivePing(API_BASE)

    expect(JSON.parse(store[REGISTRATION_KEY])).toEqual({ email: 'a@b.jp', customerId: CUSTOMER_ID })
  })

  it('サーバーが anonId を返したら localStorage に保存する', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ anonId: ANON_ID }) })

    await sendActivePing(API_BASE)

    expect(store[ANON_KEY]).toBe(ANON_ID)
  })

  it('既に匿名IDがあるなら、サーバーが別の値を返しても上書きしない', async () => {
    store[ANON_KEY] = ANON_ID
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ anonId: 'anon-other' }) })

    await sendActivePing(API_BASE)

    expect(store[ANON_KEY]).toBe(ANON_ID)
  })

  it('fetch が失敗しても例外を投げない', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    await expect(sendActivePing(API_BASE)).resolves.toBeUndefined()
  })

  it('localStorage が読めなくても例外を投げず、匿名pingは送る', async () => {
    stubStorage({
      getItem: () => {
        throw new Error('storage blocked')
      },
    })

    await expect(sendActivePing(API_BASE)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
