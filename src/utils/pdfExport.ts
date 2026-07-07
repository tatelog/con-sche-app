import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import type { PrintSettings, PaperSize } from '@/types/print'
import type { ProjectSettings } from '@/types/adm'
import { registerJapaneseFont } from './pdfFont'

const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
}

interface ExportOptions {
  settings: PrintSettings
  svgPages: string[]
  projectSettings: ProjectSettings
}

/** displayModeに応じたヘッダー表示名 */
function getHeaderTitle(workplaceName: string, displayMode: string): string {
  const name = workplaceName || ''
  switch (displayMode) {
    case 'weekly2':
    case 'weekly3':
      return name ? `${name} 週間工程表` : '週間工程表'
    case 'monthly':
      return name ? `${name} 月次工程表` : '月次工程表'
    case 'master':
      return name ? `${name} マスター工程表` : 'マスター工程表'
    default:
      return name ? `${name} 工程表` : '工程表'
  }
}

function formatPeriod(startDate: string, endDate: string): string {
  const fmt = (d: string) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${y}年${parseInt(m)}月${parseInt(day)}日`
  }
  const s = fmt(startDate)
  const e = fmt(endDate)
  if (s && e) return `${s}〜${e}`
  if (s) return `${s}〜`
  return ''
}

function formatDate(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${y}年${parseInt(m)}月${parseInt(day)}日`
}

/** SVG文字列をベクターとしてPDFに描画 */
async function renderSvgToPdf(
  doc: jsPDF,
  svgString: string,
  area: { x: number; y: number; width: number; height: number },
) {
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = svgDoc.documentElement as unknown as SVGElement
  // 左上寄せ：フッター変更時にSVG位置がずれないようにする
  svgElement.setAttribute('preserveAspectRatio', 'xMinYMin meet')
  await svg2pdf(svgElement, doc, {
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
  })
}

/** 1ページ分のPDFコンテンツ（ヘッダー/フッター/外枠/コンテンツ）を描画 */
function drawPageFrame(
  doc: jsPDF,
  settings: PrintSettings,
  projectSettings: ProjectSettings,
  width: number,
  height: number,
  pageIndex: number,
  totalPages: number,
) {
  const { margin, titleBlock, sealBlock, layout } = settings

  const outerWidth = width - margin.left - margin.right
  const outerHeight = height - margin.top - margin.bottom
  const hasFooter = titleBlock.showFooterText === true
  const hasPageNumbers = totalPages > 1
  const pageNumberH = 10
  const effectiveFooterH = hasFooter ? layout.footerHeight : hasPageNumbers ? pageNumberH : 0
  const footerY = margin.top + outerHeight - effectiveFooterH

  // ヘッダー・フッター領域の白背景（SVGコンテンツを覆う）
  doc.setFillColor(255, 255, 255)
  doc.rect(margin.left, margin.top, outerWidth, layout.headerHeight, 'F')
  if (effectiveFooterH > 0) {
    doc.rect(margin.left, footerY, outerWidth, effectiveFooterH, 'F')
  }

  // 外枠
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  doc.rect(margin.left, margin.top, outerWidth, outerHeight)

  // ヘッダー線
  doc.line(margin.left, margin.top + layout.headerHeight, width - margin.right, margin.top + layout.headerHeight)

  // フッター線（フッター領域がある時のみ）
  if (effectiveFooterH > 0) {
    doc.line(margin.left, footerY, width - margin.right, footerY)
  }

  // ── ヘッダー描画 ──
  const showSeal = (titleBlock.showSealBlock ?? true) && sealBlock.slots.length > 0
  const sealBlockWidth = showSeal ? layout.sealBlockWidth : 0

  // 情報欄: showInfoBlockがオンの場合のみ表示、infoChecksでチェックされた項目のみ
  const showInfoBlock = titleBlock.showInfoBlock ?? true
  const infoRows: { label: string; value: string }[] = []
  if (showInfoBlock) {
    const ic = titleBlock.infoChecks ?? { workplaceName: true, period: true, creationDate: true, revision: true }
    if (ic.workplaceName) infoRows.push({ label: '作業所名', value: projectSettings.workplaceName || '' })
    if (ic.period) infoRows.push({ label: '工期', value: formatPeriod(titleBlock.startDate, titleBlock.endDate) })
    if (ic.creationDate) infoRows.push({ label: '作成日', value: formatDate(titleBlock.creationDate || titleBlock.date || '') })
    if (ic.revision) infoRows.push({ label: '改訂', value: `第${titleBlock.revisionNumber ?? 1}版` })
  }

  const infoTableWidth = infoRows.length > 0 ? layout.infoBlockWidth : 0

  // 押印欄
  if (showSeal) {
    drawSealBlock(doc, sealBlock, {
      x: margin.left + outerWidth - sealBlockWidth,
      y: margin.top,
      width: sealBlockWidth,
      height: layout.headerHeight,
    })
  }

  // 情報テーブル
  if (infoRows.length > 0) {
    drawInfoTable(doc, infoRows, {
      x: margin.left + outerWidth - sealBlockWidth - infoTableWidth,
      y: margin.top,
      width: infoTableWidth,
      height: layout.headerHeight,
    })
  }

  // ヘッダータイトル（displayModeに応じた表示名）
  const headerTitle = getHeaderTitle(projectSettings.workplaceName, projectSettings.displayMode)
  const headerTextWidth = outerWidth - sealBlockWidth - infoTableWidth
  const centerX = margin.left + headerTextWidth / 2
  doc.setFontSize(14)
  doc.text(headerTitle, centerX, margin.top + layout.headerHeight * 0.45, { align: 'center' })

  // タイトル欄下部: 作成日（左）、改訂（右）
  const titleBottomY = margin.top + layout.headerHeight - 2
  doc.setFontSize(6.5)
  const creationDateStr = formatDate(titleBlock.creationDate || titleBlock.date || '')
  if (creationDateStr) {
    doc.text(`作成日: ${creationDateStr}`, margin.left + 2, titleBottomY)
  }
  const revisionStr = `第${titleBlock.revisionNumber ?? 1}版`
  doc.text(revisionStr, margin.left + headerTextWidth - 2, titleBottomY, { align: 'right' })

  // ── フッター描画 ──
  if (effectiveFooterH > 0) {
    const footerArea = { x: margin.left, y: footerY, width: outerWidth, height: effectiveFooterH }
    drawFooter(doc, titleBlock, footerArea, pageIndex, totalPages)
  }
}

export async function exportToPDF(options: ExportOptions): Promise<Blob> {
  const { settings, svgPages, projectSettings } = options

  // 用紙サイズをProjectSettingsから取得
  const paperKey = (projectSettings.paperSize === 'custom' ? 'A3' : projectSettings.paperSize) as PaperSize
  const basePaper = PAPER_DIMENSIONS[paperKey]
  const orientation = projectSettings.paperOrientation
  const [width, height] = orientation === 'landscape'
    ? [basePaper.height, basePaper.width]
    : [basePaper.width, basePaper.height]

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [width, height],
  })

  // 日本語フォント登録
  await registerJapaneseFont(doc)

  const { margin, layout } = settings
  const outerWidth = width - margin.left - margin.right
  const outerHeight = height - margin.top - margin.bottom
  const hasMultiPages = svgPages.length > 1
  const pageNumberH = 10
  const effectiveFooterH = settings.titleBlock.showFooterText ? layout.footerHeight : hasMultiPages ? pageNumberH : 0
  const contentHeight = outerHeight - layout.headerHeight - effectiveFooterH
  const drawingArea = {
    x: margin.left,
    y: margin.top + layout.headerHeight,
    width: outerWidth,
    height: contentHeight,
  }

  for (let i = 0; i < svgPages.length; i++) {
    if (i > 0) doc.addPage()

    // SVG → ベクターPDF描画（先に描画し、枠線の下に配置）
    await renderSvgToPdf(doc, svgPages[i], drawingArea)

    // 枠線・ヘッダー・フッターをSVGの上に描画（最前面）
    drawPageFrame(doc, settings, projectSettings, width, height, i, svgPages.length)

  }

  return doc.output('blob')
}

/**
 * ヘッダー右側のプロジェクト情報テーブル（infoChecksで選択された項目のみ）
 */
function drawInfoTable(
  doc: jsPDF,
  rows: { label: string; value: string }[],
  rect: { x: number; y: number; width: number; height: number }
) {
  if (rows.length === 0) return

  doc.setLineWidth(0.3)
  doc.rect(rect.x, rect.y, rect.width, rect.height)

  const rowH = rect.height / rows.length
  const labelW = 18

  doc.setFontSize(5.5)
  rows.forEach((row, i) => {
    const ry = rect.y + i * rowH
    if (i > 0) {
      doc.line(rect.x, ry, rect.x + rect.width, ry)
    }
    // ラベルと値の区切り
    doc.line(rect.x + labelW, ry, rect.x + labelW, ry + rowH)

    doc.text(row.label, rect.x + 1.5, ry + rowH * 0.65)
    doc.text(row.value || '', rect.x + labelW + 1.5, ry + rowH * 0.65, { maxWidth: rect.width - labelW - 3 })
  })
}

/**
 * フッター描画（フッターテキスト + ページ番号）
 */
function drawFooter(
  doc: jsPDF,
  titleBlock: PrintSettings['titleBlock'],
  rect: { x: number; y: number; width: number; height: number },
  pageIndex: number,
  totalPages: number,
) {
  doc.setLineWidth(0.3)

  // フッターテキスト（有効時）
  if (titleBlock.showFooterText && titleBlock.footerText) {
    doc.setFontSize(6)
    const lines = titleBlock.footerText.split('\n')
    const lineHeight = 3
    const startY = rect.y + 3
    lines.forEach((line, i) => {
      if (startY + i * lineHeight < rect.y + rect.height - 5) {
        doc.text(line, rect.x + 3, startY + i * lineHeight)
      }
    })
  }

  // ページ番号（右下）
  if (totalPages > 1) {
    doc.setFontSize(7)
    doc.text(`${pageIndex + 1}/${totalPages}`, rect.x + rect.width - 3, rect.y + rect.height - 2, { align: 'right' })
  }
}

function drawSealBlock(
  doc: jsPDF,
  sealBlock: PrintSettings['sealBlock'],
  rect: { x: number; y: number; width: number; height: number }
) {
  if (sealBlock.slots.length === 0) return

  const slotWidth = rect.width / sealBlock.slots.length

  doc.setLineWidth(0.3)
  doc.rect(rect.x, rect.y, rect.width, rect.height)

  // 横の区切り線（組織名ラベルと押印スペースの境界）
  const labelHeight = Math.min(8, rect.height * 0.3)
  doc.line(rect.x, rect.y + labelHeight, rect.x + rect.width, rect.y + labelHeight)

  sealBlock.slots.forEach((slot, i) => {
    const slotX = rect.x + i * slotWidth

    // 縦の区切り線
    if (i > 0) {
      doc.line(slotX, rect.y, slotX, rect.y + rect.height)
    }

    // 組織名ラベル
    doc.setFontSize(6)
    doc.text(slot.position, slotX + slotWidth / 2, rect.y + labelHeight * 0.7, { align: 'center' })
  })
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
