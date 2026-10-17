import { describe, it, expect } from 'vitest'
import { buildRowGroups } from '@/utils/headerColumnValue'
import type { HeaderColumn, HierarchyRow } from '@/types/adm'

// 2026-10-17 社内検証での指摘:
// 「同一工区や棟の場合はマージする必要があるけどそれが崩れてる」
//
// 編集画面(NetworkCanvas)は rowGroupInfo で連続する同じ値をまとめて
// 縦に結合して見せているが、PDF・印刷の描画には結合の概念が無く、
// 全行に値をベタ描きしていた。そのため画面と紙で見え方が食い違う。
// 結合の計算をここに切り出して、両方から同じものを使う。

const col = (over: Partial<HeaderColumn>): HeaderColumn => ({
  id: 'col-zone',
  type: 'zone',
  label: '工区',
  width: 60,
  order: 0,
  visible: true,
  ...over,
})

const row = (over: Partial<HierarchyRow>): HierarchyRow => ({
  buildingId: 'b1',
  buildingName: 'A棟',
  zoneId: 'z1',
  zoneName: '1工区',
  roomId: 'r1',
  roomName: '3',
  detailId: 'd1',
  detailName: '会議室',
  y: 0,
  ...over,
})

const noCustom = () => ''

describe('buildRowGroups', () => {
  it('同じ工区が続く行は、先頭の行にまとめられる', () => {
    const rows = [
      row({ zoneId: 'z1', roomId: 'r1', detailId: 'd1' }),
      row({ zoneId: 'z1', roomId: 'r2', detailId: 'd2' }),
      row({ zoneId: 'z1', roomId: 'r3', detailId: 'd3' }),
    ]
    const groups = buildRowGroups([col({ type: 'zone' })], rows, noCustom)
    const zone = groups.get('col-zone')!
    expect(zone[0]).toEqual({ isFirst: true, rowSpan: 3 })
    expect(zone[1]).toEqual({ isFirst: false, rowSpan: 0 })
    expect(zone[2]).toEqual({ isFirst: false, rowSpan: 0 })
  })

  it('工区が変わったら新しいまとまりになる', () => {
    const rows = [
      row({ zoneId: 'z1', detailId: 'd1' }),
      row({ zoneId: 'z1', detailId: 'd2' }),
      row({ zoneId: 'z2', zoneName: '2工区', detailId: 'd3' }),
    ]
    const groups = buildRowGroups([col({ type: 'zone' })], rows, noCustom)
    const zone = groups.get('col-zone')!
    expect(zone[0]).toEqual({ isFirst: true, rowSpan: 2 })
    expect(zone[1]).toEqual({ isFirst: false, rowSpan: 0 })
    expect(zone[2]).toEqual({ isFirst: true, rowSpan: 1 })
  })

  it('名前が同じでも別の工区なら結合しない（IDで見る）', () => {
    const rows = [
      row({ zoneId: 'z1', zoneName: '1工区', detailId: 'd1' }),
      row({ zoneId: 'z9', zoneName: '1工区', detailId: 'd2' }),
    ]
    const groups = buildRowGroups([col({ type: 'zone' })], rows, noCustom)
    const zone = groups.get('col-zone')!
    expect(zone[0]).toEqual({ isFirst: true, rowSpan: 1 })
    expect(zone[1]).toEqual({ isFirst: true, rowSpan: 1 })
  })

  it('棟も同じようにまとめられる', () => {
    const rows = [
      row({ buildingId: 'b1', zoneId: 'z1', detailId: 'd1' }),
      row({ buildingId: 'b1', zoneId: 'z2', detailId: 'd2' }),
      row({ buildingId: 'b2', buildingName: 'B棟', zoneId: 'z3', detailId: 'd3' }),
    ]
    const groups = buildRowGroups([col({ id: 'col-building', type: 'building', label: '棟' })], rows, noCustom)
    const building = groups.get('col-building')!
    expect(building[0]).toEqual({ isFirst: true, rowSpan: 2 })
    expect(building[2]).toEqual({ isFirst: true, rowSpan: 1 })
  })

  it('カスタム列は入力された値が同じなら結合する', () => {
    const rows = [
      row({ zoneId: 'z1', roomId: 'r1', detailId: 'd1' }),
      row({ zoneId: 'z1', roomId: 'r1', detailId: 'd2' }),
    ]
    const vals = new Map([['col-c1:0', '鉄筋'], ['col-c1:1', '鉄筋']])
    const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''
    const groups = buildRowGroups([col({ id: 'col-c1', type: 'custom', label: '職種' })], rows, get)
    const c = groups.get('col-c1')!
    expect(c[0]).toEqual({ isFirst: true, rowSpan: 2 })
    expect(c[1]).toEqual({ isFirst: false, rowSpan: 0 })
  })

  it('カスタム列の値が違えば結合しない', () => {
    const rows = [
      row({ zoneId: 'z1', roomId: 'r1', detailId: 'd1' }),
      row({ zoneId: 'z1', roomId: 'r1', detailId: 'd2' }),
    ]
    const vals = new Map([['col-c1:0', '鉄筋'], ['col-c1:1', '型枠']])
    const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''
    const groups = buildRowGroups([col({ id: 'col-c1', type: 'custom', label: '職種' })], rows, get)
    const c = groups.get('col-c1')!
    expect(c[0]).toEqual({ isFirst: true, rowSpan: 1 })
    expect(c[1]).toEqual({ isFirst: true, rowSpan: 1 })
  })

  it('データのない余白行どうしは結合しない', () => {
    const rows = [row({ zoneId: 'z1', detailId: 'd1' }), undefined, undefined]
    const groups = buildRowGroups([col({ type: 'zone' })], rows, noCustom)
    const zone = groups.get('col-zone')!
    expect(zone[0]).toEqual({ isFirst: true, rowSpan: 1 })
    expect(zone[1]).toEqual({ isFirst: true, rowSpan: 1 })
    expect(zone[2]).toEqual({ isFirst: true, rowSpan: 1 })
  })

  it('行番号の起点を渡すと、カスタム列の値をその通し番号で引く（2ページ目）', () => {
    const rows = [
      row({ zoneId: 'z1', roomId: 'r1', detailId: 'd1' }),
      row({ zoneId: 'z1', roomId: 'r1', detailId: 'd2' }),
    ]
    const vals = new Map([['col-c1:20', '内装'], ['col-c1:21', '内装']])
    const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''
    // 1ページ20行なら、2ページ目の先頭はデータ上の21行目(index 20)
    const groups = buildRowGroups([col({ id: 'col-c1', type: 'custom', label: '職種' })], rows, get, 20)
    const c = groups.get('col-c1')!
    expect(c[0]).toEqual({ isFirst: true, rowSpan: 2 })
  })

  it('複数の列をいっぺんに計算できる', () => {
    const rows = [
      row({ zoneId: 'z1', roomId: 'r1', detailId: 'd1', detailName: '会議室' }),
      row({ zoneId: 'z1', roomId: 'r2', detailId: 'd2', detailName: 'ホール' }),
    ]
    const groups = buildRowGroups(
      [col({ type: 'zone' }), col({ id: 'col-detail', type: 'detail', label: '部屋名' })],
      rows,
      noCustom,
    )
    expect(groups.get('col-zone')![0]).toEqual({ isFirst: true, rowSpan: 2 })
    expect(groups.get('col-detail')![0]).toEqual({ isFirst: true, rowSpan: 1 })
    expect(groups.get('col-detail')![1]).toEqual({ isFirst: true, rowSpan: 1 })
  })
})
