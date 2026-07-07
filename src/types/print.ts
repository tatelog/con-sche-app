export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1'
export type PaperOrientation = 'portrait' | 'landscape'

export interface InfoChecks {
  workplaceName: boolean
  period: boolean
  creationDate: boolean
  revision: boolean
}

export interface TitleBlock {
  projectName: string       // 旧互換（作業所名はprojectSettingsから参照）
  startDate: string         // ISO YYYY-MM-DD（工期開始 - projectSettingsから参照）
  endDate: string           // ISO YYYY-MM-DD（工期終了 - projectSettingsから参照）
  creationDate: string      // 作成日
  revisionNumber: number    // 第n版
  showInfoBlock: boolean    // 情報欄表示トグル
  infoChecks: InfoChecks    // 情報欄に表示する項目
  showFooterText: boolean   // フッターテキスト表示
  footerText: string        // フッターテキスト（改行可能）
  showSealBlock: boolean    // 押印欄表示トグル
  // 旧フィールド（後方互換）
  drawingTitle: string
  date: string
  designer: string
  checker: string
  approver: string
  companyName: string
  companyLogo?: string
  revision: string
  notes?: string
}

export interface SealSlot {
  id: string
  position: string // 組織名（施主/監理事務所/設計事務所/施工会社）
  name: string
  date?: string
  sealed: boolean
}

export interface SealBlock {
  slots: SealSlot[]
  layout: 'horizontal' | 'vertical'
}

export interface PrintLayoutDimensions {
  headerHeight: number     // mm, default 30
  footerHeight: number     // mm, default 25, max 59
  infoBlockWidth: number   // mm, default 80
  sealBlockWidth: number   // mm, default 80
  rowHeaderWidth: number   // mm, default 30
}

export interface PrintSettings {
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
  titleBlock: TitleBlock
  sealBlock: SealBlock
  showGrid: boolean
  showLegend: boolean
  legendPosition?: { x: number; y: number } // SVG座標系でのオフセット（右下基準、負値=右下からの距離）
  layout: PrintLayoutDimensions
}

// 用紙サイズ（mm）
export const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
}

export function createDefaultPrintSettings(): PrintSettings {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 90)

  return {
    margin: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    },
    titleBlock: {
      projectName: '',
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      creationDate: today.toISOString().split('T')[0],
      revisionNumber: 1,
      showInfoBlock: true,
      infoChecks: {
        workplaceName: true,
        period: true,
        creationDate: true,
        revision: true,
      },
      showFooterText: false,
      footerText: '',
      showSealBlock: true,
      // 旧フィールド
      drawingTitle: '工程表',
      date: today.toISOString().split('T')[0],
      designer: '',
      checker: '',
      approver: '',
      companyName: '',
      revision: 'R0',
    },
    sealBlock: {
      slots: [
        { id: '1', position: '施主', name: '', sealed: false },
        { id: '2', position: '監理事務所', name: '', sealed: false },
        { id: '3', position: '設計事務所', name: '', sealed: false },
        { id: '4', position: '施工会社', name: '', sealed: false },
      ],
      layout: 'horizontal',
    },
    showGrid: true,
    showLegend: true,
    layout: {
      headerHeight: 30,
      footerHeight: 25,
      infoBlockWidth: 80,
      sealBlockWidth: 80,
      rowHeaderWidth: 30,
    },
  }
}
