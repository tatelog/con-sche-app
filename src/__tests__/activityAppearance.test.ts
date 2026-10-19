import { describe, it, expect } from 'vitest'
import {
  resolveActivityAppearance,
  CRITICAL_COLOR,
} from '@/utils/activityAppearance'

/**
 * 作業の見た目（線色・文字色・文字サイズ・引き出し線）の決め方を固める。
 *
 * 利用者から3つの要望があった。
 * ・文字サイズを変えられるようにしてほしい
 * ・線色と同じように文字色も一緒に変わってほしい
 * ・引き出し線に「なし」がほしい
 * さらに、クリティカルパスの赤を消して、赤を自分の強調に使いたいという要望も。
 *
 * 画面(ActivityArrow)とPDF(SvgPreviewDialog)で同じ答えを出すために切り出す。
 */

const base = {
  lineColor: '#374151',
  isCritical: false,
  highlightCritical: true,
  defaultFontSize: 9,
}

describe('文字色', () => {
  it('指定が無ければ線色に合わせる', () => {
    const r = resolveActivityAppearance({ ...base, lineColor: '#2563EB' })
    expect(r.textColor).toBe('#2563EB')
  })

  it('文字色を指定したら、そちらが勝つ', () => {
    const r = resolveActivityAppearance({ ...base, lineColor: '#2563EB', textColor: '#111827' })
    expect(r.textColor).toBe('#111827')
  })
})

describe('クリティカルパスの色', () => {
  it('色で示す設定なら、線も文字も赤になる', () => {
    const r = resolveActivityAppearance({ ...base, isCritical: true })
    expect(r.lineColor).toBe(CRITICAL_COLOR)
    expect(r.textColor).toBe(CRITICAL_COLOR)
  })

  it('色で示さない設定なら、クリティカルパスでも自分の色のまま', () => {
    const r = resolveActivityAppearance({
      ...base,
      lineColor: '#374151',
      isCritical: true,
      highlightCritical: false,
    })
    expect(r.lineColor).toBe('#374151')
    expect(r.textColor).toBe('#374151')
  })

  it('色で示さない設定なら、赤を指定した作業だけが赤くなる', () => {
    const r = resolveActivityAppearance({
      ...base,
      lineColor: CRITICAL_COLOR,
      isCritical: false,
      highlightCritical: false,
    })
    expect(r.lineColor).toBe(CRITICAL_COLOR)
    expect(r.textColor).toBe(CRITICAL_COLOR)
  })

  it('クリティカルパスの色は、作業ごとの文字色の指定より優先する', () => {
    const r = resolveActivityAppearance({ ...base, isCritical: true, textColor: '#111827' })
    expect(r.textColor).toBe(CRITICAL_COLOR)
  })
})

describe('文字サイズ', () => {
  it('指定が無ければプロジェクトの既定を使う', () => {
    expect(resolveActivityAppearance({ ...base, defaultFontSize: 9 }).fontSize).toBe(9)
  })

  it('作業ごとに指定したら、そちらを使う', () => {
    expect(resolveActivityAppearance({ ...base, fontSize: 14 }).fontSize).toBe(14)
  })

  it('0 や負の値は既定に落とす', () => {
    expect(resolveActivityAppearance({ ...base, fontSize: 0 }).fontSize).toBe(9)
    expect(resolveActivityAppearance({ ...base, fontSize: -3 }).fontSize).toBe(9)
  })
})

describe('引き出し線', () => {
  it('指定が無ければプロジェクトの既定を使う', () => {
    const r = resolveActivityAppearance({ ...base, defaultLeaderLineStyle: 'underline' })
    expect(r.leaderLineStyle).toBe('underline')
  })

  it('どちらも無ければ線を引く', () => {
    expect(resolveActivityAppearance({ ...base }).leaderLineStyle).toBe('line')
  })

  it('「なし」を選べる', () => {
    const r = resolveActivityAppearance({
      ...base,
      leaderLineStyle: 'none',
      defaultLeaderLineStyle: 'line',
    })
    expect(r.leaderLineStyle).toBe('none')
  })
})
