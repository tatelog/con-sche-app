/**
 * CSV エクスポートユーティリティ
 * exportFullData() のデータをCSV形式に変換
 */

import type { ADMExportData } from '@/stores/admStore'

const CSV_HEADERS = [
  '作業名',
  '始点ノード',
  '終点ノード',
  '開始日',
  '終了日',
  '工数(日)',
  'ダミー',
  'クリティカル',
  'トータルフロート',
  'フリーフロート',
  '工区',
  '部屋名',
  'メモ',
]

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportToCSV(data: ADMExportData): string {
  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]))

  // 階層マップ（detailId → zone/detail名）
  const zoneMap = new Map(data.hierarchy.zones.map((z) => [z.id, z.name]))
  const detailMap = new Map(data.hierarchy.detailCategories.map((d) => [d.id, d.name]))

  const rows = data.activities.map((activity) => {
    const fromNode = nodeMap.get(activity.fromNodeId)
    const toNode = nodeMap.get(activity.toNodeId)

    const zone = activity.detailCategoryId
      ? (() => {
          const detail = data.hierarchy.detailCategories.find((d) => d.id === activity.detailCategoryId)
          if (!detail) return ''
          const room = data.hierarchy.rooms.find((r) => r.id === detail.roomId)
          if (!room) return ''
          return zoneMap.get(room.zoneId) || ''
        })()
      : ''

    const detailName = activity.detailCategoryId
      ? detailMap.get(activity.detailCategoryId) || ''
      : ''

    return [
      activity.name,
      fromNode ? String(fromNode.number) : '',
      toNode ? String(toNode.number) : '',
      activity.startDate || '',
      activity.endDate || '',
      String(activity.duration),
      activity.isDummy ? 'Yes' : 'No',
      activity.isCritical ? 'Yes' : 'No',
      String(activity.totalFloat),
      String(activity.freeFloat),
      zone,
      detailName,
      activity.note || '',
    ]
      .map(escapeCsvField)
      .join(',')
  })

  return '\uFEFF' + CSV_HEADERS.join(',') + '\n' + rows.join('\n')
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
