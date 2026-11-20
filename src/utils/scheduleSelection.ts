import type { Activity, EventNode, Position } from '@/types/adm'

export function segmentIntersectsBox(a: Position, b: Position, start: Position, end: Position) {
  const min = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) }
  const max = { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) }
  let low = 0
  let high = 1
  for (const axis of ['x', 'y'] as const) {
    const delta = b[axis] - a[axis]
    if (delta === 0) {
      if (a[axis] < min[axis] || a[axis] > max[axis]) return false
    } else {
      const first = (min[axis] - a[axis]) / delta
      const last = (max[axis] - a[axis]) / delta
      low = Math.max(low, Math.min(first, last))
      high = Math.min(high, Math.max(first, last))
      if (low > high) return false
    }
  }
  return true
}

export type ScheduleClipboard = { nodes: EventNode[]; activities: Activity[] }

export function copySchedule(nodes: Map<string, EventNode>, activities: Map<string, Activity>, nodeIds: string[], activityIds: string[]): ScheduleClipboard {
  const selected = [...new Set(activityIds)].flatMap(id => {
    const activity = activities.get(id)
    return activity && nodes.has(activity.fromNodeId) && nodes.has(activity.toNodeId) ? [activity] : []
  })
  const ids = new Set([...nodeIds, ...selected.flatMap(a => [a.fromNodeId, a.toNodeId])])
  return structuredClone({ nodes: [...ids].flatMap(id => { const node = nodes.get(id); return node ? [node] : [] }), activities: selected })
}

export function pasteSchedule(clipboard: ScheduleClipboard, target: Position, nextNumber: number, id: () => string): ScheduleClipboard {
  if (!clipboard.nodes.length) return { nodes: [], activities: [] }
  const dx = target.x - Math.min(...clipboard.nodes.map(n => n.position.x))
  const dy = target.y - Math.min(...clipboard.nodes.map(n => n.position.y))
  const ids = new Map<string, string>()
  const shift = (p: Position) => ({ x: p.x + dx, y: p.y + dy })
  const nodes = clipboard.nodes.map((n, index) => {
    const newId = id()
    ids.set(n.id, newId)
    return { ...structuredClone(n), id: newId, number: nextNumber + index, position: shift(n.position) }
  })
  const activities = clipboard.activities.flatMap(a => {
    const fromNodeId = ids.get(a.fromNodeId), toNodeId = ids.get(a.toNodeId)
    if (!fromNodeId || !toNodeId) return []
    return [{ ...structuredClone(a), id: id(), fromNodeId, toNodeId, detailCategoryId: undefined, rowIndex: undefined, startDate: undefined, endDate: undefined, waypoints: a.waypoints?.map(shift) }]
  })
  return { nodes, activities }
}
