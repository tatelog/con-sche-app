import { describe, it, expect } from 'vitest'
import { spanLengthAt, spanLabelPlacement } from '@/utils/calendarSpanLabel'

// 2026-10-17 利用者からのお問い合わせ:
// 「センター振分など位置指定ができると嬉しいです。※不可でも問題ございません」
// （カレンダーヘッダーの「1月」を指して）
//
// 月・年・年度のラベルは、その期間が始まる列に左寄せで固定されていた。
// 期間のまとまりの中央にも置けるようにする。既定は従来どおり左寄せ。
// 期間が表示の端で切れている場合は、見えている範囲だけで中央を決める。

const DAY_WIDTH = 20

/** from から n 日ぶんの連続した日付 */
const days = (from: string, n: number): Date[] => {
  const base = new Date(from)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return d
  })
}

describe('spanLengthAt', () => {
  it('月の残り日数を数える（月の初日から）', () => {
    // 2026-10-01 から 40日 → 10月は31日ぶん
    const dates = days('2026-10-01', 40)
    expect(spanLengthAt(dates, 0, 'month')).toBe(31)
  })

  it('次の月は次の月のぶんだけ数える', () => {
    const dates = days('2026-10-01', 40)
    // 11/1 は index 31。残りは 40-31 = 9日ぶん
    expect(spanLengthAt(dates, 31, 'month')).toBe(9)
  })

  it('月の途中から表示が始まるときは、見えている範囲だけ数える', () => {
    // 2026-10-20 から 10日 → 10月は 20〜31 のうち見えているのは12日だが
    // 表示は10日ぶんなので 10月は10日ぶん… ではなく 10/20〜10/29 の10日
    const dates = days('2026-10-20', 10)
    expect(spanLengthAt(dates, 0, 'month')).toBe(10)
  })

  it('月の途中で表示が終わるときも、見えている範囲だけ数える', () => {
    // 2026-10-28 から 7日 → 10/28,29,30,31 の4日ぶんが10月
    const dates = days('2026-10-28', 7)
    expect(spanLengthAt(dates, 0, 'month')).toBe(4)
  })

  it('年でも同じように数えられる', () => {
    // 2026-12-28 から 10日 → 2026年は 12/28〜12/31 の4日
    const dates = days('2026-12-28', 10)
    expect(spanLengthAt(dates, 0, 'year')).toBe(4)
  })

  it('年度は4月はじまりで区切る', () => {
    // 2026-03-29 から 10日 → 2025年度は 3/29,30,31 の3日
    const dates = days('2026-03-29', 10)
    expect(spanLengthAt(dates, 0, 'fiscalYear')).toBe(3)
  })
})

describe('spanLabelPlacement', () => {
  const dates = days('2026-10-01', 40)

  it('左寄せ（既定）は従来どおり期間の先頭に置く', () => {
    const p = spanLabelPlacement(dates, 0, 'month', 'start', DAY_WIDTH)
    expect(p.anchor).toBe('start')
    expect(p.offsetX).toBe(2)
  })

  it('期間の中央は、月のまとまり全体のまんなかに置く（10月なら15日あたり）', () => {
    // 10月は31日ぶん。幅 31*20=620 の中央は 310 ＝ 15.5日目あたり
    const p = spanLabelPlacement(dates, 0, 'month', 'span', DAY_WIDTH)
    expect(p.anchor).toBe('middle')
    expect(p.offsetX).toBe(310)
    expect(p.width).toBe(620)
  })

  it('セルの中央は、期間の先頭の列の中だけで中央に置く', () => {
    const p = spanLabelPlacement(dates, 0, 'month', 'cell', DAY_WIDTH)
    expect(p.anchor).toBe('middle')
    expect(p.offsetX).toBe(DAY_WIDTH / 2)
    expect(p.width).toBe(DAY_WIDTH)
  })

  it('セルの中央は、月の長さが変わっても位置が変わらない', () => {
    const short = days('2026-10-28', 7)
    const a = spanLabelPlacement(dates, 0, 'month', 'cell', DAY_WIDTH)
    const b = spanLabelPlacement(short, 0, 'month', 'cell', DAY_WIDTH)
    expect(a.offsetX).toBe(b.offsetX)
  })

  it('端で切れている月は、見えている範囲のまんなかに置く', () => {
    // 2026-10-28 から7日 → 10月は4日ぶん。幅 80 の中央は 40
    const short = days('2026-10-28', 7)
    const p = spanLabelPlacement(short, 0, 'month', 'span', DAY_WIDTH)
    expect(p.offsetX).toBe(40)
    expect(p.width).toBe(80)
  })

  it('1列しかない月でもはみ出さない位置に置く', () => {
    // 2026-10-31 から3日 → 10月は1日ぶん
    const short = days('2026-10-31', 3)
    const p = spanLabelPlacement(short, 0, 'month', 'span', DAY_WIDTH)
    expect(p.offsetX).toBe(10)
    expect(p.width).toBe(20)
  })

  it('左寄せのときは従来と同じ広めの幅を返す（文字が切れないように）', () => {
    const p = spanLabelPlacement(dates, 0, 'month', 'start', DAY_WIDTH)
    expect(p.width).toBeGreaterThan(DAY_WIDTH)
  })
})
