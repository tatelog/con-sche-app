/**
 * 通り列・カスタム列の値を、行の並び替えに追従させる。
 *
 * これらの列の値は階層(棟>工区>階>細目)に属さず、admStore の
 * customColumnValues に「列ID:行番号」で入っている（utils/headerColumnValue 参照）。
 * 行番号で持っているぶん、行を動かしたり消したりしても値は元の行番号に
 * 残り続け、「移動しても項目が付いてこない」「消しても項目が消えない」
 * という状態になっていた。
 *
 * 行を動かす側の操作から、ここの関数を通して値も一緒に動かす。
 */

/** 「列ID:行番号」を分解する。列IDにコロンが入っていてもいいように後ろから切る */
function splitKey(key: string): { columnId: string; rowIndex: number } | null {
  const sep = key.lastIndexOf(':')
  if (sep < 0) return null
  const rowIndex = Number(key.slice(sep + 1))
  if (!Number.isInteger(rowIndex) || rowIndex < 0) return null
  return { columnId: key.slice(0, sep), rowIndex }
}

const makeKey = (columnId: string, rowIndex: number) => `${columnId}:${rowIndex}`

/**
 * 行を挿入方式で動かしたあとの並びを返す。
 * 戻り値の i 番目には、移動前の行番号が入る。
 */
export function buildRowOrderAfterMove(rowCount: number, from: number, to: number): number[] {
  const order = Array.from({ length: rowCount }, (_, i) => i)
  if (from === to || from < 0 || to < 0 || from >= rowCount || to >= rowCount) return order
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved)
  return order
}

/**
 * 行を from から to へ動かしたときの、行番号の移動先を返す。
 * 動かした範囲の外は変わらない。
 */
function mappedIndexForMove(rowIndex: number, from: number, to: number): number {
  if (from === to) return rowIndex
  if (rowIndex === from) return to
  if (from < to) {
    // 下へ動かす: 間の行が1つずつ繰り上がる
    return rowIndex > from && rowIndex <= to ? rowIndex - 1 : rowIndex
  }
  // 上へ動かす: 間の行が1つずつ繰り下がる
  return rowIndex >= to && rowIndex < from ? rowIndex + 1 : rowIndex
}

/** 行を動かしたときに、その行の値も一緒に動かす */
export function moveRowValues(
  values: Map<string, string>,
  from: number,
  to: number,
): Map<string, string> {
  if (from === to) return new Map(values)
  const next = new Map<string, string>()
  for (const [key, value] of values) {
    const parsed = splitKey(key)
    if (!parsed) {
      next.set(key, value)
      continue
    }
    next.set(makeKey(parsed.columnId, mappedIndexForMove(parsed.rowIndex, from, to)), value)
  }
  return next
}

/** 行を消したときに、その行の値も消して、下の行を繰り上げる */
export function deleteRowValues(
  values: Map<string, string>,
  rowIndex: number,
): Map<string, string> {
  const next = new Map<string, string>()
  for (const [key, value] of values) {
    const parsed = splitKey(key)
    if (!parsed) {
      next.set(key, value)
      continue
    }
    if (parsed.rowIndex === rowIndex) continue
    const shifted = parsed.rowIndex > rowIndex ? parsed.rowIndex - 1 : parsed.rowIndex
    next.set(makeKey(parsed.columnId, shifted), value)
  }
  return next
}

/** 行を挿入したときに、その位置から下の行を繰り下げる */
export function insertRowValues(
  values: Map<string, string>,
  atIndex: number,
): Map<string, string> {
  const next = new Map<string, string>()
  for (const [key, value] of values) {
    const parsed = splitKey(key)
    if (!parsed) {
      next.set(key, value)
      continue
    }
    const shifted = parsed.rowIndex >= atIndex ? parsed.rowIndex + 1 : parsed.rowIndex
    next.set(makeKey(parsed.columnId, shifted), value)
  }
  return next
}
