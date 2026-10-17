/**
 * 表題欄の高さの決め方。
 *
 * 押印欄（施主・監理事務所…）のラベル行と、情報欄（作業所名・工期・作成日・改訂）は
 * それぞれ別の式で高さを出していたため、横罫線が揃わず段差になっていた。
 *   情報欄 : ヘッダー高 / 行数          （30mm・4行なら 7.5mm）
 *   押印欄 : min(8, ヘッダー高 * 0.3)   （同条件で 8mm → 0.5mm ずれる）
 *
 * 押印欄のラベル行の下端を、情報欄の罫線のどれかに合わせる。
 * 押印欄のラベルとして自然な高さ（8mm 目安）に最も近い罫線を選ぶ。
 */
const PREFERRED_LABEL_HEIGHT = 8

export function sealLabelHeight(headerHeight: number, infoRowCount: number): number {
  // 情報欄が無いときは合わせる相手がいないので従来どおり
  if (infoRowCount <= 0) return Math.min(PREFERRED_LABEL_HEIGHT, headerHeight * 0.3)

  const rowHeight = headerHeight / infoRowCount

  // 罫線の位置（行高の整数倍）のうち、8mm に最も近いものを選ぶ。
  // ヘッダー全体を埋めてしまわないよう、最後の罫線は使わない
  let best = rowHeight
  for (let n = 2; n <= infoRowCount - 1; n++) {
    const candidate = rowHeight * n
    if (Math.abs(candidate - PREFERRED_LABEL_HEIGHT) < Math.abs(best - PREFERRED_LABEL_HEIGHT)) {
      best = candidate
    }
  }
  return Math.min(best, headerHeight)
}

/**
 * フッターに空ける高さ(mm)。
 *
 * フッターの文字を出すときだけでなく、画像（キープラン・凡例）を貼ったときも
 * 場所が要る。ここを一箇所にまとめないと、作図領域を決める側と
 * フッターを描く側で食い違い、工程表の下端がフッターに隠れる。
 */
export function footerAreaHeight(
  showFooterText: boolean,
  imageCount: number,
  footerHeight: number,
  hasPageNumbers: boolean,
  pageNumberHeight: number,
): number {
  if (showFooterText || imageCount > 0) return footerHeight
  return hasPageNumbers ? pageNumberHeight : 0
}
