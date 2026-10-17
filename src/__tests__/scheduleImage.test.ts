import { describe, it, expect } from 'vitest'
import {
  isSupportedImageType,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  MAX_TOTAL_BYTES,
  canAddImage,
  validateImageSource,
  fitWithinBox,
  scaledSize,
  createScheduleImage,
} from '@/utils/scheduleImage'

// 2026-10-17 利用者からのお問い合わせ:
// 「フッターに画像データを入れれるようにすることは可能でしょうか？
//   用途としては、キープラン、凡例などを入れたいです。※不可でも問題ございません」
//
// 画像はファイル選択とクリップボードの貼り付けの両方から受け取る。
// 対応は PNG と JPEG。貼ったあと大きさを変えられるようにする。

describe('isSupportedImageType', () => {
  it('PNGとJPEGを受け付ける', () => {
    expect(isSupportedImageType('image/png')).toBe(true)
    expect(isSupportedImageType('image/jpeg')).toBe(true)
  })

  it('jpg という書き方も受け付ける', () => {
    expect(isSupportedImageType('image/jpg')).toBe(true)
  })

  it('大文字で来ても受け付ける', () => {
    expect(isSupportedImageType('IMAGE/PNG')).toBe(true)
  })

  it('それ以外は受け付けない', () => {
    expect(isSupportedImageType('image/gif')).toBe(false)
    expect(isSupportedImageType('image/svg+xml')).toBe(false)
    expect(isSupportedImageType('application/pdf')).toBe(false)
    expect(isSupportedImageType('')).toBe(false)
  })
})

describe('validateImageSource', () => {
  it('対応している形式で大きすぎなければ通る', () => {
    expect(validateImageSource('image/png', 1024)).toBeNull()
  })

  it('対応していない形式は理由を返す', () => {
    const reason = validateImageSource('image/gif', 1024)
    expect(reason).toContain('PNG')
    expect(reason).toContain('JPEG')
  })

  it('大きすぎる画像は理由を返す', () => {
    const reason = validateImageSource('image/png', MAX_IMAGE_BYTES + 1)
    expect(reason).not.toBeNull()
    expect(reason).toContain('大き')
  })

  it('ちょうど上限なら通す', () => {
    expect(validateImageSource('image/png', MAX_IMAGE_BYTES)).toBeNull()
  })
})

// 2026-10-17 社内検証での指示:
// 「1枚あたりの最大容量と貼り付けられる枚数決めれば」
// 画像はブラウザの中に持つため、際限なく貼れると保存できなくなる。
// 1枚あたり・枚数・合計の3つで上限を決める。
describe('canAddImage', () => {
  const img = (bytes: number) => ({
    id: 'x',
    dataUrl: 'data:image/png;base64,' + 'A'.repeat(Math.ceil((bytes * 4) / 3)),
    mimeType: 'image/png',
    naturalWidth: 10,
    naturalHeight: 10,
    widthMm: 10,
    heightMm: 10,
  })

  it('何も貼っていなければ追加できる', () => {
    expect(canAddImage([], 1024)).toBeNull()
  })

  it('枚数が上限に達していたら追加できない', () => {
    const full = Array.from({ length: MAX_IMAGE_COUNT }, () => img(1024))
    const reason = canAddImage(full, 1024)
    expect(reason).not.toBeNull()
    expect(reason).toContain(String(MAX_IMAGE_COUNT))
  })

  it('上限の1枚手前なら追加できる', () => {
    const almost = Array.from({ length: MAX_IMAGE_COUNT - 1 }, () => img(1024))
    expect(canAddImage(almost, 1024)).toBeNull()
  })

  it('合計が上限を超えるなら追加できない', () => {
    const heavy = [img(MAX_TOTAL_BYTES - 1000)]
    const reason = canAddImage(heavy, 5000)
    expect(reason).not.toBeNull()
    expect(reason).toContain('合計')
  })

  it('合計が上限内なら追加できる', () => {
    const some = [img(1024 * 100)]
    expect(canAddImage(some, 1024 * 100)).toBeNull()
  })
})

describe('fitWithinBox', () => {
  it('横長の画像は幅に合わせて縮む', () => {
    // 200x100 を 50x50 の枠に入れる → 50x25
    expect(fitWithinBox(200, 100, 50, 50)).toEqual({ width: 50, height: 25 })
  })

  it('縦長の画像は高さに合わせて縮む', () => {
    // 100x200 を 50x50 の枠に入れる → 25x50
    expect(fitWithinBox(100, 200, 50, 50)).toEqual({ width: 25, height: 50 })
  })

  it('枠より小さい画像は拡大しない', () => {
    expect(fitWithinBox(20, 10, 50, 50)).toEqual({ width: 20, height: 10 })
  })

  it('縦横比は保たれる', () => {
    const r = fitWithinBox(300, 200, 90, 90)
    expect(r.width / r.height).toBeCloseTo(300 / 200, 5)
  })
})

// 2026-10-17 社内検証で見つけた不具合:
// スライダーを動かすとパネルには 115×75mm と出るのに、PDFは 59.9×39.0mm のままだった。
// PDF側はフッターからはみ出さないよう縮めるため、フッターに収まらない大きさを
// 指定できてしまうと表示と出力が食い違う。
// 大きさの指定は「フッターに収まる最大」を上限にする。
describe('フッターに収まる範囲でしか大きくできない', () => {
  it('収まる最大を100%としたとき、どの割合でもフッターからはみ出さない', () => {
    const boxW = 174
    const boxH = 39
    const max = fitWithinBox(719, 468, boxW, boxH)
    for (const percent of [10, 25, 50, 75, 100]) {
      const w = (max.width * percent) / 100
      const h = (max.height * percent) / 100
      expect(w).toBeLessThanOrEqual(boxW + 1e-9)
      expect(h).toBeLessThanOrEqual(boxH + 1e-9)
    }
  })

  it('100%はフッターの高さいっぱいになる（横長の画像）', () => {
    const max = fitWithinBox(719, 468, 174, 39)
    expect(max.height).toBeCloseTo(39, 5)
  })

  it('縦横比は割合を変えても保たれる', () => {
    const max = fitWithinBox(719, 468, 174, 39)
    const half = { width: max.width / 2, height: max.height / 2 }
    expect(half.width / half.height).toBeCloseTo(719 / 468, 5)
  })
})

describe('scaledSize', () => {
  it('倍率をかけた大きさを返す', () => {
    expect(scaledSize(40, 20, 1)).toEqual({ width: 40, height: 20 })
    expect(scaledSize(40, 20, 0.5)).toEqual({ width: 20, height: 10 })
    expect(scaledSize(40, 20, 2)).toEqual({ width: 80, height: 40 })
  })

  it('縦横比は変わらない', () => {
    const r = scaledSize(300, 200, 0.37)
    expect(r.width / r.height).toBeCloseTo(300 / 200, 5)
  })

  it('小さくしすぎても0にはしない', () => {
    const r = scaledSize(40, 20, 0.0001)
    expect(r.width).toBeGreaterThan(0)
    expect(r.height).toBeGreaterThan(0)
  })
})

describe('createScheduleImage', () => {
  const dataUrl = 'data:image/png;base64,AAAA'

  it('フッターの高さに収まる大きさで作られる', () => {
    // 元画像 400x200、フッター領域 180x20mm
    const img = createScheduleImage(dataUrl, 'image/png', 400, 200, 180, 20)
    expect(img.heightMm).toBeLessThanOrEqual(20)
    expect(img.widthMm).toBeLessThanOrEqual(180)
    expect(img.widthMm / img.heightMm).toBeCloseTo(2, 5)
  })

  it('元の大きさを覚えておく（あとで倍率を変えるため）', () => {
    const img = createScheduleImage(dataUrl, 'image/png', 400, 200, 180, 20)
    expect(img.naturalWidth).toBe(400)
    expect(img.naturalHeight).toBe(200)
  })

  it('IDが振られ、同じ画像でも別IDになる', () => {
    const a = createScheduleImage(dataUrl, 'image/png', 400, 200, 180, 20)
    const b = createScheduleImage(dataUrl, 'image/png', 400, 200, 180, 20)
    expect(a.id).not.toBe(b.id)
  })

  it('データと形式を持つ', () => {
    const img = createScheduleImage(dataUrl, 'image/png', 400, 200, 180, 20)
    expect(img.dataUrl).toBe(dataUrl)
    expect(img.mimeType).toBe('image/png')
  })
})
