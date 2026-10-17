import { describe, it, expect } from 'vitest'
import { generateAllPageSVGs } from '@/components/dialogs/SvgPreviewDialog'
import { DEFAULT_HEADER_COLUMNS } from '@/types/adm'
import type { HeaderColumn, HierarchyRow, ProjectSettings, EventNode, Activity } from '@/types/adm'

// 2026-10-17 ゆたかの指摘（本番の画面写真つき）:
//  ・「同一工区や棟の場合はマージする必要があるけどそれが崩れてる」
//  ・「カスタム列を追加して工程表を作ったら工程が貫通してる」
//
// PDF・印刷のSVGは行ヘッダーを全行ベタ描きしていたので、編集画面では
// 結合されている工区・棟が紙では行の数だけ繰り返される。
// また作図レイヤーにクリップが無く、表示期間より前から始まる作業の矢印が
// 行ヘッダーの上を走っていた。どちらもこのSVG生成の出力で確かめる。

const settings = (over: Partial<ProjectSettings> = {}): ProjectSettings =>
  ({
    rowHeight: 40,
    displayRows: 20,
    displayDays: 10,
    displayMode: 'daily',
    viewStartOffset: 0,
    startDate: '2026-10-05',
    weekStartDay: 1,
    edgeCornerRadius: 0,
    paperSize: 'A3',
    paperOrientation: 'landscape',
    calendarHeaderRows: ['day', 'weekday'],
    calendarFontSize: 9,
    monthlyWeeklyLabel: false,
    headerColumns: DEFAULT_HEADER_COLUMNS,
    defaultActivityDisplay: { edgeCornerRadius: 0 },
    ...over,
  }) as unknown as ProjectSettings

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

const dates = Array.from({ length: 10 }, (_, i) => new Date(2026, 9, 5 + i))
type GetCustomValue = (columnId: string, rowIndex: number) => string
const noCustom: GetCustomValue = () => ''

const zoneCol: HeaderColumn = { id: 'col-zone', type: 'zone', label: '工区', width: 60, order: 0, visible: true }
const gridCol: HeaderColumn = { id: 'col-grid', type: 'grid', label: '通り', width: 50, order: 1, visible: true }

/** SVG内に出てくる <text>…</text> の中身を全部ひろう */
function textsOf(svg: string): string[] {
  return Array.from(svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)).map((m) => m[1])
}

function render(
  rows: HierarchyRow[],
  columns: HeaderColumn[],
  getCustomValue: GetCustomValue = noCustom,
  nodes: EventNode[] = [],
  activities: Activity[] = [],
): string {
  return generateAllPageSVGs(
    settings(),
    rows,
    nodes,
    activities,
    dates,
    null,
    new Map(nodes.map((n) => [n.id, n])),
    columns,
    0,
    getCustomValue,
  )[0]
}

describe('PDF・印刷の行ヘッダー', () => {
  it('同じ工区が続く行では、工区名を1回だけ描く', () => {
    const rows = [
      row({ zoneId: 'z1', roomId: 'r1', detailId: 'd1' }),
      row({ zoneId: 'z1', roomId: 'r2', detailId: 'd2' }),
      row({ zoneId: 'z1', roomId: 'r3', detailId: 'd3' }),
    ]
    const svg = render(rows, [zoneCol])
    expect(textsOf(svg).filter((t) => t === '1工区')).toHaveLength(1)
  })

  it('工区が変わればその数だけ描く', () => {
    const rows = [
      row({ zoneId: 'z1', detailId: 'd1' }),
      row({ zoneId: 'z1', detailId: 'd2' }),
      row({ zoneId: 'z2', zoneName: '2工区', detailId: 'd3' }),
    ]
    const svg = render(rows, [zoneCol])
    const texts = textsOf(svg)
    expect(texts.filter((t) => t === '1工区')).toHaveLength(1)
    expect(texts.filter((t) => t === '2工区')).toHaveLength(1)
  })

  it('同じ棟が続く行では、棟名を1回だけ描く', () => {
    const buildingCol: HeaderColumn = { id: 'col-building', type: 'building', label: '棟', width: 50, order: 0, visible: true }
    const rows = [
      row({ buildingId: 'b1', zoneId: 'z1', detailId: 'd1' }),
      row({ buildingId: 'b1', zoneId: 'z2', detailId: 'd2' }),
    ]
    const svg = render(rows, [buildingCol])
    expect(textsOf(svg).filter((t) => t === 'A棟')).toHaveLength(1)
  })

  it('「通り」列に入力した値がPDFにも出る', () => {
    const vals = new Map([['col-grid:0', 'X1']])
    const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''
    const svg = render([row({ detailId: 'd1' })], [gridCol], get)
    expect(textsOf(svg)).toContain('X1')
  })

  it('「通り」の値が同じ行どうしは結合する', () => {
    const vals = new Map([['col-grid:0', 'X1'], ['col-grid:1', 'X1']])
    const get = (columnId: string, rowIndex: number) => vals.get(`${columnId}:${rowIndex}`) ?? ''
    const rows = [row({ detailId: 'd1' }), row({ detailId: 'd2' })]
    const svg = render(rows, [gridCol], get)
    expect(textsOf(svg).filter((t) => t === 'X1')).toHaveLength(1)
  })
})

describe('作図エリアのクリップ', () => {
  it('作図レイヤーに行ヘッダーを避けるクリップがかかっている', () => {
    const svg = render([row({ detailId: 'd1' })], [zoneCol, gridCol])
    // clipPath が定義され、その左端が行ヘッダーの幅（60+50）と一致すること
    const clip = svg.match(/<clipPath id="([^"]+)">\s*<rect x="(\d+(?:\.\d+)?)"/)
    expect(clip).not.toBeNull()
    expect(Number(clip![2])).toBe(110)
    // 作図レイヤーがそのクリップを使っていること
    expect(svg).toMatch(new RegExp(`<g id="layer-activities"[^>]*clip-path="url\\(#${clip![1]}\\)"`))
  })
})
