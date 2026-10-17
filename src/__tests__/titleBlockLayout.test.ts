import { describe, it, expect } from 'vitest'
import { sealLabelHeight, footerAreaHeight } from '@/utils/titleBlockLayout'

// 2026-10-17 利用者からのお問い合わせ:
// 「どうしてのここの枠線のズレが気になってしまいます」（表題欄の右上を指して）
//
// 出力PDFの罫線座標を実測したところ、情報欄（作業所名・工期・作成日・改訂）の
// 1行目の下線が y=49.61pt、押印欄のラベル行の下線が y=51.02pt で、
// 1.41pt（約0.5mm）ずれていた。
//   情報欄   : 行高 = ヘッダー高 / 行数          → 30mm / 4 = 7.5mm
//   押印欄   : ラベル高 = min(8, ヘッダー高*0.3) → min(8, 9) = 8mm
// 基準が別々なので揃わない。押印欄のラベル行の下端を、情報欄の罫線に合わせる。

describe('sealLabelHeight', () => {
  it('情報欄の行の高さに合わせる（4行・ヘッダー30mm）', () => {
    // 行高7.5mm。従来は8mmで0.5mmずれていた
    expect(sealLabelHeight(30, 4)).toBeCloseTo(7.5, 5)
  })

  it('情報欄の罫線のどれかと必ず一致する', () => {
    const headerHeight = 30
    for (const rows of [1, 2, 3, 4, 5, 6]) {
      const rowH = headerHeight / rows
      const h = sealLabelHeight(headerHeight, rows)
      // 行高の整数倍になっている＝情報欄のどれかの罫線と同じ高さ
      const ratio = h / rowH
      expect(Math.abs(ratio - Math.round(ratio))).toBeLessThan(1e-9)
    }
  })

  it('8mmに最も近い罫線を選ぶ（押印欄のラベルとして自然な高さ）', () => {
    // 6行なら行高5mm。候補は5,10,15… 8に近いのは10ではなく5… ではなく
    // |5-8|=3, |10-8|=2 なので10を選ぶ
    expect(sealLabelHeight(30, 6)).toBeCloseTo(10, 5)
    // 3行なら行高10mm。候補は10,20。8に近いのは10
    expect(sealLabelHeight(30, 3)).toBeCloseTo(10, 5)
  })

  it('ヘッダー全体の高さは超えない', () => {
    const h = sealLabelHeight(6, 1)
    expect(h).toBeLessThanOrEqual(6)
    expect(h).toBeGreaterThan(0)
  })

  it('情報欄が無いときは従来どおりの高さにする', () => {
    // min(8, ヘッダー高 * 0.3)
    expect(sealLabelHeight(30, 0)).toBeCloseTo(8, 5)
    expect(sealLabelHeight(20, 0)).toBeCloseTo(6, 5)
  })
})

// 2026-10-18 社内検証で見つけた不具合:
// 画像だけを貼って「フッター」のチェックを外したままにすると、
// 作図領域がフッターのぶん縮まないまま工程表が描かれ、
// あとから重ねて描くフッターに下端が隠れていた。
// （印刷プレビューのSVGが高さ1010のまま。フッターONなら930になる）
//
// フッター領域の高さは次の順で決まる:
//   フッター文字あり → フッターの高さ
//   画像が1枚以上あり → フッターの高さ（文字が無くても要る）
//   どちらも無くページ番号あり → ページ番号ぶん
//   どれも無い → 0
describe('footerAreaHeight', () => {
  const FOOTER = 25
  const PAGE_NUM = 10

  it('フッター文字を出すときはフッターの高さ', () => {
    expect(footerAreaHeight(true, 0, FOOTER, false, PAGE_NUM)).toBe(FOOTER)
  })

  it('画像を貼っていれば、フッター文字が無くてもフッターの高さ', () => {
    expect(footerAreaHeight(false, 1, FOOTER, false, PAGE_NUM)).toBe(FOOTER)
  })

  it('フッター文字と画像の両方があってもフッターの高さは変わらない', () => {
    expect(footerAreaHeight(true, 3, FOOTER, true, PAGE_NUM)).toBe(FOOTER)
  })

  it('どちらも無く複数ページならページ番号ぶんだけ空ける', () => {
    expect(footerAreaHeight(false, 0, FOOTER, true, PAGE_NUM)).toBe(PAGE_NUM)
  })

  it('どれも無ければ空けない', () => {
    expect(footerAreaHeight(false, 0, FOOTER, false, PAGE_NUM)).toBe(0)
  })
})
