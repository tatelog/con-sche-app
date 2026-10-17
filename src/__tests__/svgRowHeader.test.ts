import { describe, it, expect } from 'vitest'
import { generateAllPageSVGs } from '@/components/dialogs/SvgPreviewDialog'
import { DEFAULT_HEADER_COLUMNS } from '@/types/adm'
import type { HeaderColumn, HierarchyRow, ProjectSettings, EventNode, Activity } from '@/types/adm'

// 2026-10-17 社内検証での指摘（本番画面の確認）:
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
  settingsOverride: Partial<ProjectSettings> = {},
): string {
  return generateAllPageSVGs(
    settings(settingsOverride),
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

// 2026-10-17 利用者からのお問い合わせ:
// 「日曜日の下の下線部が消えてしまっている。土曜日も同様？？」
//
// 出力PDFを8倍に拡大して画素を確認したところ、平日の列は罫線の色が線幅ぶん
// 出ているのに対し、土日の列は線の下半分が非稼働日の塗りで覆われていた。
// ヘッダー下端の線を描いたあとに、同じ高さから非稼働日の塗りを描いているため。
describe('ヘッダー下端の罫線', () => {
  it('非稼働日の塗りより後に罫線を描く（土日で線が欠けない）', () => {
    // dates は 2026-10-05 から10日間。10/10(土) と 10/11(日) を含む。
    // ヘッダーの高さは50固定。下端の罫線と非稼働日の塗りがどちらも y=50 から始まる。
    // 塗りが後だと線の下半分が潰れるので、塗り→線の順で描かれていること。
    const svg = render([row({ detailId: 'd1' })], [zoneCol])
    const ruleIndex = svg.search(/<line x1="[\d.]+" y1="50" x2="[\d.]+" y2="50" stroke="#9CA3AF"/)
    const fillIndex = svg.search(/<rect x="[\d.]+" y="50" width="[\d.]+" height="[\d.]+" fill="#F3F4F6"\/>/)
    expect(ruleIndex).toBeGreaterThanOrEqual(0)
    expect(fillIndex).toBeGreaterThanOrEqual(0)
    expect(fillIndex).toBeLessThan(ruleIndex)
  })
})

// 2026-10-17 利用者からのお問い合わせ:
// 「日にちが枠線に近い気がします」
//
// 実測すると「近い」のではなく、日付の文字がヘッダー上端の罫線をまたいでいた。
// 日付・曜日・月の3行とも行の中央より一律に上へずれている。原因は縦位置に
// dominant-baseline="middle" を使っていること。これはPDF変換で効かない。
// 同じヘッダー内でも列見出しは dominant-baseline を使わず y に手で
// オフセットを足しており、そちらは行の中央に収まっていた。
describe('カレンダーヘッダーの文字の縦位置', () => {
  it('dominant-baseline に頼らない（PDF変換で効かないため）', () => {
    const svg = render([row({ detailId: 'd1' })], [zoneCol])
    expect(svg).not.toContain('dominant-baseline')
  })

  it('文字のベースラインが行の中央より下に置かれている', () => {
    const svg = render([row({ detailId: 'd1' })], [zoneCol])
    // ヘッダーは day / weekday の2行。1行目（日付）の中央は 50/2/2 = 12.5。
    // dates の先頭は 2026-10-05 なので、文字が "5" の text を見る
    // （列見出しも text-anchor=middle なので、中身で日付を特定する）
    const dayText = svg.match(/<text x="[\d.]+" y="([\d.]+)" text-anchor="middle" font-size="([\d.]+)" fill="[^"]*">5<\/text>/)
    expect(dayText).not.toBeNull()
    const y = Number(dayText![1])
    const fontSize = Number(dayText![2])
    // 2行ヘッダーなら1行の高さは25、その中央は12.5
    const rowCenter = 12.5
    expect(y).toBeGreaterThan(rowCenter)
    // 下げ幅は文字の高さの半分より小さい（行からはみ出さない）
    expect(y - rowCenter).toBeLessThan(fontSize / 2)
  })
})

// 2026-10-17 社内検証での指摘:
// 「日付のパターンを変えても大丈夫か」
// カレンダーヘッダーの行構成（日 / 曜日 / 月 / 年 / 年度 / 祝日名）は設定で
// 最大3行まで組み替えられ、文字の大きさも変えられる。どの組み合わせでも
// 文字が行の内側に収まることを確かめる。
describe('ヘッダーの行構成を変えても文字が行に収まる', () => {
  const HEADER_HEIGHT = 50

  /** 指定した文字の <text> の y とフォントサイズを拾う */
  function textOf(svg: string, label: string) {
    const m = svg.match(
      new RegExp(`<text x="[\\d.]+" y="([\\d.]+)" text-anchor="middle" font-size="([\\d.]+)" fill="[^"]*">${label}</text>`),
    )
    return m ? { y: Number(m[1]), fontSize: Number(m[2]) } : null
  }

  /** 文字がその行の上下からはみ出していないか（ベースライン基準のざっくり判定） */
  function withinRow(y: number, fontSize: number, rowIndex: number, rowCount: number) {
    const rowH = HEADER_HEIGHT / rowCount
    const top = rowIndex * rowH
    const bottom = top + rowH
    const glyphTop = y - fontSize * 0.8
    const glyphBottom = y + fontSize * 0.2
    return glyphTop >= top && glyphBottom <= bottom
  }

  const cases: { name: string; rows: string[]; dayRowIndex: number }[] = [
    { name: '日付だけの1行', rows: ['day'], dayRowIndex: 0 },
    { name: '日付と曜日の2行', rows: ['day', 'weekday'], dayRowIndex: 0 },
    { name: '月・日付・曜日の3行', rows: ['month', 'day', 'weekday'], dayRowIndex: 1 },
    { name: '年・月・日付の3行', rows: ['year', 'month', 'day'], dayRowIndex: 2 },
    { name: '日付・曜日・祝日名の3行', rows: ['day', 'weekday', 'holiday'], dayRowIndex: 0 },
  ]

  for (const c of cases) {
    it(`${c.name}でも日付が行の内側に収まる`, () => {
      const svg = render([row({ detailId: 'd1' })], [zoneCol], noCustom, [], [], {
        calendarHeaderRows: c.rows as ProjectSettings['calendarHeaderRows'],
      })
      const t = textOf(svg, '5') // dates の先頭は 2026-10-05
      expect(t).not.toBeNull()
      expect(withinRow(t!.y, t!.fontSize, c.dayRowIndex, c.rows.length)).toBe(true)
    })
  }

  it('文字を大きくしても行からはみ出さない（行高に合わせて抑えられる）', () => {
    const svg = render([row({ detailId: 'd1' })], [zoneCol], noCustom, [], [], {
      calendarHeaderRows: ['month', 'day', 'weekday'] as ProjectSettings['calendarHeaderRows'],
      calendarFontSize: 20,
    })
    const t = textOf(svg, '5')
    expect(t).not.toBeNull()
    expect(withinRow(t!.y, t!.fontSize, 1, 3)).toBe(true)
  })

  it('曜日も行の内側に収まる', () => {
    const svg = render([row({ detailId: 'd1' })], [zoneCol], noCustom, [], [], {
      calendarHeaderRows: ['month', 'day', 'weekday'] as ProjectSettings['calendarHeaderRows'],
    })
    const t = textOf(svg, '月') // 2026-10-05 は月曜
    expect(t).not.toBeNull()
    expect(withinRow(t!.y, t!.fontSize, 2, 3)).toBe(true)
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
