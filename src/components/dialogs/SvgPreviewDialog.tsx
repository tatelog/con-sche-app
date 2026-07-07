/**
 * SVG印刷プレビューダイアログ（フルスペック版）
 * ActivityArrow / EventNodeShape のレンダリングロジックを完全移植し、
 * admStoreの実データからカレンダー・行ヘッダー・グリッド・ノード・パスを
 * すべてSVGで描画する。
 */

import { useMemo, useState } from 'react'
import { useADMStore } from '@/stores/admStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { usePrintStore } from '@/stores/printStore'
import { PAPER_SIZES } from '@/types/print'
import type { ProjectSettings, HierarchyRow, EventNode, Activity, ProgressLine } from '@/types/adm'
import type { ProjectCalendar } from '@/types/calendar'
import type { TextBox } from '@/types/textbox'
import { useTextBoxStore } from '@/stores/textboxStore'
import { useUIStore } from '@/stores/uiStore'
import { calcPlannedCurve, calcActualCurve } from '@/utils/progressCalc'
import {
  isWeekend,
  isNonWorkday as isNonWorkdayUtil,
  getNonWorkdayRanges as getNonWorkdayRangesUtil,
  getCalendarDaysForWorkdays as getCalendarDaysForWorkdaysUtil,
  computeViewStartDate,
} from '@/utils/dateUtils'

// ── 定数（NetworkCanvas / ActivityArrow / EventNodeShape と同一） ──
const HEADER_HEIGHT = 50
const DEFAULT_ROW_HEIGHT = 40
const DAY_WIDTH = 30
const NODE_RADIUS = 6
const ARROW_HEAD_SIZE = 6
const LEADER_GAP = 12

// 色
const HEADER_BG = '#F3F4F6'
const GRID_COLOR = '#E5E7EB'
const NON_WORKDAY_BG = '#F3F4F6'
const CRITICAL_COLOR = '#DC2626'

interface SvgPreviewDialogProps {
  isOpen: boolean
  onClose: () => void
  projectSettings: ProjectSettings
}

// ═══════════════════════════════════════════════════════
// ActivityArrow ロジック完全移植
// ═══════════════════════════════════════════════════════

/** 水平セグメント分割: 非稼働日 + duration超過 → 破線化 */
function splitHorizontalSegment(
  x1: number, x2: number, y: number,
  nonWorkdayRanges: Array<{ startX: number; endX: number }>,
  workDurationEndX: number,
): Array<{ points: number[]; isDashed: boolean }> {
  const lineStartX = Math.min(x1, x2)
  const lineEndX = Math.max(x1, x2)
  const segments: Array<{ x1: number; x2: number; isDashed: boolean }> = []
  let currentX = lineStartX

  const sortedRanges = [...nonWorkdayRanges]
    .filter(r => r.endX > lineStartX && r.startX < lineEndX)
    .sort((a, b) => a.startX - b.startX)

  for (const range of sortedRanges) {
    const rangeStart = Math.max(range.startX, lineStartX)
    const rangeEnd = Math.min(range.endX, lineEndX)

    if (currentX < rangeStart) {
      const segEnd = rangeStart
      if (currentX < workDurationEndX) {
        const solidEnd = Math.min(segEnd, workDurationEndX)
        if (currentX < solidEnd) segments.push({ x1: currentX, x2: solidEnd, isDashed: false })
        if (solidEnd < segEnd) segments.push({ x1: solidEnd, x2: segEnd, isDashed: true })
      } else {
        segments.push({ x1: currentX, x2: segEnd, isDashed: true })
      }
    }
    if (rangeStart < rangeEnd) segments.push({ x1: rangeStart, x2: rangeEnd, isDashed: true })
    currentX = rangeEnd
  }

  if (currentX < lineEndX) {
    if (currentX < workDurationEndX) {
      const solidEnd = Math.min(lineEndX, workDurationEndX)
      if (currentX < solidEnd) segments.push({ x1: currentX, x2: solidEnd, isDashed: false })
      if (solidEnd < lineEndX) segments.push({ x1: solidEnd, x2: lineEndX, isDashed: true })
    } else {
      segments.push({ x1: currentX, x2: lineEndX, isDashed: true })
    }
  }

  return segments.map(seg => ({ points: [seg.x1, y, seg.x2, y], isDashed: seg.isDashed }))
}

/** 垂直セグメント分割 */
function splitVerticalSegment(
  x: number, y1: number, y2: number,
  nonWorkdayRanges: Array<{ startX: number; endX: number }>,
  workDurationEndX: number,
): Array<{ points: number[]; isDashed: boolean }> {
  const isInNonWorkday = nonWorkdayRanges.some(r => x >= r.startX && x < r.endX)
  const isExceedsDuration = x >= workDurationEndX
  return [{ points: [x, y1, x, y2], isDashed: isInNonWorkday || isExceedsDuration }]
}

/** 全セグメント分割 */
function splitAllSegments(
  points: number[],
  nonWorkdayRanges: Array<{ startX: number; endX: number }>,
  workDurationEndX: number,
): Array<{ points: number[]; isDashed: boolean }> {
  const all: Array<{ points: number[]; isDashed: boolean }> = []
  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i], y1 = points[i + 1], x2 = points[i + 2], y2 = points[i + 3]
    if (y1 === y2) {
      all.push(...splitHorizontalSegment(x1, x2, y1, nonWorkdayRanges, workDurationEndX))
    } else if (x1 === x2) {
      all.push(...splitVerticalSegment(x1, y1, y2, nonWorkdayRanges, workDurationEndX))
    } else {
      const segX = (x1 + x2) / 2
      const isInNonWorkday = nonWorkdayRanges.some(r => segX >= r.startX && segX < r.endX)
      all.push({ points: [x1, y1, x2, y2], isDashed: isInNonWorkday || segX >= workDurationEndX })
    }
  }
  return all
}

/** 角丸セグメント生成（完全移植） */
interface RoundedSegment { points?: number[]; pathData?: string; isDashed: boolean }

function generateRoundedCornerSegments(
  segments: Array<{ points: number[]; isDashed: boolean }>,
  rawPoints: number[],
  cornerRadius: number,
): RoundedSegment[] {
  if (rawPoints.length <= 4 || cornerRadius <= 0) return segments

  const bendPoints: Array<{ x: number; y: number }> = []
  for (let i = 2; i < rawPoints.length - 2; i += 2) {
    bendPoints.push({ x: rawPoints[i], y: rawPoints[i + 1] })
  }
  if (bendPoints.length === 0) return segments

  const segs = segments.map(s => ({ ...s, points: s.points ? [...s.points] : undefined, _cornerAfter: null as { pathData: string; isDashed: boolean } | null }))

  for (const bend of bendPoints) {
    const prevSegIdx = segs.findIndex(s =>
      s.points && s.points[s.points.length - 2] === bend.x && s.points[s.points.length - 1] === bend.y
    )
    const nextSegIdx = segs.findIndex(s =>
      s.points && s.points[0] === bend.x && s.points[1] === bend.y
    )
    if (prevSegIdx === -1 || nextSegIdx === -1) continue

    const prevSeg = segs[prevSegIdx]
    const nextSeg = segs[nextSegIdx]
    if (!prevSeg.points || !nextSeg.points) continue

    const prevLen = Math.sqrt(
      (prevSeg.points[prevSeg.points.length - 2] - prevSeg.points[prevSeg.points.length - 4]) ** 2 +
      (prevSeg.points[prevSeg.points.length - 1] - prevSeg.points[prevSeg.points.length - 3]) ** 2
    )
    const nextLen = Math.sqrt(
      (nextSeg.points[2] - nextSeg.points[0]) ** 2 + (nextSeg.points[3] - nextSeg.points[1]) ** 2
    )

    const r = Math.min(cornerRadius, prevLen / 2, nextLen / 2)
    if (r <= 0.5) continue

    const prevDx = prevSeg.points[prevSeg.points.length - 2] - prevSeg.points[prevSeg.points.length - 4]
    const prevDy = prevSeg.points[prevSeg.points.length - 1] - prevSeg.points[prevSeg.points.length - 3]
    const prevNorm = Math.sqrt(prevDx * prevDx + prevDy * prevDy)
    const nextDx = nextSeg.points[2] - nextSeg.points[0]
    const nextDy = nextSeg.points[3] - nextSeg.points[1]
    const nextNorm = Math.sqrt(nextDx * nextDx + nextDy * nextDy)

    const cornerStartX = bend.x - (prevDx / prevNorm) * r
    const cornerStartY = bend.y - (prevDy / prevNorm) * r
    const cornerEndX = bend.x + (nextDx / nextNorm) * r
    const cornerEndY = bend.y + (nextDy / nextNorm) * r

    prevSeg.points[prevSeg.points.length - 2] = cornerStartX
    prevSeg.points[prevSeg.points.length - 1] = cornerStartY
    nextSeg.points[0] = cornerEndX
    nextSeg.points[1] = cornerEndY

    prevSeg._cornerAfter = {
      pathData: `M ${cornerStartX} ${cornerStartY} Q ${bend.x} ${bend.y} ${cornerEndX} ${cornerEndY}`,
      isDashed: prevSeg.isDashed,
    }
  }

  const result: RoundedSegment[] = []
  for (const seg of segs) {
    if (seg.points) {
      const segLen = Math.sqrt(
        (seg.points[seg.points.length - 2] - seg.points[0]) ** 2 +
        (seg.points[seg.points.length - 1] - seg.points[1]) ** 2
      )
      if (segLen > 0.5) result.push({ points: seg.points, isDashed: seg.isDashed })
    }
    if (seg._cornerAfter) result.push({ pathData: seg._cornerAfter.pathData, isDashed: seg._cornerAfter.isDashed })
  }

  return result
}

/** パス中間点＋セグメント方向（ラベル配置用） */
function getPathMidpointWithSegmentInfo(pts: number[]): {
  x: number; y: number; segmentDirection: 'horizontal' | 'vertical' | 'diagonal'
} {
  if (pts.length < 4) return { x: pts[0] ?? 0, y: pts[1] ?? 0, segmentDirection: 'horizontal' }

  let totalLength = 0
  const segLengths: number[] = []
  for (let i = 0; i < pts.length - 2; i += 2) {
    const sdx = pts[i + 2] - pts[i], sdy = pts[i + 3] - pts[i + 1]
    const len = Math.sqrt(sdx * sdx + sdy * sdy)
    segLengths.push(len)
    totalLength += len
  }
  if (totalLength === 0) return { x: pts[0], y: pts[1], segmentDirection: 'horizontal' }

  const halfLength = totalLength / 2
  let accumulated = 0
  for (let i = 0; i < segLengths.length; i++) {
    if (accumulated + segLengths[i] >= halfLength) {
      const t = segLengths[i] > 0 ? (halfLength - accumulated) / segLengths[i] : 0
      const x = pts[i * 2] + t * (pts[i * 2 + 2] - pts[i * 2])
      const y = pts[i * 2 + 1] + t * (pts[i * 2 + 3] - pts[i * 2 + 1])
      let segDir: 'horizontal' | 'vertical' | 'diagonal'
      if (pts[i * 2] === pts[i * 2 + 2]) segDir = 'vertical'
      else if (pts[i * 2 + 1] === pts[i * 2 + 3]) segDir = 'horizontal'
      else segDir = 'diagonal'
      return { x, y, segmentDirection: segDir }
    }
    accumulated += segLengths[i]
  }
  return { x: pts[pts.length - 2], y: pts[pts.length - 1], segmentDirection: 'horizontal' }
}

/** 理想パス（ノード中心ベース、ラベル位置計算用） */
function computeIdealPathPoints(
  fx: number, fy: number, tx: number, ty: number,
  bendCount: number, routingMode: string,
): number[] {
  const dx = tx - fx, dy = ty - fy
  let isHF: boolean
  switch (routingMode) {
    case 'horizontal': isHF = true; break
    case 'vertical': isHF = false; break
    default: isHF = Math.abs(dx) >= Math.abs(dy); break
  }
  if (bendCount === 0) return [fx, fy, tx, ty]
  if (bendCount === 1) {
    if (dy === 0 || dx === 0) return [fx, fy, tx, ty]
    return isHF ? [fx, fy, tx, fy, tx, ty] : [fx, fy, fx, ty, tx, ty]
  }
  // bendCount >= 2
  if (isHF) {
    if (dy === 0) return [fx, fy, tx, ty]
    const midX = fx + dx / 2
    return [fx, fy, midX, fy, midX, ty, tx, ty]
  }
  if (dx === 0) return [fx, fy, tx, ty]
  const midY = fy + dy / 2
  return [fx, fy, fx, midY, tx, midY, tx, ty]
}

// ═══════════════════════════════════════════════════════
// ヘルパー
// ═══════════════════════════════════════════════════════

function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatDayOfWeek(date: Date): string {
  return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()]
}

function getHolidayObj(date: Date, calendar: { holidays: Array<{ date: string; name: string; status: string }> }) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const dateStr = `${y}-${m}-${d}`
  return calendar.holidays.find(h => h.date === dateStr) ?? null
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** 文字幅の概算（全角≒fontSize, 半角≒fontSize*0.6） */
function estimateTextWidth(text: string, fontSize: number): number {
  let w = 0
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0xff ? fontSize : fontSize * 0.6
  }
  return w
}

/** SVGセグメントを描画（Line or Path） */
function renderSegment(
  seg: RoundedSegment,
  strokeColor: string,
  strokeWidth: number,
  baseDash: string,
): string {
  const dash = seg.isDashed ? '3,3' : baseDash
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ''
  if (seg.pathData) {
    return `<path d="${seg.pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"${dashAttr} stroke-linecap="round" stroke-linejoin="round"/>`
  }
  if (seg.points && seg.points.length >= 4) {
    const pts = seg.points
    // 2点の直線
    return `<line x1="${pts[0]}" y1="${pts[1]}" x2="${pts[pts.length - 2]}" y2="${pts[pts.length - 1]}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${dashAttr} stroke-linecap="round"/>`
  }
  return ''
}

// ═══════════════════════════════════════════════════════
// SVG生成メイン
// ═══════════════════════════════════════════════════════

function generateSVG(
  projectSettings: ProjectSettings,
  hierarchyRows: HierarchyRow[],
  nodes: EventNode[],
  activities: Activity[],
  dates: Date[],
  calendar: ProjectCalendar | null,
  nodesMap: Map<string, EventNode>,
  visibleColumns: ProjectSettings['headerColumns'],
  viewStartDayOffset: number,
  pageIndex: number = 0,
  rowsPerPage?: number,
  textboxes: TextBox[] = [],
  progressLines: ProgressLine[] = [],
  activeProgressLineId: string | null = null,
  showSCurve: boolean = false,
  projectDuration: number = 0,
  showLegend: boolean = false,
): string {
  const ROW_HEIGHT = projectSettings.rowHeight || DEFAULT_ROW_HEIGHT
  const effectiveRowsPerPage = rowsPerPage ?? (projectSettings.displayRows || 20)
  const totalDataRows = Math.max(hierarchyRows.length, effectiveRowsPerPage)
  const pageStartRow = pageIndex * effectiveRowsPerPage
  const pageEndRow = Math.min(pageStartRow + effectiveRowsPerPage, totalDataRows)
  const totalRows = effectiveRowsPerPage // 常に固定高さ
  const effectiveTotalDays = dates.length
  const rowHeaderWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0)
  const svgWidth = rowHeaderWidth + effectiveTotalDays * DAY_WIDTH
  const svgHeight = HEADER_HEIGHT + totalRows * ROW_HEIGHT
  const gridOffsetX = rowHeaderWidth
  const gridOffsetY = HEADER_HEIGHT

  const startDate = new Date(projectSettings.startDate)
  const cornerRadius = projectSettings.defaultActivityDisplay.edgeCornerRadius ?? projectSettings.edgeCornerRadius ?? 0

  const parts: string[] = []

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMinYMin meet" style="font-family: 'NotoSansJP', sans-serif;">`)
  parts.push(`<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="white"/>`)

  // ── レイヤー: 背景（ヘッダー、非稼働日、行ヘッダー） ──
  parts.push('<g id="layer-bg">')

  // ── カレンダーヘッダー ──
  parts.push(`<rect x="${rowHeaderWidth}" y="0" width="${effectiveTotalDays * DAY_WIDTH}" height="${HEADER_HEIGHT}" fill="${HEADER_BG}"/>`)
  parts.push(`<rect x="0" y="0" width="${rowHeaderWidth}" height="${HEADER_HEIGHT}" fill="#F9FAFB" stroke="${GRID_COLOR}" stroke-width="0.5"/>`)

  let colX = 0
  for (const col of visibleColumns) {
    parts.push(`<rect x="${colX}" y="0" width="${col.width}" height="${HEADER_HEIGHT}" fill="#F9FAFB" stroke="${GRID_COLOR}" stroke-width="0.5"/>`)
    parts.push(`<text x="${colX + col.width / 2}" y="${HEADER_HEIGHT / 2 + 4}" text-anchor="middle" font-size="10" fill="#4B5563">${escapeXml(col.label)}</text>`)
    colX += col.width
  }

  dates.forEach((date, i) => {
    const x = rowHeaderWidth + i * DAY_WIDTH
    const weekend = isWeekend(date)
    const holidayObj = calendar ? getHolidayObj(date, calendar) : null
    const isHolidayDay = holidayObj != null && holidayObj.status !== 'workday'
    const isWorkdayHoliday = holidayObj != null && holidayObj.status === 'workday'

    let bg = HEADER_BG
    if (isHolidayDay || isWorkdayHoliday) bg = '#DBEAFE'
    else if (weekend) bg = '#FEE2E2'

    let textColor = '#374151', subColor = '#6B7280'
    if (isHolidayDay || isWorkdayHoliday) { textColor = '#1D4ED8'; subColor = '#1D4ED8' }
    else if (weekend) { textColor = '#DC2626'; subColor = '#DC2626' }

    parts.push(`<rect x="${x}" y="0" width="${DAY_WIDTH}" height="${HEADER_HEIGHT}" fill="${bg}" stroke="${GRID_COLOR}" stroke-width="0.5"/>`)
    parts.push(`<text x="${x + DAY_WIDTH / 2}" y="16" text-anchor="middle" font-size="9" fill="${textColor}">${formatDateShort(date)}</text>`)
    const subText = holidayObj ? holidayObj.name.slice(0, 2) : formatDayOfWeek(date)
    parts.push(`<text x="${x + DAY_WIDTH / 2}" y="30" text-anchor="middle" font-size="8" fill="${subColor}">${escapeXml(subText)}</text>`)
    if (holidayObj && !weekend) {
      parts.push(`<text x="${x + DAY_WIDTH / 2}" y="44" text-anchor="middle" font-size="6" fill="#1D4ED8">${isWorkdayHoliday ? '\u25CB' : '\u25CF'}</text>`)
    }
  })

  parts.push(`<line x1="${rowHeaderWidth}" y1="${HEADER_HEIGHT}" x2="${svgWidth}" y2="${HEADER_HEIGHT}" stroke="#9CA3AF" stroke-width="1"/>`)

  // ── グリッド背景（非稼働日の塗り）──
  dates.forEach((date, i) => {
    if (isNonWorkdayUtil(date, calendar)) {
      parts.push(`<rect x="${gridOffsetX + i * DAY_WIDTH}" y="${gridOffsetY}" width="${DAY_WIDTH}" height="${totalRows * ROW_HEIGHT}" fill="${NON_WORKDAY_BG}"/>`)
    }
  })

  // ── 行ヘッダー ──
  for (let displayIdx = 0; displayIdx < totalRows; displayIdx++) {
    const dataIdx = pageStartRow + displayIdx
    const row = dataIdx < hierarchyRows.length ? hierarchyRows[dataIdx] : undefined
    let cx = 0
    for (const col of visibleColumns) {
      const cy = HEADER_HEIGHT + displayIdx * ROW_HEIGHT
      parts.push(`<rect x="${cx}" y="${cy}" width="${col.width}" height="${ROW_HEIGHT}" fill="white" stroke="${GRID_COLOR}" stroke-width="0.5"/>`)
      if (row) {
        let value = ''
        switch (col.type) {
          case 'zone': value = row.zoneName; break
          case 'floor': value = row.roomName; break
          case 'detail': value = row.detailName; break
        }
        if (value) parts.push(`<text x="${cx + 4}" y="${cy + ROW_HEIGHT / 2 + 4}" font-size="9" fill="#374151">${escapeXml(value)}</text>`)
      }
      cx += col.width
    }
  }
  parts.push(`<line x1="${rowHeaderWidth}" y1="0" x2="${rowHeaderWidth}" y2="${svgHeight}" stroke="#9CA3AF" stroke-width="1"/>`)
  parts.push('</g>') // layer-bg

  // ── レイヤー: グリッド枠線（アクティビティの下） ──
  parts.push('<g id="layer-grid">')
  // 端部は印刷枠と重なるため描画しない（i=0〜内側のみ）
  for (let i = 1; i < effectiveTotalDays; i++) {
    const x = gridOffsetX + i * DAY_WIDTH
    const nw = isNonWorkdayUtil(dates[i], calendar)
    parts.push(`<line x1="${x}" y1="${gridOffsetY}" x2="${x}" y2="${gridOffsetY + totalRows * ROW_HEIGHT}" stroke="${nw ? '#D1D5DB' : GRID_COLOR}" stroke-width="0.5"/>`)
  }
  for (let i = 1; i < totalRows; i++) {
    const y = gridOffsetY + i * ROW_HEIGHT
    parts.push(`<line x1="${gridOffsetX}" y1="${y}" x2="${svgWidth}" y2="${y}" stroke="${GRID_COLOR}" stroke-width="0.5"/>`)
  }
  // 下端罫線（非稼働日グレー塗りの上に描画）
  const bottomY = gridOffsetY + totalRows * ROW_HEIGHT
  parts.push(`<line x1="${gridOffsetX}" y1="${bottomY}" x2="${svgWidth}" y2="${bottomY}" stroke="#9CA3AF" stroke-width="1"/>`)
  parts.push('</g>') // layer-grid

  // ── レイヤー: アクティビティ（最前面） ──
  parts.push('<g id="layer-activities">')
  const pageTopY = pageStartRow * ROW_HEIGHT
  const pageBottomY = pageEndRow * ROW_HEIGHT

  activities.forEach((activity) => {
    const fromNode = nodesMap.get(activity.fromNodeId)
    const toNode = nodesMap.get(activity.toNodeId)
    if (!fromNode || !toNode) return

    // ページ範囲外のアクティビティはスキップ
    const minNodeY = Math.min(fromNode.position.y, toNode.position.y)
    const maxNodeY = Math.max(fromNode.position.y, toNode.position.y)
    if (maxNodeY < pageTopY - ROW_HEIGHT || minNodeY >= pageBottomY + ROW_HEIGHT) return

    // view-relative座標（viewStartDayOffset考慮）
    const rawFromX = fromNode.position.x - viewStartDayOffset * DAY_WIDTH
    const rawToX = toNode.position.x - viewStartDayOffset * DAY_WIDTH
    const visibleWidth = effectiveTotalDays * DAY_WIDTH

    // 両端とも範囲外ならスキップ
    if ((rawFromX < 0 && rawToX < 0) || (rawFromX >= visibleWidth && rawToX >= visibleWidth)) return

    // ノード中心（SVG座標系、ページオフセット適用）
    const fromX = gridOffsetX + rawFromX
    const fromY = gridOffsetY + fromNode.position.y - pageTopY
    const toX = gridOffsetX + rawToX
    const toY = gridOffsetY + toNode.position.y - pageTopY
    const dx = toX - fromX
    const dy = toY - fromY

    // バナー表示モード
    if (activity.displaySettings.displayType === 'banner') {
      const bannerWidth = Math.abs(toX - fromX)
      const leftX = Math.min(fromX, toX)
      const cy = fromY // 水平前提
      const halfH = ROW_HEIGHT * 0.35
      const tipW = Math.min(halfH * 0.8, bannerWidth * 0.15)
      let bannerColor = activity.displaySettings.lineColor || '#374151'
      if (activity.isCritical) bannerColor = CRITICAL_COLOR

      const hexPoints = [
        `${leftX + tipW},${cy - halfH}`,
        `${leftX + bannerWidth - tipW},${cy - halfH}`,
        `${leftX + bannerWidth},${cy}`,
        `${leftX + bannerWidth - tipW},${cy + halfH}`,
        `${leftX + tipW},${cy + halfH}`,
        `${leftX},${cy}`,
      ].join(' ')

      parts.push(`<polygon points="${hexPoints}" fill="${bannerColor}" opacity="0.85" stroke="${bannerColor}" stroke-width="1"/>`)

      // テキスト
      const textParts: string[] = []
      if (activity.displaySettings.showName && activity.name) textParts.push(activity.name)
      if (activity.displaySettings.showDuration) textParts.push(`${activity.duration}日`)
      if (textParts.length > 0) {
        const labelText = textParts.join(' ')
        parts.push(`<text x="${leftX + bannerWidth / 2}" y="${cy + 4}" text-anchor="middle" font-size="10" fill="white">${labelText}</text>`)
      }
      return
    }

    // 色
    let strokeColor = activity.displaySettings.lineColor || '#374151'
    if (activity.isCritical) strokeColor = CRITICAL_COLOR
    const strokeWidth = activity.displaySettings.lineWidth || 2

    // 基本線種
    let baseDash = ''
    if (activity.displaySettings.lineStyle === 'dashed') baseDash = '6,3'
    else if (activity.displaySettings.lineStyle === 'dotted') baseDash = '2,3'

    // ルーティング
    const bendCount = activity.bendCount ?? 1
    const routingMode = activity.routingMode ?? 'vertical'
    let isHorizontalFirst: boolean
    switch (routingMode) {
      case 'horizontal': isHorizontalFirst = true; break
      case 'vertical': isHorizontalFirst = false; break
      default: isHorizontalFirst = Math.abs(dx) >= Math.abs(dy); break
    }

    // パス座標（NODE_RADIUS考慮）
    let points: number[] = []
    let arrowAngle = 0
    let startX: number, startY: number, endX: number, endY: number

    if (bendCount === 0) {
      const angle = Math.atan2(dy, dx)
      startX = fromX + Math.cos(angle) * NODE_RADIUS
      startY = fromY + Math.sin(angle) * NODE_RADIUS
      endX = toX - Math.cos(angle) * NODE_RADIUS
      endY = toY - Math.sin(angle) * NODE_RADIUS
      points = [startX, startY, endX, endY]
      arrowAngle = (angle * 180 / Math.PI) + 90
    } else if (bendCount === 1) {
      if (dy === 0 || dx === 0) {
        const angle = Math.atan2(dy, dx)
        startX = fromX + Math.cos(angle) * NODE_RADIUS
        startY = fromY + Math.sin(angle) * NODE_RADIUS
        endX = toX - Math.cos(angle) * NODE_RADIUS
        endY = toY - Math.sin(angle) * NODE_RADIUS
        points = [startX, startY, endX, endY]
        arrowAngle = (angle * 180 / Math.PI) + 90
      } else if (isHorizontalFirst) {
        const goRight = dx > 0, goDown = dy > 0
        startX = fromX + (goRight ? NODE_RADIUS : -NODE_RADIUS); startY = fromY
        endX = toX; endY = toY + (goDown ? -NODE_RADIUS : NODE_RADIUS)
        arrowAngle = goDown ? 180 : 0
        points = [startX, startY, endX, startY, endX, endY]
      } else {
        const goRight = dx > 0, goDown = dy > 0
        startX = fromX; startY = fromY + (goDown ? NODE_RADIUS : -NODE_RADIUS)
        endX = toX + (goRight ? -NODE_RADIUS : NODE_RADIUS); endY = toY
        arrowAngle = goRight ? 90 : -90
        points = [startX, startY, startX, endY, endX, endY]
      }
    } else {
      // bendCount >= 2
      if (isHorizontalFirst) {
        const goRight = dx > 0
        startX = fromX + (goRight ? NODE_RADIUS : -NODE_RADIUS); startY = fromY
        endX = toX + (goRight ? -NODE_RADIUS : NODE_RADIUS); endY = toY
        arrowAngle = goRight ? 90 : -90
        if (dy === 0) {
          points = [startX, startY, endX, endY]
        } else {
          const midX = fromX + dx / 2
          points = [startX, startY, midX, startY, midX, endY, endX, endY]
        }
      } else {
        const goDown = dy > 0
        startX = fromX; startY = fromY + (goDown ? NODE_RADIUS : -NODE_RADIUS)
        endX = toX; endY = toY + (goDown ? -NODE_RADIUS : NODE_RADIUS)
        arrowAngle = goDown ? 180 : 0
        if (dx === 0) {
          points = [startX, startY, endX, endY]
        } else {
          const midY = fromY + dy / 2
          points = [startX, startY, startX, midY, endX, midY, endX, endY]
        }
      }
    }

    if (points.length === 0) return

    // ── セグメント分割＋角丸 ──
    if (activity.isDummy) {
      // ダミー: 全破線、角丸あり
      const dummySegs: Array<{ points: number[]; isDashed: boolean }> = []
      for (let i = 0; i < points.length - 2; i += 2) {
        dummySegs.push({ points: [points[i], points[i + 1], points[i + 2], points[i + 3]], isDashed: false })
      }
      const rounded = generateRoundedCornerSegments(dummySegs, points, cornerRadius)
      for (const seg of rounded) {
        parts.push(renderSegment(seg, strokeColor, strokeWidth, baseDash || '6,3'))
      }
    } else {
      // 非稼働日範囲を計算（元座標ベース）
      const nonWorkdayRanges = getNonWorkdayRangesUtil(
        Math.min(fromNode.position.x, toNode.position.x),
        Math.max(fromNode.position.x, toNode.position.x) + DAY_WIDTH,
        startDate, DAY_WIDTH, calendar,
      ).map(range => ({
        startX: gridOffsetX + range.startX - viewStartDayOffset * DAY_WIDTH,
        endX: gridOffsetX + range.endX - viewStartDayOffset * DAY_WIDTH,
      }))

      // workDurationEndX
      const calendarDays = getCalendarDaysForWorkdaysUtil(
        fromNode.position.x, activity.duration, startDate, DAY_WIDTH, calendar,
      )
      const workDurationEndX = fromX + calendarDays * DAY_WIDTH

      const rawSegments = splitAllSegments(points, nonWorkdayRanges, workDurationEndX)
      const rounded = generateRoundedCornerSegments(rawSegments, points, cornerRadius)
      for (const seg of rounded) {
        parts.push(renderSegment(seg, strokeColor, strokeWidth, baseDash))
      }
    }

    // ── 矢印ヘッド ──
    // arrowAngle: 度数（90=右, -90=左, 180=下, 0=上）
    let arrowX = endX!, arrowY = endY!
    if (arrowAngle === 90) arrowX -= ARROW_HEAD_SIZE
    else if (arrowAngle === -90) arrowX += ARROW_HEAD_SIZE
    else if (arrowAngle === 180) arrowY -= ARROW_HEAD_SIZE
    else if (arrowAngle === 0) arrowY += ARROW_HEAD_SIZE

    // SVG三角形（RegularPolygon sides=3 と同等）
    const rad = arrowAngle * Math.PI / 180
    const triPoints: [number, number][] = []
    for (let i = 0; i < 3; i++) {
      const a = rad + (i * 2 * Math.PI / 3) - Math.PI / 2
      triPoints.push([
        arrowX + ARROW_HEAD_SIZE * Math.cos(a),
        arrowY + ARROW_HEAD_SIZE * Math.sin(a),
      ])
    }
    parts.push(`<polygon points="${triPoints.map(p => `${p[0]},${p[1]}`).join(' ')}" fill="${strokeColor}"/>`)

    // ── ラベル ──
    if (!activity.isDummy && (activity.displaySettings.showName || activity.displaySettings.showDuration)) {
      const idealPath = computeIdealPathPoints(fromX, fromY, toX, toY, bendCount, routingMode)
      const midInfo = getPathMidpointWithSegmentInfo(idealPath)
      const userOffX = activity.labelOffset?.x ?? 0
      const userOffY = activity.labelOffset?.y ?? 0
      const autoLeader = midInfo.segmentDirection === 'vertical' && userOffX === 0 && userOffY === 0
      const hasBasis = activity.durationMode === 'calculated' && activity.displaySettings.showDuration

      const resolvedAlign = activity.displaySettings.textAlign ?? projectSettings.defaultActivityDisplay.textAlign ?? 'center'
      const dynamicTextWidth = Math.max(100, Math.abs(toX - fromX))
      const effTextWidth = autoLeader ? Math.min(dynamicTextWidth, 150) : dynamicTextWidth

      let anchorX: number, anchorY: number
      if (autoLeader) {
        anchorX = midInfo.x + LEADER_GAP
        anchorY = midInfo.y - 5
      } else {
        anchorX = midInfo.x
        anchorY = midInfo.y - (hasBasis ? 28 : 15)
      }

      let textBaseX: number
      if (autoLeader) {
        textBaseX = midInfo.x + LEADER_GAP
      } else {
        switch (resolvedAlign) {
          case 'left': textBaseX = Math.min(fromX, toX); break
          case 'right': textBaseX = Math.max(fromX, toX) - dynamicTextWidth; break
          default: textBaseX = anchorX - dynamicTextWidth / 2; break
        }
      }

      const labelX = textBaseX + userOffX
      const labelY = anchorY + userOffY

      let effectiveAlign: 'start' | 'middle' | 'end'
      if (autoLeader) {
        effectiveAlign = 'start'
      } else if (userOffX !== 0 || userOffY !== 0) {
        effectiveAlign = midInfo.x < labelX + effTextWidth / 2 ? 'start' : 'end'
      } else {
        effectiveAlign = resolvedAlign === 'left' ? 'start' : resolvedAlign === 'right' ? 'end' : 'middle'
      }

      // テキストX座標
      let textX: number
      switch (effectiveAlign) {
        case 'start': textX = labelX; break
        case 'end': textX = labelX + effTextWidth; break
        default: textX = labelX + effTextWidth / 2; break
      }

      // 引き出し線
      if (autoLeader) {
        parts.push(`<line x1="${midInfo.x}" y1="${midInfo.y}" x2="${midInfo.x + LEADER_GAP}" y2="${midInfo.y}" stroke="#9CA3AF" stroke-width="0.5"/>`)
      } else if (userOffX !== 0 || userOffY !== 0) {
        const leaderTextX = midInfo.x < labelX + effTextWidth / 2 ? labelX : labelX + effTextWidth
        parts.push(`<line x1="${midInfo.x}" y1="${midInfo.y}" x2="${leaderTextX}" y2="${labelY + 9}" stroke="#9CA3AF" stroke-width="0.5"/>`)
      }

      // テキスト内容
      let text = ''
      if (activity.durationMode === 'calculated' && activity.displaySettings.showDuration) {
        text = activity.displaySettings.showName ? activity.name : ''
      } else if (activity.displaySettings.showName && activity.displaySettings.showDuration) {
        text = `${activity.name}(${activity.duration})`
      } else if (activity.displaySettings.showName) {
        text = activity.name
      } else {
        text = `${activity.duration}日`
      }

      const textFill = activity.isCritical ? CRITICAL_COLOR : '#374151'
      if (text) {
        parts.push(`<text x="${textX}" y="${labelY + 9}" text-anchor="${effectiveAlign}" font-size="9" fill="${textFill}">${escapeXml(text)}</text>`)
      }

      // 歩掛根拠テキスト
      if (hasBasis) {
        const basisText = `${activity.quantity ?? 0}${activity.quantityUnit ?? ''} \u00F7 (${activity.productivity ?? 1} \u00D7 ${activity.laborCount ?? 1}人\u30FB日) = ${activity.duration}日`
        parts.push(`<text x="${textX}" y="${labelY + 20}" text-anchor="${effectiveAlign}" font-size="7" fill="#6B7280">${escapeXml(basisText)}</text>`)
      }
    }
  })
  parts.push('</g>') // layer-activities

  // ── レイヤー: ノード ──
  // バナーのみ接続ノードは印刷時非表示
  const bannerOnlyNodeIds = new Set<string>()
  nodes.forEach((node) => {
    const connActs = activities.filter(a => a.fromNodeId === node.id || a.toNodeId === node.id)
    if (connActs.length > 0 && connActs.every(a => a.displaySettings.displayType === 'banner')) {
      bannerOnlyNodeIds.add(node.id)
    }
  })

  parts.push('<g id="layer-nodes">')
  nodes.forEach((node) => {
    if (bannerOnlyNodeIds.has(node.id)) return

    const adjustedX = node.position.x - viewStartDayOffset * DAY_WIDTH
    if (adjustedX < 0 || adjustedX >= effectiveTotalDays * DAY_WIDTH) return

    // ページ範囲外のノードはスキップ
    if (node.position.y < pageTopY - ROW_HEIGHT || node.position.y >= pageBottomY + ROW_HEIGHT) return

    const cx = gridOffsetX + adjustedX
    const cy = gridOffsetY + node.position.y - pageTopY

    const isCritical = activities.some(a => a.isCritical && (a.fromNodeId === node.id || a.toNodeId === node.id))
    const nodeStroke = isCritical ? CRITICAL_COLOR : '#374151'
    const nodeSW = isCritical ? 2 : 1.5

    // 半円判定（カレンダー初日は右向き半円を強制）
    let semiDir = getNodeSemiCircleDirection(node.id, nodes, activities, nodesMap)
    if (adjustedX === 0) semiDir = 'right'

    if (semiDir) {
      // 半円をSVG arcで描画
      const arcPath = buildSemiCirclePath(cx, cy, NODE_RADIUS, semiDir)
      parts.push(`<path d="${arcPath}" fill="white" stroke="${nodeStroke}" stroke-width="${nodeSW}"/>`)
    } else {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${NODE_RADIUS}" fill="white" stroke="${nodeStroke}" stroke-width="${nodeSW}"/>`)
    }

    // ラベル
    if (node.label) {
      parts.push(`<text x="${cx}" y="${cy - NODE_RADIUS - 4}" text-anchor="middle" font-size="9" fill="#374151">${escapeXml(node.label)}</text>`)
    }
  })
  parts.push('</g>') // layer-nodes

  // ── レイヤー: テキストボックス ──
  if (textboxes.length > 0) {
    parts.push('<g id="layer-textboxes">')
    const pad = 2
    textboxes.forEach((tb) => {
      const isVertical = tb.writingDirection === 'vertical'
      const fs = tb.fontSize
      const anchorX = tb.snapAnchorX ?? 'left'
      const anchorY = tb.snapAnchorY ?? 'center'

      // 自動サイズ計算（TextBoxNode.tsx と同一ロジック）
      let ew: number, eh: number
      if (!tb.text) {
        ew = tb.width; eh = tb.height
      } else if (isVertical) {
        const columns = tb.text.split('\n')
        ew = columns.length * (fs + pad) + pad
        eh = Math.max(...columns.map(c => c.length)) * fs + pad * 2
      } else {
        const lines = tb.text.split('\n')
        ew = Math.max(...lines.map(l => estimateTextWidth(l, fs))) + pad * 2
        eh = lines.length * (fs + pad) + pad
      }

      // SVG座標系への変換
      const rawX = tb.position.x - viewStartDayOffset * DAY_WIDTH
      if (rawX + ew < 0 || rawX - ew >= effectiveTotalDays * DAY_WIDTH) return
      if (tb.position.y < pageTopY - ROW_HEIGHT || tb.position.y >= pageBottomY + ROW_HEIGHT) return

      const baseX = gridOffsetX + rawX
      const baseY = gridOffsetY + tb.position.y - pageTopY

      // スナップアンカーオフセット
      const offX = anchorX === 'center' ? -ew / 2 : anchorX === 'right' ? -ew : 0
      const offY = anchorY === 'center' ? -eh / 2 : anchorY === 'bottom' ? -eh : 0
      const bx = baseX + offX
      const by = baseY + offY

      // 背景矩形
      if (tb.showBackground !== false && tb.backgroundColor && tb.backgroundColor !== 'transparent') {
        parts.push(`<rect x="${bx}" y="${by}" width="${ew}" height="${eh}" fill="${tb.backgroundColor}" rx="2"/>`)
      }
      // 枠線
      if (tb.showBorder) {
        parts.push(`<rect x="${bx}" y="${by}" width="${ew}" height="${eh}" fill="none" stroke="${tb.borderColor}" stroke-width="${tb.borderWidth}" rx="2"/>`)
      }

      // テキスト描画
      if (tb.text) {
        if (isVertical) {
          // 縦書き: 列ごとに右→左、文字を1文字ずつ縦に配置
          tb.text.split('\n').forEach((col, colIdx) => {
            const colX = bx + ew - (colIdx + 1) * (fs + pad) + (fs + pad) / 2
            col.split('').forEach((ch, charIdx) => {
              parts.push(`<text x="${colX}" y="${by + pad + charIdx * fs + fs * 0.85}" text-anchor="middle" font-size="${fs}" fill="${tb.fontColor}">${escapeXml(ch)}</text>`)
            })
          })
        } else {
          // 横書き: 行ごとに描画
          tb.text.split('\n').forEach((line, lineIdx) => {
            const ly = by + pad + lineIdx * (fs + pad) + fs * 0.85
            const lx = bx + pad
            parts.push(`<text x="${lx}" y="${ly}" font-size="${fs}" fill="${tb.fontColor}">${escapeXml(line)}</text>`)
          })
        }
      }
    })
    parts.push('</g>') // layer-textboxes
  }

  // ── レイヤー: 進捗線（雷線） ──
  const visiblePLs = progressLines.filter(pl => pl.baseDate && pl.visible)
  if (visiblePLs.length > 0) {
    parts.push(`<g id="layer-progress-lines" transform="translate(${gridOffsetX}, ${gridOffsetY})">`)
    for (const pl of visiblePLs) {
      const isActive = pl.id === activeProgressLineId
      const baseX = pl.baseDateX - viewStartDayOffset * DAY_WIDTH
      const lineColor = isActive ? '#DC2626' : '#9CA3AF'
      const lineWidth = isActive ? 2.5 : 1.5
      const lineOpacity = isActive ? 1 : 0.4

      // ノード座標（全行セル中央）
      const pts: { x: number; y: number; offset: number; rowIdx: number }[] = []
      for (let i = pageStartRow; i < pageEndRow; i++) {
        const localI = i - pageStartRow
        const detailId = hierarchyRows[i]?.detailId
        const offset = detailId ? (pl.rowOffsets[detailId] ?? 0) : 0
        const x = baseX + offset * DAY_WIDTH
        const y = localI * ROW_HEIGHT + ROW_HEIGHT / 2
        pts.push({ x, y, offset, rowIdx: localI })
      }

      if (pts.length > 0) {
        // ポリライン: 上端延長 → 各ノード → 下端延長
        const allPts = [
          `${pts[0].x},0`,
          ...pts.map(p => `${p.x},${p.y}`),
          `${pts[pts.length - 1].x},${totalRows * ROW_HEIGHT}`,
        ]
        parts.push(`<polyline points="${allPts.join(' ')}" fill="none" stroke="${lineColor}" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${lineOpacity}"/>`)

        // オフセット日数テキスト（アクティブ線のみ、0以外）
        if (isActive) {
          for (const p of pts) {
            if (p.offset === 0) continue
            const label = p.offset > 0 ? `+${p.offset}` : `${p.offset}`
            const color = p.offset > 0 ? '#16A34A' : '#DC2626'
            parts.push(`<text x="${p.x + 6}" y="${p.y - 2}" font-size="9" fill="${color}">${label}</text>`)
          }
        }
      }
    }
    parts.push('</g>')
  }

  // ── レイヤー: S字カーブ ──
  if (showSCurve && projectDuration > 0) {
    const planned = calcPlannedCurve(activities, projectDuration)
    const activePL = visiblePLs.find(pl => pl.id === activeProgressLineId)
    const actual = activePL ? calcActualCurve(activities, activePL, projectDuration) : []

    if (planned.length > 0) {
      const graphTop = gridOffsetY + 4
      const graphBottom = gridOffsetY + totalRows * ROW_HEIGHT - 4
      const graphHeight = graphBottom - graphTop
      const graphWidth = effectiveTotalDays * DAY_WIDTH
      const xScale = projectDuration > 0 ? graphWidth / projectDuration : DAY_WIDTH

      parts.push(`<g id="layer-scurve" transform="translate(${gridOffsetX}, 0)">`)
      // 半透明背景
      parts.push(`<rect x="0" y="${gridOffsetY}" width="${graphWidth}" height="${totalRows * ROW_HEIGHT}" fill="rgba(255,255,255,0.6)"/>`)

      // Y軸グリッド
      for (const pct of [0, 25, 50, 75, 100]) {
        const y = graphTop + graphHeight * (1 - pct / 100)
        parts.push(`<line x1="0" y1="${y}" x2="${graphWidth}" y2="${y}" stroke="#E5E7EB" stroke-width="0.5" stroke-dasharray="4,4"/>`)
        parts.push(`<text x="2" y="${y - 2}" font-size="8" fill="#9CA3AF">${pct}%</text>`)
      }

      // 計画曲線（青）- 横軸をprojectDuration基準でスケーリング
      const plannedPts = planned.map(p => `${p.day * xScale},${graphTop + graphHeight * (1 - p.percent / 100)}`).join(' ')
      parts.push(`<polyline points="${plannedPts}" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`)

      // 実績曲線（緑・破線）
      if (actual.length > 0) {
        const actualPts = actual.map(p => `${p.day * xScale},${graphTop + graphHeight * (1 - p.percent / 100)}`).join(' ')
        parts.push(`<polyline points="${actualPts}" fill="none" stroke="#16A34A" stroke-width="2" stroke-dasharray="6,3" stroke-linecap="round" stroke-linejoin="round"/>`)
      }

      parts.push('</g>')
    }
  }

  // 凡例
  if (showLegend) {
    const lw = 90, lh = 42
    const lx = svgWidth - lw - 4
    const ly = svgHeight - lh - 4
    const lPad = 4
    const lineLen = 24
    const arrowSize = 3
    const rowH = 10
    const textX = lx + lPad + lineLen + 6

    parts.push(`<g font-family="NotoSansJP, sans-serif">`)
    // 白背景 + 枠
    parts.push(`<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="white" stroke="#9CA3AF" stroke-width="0.5" rx="2"/>`)
    // タイトル
    parts.push(`<text x="${lx + lPad}" y="${ly + 9}" font-size="7" fill="#374151">凡例</text>`)

    // クリティカルパス（赤太線 + 三角矢印）
    const cy = ly + 18
    const cx1 = lx + lPad, cx2 = cx1 + lineLen
    parts.push(`<line x1="${cx1}" y1="${cy}" x2="${cx2}" y2="${cy}" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round"/>`)
    parts.push(`<polygon points="${cx2},${cy} ${cx2 - arrowSize * 1.5},${cy - arrowSize} ${cx2 - arrowSize * 1.5},${cy + arrowSize}" fill="#DC2626"/>`)
    parts.push(`<text x="${textX}" y="${cy + 3}" font-size="7" fill="#374151">クリティカルパス</text>`)

    // 通常作業（黒実線 + 三角矢印）
    const ny = cy + rowH
    const nx1 = lx + lPad, nx2 = nx1 + lineLen
    parts.push(`<line x1="${nx1}" y1="${ny}" x2="${nx2}" y2="${ny}" stroke="#374151" stroke-width="1.5" stroke-linecap="round"/>`)
    parts.push(`<polygon points="${nx2},${ny} ${nx2 - arrowSize * 1.5},${ny - arrowSize} ${nx2 - arrowSize * 1.5},${ny + arrowSize}" fill="#374151"/>`)
    parts.push(`<text x="${textX}" y="${ny + 3}" font-size="7" fill="#374151">通常作業</text>`)

    // ダミー作業（破線 + 三角矢印）
    const dy = ny + rowH
    const dx1 = lx + lPad, dx2 = dx1 + lineLen
    parts.push(`<line x1="${dx1}" y1="${dy}" x2="${dx2}" y2="${dy}" stroke="#6B7280" stroke-width="1" stroke-dasharray="4,2" stroke-linecap="round"/>`)
    parts.push(`<polygon points="${dx2},${dy} ${dx2 - arrowSize * 1.2},${dy - arrowSize * 0.8} ${dx2 - arrowSize * 1.2},${dy + arrowSize * 0.8}" fill="#6B7280"/>`)
    parts.push(`<text x="${textX}" y="${dy + 3}" font-size="7" fill="#6B7280">ダミー作業</text>`)

    parts.push(`</g>`)
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ── 半円判定（NetworkCanvasから移植） ──
function getNodeSemiCircleDirection(
  nodeId: string,
  _nodes: EventNode[],
  activities: Activity[],
  nodesMap: Map<string, EventNode>,
): 'top' | 'bottom' | 'left' | 'right' | null {
  const node = nodesMap.get(nodeId)
  if (!node) return null
  const nodeX = node.position.x
  const nodeY = node.position.y
  const lineThreshold = 3
  const nodeInnerRadius = NODE_RADIUS - 2

  for (const activity of activities) {
    if (activity.fromNodeId === nodeId || activity.toNodeId === nodeId) continue
    const fromNode = nodesMap.get(activity.fromNodeId)
    const toNode = nodesMap.get(activity.toNodeId)
    if (!fromNode || !toNode) continue

    const fX = fromNode.position.x, fY = fromNode.position.y
    const tX = toNode.position.x, tY = toNode.position.y
    const dx = tX - fX, dy = tY - fY
    const isHF = Math.abs(dx) >= Math.abs(dy)

    if (isHF) {
      const midX = fX + dx / 2
      if (Math.abs(nodeY - fY) < lineThreshold && nodeX > Math.min(fX, midX) + nodeInnerRadius && nodeX < Math.max(fX, midX) - nodeInnerRadius) return 'top'
      if (Math.abs(nodeX - midX) < lineThreshold && nodeY > Math.min(fY, tY) + nodeInnerRadius && nodeY < Math.max(fY, tY) - nodeInnerRadius) return dx > 0 ? 'left' : 'right'
      if (Math.abs(nodeY - tY) < lineThreshold && nodeX > Math.min(midX, tX) + nodeInnerRadius && nodeX < Math.max(midX, tX) - nodeInnerRadius) return 'top'
    } else {
      const midY = fY + dy / 2
      if (Math.abs(nodeX - fX) < lineThreshold && nodeY > Math.min(fY, midY) + nodeInnerRadius && nodeY < Math.max(fY, midY) - nodeInnerRadius) return dy > 0 ? 'top' : 'bottom'
      if (Math.abs(nodeY - midY) < lineThreshold && nodeX > Math.min(fX, tX) + nodeInnerRadius && nodeX < Math.max(fX, tX) - nodeInnerRadius) return 'top'
      if (Math.abs(nodeX - tX) < lineThreshold && nodeY > Math.min(midY, tY) + nodeInnerRadius && nodeY < Math.max(midY, tY) - nodeInnerRadius) return dy > 0 ? 'top' : 'bottom'
    }
  }
  return null
}

/** SVG半円パス */
function buildSemiCirclePath(cx: number, cy: number, r: number, direction: 'top' | 'bottom' | 'left' | 'right'): string {
  // arc: large-arc=0, sweep=1 for semi-circle
  switch (direction) {
    case 'top': // 上半分表示（Konva rotation=180）
      return `M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy} Z`
    case 'bottom': // 下半分表示（Konva rotation=0）
      return `M ${cx - r},${cy} A ${r},${r} 0 0,0 ${cx + r},${cy} Z`
    case 'left': // 左半分表示（Konva rotation=90）
      return `M ${cx},${cy - r} A ${r},${r} 0 0,0 ${cx},${cy + r} Z`
    case 'right': // 右半分表示（Konva rotation=-90）
      return `M ${cx},${cy - r} A ${r},${r} 0 0,1 ${cx},${cy + r} Z`
  }
}

// ═══════════════════════════════════════════════════════
// 全ページSVG生成（PDF出力用にエクスポート）
// ═══════════════════════════════════════════════════════

export function generateAllPageSVGs(
  projectSettings: ProjectSettings,
  hierarchyRows: HierarchyRow[],
  nodes: EventNode[],
  activities: Activity[],
  dates: Date[],
  calendar: ProjectCalendar | null,
  nodesMap: Map<string, EventNode>,
  visibleColumns: ProjectSettings['headerColumns'],
  viewStartDayOffset: number,
  rowsPerPageOverride?: number,
  textboxes: TextBox[] = [],
  progressLines: ProgressLine[] = [],
  activeProgressLineId: string | null = null,
  showSCurve: boolean = false,
  projectDuration: number = 0,
  showLegend: boolean = false,
): string[] {
  const rowsPerPage = rowsPerPageOverride ?? (projectSettings.displayRows || 20)
  const totalDataRows = Math.max(hierarchyRows.length, rowsPerPage)
  const totalPages = Math.ceil(totalDataRows / rowsPerPage)
  const svgPages: string[] = []
  for (let i = 0; i < totalPages; i++) {
    const isLastPage = i === totalPages - 1
    svgPages.push(generateSVG(projectSettings, hierarchyRows, nodes, activities, dates, calendar, nodesMap, visibleColumns, viewStartDayOffset, i, rowsPerPage, textboxes, progressLines, activeProgressLineId, showSCurve, projectDuration, showLegend && isLastPage))
  }
  return svgPages
}

// ═══════════════════════════════════════════════════════
// コンポーネント
// ═══════════════════════════════════════════════════════

export function SvgPreviewDialog({ isOpen, onClose, projectSettings }: SvgPreviewDialogProps) {
  const nodesMap = useADMStore((state) => state.nodes)
  const activitiesMap = useADMStore((state) => state.activities)
  const getHierarchyRows = useADMStore((state) => state.getHierarchyRows)
  const calendar = useCalendarStore((state) => state.calendar)
  const printSettings = usePrintStore((state) => state.settings)
  const progressLines = useADMStore((state) => state.progressLines)
  const activeProgressLineId = useADMStore((state) => state.activeProgressLineId)
  const projectDuration = useADMStore((state) => state.projectDuration)
  const showSCurve = useUIStore((state) => state.showSCurve)

  const textboxesMap = useTextBoxStore((state) => state.textboxes)

  const nodes = useMemo(() => Array.from(nodesMap.values()), [nodesMap])
  const activities = useMemo(() => Array.from(activitiesMap.values()), [activitiesMap])
  const textboxes = useMemo(() => Array.from(textboxesMap.values()), [textboxesMap])
  const hierarchyRows = getHierarchyRows()

  const visibleColumns = useMemo(() => {
    return projectSettings.headerColumns
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order)
  }, [projectSettings.headerColumns])

  const viewStartDate = useMemo(() => {
    return computeViewStartDate(projectSettings)
  }, [projectSettings.startDate, projectSettings.viewStartOffset, projectSettings.displayMode, projectSettings.weekStartDay])

  const viewStartDayOffset = useMemo(() => {
    const s = new Date(projectSettings.startDate)
    return Math.round((viewStartDate.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  }, [viewStartDate, projectSettings.startDate])

  const effectiveTotalDays = useMemo(() => {
    if (projectSettings.displayMode === 'monthly') {
      return new Date(viewStartDate.getFullYear(), viewStartDate.getMonth() + 1, 0).getDate()
    }
    return projectSettings.displayDays
  }, [projectSettings.displayMode, viewStartDate, projectSettings.displayDays])

  const dates = useMemo(() => {
    const result: Date[] = []
    for (let i = 0; i < effectiveTotalDays; i++) {
      const d = new Date(viewStartDate)
      d.setDate(d.getDate() + i)
      result.push(d)
    }
    return result
  }, [viewStartDate, effectiveTotalDays])

  const paperKey = (projectSettings.paperSize === 'custom' ? 'A3' : projectSettings.paperSize) as 'A4' | 'A3' | 'A2' | 'A1'
  const basePaper = PAPER_SIZES[paperKey]
  const [paperWidth, paperHeight] = projectSettings.paperOrientation === 'landscape'
    ? [basePaper.height, basePaper.width]
    : [basePaper.width, basePaper.height]

  const { margin, layout } = printSettings

  const [previewPage, setPreviewPage] = useState(0)

  // 印刷コンテンツ領域に収まる行数を計算
  const printRowsPerPage = useMemo(() => {
    const rowHeaderWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0)
    const svgW = rowHeaderWidth + effectiveTotalDays * DAY_WIDTH
    const contentWidthMm = paperWidth - margin.left - margin.right
    const contentHeightMm = paperHeight - margin.top - margin.bottom - layout.headerHeight - layout.footerHeight
    const svgHeightLimit = contentHeightMm * svgW / contentWidthMm
    const rowH = projectSettings.rowHeight || DEFAULT_ROW_HEIGHT
    return Math.max(1, Math.floor((svgHeightLimit - HEADER_HEIGHT) / rowH))
  }, [visibleColumns, effectiveTotalDays, paperWidth, paperHeight, margin, layout, projectSettings.rowHeight])

  const totalDataRows = Math.max(hierarchyRows.length, printRowsPerPage)
  const svgTotalPages = Math.ceil(totalDataRows / printRowsPerPage)

  const isLastPage = previewPage === svgTotalPages - 1
  const svgContent = useMemo(() => {
    return generateSVG(projectSettings, hierarchyRows, nodes, activities, dates, calendar, nodesMap, visibleColumns, viewStartDayOffset, previewPage, printRowsPerPage, textboxes, progressLines, activeProgressLineId, showSCurve, projectDuration, printSettings.showLegend && isLastPage)
  }, [projectSettings, hierarchyRows, nodes, activities, dates, calendar, nodesMap, visibleColumns, viewStartDayOffset, previewPage, printRowsPerPage, textboxes, progressLines, activeProgressLineId, showSCurve, projectDuration, printSettings.showLegend, isLastPage])

  const previewScale = useMemo(() => {
    return Math.min(800 / paperWidth, 600 / paperHeight)
  }, [paperWidth, paperHeight])

  const scaledW = paperWidth * previewScale
  const scaledH = paperHeight * previewScale
  const m = { top: margin.top * previewScale, right: margin.right * previewScale, bottom: margin.bottom * previewScale, left: margin.left * previewScale }
  const innerW = scaledW - m.left - m.right
  const innerH = scaledH - m.top - m.bottom
  const headerH = layout.headerHeight * previewScale
  const footerH = layout.footerHeight * previewScale

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold">SVG印刷プレビュー</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              用紙: {paperKey} {projectSettings.paperOrientation === 'landscape' ? '横' : '縦'} ({paperWidth}x{paperHeight}mm)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewPage(Math.max(0, previewPage - 1))}
              disabled={previewPage === 0}
              className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ◀
            </button>
            <span className="text-sm font-medium">{previewPage + 1} / {svgTotalPages} ページ</span>
            <button
              onClick={() => setPreviewPage(Math.min(svgTotalPages - 1, previewPage + 1))}
              disabled={previewPage === svgTotalPages - 1}
              className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ▶
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 p-6 bg-gray-100 overflow-auto flex items-center justify-center">
          <div className="relative bg-white shadow-lg border" style={{ width: scaledW, height: scaledH }}>
            <div className="absolute border border-gray-400" style={{ left: m.left, top: m.top, width: innerW, height: innerH }} />
            <div className="absolute border border-blue-300 bg-blue-50/30" style={{ left: m.left, top: m.top, width: innerW, height: headerH }}>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] text-blue-400 select-none">ヘッダー / 表題欄</span>
            </div>
            <div className="absolute overflow-hidden" style={{ left: m.left, top: m.top + headerH, width: innerW, height: innerH - headerH - footerH }}>
              <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ width: '100%', height: '100%' }} className="[&>svg]:!w-full [&>svg]:!h-full [&>svg]:!max-w-full [&>svg]:!max-h-full [&>svg]:block" />
            </div>
            <div className="absolute border border-green-300 bg-green-50/30" style={{ left: m.left, top: m.top + innerH - footerH, width: innerW, height: footerH }}>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] text-green-400 select-none">フッター</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50 shrink-0">
          <p className="text-xs text-gray-500">
            SVG要素: ノード {nodes.length}個 / 作業 {activities.length}本 / 日数 {effectiveTotalDays}日 / 行 {totalDataRows}行{svgTotalPages > 1 ? ` (${svgTotalPages}ページ)` : ''}
          </p>
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border rounded-md hover:bg-gray-50">閉じる</button>
        </div>
      </div>
    </div>
  )
}
