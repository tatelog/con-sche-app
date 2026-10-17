/**
 * カレンダーヘッダーの「期間ラベル」（年 / 年度 / 月）の置き方。
 *
 * これらのラベルは期間が始まる列に左寄せで固定されていた。利用者から
 * 「センター振分など位置指定ができると嬉しい」という要望があり、
 * 期間のまとまりの中央にも置けるようにした。
 *
 * 編集画面（NetworkCanvas）とPDF・印刷（SvgPreviewDialog）で同じ位置に
 * 出すため、計算をここに集めている。
 */

export type SpanUnit = 'year' | 'fiscalYear' | 'month'
/**
 * start = 期間の先頭の列に左寄せ（従来）
 * cell  = 期間の先頭の列の中で中央
 * span  = 期間のまとまり全体の中央（10月なら15日あたり）
 *
 * ラベルが出る列は「表示範囲の先頭」と「月や年が変わる列」の2種類。
 * 利用者の求めているのはそのセルの中での左右の寄せ方なので、設定には
 * start と cell だけを出している。span は計算だけ用意してある。
 */
export type SpanAlign = 'start' | 'cell' | 'span'

/** 左寄せのときの描画幅。文字が切れないよう従来どおり広めに取る */
const START_ALIGN_WIDTH_IN_DAYS = 8
/** 左寄せのときの左の余白 */
const START_ALIGN_PADDING = 2

/** その日が属する期間の識別子。同じ期間なら同じ値になる */
function spanKey(date: Date, unit: SpanUnit): string {
  switch (unit) {
    case 'year':
      return `${date.getFullYear()}`
    case 'fiscalYear': {
      // 4月はじまり
      const fy = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
      return `fy${fy}`
    }
    case 'month':
      return `${date.getFullYear()}-${date.getMonth()}`
  }
}

/**
 * index の列から始まる期間が、表示範囲の中で何列ぶん続くか。
 * 期間が表示の端で切れている場合は、見えているぶんだけ数える。
 */
export function spanLengthAt(dates: Date[], index: number, unit: SpanUnit): number {
  if (index < 0 || index >= dates.length) return 0
  const key = spanKey(dates[index], unit)
  let length = 0
  for (let i = index; i < dates.length; i++) {
    if (spanKey(dates[i], unit) !== key) break
    length++
  }
  return length
}

export interface SpanLabelPlacement {
  /** 期間の先頭の列の左端から見た、ラベルの基準位置 */
  offsetX: number
  /** ラベルに割り当てる幅 */
  width: number
  /** 文字をどこ基準で置くか */
  anchor: 'start' | 'middle'
}

export function spanLabelPlacement(
  dates: Date[],
  index: number,
  unit: SpanUnit,
  align: SpanAlign,
  dayWidth: number,
): SpanLabelPlacement {
  if (align === 'start') {
    return {
      offsetX: START_ALIGN_PADDING,
      width: dayWidth * START_ALIGN_WIDTH_IN_DAYS,
      anchor: 'start',
    }
  }
  if (align === 'cell') {
    return { offsetX: dayWidth / 2, width: dayWidth, anchor: 'middle' }
  }
  const spanWidth = spanLengthAt(dates, index, unit) * dayWidth
  return { offsetX: spanWidth / 2, width: spanWidth, anchor: 'middle' }
}
