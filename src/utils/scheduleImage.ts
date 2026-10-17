/**
 * 工程表に貼る画像（キープラン・凡例など）の扱い。
 *
 * 利用者からの要望でフッターに画像を置けるようにした。画像はファイル選択と
 * クリップボードの貼り付けの両方から受け取る。
 *
 * 画像は印刷設定ではなく工程表のデータ側に持たせている。印刷設定は
 * ブラウザの localStorage に入っており、画像を入れると容量を使い切って
 * 他の設定ごと保存できなくなるため。
 */

/** 受け付ける画像の形式 */
const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg']

/** 1枚あたりの上限。これを超えるとファイルが重くなりすぎる */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** 貼れる枚数の上限 */
export const MAX_IMAGE_COUNT = 10

/** 全部あわせた容量の上限。ブラウザの中に持つので際限なくは置けない */
export const MAX_TOTAL_BYTES = 12 * 1024 * 1024

/**
 * フッターの内側に取る余白(mm)。
 * 画面で見える大きさとPDFに出る大きさを合わせるため、設定パネルと
 * PDF出力の両方でこの値を使う。
 */
export const FOOTER_PADDING_MM = 3

export interface ScheduleImage {
  id: string
  dataUrl: string
  mimeType: string
  /** 元画像の画素数。倍率を変えるときの基準にする */
  naturalWidth: number
  naturalHeight: number
  /** 紙の上での大きさ(mm) */
  widthMm: number
  heightMm: number
}

export interface Size {
  width: number
  height: number
}

export function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_TYPES.includes(mimeType.toLowerCase())
}

/** 受け取れない画像なら理由を返す。問題なければ null */
export function validateImageSource(mimeType: string, byteSize: number): string | null {
  if (!isSupportedImageType(mimeType)) {
    return 'PNG と JPEG の画像を選んでください'
  }
  if (byteSize > MAX_IMAGE_BYTES) {
    const mb = Math.round((MAX_IMAGE_BYTES / 1024 / 1024) * 10) / 10
    return `画像が大きすぎます（${mb}MB までにしてください）`
  }
  return null
}

/** データURLが占めるおおよそのバイト数 */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return Math.floor((body.length * 3) / 4)
}

function formatMb(bytes: number): string {
  return String(Math.round((bytes / 1024 / 1024) * 10) / 10)
}

/** もう1枚追加できるか。できないなら理由を返す */
export function canAddImage(current: ScheduleImage[], newByteSize: number): string | null {
  if (current.length >= MAX_IMAGE_COUNT) {
    return `画像は ${MAX_IMAGE_COUNT} 枚までです`
  }
  const used = current.reduce((sum, img) => sum + dataUrlBytes(img.dataUrl), 0)
  if (used + newByteSize > MAX_TOTAL_BYTES) {
    return `画像の合計が大きすぎます（合計 ${formatMb(MAX_TOTAL_BYTES)}MB までです）`
  }
  return null
}

/** 縦横比を保ったまま枠に収める。枠より小さい画像は拡大しない */
export function fitWithinBox(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
): Size {
  if (naturalWidth <= 0 || naturalHeight <= 0) return { width: 0, height: 0 }
  const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight, 1)
  return { width: naturalWidth * scale, height: naturalHeight * scale }
}

/** 倍率をかけた大きさ。小さくしすぎても消えないよう下限を持たせる */
export function scaledSize(width: number, height: number, scale: number): Size {
  const MIN = 0.1
  return {
    width: Math.max(MIN, width * scale),
    height: Math.max(MIN * (height / width || 1), height * scale),
  }
}

let seq = 0

export function createScheduleImage(
  dataUrl: string,
  mimeType: string,
  naturalWidth: number,
  naturalHeight: number,
  boxWidthMm: number,
  boxHeightMm: number,
): ScheduleImage {
  const fitted = fitWithinBox(naturalWidth, naturalHeight, boxWidthMm, boxHeightMm)
  seq += 1
  return {
    id: `img-${Date.now()}-${seq}`,
    dataUrl,
    mimeType,
    naturalWidth,
    naturalHeight,
    widthMm: fitted.width,
    heightMm: fitted.height,
  }
}
