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
    hierarchy: { zones: [], rooms: [], detailCategories: [] },
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
// 6. registerConScheTools
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
