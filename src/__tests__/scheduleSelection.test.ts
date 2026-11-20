import { describe, it, expect } from 'vitest'
import { createEventNode, createActivity } from '@/types/adm'
import { copySchedule, pasteSchedule, segmentIntersectsBox } from '@/utils/scheduleSelection'
import { calculatePrintRange } from '@/utils/printRange'
import { useADMStore } from '@/stores/admStore'

describe('schedule selection', () => {
  it('selects crossing segments without selecting a nearby diagonal', () => {
    const start = { x: 4, y: 4 }, end = { x: 6, y: 6 }
    expect(segmentIntersectsBox({ x: 0, y: 5 }, { x: 10, y: 5 }, end, start)).toBe(true)
    expect(segmentIntersectsBox({ x: 0, y: 0 }, { x: 10, y: 3 }, start, end)).toBe(false)
  })
  it('copies shared endpoints once and preserves relative geometry and appearance', () => {
    const a = createEventNode({ id: 'a', number: 1, position: { x: 30, y: 20 } })
    const b = createEventNode({ id: 'b', number: 2, position: { x: 90, y: 20 } })
    const c = createEventNode({ id: 'c', number: 3, position: { x: 120, y: 60 } })
    const first = createActivity({ id: 'first', fromNodeId: 'a', toNodeId: 'b', name: '型枠', duration: 2 })
    const second = createActivity({ id: 'second', name: '打設', fromNodeId: 'b', toNodeId: 'c' })
    const clipboard = copySchedule(new Map([['a', a], ['b', b], ['c', c]]), new Map([['first', first], ['second', second]]), [], ['first', 'second'])
    first.name = '変更後'
    let next = 0
    const pasted = pasteSchedule(clipboard, { x: 300, y: 100 }, 10, () => `new-${next++}`)
    expect(pasted.nodes.map(n => n.position)).toEqual([{ x: 300, y: 100 }, { x: 360, y: 100 }, { x: 390, y: 140 }])
    expect(pasted.activities[0].name).toBe('型枠')
    expect(pasted.activities[0].toNodeId).toBe(pasted.activities[1].fromNodeId)
    expect(pasted.activities[0].duration).toBe(2)
    expect(pasted.activities[0].displaySettings).toEqual(first.displaySettings)
    expect(pasted.nodes.map(n => n.number)).toEqual([10, 11, 12])
  })
  it('can undo a paste and a grouped move without changing the source', () => {
    const state = useADMStore.getState()
    state.clearAll()
    const a = state.addNode({ x: 0, y: 20 })
    const b = state.addNode({ x: 60, y: 20 })
    const activity = state.addActivity(a, b, '施工')
    if (!activity) throw new Error('fixture activity missing')
    const current = useADMStore.getState()
    const clip = copySchedule(current.nodes, current.activities, [], [activity])
    current.pasteSelection(clip, { x: 120, y: 100 })
    const pastedIds = useADMStore.getState().selectedNodeIds
    useADMStore.getState().moveSelection({ x: 30, y: 40 })
    expect(useADMStore.getState().nodes.get(pastedIds[0])?.position).toEqual({ x: 150, y: 140 })
    expect(useADMStore.getState().nodes.get(a)?.position).toEqual({ x: 0, y: 20 })
    useADMStore.getState().undo()
    expect(useADMStore.getState().nodes.get(pastedIds[0])?.position).toEqual({ x: 120, y: 100 })
    useADMStore.getState().undo()
    expect(useADMStore.getState().nodes.size).toBe(2)
    expect(useADMStore.getState().activities.size).toBe(1)
  })
  it('preserves the first single selection when adding a different kind', () => {
    const state = useADMStore.getState()
    state.selectNode('node')
    state.toggleActivitySelection('activity')
    expect(useADMStore.getState().selectedNodeIds).toEqual(['node'])
    expect(useADMStore.getState().selectedActivityIds).toEqual(['activity'])
    state.toggleActivitySelection('activity')
    expect(useADMStore.getState().selectedActivityIds).toEqual([])
  })
})

describe('print range', () => {
  it('includes both endpoints and handles leap days and negative offsets', () => {
    expect(calculatePrintRange('2024-03-01', '2024-02-28', '2024-03-01')).toEqual({ start: '2024-02-28', end: '2024-03-01', days: 3, offset: -2 })
  })
  it('rejects missing, reversed and nonexistent dates', () => {
    expect(calculatePrintRange('2026-01-01', '', '2026-02-01')).toBeNull()
    expect(calculatePrintRange('2026-01-01', '2026-03-01', '2026-02-01')).toBeNull()
    expect(calculatePrintRange('2026-01-01', '2026-02-30', '2026-03-01')).toBeNull()
  })
})

