import { describe, it, expect } from 'vitest'
import { calculateADMCPM, detectCycle } from '@/utils/admCpm'
import { createEventNode, createActivity } from '@/types/adm'
import type { EventNode, Activity } from '@/types/adm'

// ======================================
// ヘルパー関数
// ======================================

function makeNode(id: string, number: number): EventNode {
  return createEventNode({ id, number, position: { x: 0, y: 0 } })
}

function makeActivity(
  id: string,
  from: string,
  to: string,
  duration: number,
  isDummy = false
): Activity {
  return createActivity({
    id,
    name: `Activity ${id}`,
    fromNodeId: from,
    toNodeId: to,
    duration,
    isDummy,
  })
}

// ======================================
// calculateADMCPM テスト
// ======================================

describe('calculateADMCPM', () => {
  it('空入力の場合、projectDuration=0, criticalPath=[] を返す', () => {
    const result = calculateADMCPM([], [])

    expect(result.projectDuration).toBe(0)
    expect(result.criticalPath).toEqual([])
    expect(result.nodes).toEqual([])
    expect(result.activities).toEqual([])
  })

  it('単一作業: N1→N2, duration=5 の場合、projectDuration=5 でクリティカル', () => {
    const nodes = [makeNode('N1', 1), makeNode('N2', 2)]
    const activities = [makeActivity('A1', 'N1', 'N2', 5)]

    const result = calculateADMCPM(nodes, activities)

    expect(result.projectDuration).toBe(5)

    // ノードの最早・最遅時刻
    const n1 = result.nodes.find((n) => n.id === 'N1')!
    const n2 = result.nodes.find((n) => n.id === 'N2')!
    expect(n1.earliestTime).toBe(0)
    expect(n1.latestTime).toBe(0)
    expect(n2.earliestTime).toBe(5)
    expect(n2.latestTime).toBe(5)

    // 作業がクリティカル
    const a1 = result.activities.find((a) => a.id === 'A1')!
    expect(a1.isCritical).toBe(true)
    expect(a1.es).toBe(0)
    expect(a1.ef).toBe(5)
    expect(a1.ls).toBe(0)
    expect(a1.lf).toBe(5)
    expect(a1.totalFloat).toBe(0)
    expect(a1.freeFloat).toBe(0)

    expect(result.criticalPath).toContain('A1')
  })

  it('直列: N1→N2→N3, duration=3,4 の場合、projectDuration=7 で両方クリティカル', () => {
    const nodes = [makeNode('N1', 1), makeNode('N2', 2), makeNode('N3', 3)]
    const activities = [
      makeActivity('A1', 'N1', 'N2', 3),
      makeActivity('A2', 'N2', 'N3', 4),
    ]

    const result = calculateADMCPM(nodes, activities)

    expect(result.projectDuration).toBe(7)

    // ノードの時刻
    const n1 = result.nodes.find((n) => n.id === 'N1')!
    const n2 = result.nodes.find((n) => n.id === 'N2')!
    const n3 = result.nodes.find((n) => n.id === 'N3')!
    expect(n1.earliestTime).toBe(0)
    expect(n1.latestTime).toBe(0)
    expect(n2.earliestTime).toBe(3)
    expect(n2.latestTime).toBe(3)
    expect(n3.earliestTime).toBe(7)
    expect(n3.latestTime).toBe(7)

    // 両方クリティカル
    const a1 = result.activities.find((a) => a.id === 'A1')!
    const a2 = result.activities.find((a) => a.id === 'A2')!
    expect(a1.isCritical).toBe(true)
    expect(a2.isCritical).toBe(true)
    expect(result.criticalPath).toContain('A1')
    expect(result.criticalPath).toContain('A2')
  })

  it('並列: N1→N2(d=5), N1→N3(d=3), N2→N4(d=0), N3→N4(d=0) の場合、projectDuration=5, float=2', () => {
    const nodes = [
      makeNode('N1', 1),
      makeNode('N2', 2),
      makeNode('N3', 3),
      makeNode('N4', 4),
    ]
    const activities = [
      makeActivity('A1', 'N1', 'N2', 5), // 長いパス
      makeActivity('A2', 'N1', 'N3', 3), // 短いパス
      makeActivity('A3', 'N2', 'N4', 0), // N2→N4
      makeActivity('A4', 'N3', 'N4', 0), // N3→N4
    ]

    const result = calculateADMCPM(nodes, activities)

    expect(result.projectDuration).toBe(5)

    // N1→N2(5)→N4(0) がクリティカルパス
    const a1 = result.activities.find((a) => a.id === 'A1')!
    const a3 = result.activities.find((a) => a.id === 'A3')!
    expect(a1.isCritical).toBe(true)
    expect(a3.isCritical).toBe(true)

    // N1→N3(3)→N4(0) はクリティカルではない、float=2
    const a2 = result.activities.find((a) => a.id === 'A2')!
    const a4 = result.activities.find((a) => a.id === 'A4')!
    expect(a2.isCritical).toBe(false)
    expect(a2.totalFloat).toBe(2)
    expect(a4.isCritical).toBe(false)
    expect(a4.totalFloat).toBe(2)
  })

  it('ダイヤモンド: N1→N2(3)→N4(2), N1→N3(1)→N4(4) の場合、projectDuration=5', () => {
    const nodes = [
      makeNode('N1', 1),
      makeNode('N2', 2),
      makeNode('N3', 3),
      makeNode('N4', 4),
    ]
    const activities = [
      makeActivity('A1', 'N1', 'N2', 3), // 上ルート前半
      makeActivity('A2', 'N2', 'N4', 2), // 上ルート後半 (合計5)
      makeActivity('A3', 'N1', 'N3', 1), // 下ルート前半
      makeActivity('A4', 'N3', 'N4', 4), // 下ルート後半 (合計5)
    ]

    const result = calculateADMCPM(nodes, activities)

    expect(result.projectDuration).toBe(5)

    // 両方のパスが合計5なので、両方クリティカル
    const a1 = result.activities.find((a) => a.id === 'A1')!
    const a2 = result.activities.find((a) => a.id === 'A2')!
    const a3 = result.activities.find((a) => a.id === 'A3')!
    const a4 = result.activities.find((a) => a.id === 'A4')!

    expect(a1.isCritical).toBe(true)
    expect(a2.isCritical).toBe(true)
    expect(a3.isCritical).toBe(true)
    expect(a4.isCritical).toBe(true)

    // ノードの時刻
    const n1 = result.nodes.find((n) => n.id === 'N1')!
    const n2 = result.nodes.find((n) => n.id === 'N2')!
    const n3 = result.nodes.find((n) => n.id === 'N3')!
    const n4 = result.nodes.find((n) => n.id === 'N4')!
    expect(n1.earliestTime).toBe(0)
    expect(n2.earliestTime).toBe(3)
    expect(n3.earliestTime).toBe(1)
    expect(n4.earliestTime).toBe(5)
    expect(n4.latestTime).toBe(5)
  })

  it('2パス接続: 実作業で独立パスを中間接続した場合、最長パス上の後続がクリティカルになる', () => {
    // Path A: N1→N2→N3 (dur 10, 10, total=20)
    // Path B: N4→N5→N6 (dur 5, 5, total=10)
    // Connection: N2→N5 (dur 3, 実作業)
    // 最長パス: N1→N2→N5→N6 = 10+3+5 = 18  vs  N1→N2→N3 = 20
    // → Path A (20) がクリティカル
    const nodes = [
      makeNode('N1', 1), makeNode('N2', 2), makeNode('N3', 3),
      makeNode('N4', 4), makeNode('N5', 5), makeNode('N6', 6),
    ]
    const activities = [
      makeActivity('A1', 'N1', 'N2', 10),
      makeActivity('A2', 'N2', 'N3', 10),
      makeActivity('B1', 'N4', 'N5', 5),
      makeActivity('B2', 'N5', 'N6', 5),
      makeActivity('C1', 'N2', 'N5', 3), // 接続
    ]
    const result = calculateADMCPM(nodes, activities)
    expect(result.projectDuration).toBe(20)
    // Path A は最長なのでクリティカル
    expect(result.activities.find(a => a.id === 'A1')!.isCritical).toBe(true)
    expect(result.activities.find(a => a.id === 'A2')!.isCritical).toBe(true)
    // 接続と後続はクリティカルでない（短いパス）
    expect(result.activities.find(a => a.id === 'C1')!.isCritical).toBe(false)
    expect(result.activities.find(a => a.id === 'B2')!.isCritical).toBe(false)
  })

  it('2パス接続: 接続が最長パスを作る場合、接続+後続がクリティカルになる', () => {
    // Path A: N1→N2 (dur 20)
    // Path B: N3→N4→N5 (dur 5, 15, total=20)
    // Connection: N2→N4 (dur 0, ダミー)
    // 最長パス: N1→N2→N4→N5 = 20+0+15 = 35
    const nodes = [
      makeNode('N1', 1), makeNode('N2', 2),
      makeNode('N3', 3), makeNode('N4', 4), makeNode('N5', 5),
    ]
    const activities = [
      makeActivity('A1', 'N1', 'N2', 20),
      makeActivity('B1', 'N3', 'N4', 5),
      makeActivity('B2', 'N4', 'N5', 15),
      makeActivity('D1', 'N2', 'N4', 0, true), // ダミー接続
    ]
    const result = calculateADMCPM(nodes, activities)
    expect(result.projectDuration).toBe(35)
    // 最長パス: A1→D1→B2
    expect(result.activities.find(a => a.id === 'A1')!.isCritical).toBe(true)
    expect(result.activities.find(a => a.id === 'D1')!.isCritical).toBe(true)
    expect(result.activities.find(a => a.id === 'B2')!.isCritical).toBe(true)
    // B1は短いパスなのでクリティカルでない
    expect(result.activities.find(a => a.id === 'B1')!.isCritical).toBe(false)
    expect(result.activities.find(a => a.id === 'B1')!.totalFloat).toBe(15)
  })

  it('2パス接続: 実作業で接続し最長パスを作る場合', () => {
    // Path A: N1→N2→N3 (dur 10, 5)
    // Path B: N4→N5→N6 (dur 3, 10)
    // Connection: N2→N5 (dur 2, 実作業)
    // 最長パス候補:
    //   N1→N2→N3 = 15
    //   N4→N5→N6 = 13
    //   N1→N2→N5→N6 = 10+2+10 = 22 ← 最長！
    const nodes = [
      makeNode('N1', 1), makeNode('N2', 2), makeNode('N3', 3),
      makeNode('N4', 4), makeNode('N5', 5), makeNode('N6', 6),
    ]
    const activities = [
      makeActivity('A1', 'N1', 'N2', 10),
      makeActivity('A2', 'N2', 'N3', 5),
      makeActivity('B1', 'N4', 'N5', 3),
      makeActivity('B2', 'N5', 'N6', 10),
      makeActivity('C1', 'N2', 'N5', 2), // 実作業接続
    ]
    const result = calculateADMCPM(nodes, activities)
    expect(result.projectDuration).toBe(22)
    // 最長パス: A1→C1→B2
    expect(result.activities.find(a => a.id === 'A1')!.isCritical).toBe(true)
    expect(result.activities.find(a => a.id === 'C1')!.isCritical).toBe(true)
    expect(result.activities.find(a => a.id === 'B2')!.isCritical).toBe(true)
    // A2, B1はクリティカルでない
    expect(result.activities.find(a => a.id === 'A2')!.isCritical).toBe(false)
    expect(result.activities.find(a => a.id === 'B1')!.isCritical).toBe(false)
    // LF値の確認
    expect(result.activities.find(a => a.id === 'B2')!.lf).toBe(22)
    expect(result.activities.find(a => a.id === 'C1')!.lf).toBe(12) // LT(N5)=12
  })

  it('ダミー作業: N1→N2(d=5), N2→N3(d=0, isDummy=true) の場合、ダミーはduration=0', () => {
    const nodes = [
      makeNode('N1', 1),
      makeNode('N2', 2),
      makeNode('N3', 3),
    ]
    const activities = [
      makeActivity('A1', 'N1', 'N2', 5, false),
      makeActivity('D1', 'N2', 'N3', 0, true), // ダミー作業
    ]

    const result = calculateADMCPM(nodes, activities)

    expect(result.projectDuration).toBe(5)

    // ダミー作業の確認
    const d1 = result.activities.find((a) => a.id === 'D1')!
    expect(d1.isDummy).toBe(true)
    expect(d1.duration).toBe(0)
    expect(d1.es).toBe(5)
    expect(d1.ef).toBe(5)

    // ノードの時刻
    const n2 = result.nodes.find((n) => n.id === 'N2')!
    const n3 = result.nodes.find((n) => n.id === 'N3')!
    expect(n2.earliestTime).toBe(5)
    expect(n3.earliestTime).toBe(5)
    expect(n3.latestTime).toBe(5)
  })
})

// ======================================
// detectCycle テスト
// ======================================

describe('detectCycle', () => {
  it('循環なし: N1→N2→N3 の場合、false を返す', () => {
    const nodes = [makeNode('N1', 1), makeNode('N2', 2), makeNode('N3', 3)]
    const activities = [
      makeActivity('A1', 'N1', 'N2', 3),
      makeActivity('A2', 'N2', 'N3', 4),
    ]

    expect(detectCycle(nodes, activities)).toBe(false)
  })

  it('循環あり: N1→N2→N3→N1 の場合、true を返す', () => {
    const nodes = [makeNode('N1', 1), makeNode('N2', 2), makeNode('N3', 3)]
    const activities = [
      makeActivity('A1', 'N1', 'N2', 3),
      makeActivity('A2', 'N2', 'N3', 4),
      makeActivity('A3', 'N3', 'N1', 2), // 循環
    ]

    expect(detectCycle(nodes, activities)).toBe(true)
  })

  it('空グラフの場合、false を返す', () => {
    expect(detectCycle([], [])).toBe(false)
  })

  it('自己ループ: N1→N1 の場合、true を返す', () => {
    const nodes = [makeNode('N1', 1)]
    const activities = [makeActivity('A1', 'N1', 'N1', 1)]

    expect(detectCycle(nodes, activities)).toBe(true)
  })
})
