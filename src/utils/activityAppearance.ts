/**
 * 作業の見た目（線色・文字色・文字サイズ・引き出し線）を決める。
 *
 * 画面(ActivityArrow)とPDF・印刷(SvgPreviewDialog)が別々に分岐を持っていて、
 * 片方だけ直すと食い違うため、判断をここにまとめた
 * （utils/headerColumnValue と同じ考え方）。
 *
 * 文字色は、指定が無ければ線色に合わせる。以前は線色を変えても文字は
 * 灰色のままで、利用者から「線色同様に文字色も一緒に変わってほしい」と
 * 指摘があった。
 */

export const CRITICAL_COLOR = '#DC2626' // red-600

export type LeaderLineStyle = 'line' | 'underline' | 'none'

export interface ActivityAppearanceInput {
  /** 作業に設定された線色 */
  lineColor: string
  /** 作業に設定された文字色。未指定なら線色に合わせる */
  textColor?: string
  /** 作業に設定された文字サイズ。未指定ならプロジェクトの既定 */
  fontSize?: number
  /** 作業に設定された引き出し線スタイル。未指定ならプロジェクトの既定 */
  leaderLineStyle?: LeaderLineStyle
  /** クリティカルパス上の作業か */
  isCritical: boolean
  /** クリティカルパスを色で示すか（プロジェクト設定） */
  highlightCritical: boolean
  /** プロジェクトの既定の文字サイズ */
  defaultFontSize: number
  /** プロジェクトの既定の引き出し線スタイル */
  defaultLeaderLineStyle?: LeaderLineStyle
}

export interface ResolvedActivityAppearance {
  lineColor: string
  textColor: string
  fontSize: number
  leaderLineStyle: LeaderLineStyle
}

export function resolveActivityAppearance(
  input: ActivityAppearanceInput,
): ResolvedActivityAppearance {
  const critical = input.isCritical && input.highlightCritical

  // クリティカルパスの赤は、作業ごとの指定より優先する。
  // 赤を自分の強調に使いたい場合は、プロジェクト設定で色分けを切る。
  const lineColor = critical ? CRITICAL_COLOR : input.lineColor
  const textColor = critical ? CRITICAL_COLOR : (input.textColor || input.lineColor)

  const fontSize =
    typeof input.fontSize === 'number' && input.fontSize > 0
      ? input.fontSize
      : input.defaultFontSize

  const leaderLineStyle = input.leaderLineStyle ?? input.defaultLeaderLineStyle ?? 'line'

  return { lineColor, textColor, fontSize, leaderLineStyle }
}
