/**
 * ADM形式の作業（Activity）コンポーネント
 * 水平・垂直のみで描画し、曲がり角にRを付ける
 * 工数を超えた部分は点線で表示
 * 非稼働日区間も点線で表示（水平・垂直とも）
 */

import { useRef, useState, useEffect } from 'react'
import { Group, Text, Line, Path, RegularPolygon, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Activity, EventNode } from '@/types/adm'
import { NODE_RADIUS } from './EventNodeShape'

interface ActivityArrowProps {
  activity: Activity
  fromNode: EventNode
  toNode: EventNode
  isSelected: boolean
  isChainSelected?: boolean // チェーン選択ハイライト
  maxLeftDays?: number // 左方向の最大移動日数（範囲表示用）
  cornerRadius?: number // 曲がり角のR
  dayWidth?: number // 1日あたりの幅（工数超過判定用）
  expectedCalendarDays?: number // 稼働日を考慮したカレンダー日数
  nonWorkdayRanges?: Array<{ startX: number; endX: number }> // 非稼働日のX座標範囲
  onClick?: (e: { ctrlKey: boolean; shiftKey: boolean }) => void
  onMouseDown?: (e: { ctrlKey: boolean; shiftKey: boolean; clientX: number }) => void
  isPathSelectMode?: boolean
  isFromClipped?: boolean // 開始点がクリップされたか
  isToClipped?: boolean // 終点がクリップされたか
  originalFromX?: number // クリップ前のview-relative X座標（workDurationEndX計算用）
  originalFromY?: number // クリップ前Y
  originalToX?: number // クリップ前X
  originalToY?: number // クリップ前Y
  defaultTextAlign?: 'left' | 'center' | 'right'
  defaultLeaderLineStyle?: 'line' | 'underline'
  onLabelDragEnd?: (offset: { x: number; y: number }) => void
}

const CRITICAL_COLOR = '#DC2626' // red-600
const SELECTED_COLOR = '#2563EB' // blue-600
const CHAIN_SELECTED_COLOR = '#F97316' // orange-500
const ARROW_HEAD_SIZE = 6
const DEFAULT_DAY_WIDTH = 30
const LEADER_GAP = 12 // 垂直線とラベルの間隔(px)

/**
 * セグメント分割: 水平線を非稼働日とduration超過で分割
 */
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
        if (currentX < solidEnd) {
          segments.push({ x1: currentX, x2: solidEnd, isDashed: false })
        }
        if (solidEnd < segEnd) {
          segments.push({ x1: solidEnd, x2: segEnd, isDashed: true })
        }
      } else {
        segments.push({ x1: currentX, x2: segEnd, isDashed: true })
      }
    }

    if (rangeStart < rangeEnd) {
      segments.push({ x1: rangeStart, x2: rangeEnd, isDashed: true })
    }

    currentX = rangeEnd
  }

  if (currentX < lineEndX) {
    if (currentX < workDurationEndX) {
      const solidEnd = Math.min(lineEndX, workDurationEndX)
      if (currentX < solidEnd) {
        segments.push({ x1: currentX, x2: solidEnd, isDashed: false })
      }
      if (solidEnd < lineEndX) {
        segments.push({ x1: solidEnd, x2: lineEndX, isDashed: true })
      }
    } else {
      segments.push({ x1: currentX, x2: lineEndX, isDashed: true })
    }
  }

  return segments.map(seg => ({
    points: [seg.x1, y, seg.x2, y],
    isDashed: seg.isDashed,
  }))
}

/**
 * セグメント分割: 垂直線を非稼働日とduration超過で分割
 */
function splitVerticalSegment(
  x: number, y1: number, y2: number,
  nonWorkdayRanges: Array<{ startX: number; endX: number }>,
  workDurationEndX: number,
): Array<{ points: number[]; isDashed: boolean }> {
  const isInNonWorkday = nonWorkdayRanges.some(
    r => x >= r.startX && x < r.endX
  )
  const isExceedsDuration = x >= workDurationEndX

  return [{
    points: [x, y1, x, y2],
    isDashed: isInNonWorkday || isExceedsDuration,
  }]
}

/**
 * points配列からセグメント分割を行う
 */
function splitAllSegments(
  points: number[],
  nonWorkdayRanges: Array<{ startX: number; endX: number }>,
  workDurationEndX: number,
): Array<{ points: number[]; isDashed: boolean }> {
  const allSegments: Array<{ points: number[]; isDashed: boolean }> = []

  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = points[i]
    const y1 = points[i + 1]
    const x2 = points[i + 2]
    const y2 = points[i + 3]

    if (y1 === y2) {
      // 水平線
      allSegments.push(...splitHorizontalSegment(x1, x2, y1, nonWorkdayRanges, workDurationEndX))
    } else if (x1 === x2) {
      // 垂直線
      allSegments.push(...splitVerticalSegment(x1, y1, y2, nonWorkdayRanges, workDurationEndX))
    } else {
      // 斜め線（bendCount=0の場合）
      const segX = (x1 + x2) / 2
      const isInNonWorkday = nonWorkdayRanges.some(r => segX >= r.startX && segX < r.endX)
      const isExceedsDuration = segX >= workDurationEndX
      allSegments.push({
        points: [x1, y1, x2, y2],
        isDashed: isInNonWorkday || isExceedsDuration,
      })
    }
  }

  return allSegments
}

/**
 * 角丸パスデータを生成
 * points配列の折れ点にQベジェ曲線を挿入し、角丸セグメントを返す
 */
function generateRoundedCornerSegments(
  segments: Array<{ points: number[]; isDashed: boolean }>,
  rawPoints: number[],
  cornerRadius: number,
): Array<{ points?: number[]; pathData?: string; isDashed: boolean }> {
  if (rawPoints.length <= 4 || cornerRadius <= 0) {
    // 直線または角丸なしの場合はそのまま返す
    return segments
  }

  // 折れ点のインデックスを特定（最初と最後を除く）
  const bendPoints: Array<{ x: number; y: number; index: number }> = []
  for (let i = 2; i < rawPoints.length - 2; i += 2) {
    bendPoints.push({
      x: rawPoints[i],
      y: rawPoints[i + 1],
      index: i,
    })
  }

  if (bendPoints.length === 0) return segments

  // 各折れ点の前後のセグメントを切り詰めて角丸を挿入
  const result: Array<{ points?: number[]; pathData?: string; isDashed: boolean }> = []

  // セグメントをコピーして操作
  const segs = segments.map(s => ({
    ...s,
    points: s.points ? [...s.points] : undefined,
  }))

  // 折れ点ごとに処理
  for (const bend of bendPoints) {
    // 折れ点の前のセグメントと後のセグメントを見つける
    const prevSegIdx = segs.findIndex(s =>
      s.points &&
      s.points[s.points.length - 2] === bend.x &&
      s.points[s.points.length - 1] === bend.y
    )
    const nextSegIdx = segs.findIndex(s =>
      s.points &&
      s.points[0] === bend.x &&
      s.points[1] === bend.y
    )

    if (prevSegIdx === -1 || nextSegIdx === -1) continue

    const prevSeg = segs[prevSegIdx]
    const nextSeg = segs[nextSegIdx]
    if (!prevSeg.points || !nextSeg.points) continue

    // 前セグメントの長さと後セグメントの長さを計算
    const prevLen = Math.sqrt(
      (prevSeg.points[prevSeg.points.length - 2] - prevSeg.points[prevSeg.points.length - 4]) ** 2 +
      (prevSeg.points[prevSeg.points.length - 1] - prevSeg.points[prevSeg.points.length - 3]) ** 2
    )
    const nextLen = Math.sqrt(
      (nextSeg.points[2] - nextSeg.points[0]) ** 2 +
      (nextSeg.points[3] - nextSeg.points[1]) ** 2
    )

    const r = Math.min(cornerRadius, prevLen / 2, nextLen / 2)
    if (r <= 0.5) continue

    // 前セグメントの方向
    const prevDx = prevSeg.points[prevSeg.points.length - 2] - prevSeg.points[prevSeg.points.length - 4]
    const prevDy = prevSeg.points[prevSeg.points.length - 1] - prevSeg.points[prevSeg.points.length - 3]
    const prevNorm = Math.sqrt(prevDx * prevDx + prevDy * prevDy)

    // 後セグメントの方向
    const nextDx = nextSeg.points[2] - nextSeg.points[0]
    const nextDy = nextSeg.points[3] - nextSeg.points[1]
    const nextNorm = Math.sqrt(nextDx * nextDx + nextDy * nextDy)

    // 角丸の開始点（前セグメントの終点からr手前）
    const cornerStartX = bend.x - (prevDx / prevNorm) * r
    const cornerStartY = bend.y - (prevDy / prevNorm) * r

    // 角丸の終了点（後セグメントの始点からr先）
    const cornerEndX = bend.x + (nextDx / nextNorm) * r
    const cornerEndY = bend.y + (nextDy / nextNorm) * r

    // 前セグメントの終点を切り詰め
    prevSeg.points[prevSeg.points.length - 2] = cornerStartX
    prevSeg.points[prevSeg.points.length - 1] = cornerStartY

    // 後セグメントの始点を切り詰め
    nextSeg.points[0] = cornerEndX
    nextSeg.points[1] = cornerEndY

    // 角丸セグメントのdash属性は前セグメントの属性を継承
    // 角丸パスを挿入位置にマーク
    const cornerPath = `M ${cornerStartX} ${cornerStartY} Q ${bend.x} ${bend.y} ${cornerEndX} ${cornerEndY}`
    // 挿入位置を記録（後で挿入）
    ;(prevSeg as { _cornerAfter?: { pathData: string; isDashed: boolean } })._cornerAfter = {
      pathData: cornerPath,
      isDashed: prevSeg.isDashed,
    }
  }

  // 結果を構築
  for (const seg of segs) {
    if (seg.points) {
      // 長さゼロのセグメントは除外
      const segLen = Math.sqrt(
        (seg.points[seg.points.length - 2] - seg.points[0]) ** 2 +
        (seg.points[seg.points.length - 1] - seg.points[1]) ** 2
      )
      if (segLen > 0.5) {
        result.push({ points: seg.points, isDashed: seg.isDashed })
      }
    }
    const cornerAfter = (seg as { _cornerAfter?: { pathData: string; isDashed: boolean } })._cornerAfter
    if (cornerAfter) {
      result.push({ pathData: cornerAfter.pathData, isDashed: cornerAfter.isDashed })
    }
  }

  return result
}

/**
 * ルーティング設定からパスの理想的な折れ点列を計算（ラベル位置用）
 * NODE_RADIUSやクリップは考慮しない（ノード中心ベース）
 */
function computeIdealPathPoints(
  fx: number, fy: number, tx: number, ty: number,
  bendCount: number, routingMode: string,
): number[] {
  const dx = tx - fx
  const dy = ty - fy

  let isHorizontalFirst: boolean
  switch (routingMode) {
    case 'horizontal': isHorizontalFirst = true; break
    case 'vertical': isHorizontalFirst = false; break
    default: isHorizontalFirst = Math.abs(dx) >= Math.abs(dy); break
  }

  if (bendCount === 0) {
    return [fx, fy, tx, ty]
  } else if (bendCount === 1) {
    // dy=0 または dx=0 の場合は折れが不要なので直線にフォールバック
    if (dy === 0 || dx === 0) return [fx, fy, tx, ty]
    if (isHorizontalFirst) {
      return [fx, fy, tx, fy, tx, ty]
    } else {
      return [fx, fy, fx, ty, tx, ty]
    }
  } else {
    // bendCount >= 2
    if (isHorizontalFirst) {
      if (dy === 0) return [fx, fy, tx, ty]
      const midX = fx + dx / 2
      return [fx, fy, midX, fy, midX, ty, tx, ty]
    } else {
      if (dx === 0) return [fx, fy, tx, ty]
      const midY = fy + dy / 2
      return [fx, fy, fx, midY, tx, midY, tx, ty]
    }
  }
}

/**
 * パスの中間点を弧長ベースで計算し、セグメントの方向情報も返す
 */
function getPathMidpointWithSegmentInfo(pts: number[]): {
  x: number; y: number;
  segmentDirection: 'horizontal' | 'vertical' | 'diagonal'
} {
  if (pts.length < 4) return { x: pts[0] ?? 0, y: pts[1] ?? 0, segmentDirection: 'horizontal' }

  let totalLength = 0
  const segLengths: number[] = []
  for (let i = 0; i < pts.length - 2; i += 2) {
    const sdx = pts[i + 2] - pts[i]
    const sdy = pts[i + 3] - pts[i + 1]
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

      // セグメントの方向を判定
      let segmentDirection: 'horizontal' | 'vertical' | 'diagonal'
      if (pts[i * 2] === pts[i * 2 + 2]) {
        segmentDirection = 'vertical'
      } else if (pts[i * 2 + 1] === pts[i * 2 + 3]) {
        segmentDirection = 'horizontal'
      } else {
        segmentDirection = 'diagonal'
      }

      return { x, y, segmentDirection }
    }
    accumulated += segLengths[i]
  }

  return { x: pts[pts.length - 2], y: pts[pts.length - 1], segmentDirection: 'horizontal' }
}

export function ActivityArrow({
  activity,
  fromNode,
  toNode,
  isSelected,
  isChainSelected = false,
  maxLeftDays = 0,
  cornerRadius = 5,
  dayWidth = DEFAULT_DAY_WIDTH,
  expectedCalendarDays,
  nonWorkdayRanges = [],
  onClick,
  onMouseDown,
  isPathSelectMode = false,
  isFromClipped = false,
  isToClipped = false,
  originalFromX,
  originalFromY,
  originalToX,
  originalToY,
  defaultTextAlign,
  defaultLeaderLineStyle,
  onLabelDragEnd,
}: ActivityArrowProps) {
  // ゼロ長ダミー作業は描画しない（始点と終点が同じ位置）
  if (activity.isDummy) {
    const dx = toNode.position.x - fromNode.position.x
    const dy = toNode.position.y - fromNode.position.y
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return null
  }

  // バナー表示モード
  if (activity.displaySettings.displayType === 'banner') {
    const fx = fromNode.position.x
    const tx = toNode.position.x
    const cy = fromNode.position.y // 水平バナー前提
    const bannerWidth = Math.abs(tx - fx)
    const bannerHeight = (dayWidth || DEFAULT_DAY_WIDTH) * 0.8 // 行高さの80%程度
    const leftX = Math.min(fx, tx)
    const halfH = bannerHeight / 2
    const tipW = Math.min(bannerHeight * 0.4, bannerWidth * 0.15) // 六角形の先端幅

    // 六角形パスポイント
    const hexPoints = [
      leftX + tipW, cy - halfH,           // 上辺左
      leftX + bannerWidth - tipW, cy - halfH, // 上辺右
      leftX + bannerWidth, cy,              // 右先端
      leftX + bannerWidth - tipW, cy + halfH, // 下辺右
      leftX + tipW, cy + halfH,            // 下辺左
      leftX, cy,                            // 左先端
    ]

    let bannerColor = activity.displaySettings.lineColor
    if (isSelected) bannerColor = SELECTED_COLOR
    else if (isChainSelected) bannerColor = CHAIN_SELECTED_COLOR
    else if (activity.isCritical) bannerColor = CRITICAL_COLOR

    // テキスト内容
    const textParts: string[] = []
    if (activity.displaySettings.showName && activity.name) textParts.push(activity.name)
    if (activity.displaySettings.showDuration) textParts.push(`${activity.duration}日`)
    const labelText = textParts.join(' ')

    return (
      <Group
        onClick={(e) => onClick?.({ ctrlKey: e.evt.ctrlKey, shiftKey: e.evt.shiftKey })}
        onMouseDown={(e) => onMouseDown?.({ ctrlKey: e.evt.ctrlKey, shiftKey: e.evt.shiftKey, clientX: e.evt.clientX })}
      >
        <Line
          points={hexPoints}
          closed
          fill={bannerColor}
          opacity={0.85}
          stroke={isSelected ? SELECTED_COLOR : bannerColor}
          strokeWidth={isSelected ? 2 : 1}
        />
        {labelText && (
          <Text
            x={leftX + tipW}
            y={cy - 6}
            width={bannerWidth - tipW * 2}
            text={labelText}
            fontSize={11}
            fill="white"
            align="center"
            listening={false}
          />
        )}
      </Group>
    )
  }

  // 色の決定
  let strokeColor = activity.displaySettings.lineColor
  if (isSelected) {
    strokeColor = SELECTED_COLOR
  } else if (isChainSelected) {
    strokeColor = CHAIN_SELECTED_COLOR
  } else if (activity.isCritical) {
    strokeColor = CRITICAL_COLOR
  }

  const strokeWidth = isSelected
    ? activity.displaySettings.lineWidth + 0.5
    : isChainSelected
      ? activity.displaySettings.lineWidth + 1
      : activity.displaySettings.lineWidth

  // 線種の設定
  let dash: number[] | undefined
  switch (activity.displaySettings.lineStyle) {
    case 'dashed':
      dash = [6, 3]
      break
    case 'dotted':
      dash = [2, 3]
      break
    default:
      dash = undefined
  }

  // ノード中心座標
  const fromX = fromNode.position.x
  const fromY = fromNode.position.y
  const toX = toNode.position.x
  const toY = toNode.position.y

  const dx = toX - fromX
  const dy = toY - fromY

  // 工数に基づく予定終点位置（水平方向のみ考慮）
  // expectedCalendarDaysが渡された場合は稼働日を考慮したカレンダー日数を使用
  const calendarDays = expectedCalendarDays ?? activity.duration
  const expectedDistance = calendarDays * dayWidth

  // 経路のポイントとルーティング方向を計算
  // すべてのルーティングパターンで points[] を生成（pathDataは使わない）
  let points: number[] = []
  let arrowAngle = 0 // 矢印の角度（度）

  // 開始点と終了点（ノードの円周から）
  let startX: number, startY: number
  let endX: number, endY: number

  // 折れ点の数（0=直線, 1=1回, 2=2回）
  const bendCount = activity.bendCount ?? 1
  const routingMode = activity.routingMode ?? 'vertical'

  // ルーティングパターンを決定
  let isHorizontalFirst: boolean
  switch (routingMode) {
    case 'horizontal':
      isHorizontalFirst = true
      break
    case 'vertical':
      isHorizontalFirst = false
      break
    case 'auto':
    default:
      isHorizontalFirst = Math.abs(dx) >= Math.abs(dy)
      break
  }

  // 直線モード（bendCount=0）
  if (bendCount === 0) {
    const angle = Math.atan2(dy, dx)
    startX = isFromClipped ? fromX : fromX + Math.cos(angle) * NODE_RADIUS
    startY = isFromClipped ? fromY : fromY + Math.sin(angle) * NODE_RADIUS
    endX = isToClipped ? toX : toX - Math.cos(angle) * NODE_RADIUS
    endY = isToClipped ? toY : toY - Math.sin(angle) * NODE_RADIUS
    points = [startX, startY, endX, endY]
    arrowAngle = (angle * 180 / Math.PI) + 90
  } else if (bendCount === 1) {
    // dy=0 or dx=0 → 折れ不要、直線にフォールバック
    if (dy === 0 || dx === 0) {
      const angle = Math.atan2(dy, dx)
      startX = isFromClipped ? fromX : fromX + Math.cos(angle) * NODE_RADIUS
      startY = isFromClipped ? fromY : fromY + Math.sin(angle) * NODE_RADIUS
      endX = isToClipped ? toX : toX - Math.cos(angle) * NODE_RADIUS
      endY = isToClipped ? toY : toY - Math.sin(angle) * NODE_RADIUS
      points = [startX, startY, endX, endY]
      arrowAngle = (angle * 180 / Math.PI) + 90
    } else if (isHorizontalFirst) {
      // 水平→垂直（L字型）
      const goRight = dx > 0
      const goDown = dy > 0
      startX = isFromClipped ? fromX : fromX + (goRight ? NODE_RADIUS : -NODE_RADIUS)
      startY = fromY
      endX = toX
      endY = isToClipped ? toY : toY + (goDown ? -NODE_RADIUS : NODE_RADIUS)
      arrowAngle = goDown ? 180 : 0
      points = [startX, startY, endX, startY, endX, endY]
    } else {
      // 垂直→水平（L字型）
      const goRight = dx > 0
      const goDown = dy > 0
      startX = fromX
      startY = isFromClipped ? fromY : fromY + (goDown ? NODE_RADIUS : -NODE_RADIUS)
      endX = isToClipped ? toX : toX + (goRight ? -NODE_RADIUS : NODE_RADIUS)
      endY = toY
      arrowAngle = goRight ? 90 : -90
      points = [startX, startY, startX, endY, endX, endY]
    }
  } else if (isHorizontalFirst) {
    // 2回曲がり - 水平方向優先
    const goRight = dx > 0
    startX = isFromClipped ? fromX : fromX + (goRight ? NODE_RADIUS : -NODE_RADIUS)
    startY = fromY
    endX = isToClipped ? toX : toX + (goRight ? -NODE_RADIUS : NODE_RADIUS)
    endY = toY
    arrowAngle = goRight ? 90 : -90

    if (dy === 0) {
      points = [startX, startY, endX, endY]
    } else {
      const midX = fromX + dx / 2
      points = [startX, startY, midX, startY, midX, endY, endX, endY]
    }
  } else {
    // 2回曲がり - 垂直方向優先
    const goDown = dy > 0
    startX = fromX
    startY = isFromClipped ? fromY : fromY + (goDown ? NODE_RADIUS : -NODE_RADIUS)
    endX = toX
    endY = isToClipped ? toY : toY + (goDown ? -NODE_RADIUS : NODE_RADIUS)
    arrowAngle = goDown ? 180 : 0

    if (dx === 0) {
      points = [startX, startY, endX, endY]
    } else {
      const midY = fromY + dy / 2
      points = [startX, startY, startX, midY, endX, midY, endX, endY]
    }
  }

  // ラベルの位置（クリップ前座標ベースで追従バグ修正）
  const origFX = originalFromX ?? fromX
  const origFY = originalFromY ?? fromY
  const origTX = originalToX ?? toX
  const origTY = originalToY ?? toY

  // 引き出し線アンカー（パスの中間点に追従）
  const idealPath = computeIdealPathPoints(
    origFX, origFY, origTX, origTY,
    activity.bendCount ?? 1,
    activity.routingMode ?? 'vertical',
  )
  const midInfo = getPathMidpointWithSegmentInfo(idealPath)
  const pathMid = { x: midInfo.x, y: midInfo.y }

  // 動的テキスト幅（水平距離に応じて拡大、最低100px確保）
  const dynamicTextWidth = Math.max(100, Math.abs(origTX - origFX))

  // 垂直セグメント上 & ユーザーオフセット未設定の場合、自動引き出し線
  const userOffsetX = activity.labelOffset?.x ?? 0
  const userOffsetY = activity.labelOffset?.y ?? 0
  const autoLeaderLine = midInfo.segmentDirection === 'vertical' && userOffsetX === 0 && userOffsetY === 0

  // 歩掛根拠テキストが表示される場合、さらに上にオフセット
  const hasBasisText = !activity.isDummy && activity.durationMode === 'calculated' && activity.displaySettings.showDuration

  let anchorX: number
  let anchorY: number
  if (autoLeaderLine) {
    anchorX = midInfo.x + LEADER_GAP  // 垂直線の右側にオフセット
    anchorY = midInfo.y - 5           // パス中間点にほぼ中央揃え
  } else {
    anchorX = pathMid.x
    anchorY = pathMid.y - (hasBasisText ? 28 : 15) // 根拠テキスト有りなら28px上、なければ15px上
  }

  // テキスト配置に応じたX位置（エッジの左端/中央/右端）
  const resolvedAlign = activity.displaySettings.textAlign ?? defaultTextAlign ?? 'center'
  const resolvedLeaderStyle = activity.displaySettings.leaderLineStyle ?? defaultLeaderLineStyle ?? 'line'

  // テキスト高さ・実測幅の取得（引き出し線・下線用）
  const textRef = useRef<Konva.Text>(null)
  const [textHeight, setTextHeight] = useState(9) // fontSize default
  const [measuredTextWidth, setMeasuredTextWidth] = useState(0)

  useEffect(() => {
    if (textRef.current) {
      setTextHeight(textRef.current.height())
      setMeasuredTextWidth(textRef.current.getTextWidth())
    }
  }, [activity.name, activity.duration, false, activity.displaySettings.showName, activity.displaySettings.showDuration])

  // autoLeaderLine時はテキスト幅を制限
  const effectiveTextWidth = autoLeaderLine
    ? Math.min(dynamicTextWidth, 150)
    : dynamicTextWidth

  let textBaseX: number
  if (autoLeaderLine) {
    // 垂直セグメント: 常にギャップの右側から開始
    textBaseX = midInfo.x + LEADER_GAP
  } else {
    switch (resolvedAlign) {
      case 'left':
        textBaseX = Math.min(origFX, origTX)
        break
      case 'right':
        textBaseX = Math.max(origFX, origTX) - dynamicTextWidth
        break
      default:
        textBaseX = anchorX - dynamicTextWidth / 2
        break
    }
  }

  // ユーザーオフセット適用（引き出し線用）
  const offsetX = activity.labelOffset?.x ?? 0
  const offsetY = activity.labelOffset?.y ?? 0
  const labelX = textBaseX + offsetX
  const labelY = anchorY + offsetY

  // 引き出し線のテキスト側接続点（パスに近い方の端の下部に接続）
  const leaderTextX = pathMid.x < labelX + effectiveTextWidth / 2
    ? labelX                        // パスが左側 → テキスト左端に接続
    : labelX + effectiveTextWidth   // パスが右側 → テキスト右端に接続

  // テキスト配置: 引き出し線がある場合は接続側に自動揃え
  let effectiveAlign: 'left' | 'center' | 'right'
  if (autoLeaderLine) {
    effectiveAlign = 'left'  // 垂直セグメント右側は常に左揃え
  } else if (userOffsetX !== 0 || userOffsetY !== 0) {
    // 手動引き出し線: 接続端に揃える（左端接続→左揃え、右端接続→右揃え）
    effectiveAlign = leaderTextX === labelX ? 'left' : 'right'
  } else {
    effectiveAlign = resolvedAlign
  }

  // 下線の開始/終了位置（実測テキスト幅に合わせる）
  const actualWidth = measuredTextWidth || effectiveTextWidth
  let underlineX1: number
  let underlineX2: number
  switch (effectiveAlign) {
    case 'right':
      underlineX2 = labelX + effectiveTextWidth
      underlineX1 = underlineX2 - actualWidth
      break
    case 'center':
      underlineX1 = labelX + (effectiveTextWidth - actualWidth) / 2
      underlineX2 = underlineX1 + actualWidth
      break
    default: // left
      underlineX1 = labelX
      underlineX2 = labelX + actualWidth
      break
  }

  // クリック領域用（より広い範囲でクリック検出）
  const hitStrokeWidth = 30

  // クリックハンドラ（イベント伝播を停止して確実に処理）
  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    if (onClick) onClick({ ctrlKey: e.evt.ctrlKey, shiftKey: e.evt.shiftKey })
  }

  const handleTap = (e: Konva.KonvaEventObject<Event>) => {
    e.cancelBubble = true
    if (onClick) onClick({ ctrlKey: false, shiftKey: false })
  }

  // パス選択モードでフロート移動ドラッグ開始
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isPathSelectMode && onMouseDown) {
      e.cancelBubble = true
      onMouseDown({
        ctrlKey: e.evt.ctrlKey,
        shiftKey: e.evt.shiftKey,
        clientX: e.evt.clientX,
      })
    }
  }

  // タッチでフロートドラッグ開始
  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (isPathSelectMode && onMouseDown && e.evt.touches.length === 1) {
      e.cancelBubble = true
      onMouseDown({
        ctrlKey: false,
        shiftKey: false,
        clientX: e.evt.touches[0].clientX,
      })
    }
  }

  return (
    <Group>
      {/* クリック領域（透明だが広い範囲でクリック検出） */}
      {points.length > 0 && (onClick || onMouseDown) && (
        <Line
          points={points}
          stroke="transparent"
          strokeWidth={hitStrokeWidth}
          hitStrokeWidth={hitStrokeWidth}
          listening={true}
          onClick={handleClick}
          onTap={handleTap}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
      )}

      {/* メインの線 */}
      {(() => {
        // ダミー作業にも角丸を適用
        if (activity.isDummy) {
          if (points.length === 0) return null

          const dummySegments: Array<{ points: number[]; isDashed: boolean }> = []
          for (let i = 0; i < points.length - 2; i += 2) {
            dummySegments.push({
              points: [points[i], points[i + 1], points[i + 2], points[i + 3]],
              isDashed: false,
            })
          }
          const roundedDummySegs = generateRoundedCornerSegments(dummySegments, points, cornerRadius)

          return (
            <>
              {roundedDummySegs.map((seg, idx) => {
                if (seg.pathData) {
                  return (
                    <Path
                      key={`seg-${idx}`}
                      data={seg.pathData}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      dash={dash}
                      lineCap="round"
                      lineJoin="round"
                      fill=""
                      listening={false}
                    />
                  )
                }
                return (
                  <Line
                    key={`seg-${idx}`}
                    points={seg.points!}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    dash={dash}
                    lineCap="round"
                    lineJoin="round"
                    listening={false}
                  />
                )
              })}
            </>
          )
        }

        if (points.length === 0) return null

        // 稼働日数分の終点（これを超えたら全て点線）
        // クリップ前の座標を使用して正確なworkDuration境界を計算
        const workDurationEndX = (originalFromX ?? fromX) + expectedDistance

        // pointsからセグメント分割
        const rawSegments = splitAllSegments(points, nonWorkdayRanges, workDurationEndX)

        // 角丸を適用
        const allSegments = generateRoundedCornerSegments(rawSegments, points, cornerRadius)

        return (
          <>
            {allSegments.map((seg, idx) => {
              if (seg.pathData) {
                return (
                  <Path
                    key={`seg-${idx}`}
                    data={seg.pathData}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    dash={seg.isDashed ? [3, 3] : dash}
                    lineCap="round"
                    lineJoin="round"
                    fill=""
                    listening={false}
                  />
                )
              }
              return (
                <Line
                  key={`seg-${idx}`}
                  points={seg.points!}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  dash={seg.isDashed ? [3, 3] : dash}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              )
            })}
          </>
        )
      })()}

      {/* 矢印の先端（三角形）- 終点がクリップされていない場合のみ表示 */}
      {!isToClipped && (() => {
        // 矢印の角度に応じてオフセットを計算
        // arrowAngle: 90=右, -90=左, 180=下, 0=上
        let arrowX = endX
        let arrowY = endY
        const offset = ARROW_HEAD_SIZE // 三角形の半径分オフセット

        if (arrowAngle === 90) {
          arrowX = endX - offset
        } else if (arrowAngle === -90) {
          arrowX = endX + offset
        } else if (arrowAngle === 180) {
          arrowY = endY - offset
        } else if (arrowAngle === 0) {
          arrowY = endY + offset
        }

        return (
          <RegularPolygon
            x={arrowX}
            y={arrowY}
            sides={3}
            radius={ARROW_HEAD_SIZE}
            fill={strokeColor}
            rotation={arrowAngle}
          />
        )
      })()}

      {/* 引き出し線（ユーザーオフセットが0以外のとき） */}
      {!activity.isDummy && (offsetX !== 0 || offsetY !== 0) && (activity.displaySettings.showName || activity.displaySettings.showDuration) && (
        <Line
          points={[pathMid.x, pathMid.y, leaderTextX, labelY + textHeight]}
          stroke="#9CA3AF"
          strokeWidth={0.5}
          listening={false}
        />
      )}

      {/* 自動引き出し線（垂直セグメント上のとき）- 水平スタブ */}
      {!activity.isDummy && autoLeaderLine && (activity.displaySettings.showName || activity.displaySettings.showDuration) && (
        <Line
          points={[midInfo.x, midInfo.y, midInfo.x + LEADER_GAP, midInfo.y]}
          stroke="#9CA3AF"
          strokeWidth={0.5}
          listening={false}
        />
      )}

      {/* 下線（underlineスタイル時） */}
      {!activity.isDummy && (offsetX !== 0 || offsetY !== 0) && resolvedLeaderStyle === 'underline' && (activity.displaySettings.showName || activity.displaySettings.showDuration) && (
        <Line
          points={[underlineX1, labelY + textHeight, underlineX2, labelY + textHeight]}
          stroke="#9CA3AF"
          strokeWidth={0.5}
          listening={false}
        />
      )}

      {/* ラベル */}
      {!activity.isDummy && (activity.displaySettings.showName || activity.displaySettings.showDuration) && (
        <Text
          x={labelX}
          y={labelY}
          text={
            activity.durationMode === 'calculated' && activity.displaySettings.showDuration
              ? activity.displaySettings.showName
                ? activity.name
                : ''
              : activity.displaySettings.showName && activity.displaySettings.showDuration
                ? `${activity.name}(${activity.duration})`
                : activity.displaySettings.showName
                  ? activity.name
                  : `${activity.duration}日`
          }
          fontSize={9}
          fill={activity.isCritical ? CRITICAL_COLOR : '#374151'}
          align={effectiveAlign}
          width={effectiveTextWidth}
          wrap={false ? "word" : "none"}
          ref={textRef}
          draggable={true}
          onDragEnd={(e) => {
            // 常にnon-autoのanchorを基準にoffsetを計算
            // → autoLeaderLineがOFFになってもラベルがジャンプしない
            const baseAnchorY = pathMid.y - 15
            let refX: number
            switch (resolvedAlign) {
              case 'left':  refX = Math.min(origFX, origTX); break
              case 'right': refX = Math.max(origFX, origTX) - dynamicTextWidth; break
              default:      refX = pathMid.x - dynamicTextWidth / 2; break
            }
            onLabelDragEnd?.({
              x: e.target.x() - refX,
              y: e.target.y() - baseAnchorY,
            })
            e.target.position({ x: labelX, y: labelY })
          }}
        />
      )}

      {/* 歩掛計算の根拠表示 */}
      {!activity.isDummy && activity.durationMode === 'calculated' && activity.displaySettings.showDuration && (
        <Text
          x={labelX}
          y={labelY + textHeight + 2}
          text={`${activity.quantity ?? 0}${activity.quantityUnit ?? ''} ÷ (${activity.productivity ?? 1} × ${activity.laborCount ?? 1}人・日) = ${activity.duration}日`}
          fontSize={7}
          fill="#6B7280"
          align={effectiveAlign}
          width={effectiveTextWidth}
          wrap="none"
          listening={false}
        />
      )}

      {/* 選択時のフロート表示 */}
      {isSelected && (
        <Text
          x={labelX + effectiveTextWidth / 2}
          y={labelY + 12}
          text={`TF:${activity.totalFloat}`}
          fontSize={8}
          fill="#9CA3AF"
          align="center"
          offsetX={20}
          width={40}
        />
      )}

      {/* チェーン選択時の移動可能範囲（fromNode基準で左右の移動可能域を半透明バーで表示） */}
      {isChainSelected && (maxLeftDays > 0 || activity.totalFloat > 0) && (
        <>
          {/* 左方向の移動可能範囲 */}
          {maxLeftDays > 0 && (
            <Rect
              x={fromNode.position.x - maxLeftDays * dayWidth}
              y={fromNode.position.y - 4}
              width={maxLeftDays * dayWidth}
              height={8}
              fill="#3B82F6"
              opacity={0.15}
              cornerRadius={2}
              listening={false}
            />
          )}
          {/* 右方向の移動可能範囲 */}
          {activity.totalFloat > 0 && (
            <Rect
              x={toNode.position.x}
              y={toNode.position.y - 4}
              width={activity.totalFloat * dayWidth}
              height={8}
              fill={CHAIN_SELECTED_COLOR}
              opacity={0.15}
              cornerRadius={2}
              listening={false}
            />
          )}
          {/* 範囲ラベル */}
          <Text
            x={toNode.position.x + activity.totalFloat * dayWidth + 4}
            y={toNode.position.y - 5}
            text={maxLeftDays > 0 ? `←${maxLeftDays} TF:${activity.totalFloat}→` : `TF:${activity.totalFloat}→`}
            fontSize={8}
            fill={CHAIN_SELECTED_COLOR}
            opacity={0.6}
            listening={false}
          />
        </>
      )}
    </Group>
  )
}
