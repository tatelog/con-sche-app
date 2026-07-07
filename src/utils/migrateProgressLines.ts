import type { ProgressLine, HierarchyRow } from '@/types/adm'

/**
 * 進捗線のrowOffsets keyをrowIndex(数値)からdetailIdに変換する
 * 既存データの後方互換マイグレーション
 */
export function migrateProgressLines(
  progressLines: ProgressLine[],
  hierarchyRows: HierarchyRow[],
): ProgressLine[] {
  return progressLines.map((line) => {
    const entries = Object.entries(line.rowOffsets)
    // すでにdetailIdベース（非数値キー）なら変換不要
    const hasNumericKeys = entries.some(([key]) => /^\d+$/.test(key))
    if (!hasNumericKeys) return line

    const newOffsets: Record<string, number> = {}
    for (const [key, value] of entries) {
      const index = parseInt(key, 10)
      if (!isNaN(index) && index < hierarchyRows.length) {
        const detailId = hierarchyRows[index].detailId
        if (detailId) {
          newOffsets[detailId] = value
        }
      }
    }
    return { ...line, rowOffsets: newOffsets }
  })
}
