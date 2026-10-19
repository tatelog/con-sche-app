import { describe, it, expect } from 'vitest'
import { insertAfterRowIndexForGap, planRowInsert } from '@/utils/rowInsert'
import type { DetailCategory, HierarchyRow } from '@/types/adm'

/**
 * 行の間に出る「＋」ボタンの約束を固める。
 *
 * 利用者から「＋ボタンの用途が分からない。押さなくても項目は入力できるし、
 * 押しても入力できてしまう」という指摘があった。
 * ＋の値打ちは「既存の行の間に1行割り込ませる」ことだけなので、
 * 押した結果が「上の行と同じ階に属する、中身が空の1行」になると約束する。
 */

const row = (
  roomId: string,
  detailId: string,
  detailName: string,
  y: number,
): HierarchyRow => ({
  zoneId: 'z1',
  zoneName: '1工区',
  roomId,
  roomName: roomId,
  detailId,
  detailName,
  y,
})

const detail = (id: string, roomId: string, name: string, order: number): DetailCategory => ({
  id,
  roomId,
  name,
  order,
})

// 3階（2行）→ 2階（2行）の並び
const rows: HierarchyRow[] = [
  row('f3', 'd1', '配筋', 0),
  row('f3', 'd2', '打設', 40),
  row('f2', 'd3', '配筋', 80),
  row('f2', 'd4', '打設', 120),
]

describe('insertAfterRowIndexForGap — 画面上の行間から本当の行番号を出す', () => {
  it('1ページ目は画面の位置がそのまま行番号になる', () => {
    // gapIndex 1 = 画面1行目と2行目の隙間 → その上の行は 0 行目
    expect(insertAfterRowIndexForGap(1, 0)).toBe(0)
    expect(insertAfterRowIndexForGap(4, 0)).toBe(3)
  })

  it('先頭行の上の隙間は -1（最初の行の前に挿入）を返す', () => {
    expect(insertAfterRowIndexForGap(0, 0)).toBe(-1)
  })

  it('2ページ目以降はページの先頭行ぶんずれる', () => {
    // 1ページ20行で2ページ目を見ているとき、画面3行目と4行目の隙間は
    // データ上は 22 行目の下
    expect(insertAfterRowIndexForGap(3, 20)).toBe(22)
  })

  it('2ページ目の先頭の隙間は、前のページの最終行の下になる', () => {
    expect(insertAfterRowIndexForGap(0, 20)).toBe(19)
  })
})

describe('planRowInsert — ＋を押したときに作る行', () => {
  it('3階の最後の行と2階の行の隙間で押すと、3階に行を足す', () => {
    const plan = planRowInsert({
      rows,
      afterRowIndex: 1,
      detailsInRoom: [detail('d1', 'f3', '配筋', 0), detail('d2', 'f3', '打設', 1)],
      afterDetailId: 'd2',
    })
    expect(plan).toEqual({ kind: 'into-room', roomId: 'f3', detailName: '', order: 2 })
  })

  it('足した行の細目名は空にする（上の行からコピーしない）', () => {
    // 名前をコピーすると、同じ階の同名の連続行として上のセルに結合され、
    // 行が増えたように見えない
    const plan = planRowInsert({
      rows,
      afterRowIndex: 0,
      detailsInRoom: [detail('d1', 'f3', '配筋', 0), detail('d2', 'f3', '打設', 1)],
      afterDetailId: 'd1',
    })
    expect(plan).toMatchObject({ detailName: '' })
  })

  it('階の途中で押すと、上下の細目の間の並び順になる', () => {
    const plan = planRowInsert({
      rows,
      afterRowIndex: 0,
      detailsInRoom: [detail('d1', 'f3', '配筋', 0), detail('d2', 'f3', '打設', 1)],
      afterDetailId: 'd1',
    })
    expect(plan).toEqual({ kind: 'into-room', roomId: 'f3', detailName: '', order: 0.5 })
  })

  it('階の最後の行で押すと、並び順は最後＋1になる', () => {
    const plan = planRowInsert({
      rows,
      afterRowIndex: 3,
      detailsInRoom: [detail('d3', 'f2', '配筋', 5), detail('d4', 'f2', '打設', 9)],
      afterDetailId: 'd4',
    })
    expect(plan).toEqual({ kind: 'into-room', roomId: 'f2', detailName: '', order: 10 })
  })

  it('先頭行の上で押すと、工区から作り直す合図を返す', () => {
    const plan = planRowInsert({ rows, afterRowIndex: -1, detailsInRoom: [], afterDetailId: null })
    expect(plan).toEqual({ kind: 'before-first' })
  })

  it('行がまだ1つも無いときは、先頭に作る扱いにする', () => {
    const plan = planRowInsert({ rows: [], afterRowIndex: 3, detailsInRoom: [], afterDetailId: null })
    expect(plan).toEqual({ kind: 'before-first' })
  })

  it('一番下の空行エリアで押すと、最終行の階に足す', () => {
    const plan = planRowInsert({ rows, afterRowIndex: 9, detailsInRoom: [], afterDetailId: null })
    expect(plan).toEqual({ kind: 'append-to-last-room', roomId: 'f2' })
  })

  it('上の行の細目が見つからないときは、並び順を最後＋1に寄せる', () => {
    // 細目一覧と行の対応が崩れていても、行を足せること自体は壊さない
    const plan = planRowInsert({
      rows,
      afterRowIndex: 1,
      detailsInRoom: [detail('d1', 'f3', '配筋', 3)],
      afterDetailId: 'missing',
    })
    expect(plan).toEqual({ kind: 'into-room', roomId: 'f3', detailName: '', order: 4 })
  })
})
