import { describe, it, expect } from 'vitest'
import {
  resolveHeaderCellValue,
  resolveHeaderCellKey,
  buildRowGroups,
  isFreeTextColumn,
} from '@/utils/headerColumnValue'
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

  // 2026-10-18 Issue #26 で仕様を見直した。
  // 階層列(棟・工区・階数・細目)を全部非表示にしてカスタム列だけで使うと、
  // 階層行が1つも作られないため全行が余白行になる。
  // 余白行をまとめて空にしていたので、入力した値が画面にもPDFにも出なかった。
  // 階層列は行データが無いので空のまま。自由入力列は余白行でも値を返す。
  it('行データがない余白行では、階層列は空にする', () => {
    expect(resolveHeaderCellValue(col({ type: 'zone' }), undefined, 0, getCustomValue)).toBe('')
    expect(resolveHeaderCellValue(col({ type: 'floor' }), undefined, 0, getCustomValue)).toBe('')
    expect(resolveHeaderCellValue(col({ type: 'detail' }), undefined, 0, getCustomValue)).toBe('')
    expect(resolveHeaderCellValue(col({ type: 'building' }), undefined, 0, getCustomValue)).toBe('')
  })

  it('行データがない余白行でも、カスタム列は入力された値を返す', () => {
    const c = col({ id: 'col-custom-1', type: 'custom', label: '職種' })
    expect(resolveHeaderCellValue(c, undefined, 0, getCustomValue)).toBe('鉄筋')
    expect(resolveHeaderCellValue(c, undefined, 7, getCustomValue)).toBe('型枠')
  })

  // 2026-10-17 社内検証での指摘:
  // 「レコードヘッダーの通りに数値やテキスト入れても反応が無い」
  // 「通り」列は設定でONにでき見出しも出るのに、入力しても値が出ない。
  // マスタには登録されるので選択肢には並ぶが、選んでも空のまま。
  // 値を持つ仕組みが作られていなかったため、カスタム列と同じ
  // 「列ID:行番号」の入れ物を使う方針にした。
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

  it('余白行でも通り列は入力された値を返す', () => {
    const c = col({ id: 'col-grid', type: 'grid', label: '通り' })
    const vals = new Map([['col-grid:0', 'X1']])
    const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''
    expect(resolveHeaderCellValue(c, undefined, 0, get)).toBe('X1')
  })

  it('値が入っていない余白行の自由入力列は空にする', () => {
    const c = col({ id: 'col-grid', type: 'grid', label: '通り' })
    expect(resolveHeaderCellValue(c, undefined, 3, getCustomValue)).toBe('')
  })
})

// 2026-10-18 今夜の修正の穴:
// 「通り」を空行に入力しても保存されなかった。NetworkCanvas の
// handleCellSelectChange に「既存行」と「空行」で分岐が2つあり、
// 通り列を既存行側にだけ足して空行側に入れ忘れていたため。
// 新規作成直後は全行が空行なので、最初の入力が必ず消える。
// 同じ判定を2箇所に書かないよう、列の性質をここで1つに決める。
describe('isFreeTextColumn', () => {
  it('通り列は階層に属さない自由入力列として扱う', () => {
    expect(isFreeTextColumn('grid')).toBe(true)
  })

  it('カスタム列は階層に属さない自由入力列として扱う', () => {
    expect(isFreeTextColumn('custom')).toBe(true)
  })

  it('棟・工区・階数・細目は階層列なので自由入力列ではない', () => {
    expect(isFreeTextColumn('building')).toBe(false)
    expect(isFreeTextColumn('zone')).toBe(false)
    expect(isFreeTextColumn('floor')).toBe(false)
    expect(isFreeTextColumn('detail')).toBe(false)
  })
})

describe('余白行の結合', () => {
  const gridCol = col({ id: 'col-grid', type: 'grid', label: '通り' })
  const vals = new Map([
    ['col-grid:0', 'X1'],
    ['col-grid:1', 'X1'],
  ])
  const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''

  it('余白行は同じ値が続いてもまとめない（1行ずつ独立したセルにする）', () => {
    expect(resolveHeaderCellKey(gridCol, undefined, 0, get))
      .not.toBe(resolveHeaderCellKey(gridCol, undefined, 1, get))
  })

  it('余白行だけの工程表でも、各行が rowSpan 1 のセルになる', () => {
    const groups = buildRowGroups([gridCol], [undefined, undefined, undefined], get, 0)
    const cells = groups.get('col-grid') ?? []
    expect(cells.map((c) => c.isFirst)).toEqual([true, true, true])
    expect(cells.map((c) => c.rowSpan)).toEqual([1, 1, 1])
  })
})
