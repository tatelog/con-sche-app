import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useADMStore } from '@/stores/admStore'
import type { ADMExportData } from '@/stores/admStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { createProjectSettings, createEventNode, createActivity } from '@/types/adm'
import {
  getScheduleTool,
  getActivityTool,
  shiftActivityTool,
  updateActivityDurationTool,
  validateScheduleTool,
  getActivitiesOnDateTool,
  findActivitiesTool,
} from '@/webmcp/tools'
import { registerConScheTools, CON_SCHE_TOOL_NAMES } from '@/webmcp/register'

// ======================================
// WebMCP ページ内ツール テスト
//
// 仕様:
// 1. get_schedule       開いている工程表の要約（名前・工期・作業一覧）を返す。空なら作業0件
// 2. get_activity       作業の詳細+シフト可能範囲+影響チェーン。不明IDはエラー
// 3. shift_activity     作業をN日シフト（undo履歴保存）。不明ID・範囲外はエラー
// 4. update_activity_duration  所要日数変更→CPM再計算。1未満・不明IDはエラー
// 5. validate_schedule  ループ検出。正常なら ok
// 6. registerConScheTools  document.modelContext が無い環境では何もしない（例外を投げない）
// ======================================

// フィクスチャ: 3結合点・3作業（a1→a2 がクリティカル、a3 は並行でフロートあり）
//   n1 --a1(5日)--> n2 --a2(3日)--> n3
//   n1 ------------a3(2日)--------> n3   (フロート6日)
// 行階層: rowIndex 0 = A工区/3F/躯体（a1, a2）、rowIndex 1 = B工区/2F/外構（a3）
function makeFixture(): ADMExportData {
  return {
    version: '3.0.0',
    exportedAt: new Date().toISOString(),
    projectSettings: createProjectSettings({
      id: 'fixture',
      name: 'テスト工程表',
      startDate: '2026-08-03',
      endDate: '2026-10-31',
    }),
    calendar: { workDays: [0, 1, 2, 3, 4, 5, 6], holidays: [] },
    nodes: [
      createEventNode({ id: 'n1', number: 1, position: { x: 0, y: 60 } }),
      createEventNode({ id: 'n2', number: 2, position: { x: 150, y: 60 } }),
      createEventNode({ id: 'n3', number: 3, position: { x: 300, y: 60 } }),
    ],
    activities: [
      createActivity({ id: 'a1', name: '躯体工事', fromNodeId: 'n1', toNodeId: 'n2', duration: 5, rowIndex: 0 }),
      createActivity({ id: 'a2', name: '内装工事', fromNodeId: 'n2', toNodeId: 'n3', duration: 3, rowIndex: 0 }),
      createActivity({ id: 'a3', name: '外構工事', fromNodeId: 'n1', toNodeId: 'n3', duration: 2, rowIndex: 1 }),
    ],
    hierarchy: {
      zones: [
        { id: 'z1', name: 'A工区', order: 0 },
        { id: 'z2', name: 'B工区', order: 1 },
      ],
      rooms: [
        { id: 'r1', zoneId: 'z1', name: '3F', order: 0 },
        { id: 'r2', zoneId: 'z2', name: '2F', order: 0 },
      ],
      detailCategories: [
        { id: 'd1', roomId: 'r1', name: '躯体', order: 0 },
        { id: 'd2', roomId: 'r2', name: '外構', order: 0 },
      ],
    },
    masters: { zones: [], rooms: [], details: [] },
  }
}

function loadFixture() {
  useADMStore.getState().importFullData(makeFixture())
  useADMStore.getState().recalculateCPM()
}

/** MCPツール結果からテキストを取り出してJSONパースする */
function parseResult(result: { content: Array<{ type: string; text: string }> }): any {
  return JSON.parse(result.content[0].text)
}

beforeEach(() => {
  useADMStore.getState().clearAll()
  useCalendarStore.setState({ calendar: null })
})

// --------------------------------------------------
// 1. get_schedule
// --------------------------------------------------
describe('get_schedule', () => {
  it('工程表があるとき、プロジェクト名・作業一覧・工期を返す', async () => {
    loadFixture()
    const result = await getScheduleTool.execute({})
    const data = parseResult(result)

    expect(data.projectName).toBe('テスト工程表')
    expect(data.activities).toHaveLength(3)
    expect(data.projectDuration).toBe(8) // 5+3 がクリティカルパス
    expect(data.nodeCount).toBe(3)

    const a1 = data.activities.find((a: any) => a.id === 'a1')
    expect(a1.name).toBe('躯体工事')
    expect(a1.duration).toBe(5)
    expect(a1.isCritical).toBe(true)

    const a3 = data.activities.find((a: any) => a.id === 'a3')
    expect(a3.isCritical).toBe(false)
    expect(a3.totalFloat).toBe(6)
  })

  it('工程表が空のとき、作業0件の要約を返す（エラーにしない）', async () => {
    const result = await getScheduleTool.execute({})
    const data = parseResult(result)
    expect(data.activities).toHaveLength(0)
    expect(data.nodeCount).toBe(0)
  })
})

// --------------------------------------------------
// 2. get_activity
// --------------------------------------------------
describe('get_activity', () => {
  it('存在する作業IDの詳細（フロート・シフト可能範囲）を返す', async () => {
    loadFixture()
    const result = await getActivityTool.execute({ activityId: 'a3' })
    const data = parseResult(result)

    expect(data.name).toBe('外構工事')
    expect(data.duration).toBe(2)
    expect(data.totalFloat).toBe(6)
    expect(data.isCritical).toBe(false)
    expect(data.shiftRange).toBeDefined()
    expect(data.shiftRange.maxRight).toBeGreaterThan(0) // フロート分右にずらせる
  })

  it('存在しない作業IDはエラーを返す', async () => {
    loadFixture()
    const result = await getActivityTool.execute({ activityId: 'nonexistent' })
    expect(result.isError).toBe(true)
  })
})

// --------------------------------------------------
// 3. shift_activity
// --------------------------------------------------
describe('shift_activity', () => {
  it('フロートのある作業をシフトすると位置が変わり、シフト後の状態を返す', async () => {
    loadFixture()
    const before = useADMStore.getState().getActivity('a3')!
    const beforeFromX = useADMStore.getState().getNode(before.fromNodeId)!.position.x

    const result = await shiftActivityTool.execute({ activityId: 'a3', shiftDays: 2 })
    expect(result.isError).toBeUndefined()

    const after = useADMStore.getState().getActivity('a3')!
    const afterFromX = useADMStore.getState().getNode(after.fromNodeId)!.position.x
    expect(afterFromX).toBeGreaterThan(beforeFromX)
  })

  it('シフト後にundoで元に戻せる（履歴が保存されている）', async () => {
    loadFixture()
    const beforeFromX = useADMStore.getState().getNode('n1')!.position.x

    await shiftActivityTool.execute({ activityId: 'a3', shiftDays: 2 })
    useADMStore.getState().undo()

    const restoredX = useADMStore.getState().getNode('n1')!.position.x
    expect(restoredX).toBe(beforeFromX)
  })

  it('存在しない作業IDはエラーを返す', async () => {
    loadFixture()
    const result = await shiftActivityTool.execute({ activityId: 'nonexistent', shiftDays: 1 })
    expect(result.isError).toBe(true)
  })

  it('シフト可能範囲を超える量はエラーを返し、可能範囲を伝える', async () => {
    loadFixture()
    const result = await shiftActivityTool.execute({ activityId: 'a3', shiftDays: 9999 })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('範囲')
  })

  // シフトで動かした作業は、元の結合点から切り離して専用の結合点に付け替える。
  // このとき先行と繋ぎ直さないと、その結合点は工程の起点と同じ扱いになり、
  // CPM の値が丸ごと壊れる。座標しか見ていないと気づけない。
  it('シフトした作業は先行との繋がりを保つ（起点ノードが孤立しない）', async () => {
    loadFixture()

    await shiftActivityTool.execute({ activityId: 'a2', shiftDays: 1 })

    const a2 = useADMStore.getState().getActivity('a2')!
    const incoming = useADMStore.getState().getActivitiesToNode(a2.fromNodeId)
    expect(incoming.length).toBeGreaterThan(0)
  })

  it('シフトしても先行のある作業の es が工程の先頭に落ちない', async () => {
    loadFixture()
    // a2 は a1(5日) の後続なので es=5。ここが 0 に落ちるのが元のバグ
    expect(useADMStore.getState().getActivity('a2')!.es).toBe(5)

    await shiftActivityTool.execute({ activityId: 'a2', shiftDays: 1 })

    expect(useADMStore.getState().getActivity('a2')!.es).toBe(5)
  })

  it('シフトしても先行作業自体の日程は動かない', async () => {
    loadFixture()
    await shiftActivityTool.execute({ activityId: 'a3', shiftDays: 2 })

    const a1 = useADMStore.getState().getActivity('a1')!
    expect(a1.es).toBe(0)
    expect(a1.ef).toBe(5)
  })

  it('フロート内のシフトでは工期が伸びない', async () => {
    loadFixture()
    const before = useADMStore.getState().projectDuration

    await shiftActivityTool.execute({ activityId: 'a3', shiftDays: 2 })

    expect(useADMStore.getState().projectDuration).toBe(before)
  })

  // 日付は結合点の x 座標から引く（xToDate）。ちょうど N 日ぶん動いていること。
  it('右に2日シフトすると起点が2日ぶん（dayWidth×2）右へ動く', async () => {
    loadFixture()
    const dayWidth = useADMStore.getState().projectSettings.dayWidth
    const before = useADMStore.getState().getNode('n1')!.position.x

    await shiftActivityTool.execute({ activityId: 'a3', shiftDays: 2 })

    const a3 = useADMStore.getState().getActivity('a3')!
    const after = useADMStore.getState().getNode(a3.fromNodeId)!.position.x
    expect(after - before).toBe(dayWidth * 2)
  })

  it('undo で構造も位置も元に戻る', async () => {
    loadFixture()
    const beforeX = useADMStore.getState().getNode('n1')!.position.x
    const beforeActs = useADMStore.getState().activities.size
    const beforeNodes = useADMStore.getState().nodes.size

    await shiftActivityTool.execute({ activityId: 'a3', shiftDays: 2 })
    useADMStore.getState().undo()

    const a3 = useADMStore.getState().getActivity('a3')!
    expect(useADMStore.getState().getNode(a3.fromNodeId)!.position.x).toBe(beforeX)
    expect(useADMStore.getState().activities.size).toBe(beforeActs)
    expect(useADMStore.getState().nodes.size).toBe(beforeNodes)
  })
})

// --------------------------------------------------
// 4. update_activity_duration
// --------------------------------------------------
describe('update_activity_duration', () => {
  it('日数を変更するとCPMが再計算され、新しい工期を返す', async () => {
    loadFixture()
    const result = await updateActivityDurationTool.execute({ activityId: 'a1', duration: 7 })
    const data = parseResult(result)

    expect(data.projectDuration).toBe(10) // 7+3
    expect(useADMStore.getState().getActivity('a1')!.duration).toBe(7)
  })

  it('変更後にundoで元に戻せる', async () => {
    loadFixture()
    await updateActivityDurationTool.execute({ activityId: 'a1', duration: 7 })
    useADMStore.getState().undo()
    expect(useADMStore.getState().getActivity('a1')!.duration).toBe(5)
  })

  it('1未満の日数はエラーを返す', async () => {
    loadFixture()
    const result = await updateActivityDurationTool.execute({ activityId: 'a1', duration: 0 })
    expect(result.isError).toBe(true)
    expect(useADMStore.getState().getActivity('a1')!.duration).toBe(5) // 変わっていない
  })

  it('存在しない作業IDはエラーを返す', async () => {
    loadFixture()
    const result = await updateActivityDurationTool.execute({ activityId: 'nonexistent', duration: 3 })
    expect(result.isError).toBe(true)
  })
})

// --------------------------------------------------
// 5. validate_schedule
// --------------------------------------------------
describe('validate_schedule', () => {
  it('正常な工程表は ok を返す', async () => {
    loadFixture()
    const result = await validateScheduleTool.execute({})
    const data = parseResult(result)
    expect(data.ok).toBe(true)
    expect(data.issues).toHaveLength(0)
  })

  it('循環依存があると検出して報告する', async () => {
    // addActivity はサイクルを拒否するため、壊れたインポートデータを直接注入して再現する
    const fixture = makeFixture()
    fixture.activities.push(
      createActivity({ id: 'a-loop', name: '逆行作業', fromNodeId: 'n3', toNodeId: 'n1', duration: 1 })
    )
    useADMStore.getState().importFullData(fixture)

    const result = await validateScheduleTool.execute({})
    const data = parseResult(result)
    expect(data.ok).toBe(false)
    expect(data.issues.some((i: any) => i.type === 'cycle')).toBe(true)
  })

  it('作業と繋がっていない孤立ノードを検出する', async () => {
    loadFixture()
    useADMStore.getState().addNode({ x: 500, y: 200 }) // 孤立ノード

    const result = await validateScheduleTool.execute({})
    const data = parseResult(result)
    expect(data.ok).toBe(false)
    expect(data.issues.some((i: any) => i.type === 'isolated_node')).toBe(true)
  })
})

// --------------------------------------------------
// 6. get_activities_on_date
//
// フィクスチャの日付（開始 2026-08-03, dayWidth 30）:
//   n1 x=0   → 2026-08-03
//   n2 x=150 → 2026-08-08
//   n3 x=300 → 2026-08-13
//   a1 (n1→n2): 8/3〜8/7  a2 (n2→n3): 8/8〜8/12  a3 (n1→n3): 8/3〜8/12
// --------------------------------------------------
describe('get_activities_on_date', () => {
  it('指定日に実施中の作業だけを返す（開始〜終了の範囲判定）', async () => {
    loadFixture()
    const result = await getActivitiesOnDateTool.execute({ date: '2026-08-04' })
    const data = parseResult(result)

    const ids = data.activities.map((a: any) => a.id)
    expect(ids).toContain('a1')
    expect(ids).toContain('a3')
    expect(ids).not.toContain('a2') // a2は8/8開始でまだ先
    expect(data.date).toBe('2026-08-04')
  })

  it('後半の日付では後続作業が返る', async () => {
    loadFixture()
    const result = await getActivitiesOnDateTool.execute({ date: '2026-08-09' })
    const data = parseResult(result)

    const ids = data.activities.map((a: any) => a.id)
    expect(ids).toContain('a2')
    expect(ids).toContain('a3')
    expect(ids).not.toContain('a1') // a1は8/7で終了済み
  })

  it('工期の範囲外の日付では作業0件を返す（エラーにしない）', async () => {
    loadFixture()
    const result = await getActivitiesOnDateTool.execute({ date: '2026-12-01' })
    const data = parseResult(result)
    expect(data.activities).toHaveLength(0)
  })

  it('不正な日付形式はエラーを返す', async () => {
    loadFixture()
    const result = await getActivitiesOnDateTool.execute({ date: 'あした' })
    expect(result.isError).toBe(true)
  })
})

// --------------------------------------------------
// 7. find_activities
// --------------------------------------------------
describe('find_activities', () => {
  it('作業名の部分一致で検索し、開始日と「あと何日で開始か」を返す', async () => {
    loadFixture()
    const result = await findActivitiesTool.execute({ query: '内装', fromDate: '2026-08-01' })
    const data = parseResult(result)

    expect(data.matches).toHaveLength(1)
    const m = data.matches[0]
    expect(m.id).toBe('a2')
    expect(m.startDate).toBe('2026-08-08')
    expect(m.endDate).toBe('2026-08-12')
    expect(m.daysUntilStart).toBe(7) // 8/1から8/8まで7日
  })

  it('開始済みの作業は daysUntilStart が0以下になる', async () => {
    loadFixture()
    const result = await findActivitiesTool.execute({ query: '躯体', fromDate: '2026-08-05' })
    const data = parseResult(result)
    expect(data.matches[0].daysUntilStart).toBeLessThanOrEqual(0)
  })

  it('一致なしは空リストを返す（エラーにしない）', async () => {
    loadFixture()
    const result = await findActivitiesTool.execute({ query: 'コンクリート打設' })
    const data = parseResult(result)
    expect(data.matches).toHaveLength(0)
  })

  it('queryが空はエラーを返す', async () => {
    loadFixture()
    const result = await findActivitiesTool.execute({ query: '' })
    expect(result.isError).toBe(true)
  })

  it('工区名でも検索できる（行ヘッダーの位置情報にマッチ）', async () => {
    loadFixture()
    const result = await findActivitiesTool.execute({ query: 'A工区' })
    const data = parseResult(result)
    const ids = data.matches.map((m: any) => m.id)
    expect(ids).toContain('a1')
    expect(ids).toContain('a2')
    expect(ids).not.toContain('a3') // a3はB工区
  })

  it('複数語はAND検索（「2F 外構工事」→ B工区の外構工事だけ）', async () => {
    loadFixture()
    const result = await findActivitiesTool.execute({ query: '2F 外構工事' })
    const data = parseResult(result)
    expect(data.matches).toHaveLength(1)
    expect(data.matches[0].id).toBe('a3')
  })

  it('検索結果に工区・階の位置情報が含まれる', async () => {
    loadFixture()
    const result = await findActivitiesTool.execute({ query: '躯体工事' })
    const data = parseResult(result)
    expect(data.matches[0].location).toEqual(
      expect.objectContaining({ zone: 'A工区', floor: '3F' })
    )
  })
})

// --------------------------------------------------
// 8. registerConScheTools
// --------------------------------------------------
describe('registerConScheTools', () => {
  it('document が無い環境（SSR等）では何もせず、例外を投げない', () => {
    expect(() => registerConScheTools()).not.toThrow()
  })

  it('document.modelContext が無いブラウザでは登録せず、例外を投げない', () => {
    ;(globalThis as any).document = {}
    try {
      expect(() => registerConScheTools()).not.toThrow()
    } finally {
      delete (globalThis as any).document
    }
  })

  it('document.modelContext があれば5つのツールを登録する', () => {
    const registerTool = vi.fn()
    ;(globalThis as any).document = { modelContext: { registerTool } }
    try {
      registerConScheTools()
      expect(registerTool).toHaveBeenCalledTimes(CON_SCHE_TOOL_NAMES.length)
      const names = registerTool.mock.calls.map((c) => c[0].name)
      expect(names).toEqual(expect.arrayContaining([...CON_SCHE_TOOL_NAMES]))
    } finally {
      delete (globalThis as any).document
    }
  })
})
