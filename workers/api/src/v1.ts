/**
 * Con-Sche 連携API v1
 *
 * 認証:   Authorization: Bearer cs_live_...（登録時に発行されたAPIコード）
 * 課金単位: 読み取り系 = 2pt / 更新系 = 3pt（読み:更新 = 2/3 : 1）
 *          無料枠 = 月90pt（更新30回、または読み取り45回相当）
 * ログ:   全リクエストを usage_logs に記録（誰が・いつ・何を・何pt）
 *
 * POST /api/v1/cpm      [2pt] 工程データからCPM計算（最早/最遅・フロート・クリティカルパス）
 * POST /api/v1/convert  [2pt] 工程JSON → .csaファイル / .csaファイル → 工程JSON
 * GET  /api/v1/usage    [0pt] 自分のキーの当月利用量照会
 *
 * CPM計算エンジン・ファイル形式はエディタ本体（src/utils/）と同一コードを使用。
 */

import { calculateADMCPM, detectCycle } from '../../../src/utils/admCpm'
import { isNonWorkday } from '../../../src/utils/dateUtils'
import { exportFullPackage, importPackage } from '../../../src/utils/conScheFile'
import { createEventNode, createActivity, createProjectSettings } from '../../../src/types/adm'
import type { EventNode, Activity } from '../../../src/types/adm'
import type { ProjectCalendar, Holiday } from '../../../src/types/calendar'
import type { ADMExportData } from '../../../src/stores/admStore'
import { sha256Hex, json, corsHeaders, type Env } from './index'

// ======================================
// 従量カウント設定
// ======================================

export const WEIGHT_READ = 2 // 読み取り系（計算・変換・参照）
export const WEIGHT_UPDATE = 3 // 更新系（将来のデータ保存系エンドポイント用）
export const MONTHLY_LIMIT_POINTS = 90 // 月間無料枠 = 更新30回（読み取りなら45回）相当

interface AuthInfo {
  keyId: string
  customerId: string
  plan: string
}

// ======================================
// 認証・計測
// ======================================

async function authenticate(request: Request, env: Env): Promise<AuthInfo | Response> {
  const header = request.headers.get('Authorization') ?? ''
  const match = header.match(/^Bearer\s+(cs_live_[0-9a-f]+)$/i)
  if (!match) {
    return json(env, 401, {
      error: 'APIコードが必要です。Authorization: Bearer cs_live_... の形式で指定してください。',
    })
  }
  const keyHash = await sha256Hex(match[1])
  const row = await env.DB.prepare(
    'SELECT id, customer_id, plan, status FROM api_keys WHERE key_hash = ?1'
  ).bind(keyHash).first<{ id: string; customer_id: string; plan: string; status: string }>()

  if (!row) {
    return json(env, 401, { error: 'APIコードが無効です。' })
  }
  if (row.status !== 'active') {
    return json(env, 403, { error: 'このAPIコードは停止されています。お問い合わせください。' })
  }
  return { keyId: row.id, customerId: row.customer_id, plan: row.plan }
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

async function getUsedPoints(env: Env, keyId: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT count FROM usage WHERE key_id = ?1 AND month = ?2'
  ).bind(keyId, currentMonth()).first<{ count: number }>()
  return row?.count ?? 0
}

/** 利用ログを記録し、課金ポイントがあれば当月集計に加算する */
async function recordUsage(
  env: Env,
  keyId: string,
  endpoint: string,
  status: number,
  units: number,
  ip: string
): Promise<void> {
  const now = new Date().toISOString()
  const statements = [
    env.DB.prepare(
      'INSERT INTO usage_logs (id, key_id, endpoint, status, units, ip, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
    ).bind(crypto.randomUUID(), keyId, endpoint, status, units, ip, now),
  ]
  if (units > 0) {
    statements.push(
      env.DB.prepare(
        'INSERT INTO usage (key_id, month, count) VALUES (?1, ?2, ?3) ON CONFLICT(key_id, month) DO UPDATE SET count = count + excluded.count'
      ).bind(keyId, currentMonth(), units)
    )
  }
  await env.DB.batch(statements)
}

// ======================================
// 稼働日 → カレンダー日付の変換
// ======================================

interface CalendarInput {
  startDate: string // YYYY-MM-DD（工程の起点。第1稼働日はこの日以降の最初の稼働日）
  workDays?: number[] // 0=日〜6=土。省略時は月〜金
  holidays?: Array<{ date: string; name?: string; status?: 'holiday' | 'workday' }>
}

function buildCalendar(input: CalendarInput): ProjectCalendar {
  const holidays: Holiday[] = (input.holidays ?? []).map((h) => ({
    date: h.date,
    name: h.name ?? '',
    type: 'custom',
    status: h.status ?? 'holiday',
  }))
  return {
    id: 'api',
    projectId: 'api',
    startDate: input.startDate,
    workDays: input.workDays ?? [1, 2, 3, 4, 5],
    holidays,
    events: [],
  }
}

/**
 * 稼働日インデックス → 日付(ISO) の対応表を作る。
 * 戻り値の [i] は「第 i+1 稼働日」の日付。
 * 例: ET=0 の結合点から始まる作業の開始日は [0]、EF=5 の作業の終了日は [4]。
 */
function buildWorkdayDates(calendar: ProjectCalendar, count: number): string[] {
  const dates: string[] = []
  const cursor = new Date(`${calendar.startDate}T00:00:00Z`)
  let guard = 0
  while (dates.length < count && guard < 5000) {
    if (!isNonWorkday(cursor, calendar)) {
      dates.push(cursor.toISOString().slice(0, 10))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    guard++
  }
  return dates
}

// ======================================
// POST /api/v1/cpm
// ======================================

interface CpmRequest {
  nodes: Array<{ id: string; number?: number; label?: string }>
  activities: Array<{
    id: string
    name?: string
    fromNodeId: string
    toNodeId: string
    duration: number
    isDummy?: boolean
  }>
  calendar?: CalendarInput
}

function validateCpmInput(body: CpmRequest): string | null {
  if (!Array.isArray(body.nodes) || body.nodes.length === 0) return 'nodes は1件以上の配列で指定してください。'
  if (!Array.isArray(body.activities)) return 'activities は配列で指定してください。'
  if (body.nodes.length > 2000 || body.activities.length > 5000) return 'データが大きすぎます（nodes上限2000件・activities上限5000件）。'

  const ids = new Set<string>()
  for (const n of body.nodes) {
    if (!n.id || typeof n.id !== 'string') return 'nodes の各要素に id (string) が必要です。'
    if (ids.has(n.id)) return `ノードID "${n.id}" が重複しています。`
    ids.add(n.id)
  }
  for (const a of body.activities) {
    if (!a.id || typeof a.id !== 'string') return 'activities の各要素に id (string) が必要です。'
    if (!ids.has(a.fromNodeId)) return `作業 "${a.id}" の fromNodeId "${a.fromNodeId}" が nodes に存在しません。`
    if (!ids.has(a.toNodeId)) return `作業 "${a.id}" の toNodeId "${a.toNodeId}" が nodes に存在しません。`
    if (typeof a.duration !== 'number' || !Number.isFinite(a.duration) || a.duration < 0) {
      return `作業 "${a.id}" の duration は0以上の数値で指定してください。`
    }
  }
  if (body.calendar && !/^\d{4}-\d{2}-\d{2}$/.test(body.calendar.startDate ?? '')) {
    return 'calendar.startDate は YYYY-MM-DD 形式で指定してください。'
  }
  return null
}

async function handleCpm(request: Request, env: Env): Promise<Response> {
  let body: CpmRequest
  try {
    body = await request.json()
  } catch {
    return json(env, 400, { error: 'リクエストボディはJSONで指定してください。' })
  }

  const validationError = validateCpmInput(body)
  if (validationError) return json(env, 400, { error: validationError })

  const nodes: EventNode[] = body.nodes.map((n, i) =>
    createEventNode({ id: n.id, number: n.number ?? i + 1, label: n.label })
  )
  const activities: Activity[] = body.activities.map((a) =>
    createActivity({
      id: a.id,
      name: a.name ?? a.id,
      fromNodeId: a.fromNodeId,
      toNodeId: a.toNodeId,
      duration: a.duration,
      isDummy: a.isDummy ?? a.duration === 0,
    })
  )

  if (detectCycle(nodes, activities)) {
    return json(env, 422, { error: '作業の依存関係に循環があります。fromNodeId/toNodeIdを確認してください。' })
  }

  const result = calculateADMCPM(nodes, activities)

  // カレンダーが指定されていれば稼働日番号を日付に変換
  let dates: string[] | null = null
  if (body.calendar) {
    const calendar = buildCalendar(body.calendar)
    dates = buildWorkdayDates(calendar, result.projectDuration + 2)
  }

  return json(env, 200, {
    projectDuration: result.projectDuration, // 全体工期（稼働日数）
    projectEndDate: dates ? dates[Math.max(result.projectDuration - 1, 0)] ?? null : undefined,
    criticalPath: result.criticalPath,
    nodes: result.nodes.map((n) => ({
      id: n.id,
      number: n.number,
      earliestTime: n.earliestTime,
      latestTime: n.latestTime,
      slack: n.slack,
      // この結合点から後続作業を最早/最遅で開始できる日
      earliestStartDate: dates ? dates[n.earliestTime] ?? null : undefined,
      latestStartDate: dates ? dates[n.latestTime] ?? null : undefined,
    })),
    activities: result.activities.map((a) => ({
      id: a.id,
      name: a.name,
      duration: a.duration,
      es: a.es,
      ef: a.ef,
      ls: a.ls,
      lf: a.lf,
      totalFloat: a.totalFloat,
      freeFloat: a.freeFloat,
      isCritical: a.isCritical,
      startDate: dates ? dates[a.es] ?? null : undefined,
      endDate: dates ? dates[Math.max(a.ef - 1, a.es)] ?? null : undefined,
    })),
  })
}

// ======================================
// POST /api/v1/convert
// ======================================

interface ConvertJsonRequest {
  name?: string
  calendar?: CalendarInput
  nodes: Array<{ id: string; number?: number; label?: string; position?: { x: number; y: number } }>
  activities: Array<{
    id: string
    name?: string
    fromNodeId: string
    toNodeId: string
    duration: number
    isDummy?: boolean
    rowIndex?: number
  }>
}

/** 工程JSON → .csa（エディタで開けるファイル） */
async function convertJsonToCsa(body: ConvertJsonRequest, env: Env): Promise<Response> {
  const validationError = validateCpmInput(body as CpmRequest)
  if (validationError) return json(env, 400, { error: validationError })

  const startDate = body.calendar?.startDate ?? new Date().toISOString().slice(0, 10)
  const calendar = buildCalendar({ ...(body.calendar ?? { startDate }), startDate })

  const settings = createProjectSettings({
    id: crypto.randomUUID(),
    name: body.name ?? 'API生成工程表',
    startDate,
  })

  const nodes: EventNode[] = body.nodes.map((n, i) =>
    createEventNode({ id: n.id, number: n.number ?? i + 1, label: n.label, position: n.position })
  )
  const activities: Activity[] = body.activities.map((a) =>
    createActivity({
      id: a.id,
      name: a.name ?? a.id,
      fromNodeId: a.fromNodeId,
      toNodeId: a.toNodeId,
      duration: a.duration,
      isDummy: a.isDummy ?? a.duration === 0,
      rowIndex: a.rowIndex,
    })
  )

  if (detectCycle(nodes, activities)) {
    return json(env, 422, { error: '作業の依存関係に循環があります。fromNodeId/toNodeIdを確認してください。' })
  }

  // 位置が未指定のノードはCPM結果から自動配置（X=日付位置、Y=行位置。エディタで調整可能）
  const result = calculateADMCPM(nodes, activities)
  const dates = buildWorkdayDates(calendar, result.projectDuration + 2)
  const startMs = new Date(`${startDate}T00:00:00Z`).getTime()
  const rowY = (row: number) => 20 + row * settings.rowHeight + settings.rowHeight / 2

  const nodeRow = new Map<string, number>()
  body.activities.forEach((a, i) => {
    const row = a.rowIndex ?? i % settings.displayRows
    if (!nodeRow.has(a.fromNodeId)) nodeRow.set(a.fromNodeId, row)
    if (!nodeRow.has(a.toNodeId)) nodeRow.set(a.toNodeId, row)
  })

  const positionedNodes = result.nodes.map((n, i) => {
    const original = body.nodes[i]
    if (original?.position) return { ...n, position: original.position }
    const dateStr = dates[n.earliestTime] ?? dates[dates.length - 1] ?? startDate
    const diffDays = Math.floor((new Date(`${dateStr}T00:00:00Z`).getTime() - startMs) / 86_400_000)
    return { ...n, position: { x: diffDays * settings.dayWidth, y: rowY(nodeRow.get(n.id) ?? 0) } }
  })

  const data: ADMExportData = {
    version: '3.0.0',
    exportedAt: new Date().toISOString(),
    projectSettings: settings,
    calendar: { workDays: calendar.workDays, holidays: calendar.holidays },
    nodes: positionedNodes,
    activities: result.activities,
    hierarchy: { zones: [], rooms: [], detailCategories: [] },
    masters: { zones: [], rooms: [], details: [] },
    textboxes: [],
  }

  const blob = await exportFullPackage(data)
  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="con-sche_${startDate}.csa"`,
      ...corsHeaders(env),
    },
  })
}

/** .csa/.csl → 工程JSON */
async function convertCsaToJson(request: Request, env: Env): Promise<Response> {
  const buffer = await request.arrayBuffer()
  if (buffer.byteLength === 0) return json(env, 400, { error: 'ファイルが空です。' })
  if (buffer.byteLength > 10 * 1024 * 1024) return json(env, 400, { error: 'ファイルが大きすぎます（上限10MB）。' })
  try {
    const file = new File([buffer], 'upload.csa')
    const result = await importPackage(file)
    return json(env, 200, result)
  } catch (e) {
    return json(env, 422, {
      error: `.csa/.cslファイルとして読み込めませんでした: ${e instanceof Error ? e.message : '不明なエラー'}`,
    })
  }
}

async function handleConvert(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get('Content-Type') ?? ''
  if (contentType.includes('application/json')) {
    let body: ConvertJsonRequest
    try {
      body = await request.json()
    } catch {
      return json(env, 400, { error: 'リクエストボディはJSONで指定してください。' })
    }
    return convertJsonToCsa(body, env)
  }
  // application/zip / application/octet-stream → .csa解凍
  return convertCsaToJson(request, env)
}

// ======================================
// ルーティング
// ======================================

const ROUTES: Record<string, { weight: number; handler: (req: Request, env: Env) => Promise<Response> }> = {
  'POST /api/v1/cpm': { weight: WEIGHT_READ, handler: handleCpm },
  'POST /api/v1/convert': { weight: WEIGHT_READ, handler: handleConvert },
}

export async function handleV1(request: Request, env: Env, url: URL): Promise<Response> {
  const auth = await authenticate(request, env)
  if (auth instanceof Response) return auth
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const path = url.pathname

  // 利用量照会（課金なし）
  if (path === '/api/v1/usage' && request.method === 'GET') {
    const used = await getUsedPoints(env, auth.keyId)
    await recordUsage(env, auth.keyId, path, 200, 0, ip)
    return json(env, 200, {
      month: currentMonth(),
      usedPoints: used,
      limitPoints: MONTHLY_LIMIT_POINTS,
      note: '読み取り系=2pt、更新系=3pt。無料枠は月90pt（更新30回または読み取り45回相当）。',
    })
  }

  const route = ROUTES[`${request.method} ${path}`]
  if (!route) {
    return json(env, 404, { error: 'エンドポイントが見つかりません。' })
  }

  // 無料枠チェック
  const used = await getUsedPoints(env, auth.keyId)
  if (used + route.weight > MONTHLY_LIMIT_POINTS) {
    await recordUsage(env, auth.keyId, path, 429, 0, ip)
    return json(env, 429, {
      error: '今月の無料枠を超えました。上限の引き上げはお問い合わせください。',
      usedPoints: used,
      limitPoints: MONTHLY_LIMIT_POINTS,
    })
  }

  let response: Response
  try {
    response = await route.handler(request, env)
  } catch (e) {
    console.error('[v1] handler error:', e)
    response = json(env, 500, { error: '処理に失敗しました。時間をおいて再度お試しください。' })
  }

  // 成功時のみ課金、全リクエストをログ
  const charged = response.status < 400 ? route.weight : 0
  await recordUsage(env, auth.keyId, path, response.status, charged, ip)
  response.headers.set('X-ConSche-Usage', `${used + charged}/${MONTHLY_LIMIT_POINTS}`)
  return response
}
