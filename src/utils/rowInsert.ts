/**
 * 行の間に出る「＋」ボタンが何をするかを決める。
 *
 * 利用者から「＋ボタンの用途が分からない。挿入をしなくても項目は入力でき、
 * 挿入しても入力出来てしまう」という指摘があった。
 *
 * 一番下の空行はセルに打った時点で行の実体が作られるので、下に足すだけなら
 * ＋は要らない。＋の値打ちは「既存の行の間に1行割り込ませる」ことだけ。
 * そこで、押した結果を「上の行と同じ階に属する、中身が空の1行」に揃えた。
 *
 * 細目名を空にするのは見た目の都合もある。細目の列は同じ階の同名の連続行を
 * ひとつのセルに結合する（NetworkCanvas の getColumnKey）ため、上の行から
 * 名前をコピーすると結合してしまい、行が増えたように見えない。
 */

import type { DetailCategory, HierarchyRow } from '@/types/adm'

export type RowInsertPlan =
  /** 先頭の前に挿入。工区→階→細目をまとめて作る */
  | { kind: 'before-first' }
  /** 既存の行の下に、同じ階の空の細目を1つ足す */
  | { kind: 'into-room'; roomId: string; detailName: string; order: number }
  /** 一番下の空行エリアで押された。最終行の階に足す */
  | { kind: 'append-to-last-room'; roomId: string }

/**
 * ＋ボタンは画面上の行間に出る。gapIndex は画面内での隙間の位置で、
 * 0 が画面先頭行の上。ページ送りしているぶんを足して本当の行番号に直す。
 *
 * これを忘れると2ページ目以降で押したときに別の行の下に入ってしまう。
 */
export function insertAfterRowIndexForGap(gapIndex: number, pageStartRow: number): number {
  return pageStartRow + gapIndex - 1
}

export interface PlanRowInsertInput {
  /** 表示中の全行（ページ送り前の通し） */
  rows: HierarchyRow[]
  /** この行の下に挿入する。-1 は先頭の前、rows.length 以上は空行エリア */
  afterRowIndex: number
  /** 上の行が属する階の細目一覧（並び順は問わない） */
  detailsInRoom: DetailCategory[]
  /** 上の行の細目ID */
  afterDetailId: string | null
}

export function planRowInsert({
  rows,
  afterRowIndex,
  detailsInRoom,
  afterDetailId,
}: PlanRowInsertInput): RowInsertPlan {
  if (rows.length === 0 || afterRowIndex < 0) {
    return { kind: 'before-first' }
  }

  if (afterRowIndex >= rows.length) {
    return { kind: 'append-to-last-room', roomId: rows[rows.length - 1].roomId }
  }

  const roomId = rows[afterRowIndex].roomId
  const sorted = [...detailsInRoom].sort((a, b) => a.order - b.order)
  const currentIndex = sorted.findIndex((d) => d.id === afterDetailId)

  let order: number
  if (currentIndex < 0) {
    // 行と細目の対応が取れないとき。行を足せること自体は壊さない
    const lastOrder = sorted.length > 0 ? sorted[sorted.length - 1].order : 0
    order = lastOrder + 1
  } else if (currentIndex < sorted.length - 1) {
    order = (sorted[currentIndex].order + sorted[currentIndex + 1].order) / 2
  } else {
    order = sorted[currentIndex].order + 1
  }

  return { kind: 'into-room', roomId, detailName: '', order }
}
