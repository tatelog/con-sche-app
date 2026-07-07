import { describe, it, expect, beforeEach } from 'vitest'
import { useADMStore } from '@/stores/admStore'
import type { ADMExportData } from '@/stores/admStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { createProjectSettings, createEventNode, createActivity } from '@/types/adm'

// ======================================
// エクスポート / インポート テスト
// ======================================

// テスト用フィクスチャ（3結合点・2作業の最小工程）
function makeFixture(): ADMExportData {
  return {
    version: '3.0.0',
    exportedAt: new Date().toISOString(),
    projectSettings: createProjectSettings({ id: 'fixture', name: 'テスト工程表' }),
    calendar: { workDays: [1, 2, 3, 4, 5], holidays: [] },
    nodes: [
      createEventNode({ id: 'n1', number: 1, position: { x: 0, y: 60 } }),
      createEventNode({ id: 'n2', number: 2, position: { x: 150, y: 60 } }),
      createEventNode({ id: 'n3', number: 3, position: { x: 300, y: 60 } }),
    ],
    activities: [
      createActivity({ id: 'a1', name: '作業1', fromNodeId: 'n1', toNodeId: 'n2', duration: 5, rowIndex: 0 }),
      createActivity({ id: 'a2', name: '作業2', fromNodeId: 'n2', toNodeId: 'n3', duration: 3, rowIndex: 0 }),
    ],
    hierarchy: { zones: [], rooms: [], detailCategories: [] },
    masters: { zones: [], rooms: [], details: [] },
  }
}

beforeEach(() => {
  useADMStore.getState().clearAll()
  // calendarStore もリセット（null に戻す）
  useCalendarStore.setState({ calendar: null })
})

describe('exportFullData / importFullData', () => {
  // --------------------------------------------------
  // 1. 基本ラウンドトリップ
  // --------------------------------------------------
  it('import → export → clearAll → import で元のデータが復元される', () => {
    // フィクスチャを投入
    useADMStore.getState().importFullData(makeFixture())

    const stateBefore = useADMStore.getState()
    const nodeCountBefore = stateBefore.nodes.size
    const activityCountBefore = stateBefore.activities.size

    // データが投入されていることを確認
    expect(nodeCountBefore).toBeGreaterThan(0)
    expect(activityCountBefore).toBeGreaterThan(0)

    // エクスポート
    const exported = useADMStore.getState().exportFullData()

    // クリア
    useADMStore.getState().clearAll()
    expect(useADMStore.getState().nodes.size).toBe(0)
    expect(useADMStore.getState().activities.size).toBe(0)

    // インポート
    useADMStore.getState().importFullData(exported)

    const stateAfter = useADMStore.getState()
    expect(stateAfter.nodes.size).toBe(nodeCountBefore)
    expect(stateAfter.activities.size).toBe(activityCountBefore)
  })

  // --------------------------------------------------
  // 2. v2フォーマットチェック
  // --------------------------------------------------
  it('exportFullData() の結果が v2 フォーマットに準拠している', () => {
    useADMStore.getState().importFullData(makeFixture())

    const exported = useADMStore.getState().exportFullData()

    // version
    expect(exported.version).toBe('3.0.0')

    // exportedAt が ISO 形式の文字列
    expect(typeof exported.exportedAt).toBe('string')
    expect(new Date(exported.exportedAt).toISOString()).toBe(exported.exportedAt)

    // calendar.workDays が number[]（boolean[] ではない）
    expect(Array.isArray(exported.calendar.workDays)).toBe(true)
    for (const day of exported.calendar.workDays) {
      expect(typeof day).toBe('number')
    }
  })

  // --------------------------------------------------
  // 3. v1後方互換性
  // --------------------------------------------------
  it('v1 形式（workDays: boolean[]）のデータをインポートすると number[] に変換される', () => {
    const v1Data: ADMExportData = {
      version: '1.0.0',
      exportedAt: '2026-02-07T00:00:00.000Z',
      projectSettings: createProjectSettings({ id: 'test', name: 'Test' }),
      calendar: {
        workDays: [true, true, true, true, true, false, false] as any, // v1 形式
        holidays: [],
      },
      nodes: [],
      activities: [],
      hierarchy: { zones: [], rooms: [], detailCategories: [] },
      masters: { zones: [], rooms: [], details: [] },
    }

    useADMStore.getState().importFullData(v1Data)

    // calendarStore 上の workDays が number[] に変換されている
    const calendar = useCalendarStore.getState().calendar
    expect(calendar).not.toBeNull()
    expect(Array.isArray(calendar!.workDays)).toBe(true)
    for (const day of calendar!.workDays) {
      expect(typeof day).toBe('number')
    }

    // v1 の [true,true,true,true,true,false,false] は index 0〜4 が true
    // → number[] では [0,1,2,3,4]
    expect(calendar!.workDays).toEqual([0, 1, 2, 3, 4])
  })

  // --------------------------------------------------
  // 4. 空データのインポート
  // --------------------------------------------------
  it('nodes=[], activities=[] の空データをインポートできる', () => {
    // 先にフィクスチャを入れてから空データで上書き
    useADMStore.getState().importFullData(makeFixture())
    expect(useADMStore.getState().nodes.size).toBeGreaterThan(0)

    const emptyData: ADMExportData = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      projectSettings: createProjectSettings({ id: 'empty', name: 'Empty' }),
      calendar: {
        workDays: [1, 2, 3, 4, 5],
        holidays: [],
      },
      nodes: [],
      activities: [],
      hierarchy: { zones: [], rooms: [], detailCategories: [] },
      masters: { zones: [], rooms: [], details: [] },
    }

    useADMStore.getState().importFullData(emptyData)

    expect(useADMStore.getState().nodes.size).toBe(0)
    expect(useADMStore.getState().activities.size).toBe(0)
  })

  // --------------------------------------------------
  // 5. プロジェクト設定の保持
  // --------------------------------------------------
  it('export → import でプロジェクト設定名が保持される', () => {
    useADMStore.getState().importFullData(makeFixture())

    const exported = useADMStore.getState().exportFullData()
    const projectNameBefore = exported.projectSettings.name

    // 設定名が空でないことを確認
    expect(projectNameBefore).toBeTruthy()

    // クリアしてインポート
    useADMStore.getState().clearAll()
    useADMStore.getState().importFullData(exported)

    const projectNameAfter = useADMStore.getState().projectSettings.name
    expect(projectNameAfter).toBe(projectNameBefore)
  })
})
