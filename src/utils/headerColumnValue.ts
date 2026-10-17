import type { HeaderColumn, HierarchyRow } from '@/types/adm'

/**
 * ヘッダー列のセルに出す文字列を決める。
 *
 * 編集画面（NetworkCanvas）とPDF・印刷（SvgPreviewDialog）で同じ値を出すために
 * 切り出した。以前はSVG側が zone / floor / detail しか解決しておらず、
 * カスタム列と棟列がPDFで常に空欄になっていた。
 *
 * カスタム列の値は行データ（HierarchyRow）ではなく admStore の
 * customColumnValues に「列ID:行番号」で入っているため、取得関数を受け取る。
 * rowIndex はページ内の位置ではなく、データ全体の通し番号を渡すこと。
 */
export function resolveHeaderCellValue(
  col: HeaderColumn,
  row: HierarchyRow | undefined,
  rowIndex: number,
  getCustomValue: (columnId: string, rowIndex: number) => string,
): string {
  if (!row) return ''
  switch (col.type) {
    case 'building':
      return row.buildingName ?? ''
    case 'zone':
      return row.zoneName
    case 'floor':
      return row.roomName
    case 'detail':
      return row.detailName
    // 「通り」はカスタム列と同じ自由入力列として扱う。階層(工区>階>細目)には
    // 属さず、値は customColumnValues に「列ID:行番号」で入る。
    case 'grid':
    case 'custom':
      return getCustomValue(col.id, rowIndex)
    default:
      return ''
  }
}

/** 連続する行をまとめるかどうかの判定キー。同じキーが続く行が1つのセルになる */
export function resolveHeaderCellKey(
  col: HeaderColumn,
  row: HierarchyRow | undefined,
  rowIndex: number,
  getCustomValue: (columnId: string, rowIndex: number) => string,
): string {
  // 行データのない余白行は、隣とくっつけずそれぞれ独立した空セルにする
  if (!row) return `__empty__:${rowIndex}`
  switch (col.type) {
    case 'building':
      return row.buildingId ?? ''
    case 'zone':
      return row.zoneId
    case 'floor':
      return row.roomId
    case 'detail':
      return `${row.zoneId}/${row.roomId}/${row.detailName || row.detailId}`
    case 'grid':
    case 'custom': {
      const val = getCustomValue(col.id, rowIndex)
      return `${row.zoneId}/${row.roomId}/${val || row.detailId}`
    }
    default:
      return ''
  }
}

/** 1つのセルが、まとまりの先頭かどうかと、何行ぶんの高さを持つか */
export interface RowGroupCell {
  isFirst: boolean
  rowSpan: number
}

/**
 * 列ごとに、連続する同じ値の行をまとめた情報を返す。
 *
 * 編集画面(NetworkCanvas)とPDF・印刷(SvgPreviewDialog)で結合の見え方を
 * 揃えるために切り出した。以前はPDF側に結合の概念が無く、同じ工区・棟が
 * 行の数だけ繰り返し描かれていた。
 *
 * rowStartIndex はこの rows 配列の先頭がデータ全体の何行目かを渡す。
 * カスタム列・通り列の値は「列ID:通し番号」で持っているため、
 * ページ内の位置で引くと2ページ目以降でズレる。
 */
export function buildRowGroups(
  columns: HeaderColumn[],
  rows: (HierarchyRow | undefined)[],
  getCustomValue: (columnId: string, rowIndex: number) => string,
  rowStartIndex = 0,
): Map<string, RowGroupCell[]> {
  const result = new Map<string, RowGroupCell[]>()

  for (const col of columns) {
    const cells: RowGroupCell[] = []
    let groupStart = 0
    let currentKey = ''

    for (let i = 0; i < rows.length; i++) {
      const key = resolveHeaderCellKey(col, rows[i], rowStartIndex + i, getCustomValue)

      if (i === 0 || key !== currentKey) {
        if (i > 0) cells[groupStart].rowSpan = i - groupStart
        cells[i] = { isFirst: true, rowSpan: 1 }
        groupStart = i
        currentKey = key
      } else {
        cells[i] = { isFirst: false, rowSpan: 0 }
      }
    }

    if (rows.length > 0) cells[groupStart].rowSpan = rows.length - groupStart
    result.set(col.id, cells)
  }

  return result
}
