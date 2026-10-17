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
    case 'custom':
      return getCustomValue(col.id, rowIndex)
    default:
      return ''
  }
}
