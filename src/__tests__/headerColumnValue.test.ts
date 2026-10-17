import { describe, it, expect } from 'vitest'
import { resolveHeaderCellValue } from '@/utils/headerColumnValue'
import type { HeaderColumn, HierarchyRow } from '@/types/adm'

// 2026-10-17 利用者からの指摘:
// 「ヘッダー列がPDFに表示されない。編集画面では表示されている。
//   カスタム列で追加したものが表示されないようです。
//   初期設定であるヘッダー列の項目であれば印刷に反映されるようなのですが」
//
// 原因は SvgPreviewDialog の行ヘッダー描画が zone / floor / detail しか
// 値を解決しておらず、custom と building が常に空文字になっていたこと。
// 編集画面(NetworkCanvas)は admStore の getCustomColumnValue を見ているため
// 表示され、PDF側だけ空になる。値の解決をここに切り出して両方から使う。

const col = (over: Partial<HeaderColumn>): HeaderColumn => ({
  id: 'col-zone',
  type: 'zone',
  label: '工区',
  width: 60,
  order: 0,
  visible: true,
  ...over,
})

const row: HierarchyRow = {
  buildingId: 'b1',
  buildingName: 'A棟',
  zoneId: 'z1',
  zoneName: '1工区',
  roomId: 'r1',
  roomName: '3F',
  detailId: 'd1',
  detailName: '会議室',
  y: 0,
}

// カスタム列の値は "列ID:行番号" で持っている（admStore.customColumnValues）
const values = new Map<string, string>([
  ['col-custom-1:0', '鉄筋'],
  ['col-custom-1:7', '型枠'],
])
const getCustomValue = (columnId: string, rowIndex: number) =>
  values.get(`${columnId}:${rowIndex}`) ?? ''

describe('resolveHeaderCellValue', () => {
  it('工区列はその行の工区名を返す', () => {
    expect(resolveHeaderCellValue(col({ type: 'zone' }), row, 0, getCustomValue)).toBe('1工区')
  })

  it('階数列はその行の階数を返す', () => {
    expect(resolveHeaderCellValue(col({ type: 'floor' }), row, 0, getCustomValue)).toBe('3F')
  })

  it('部屋名列はその行の部屋名を返す', () => {
    expect(resolveHeaderCellValue(col({ type: 'detail' }), row, 0, getCustomValue)).toBe('会議室')
  })

  it('棟列はその行の棟名を返す', () => {
    expect(resolveHeaderCellValue(col({ type: 'building' }), row, 0, getCustomValue)).toBe('A棟')
  })

  it('棟が未設定の行では棟列は空にする', () => {
    const noBuilding = { ...row, buildingId: undefined, buildingName: undefined }
    expect(resolveHeaderCellValue(col({ type: 'building' }), noBuilding, 0, getCustomValue)).toBe('')
  })

  it('カスタム列はその列・その行に入力された値を返す', () => {
    const c = col({ id: 'col-custom-1', type: 'custom', label: '職種' })
    expect(resolveHeaderCellValue(c, row, 0, getCustomValue)).toBe('鉄筋')
  })

  it('カスタム列の行番号はデータ全体の通し番号で引く（2ページ目でもズレない）', () => {
    const c = col({ id: 'col-custom-1', type: 'custom', label: '職種' })
    // 1ページ20行なら、2ページ目の8行目はデータ上の27行目。
    // ページ内の位置(7)ではなく通し番号で引くと空になる
    expect(resolveHeaderCellValue(c, row, 7, getCustomValue)).toBe('型枠')
    expect(resolveHeaderCellValue(c, row, 27, getCustomValue)).toBe('')
  })

  it('値が入っていないカスタム列は空にする', () => {
    const c = col({ id: 'col-custom-9', type: 'custom', label: '備考' })
    expect(resolveHeaderCellValue(c, row, 0, getCustomValue)).toBe('')
  })

  it('行データがない余白行は、どの列でも空にする', () => {
    expect(resolveHeaderCellValue(col({ type: 'zone' }), undefined, 0, getCustomValue)).toBe('')
    const c = col({ id: 'col-custom-1', type: 'custom', label: '職種' })
    expect(resolveHeaderCellValue(c, undefined, 0, getCustomValue)).toBe('')
  })

  // 2026-10-17 ゆたかの指摘:
  // 「レコードヘッダーの通りに数値やテキスト入れても反応が無い」
  // 「通り」列は設定でONにでき見出しも出るのに、入力しても値が出ない。
  // マスタには登録されるので選択肢には並ぶが、選んでも空のまま。
  // 値を持つ仕組みが作られていなかったため、カスタム列と同じ
  // 「列ID:行番号」の入れ物を使う方針にした（ゆたかの選択: A）。
  it('通り列はその列・その行に入力された値を返す', () => {
    const c = col({ id: 'col-grid', type: 'grid', label: '通り' })
    const vals = new Map([['col-grid:0', 'X1']])
    const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''
    expect(resolveHeaderCellValue(c, row, 0, get)).toBe('X1')
  })

  it('通り列も行番号はデータ全体の通し番号で引く', () => {
    const c = col({ id: 'col-grid', type: 'grid', label: '通り' })
    const vals = new Map([['col-grid:27', 'Y3']])
    const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''
    expect(resolveHeaderCellValue(c, row, 27, get)).toBe('Y3')
    expect(resolveHeaderCellValue(c, row, 7, get)).toBe('')
  })

  it('値が入っていない通り列は空にする', () => {
    const c = col({ id: 'col-grid', type: 'grid', label: '通り' })
    expect(resolveHeaderCellValue(c, row, 0, getCustomValue)).toBe('')
  })

  it('余白行では通り列も空にする', () => {
    const c = col({ id: 'col-grid', type: 'grid', label: '通り' })
    const vals = new Map([['col-grid:0', 'X1']])
    const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''
    expect(resolveHeaderCellValue(c, undefined, 0, get)).toBe('')
  })
})
