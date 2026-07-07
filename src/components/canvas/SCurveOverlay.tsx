/**
 * S字カーブオーバーレイ
 * 行内（最上段上端〜最下段下端）に計画曲線と実績曲線を半透明で表示
 */

import { Line, Rect, Text } from 'react-konva'
import type { CurvePoint } from '@/utils/progressCalc'

const PADDING_Y = 4

interface SCurveOverlayProps {
  plannedCurve: CurvePoint[]
  actualCurve: CurvePoint[]
  totalRows: number
  rowHeight: number
  dayWidth: number
  effectiveTotalDays: number
  projectDuration: number // 竣工までの日数（横軸100%）
}

export function SCurveOverlay({
  plannedCurve,
  actualCurve,
  totalRows,
  rowHeight,
  dayWidth,
  effectiveTotalDays,
  projectDuration,
}: SCurveOverlayProps) {
  const totalHeight = totalRows * rowHeight
  const graphTop = PADDING_Y
  const graphBottom = totalHeight - PADDING_Y
  const graphHeight = graphBottom - graphTop

  const totalWidth = effectiveTotalDays * dayWidth

  // 横軸: projectDuration（竣工）= グラフ右端にスケーリング
  const xScale = projectDuration > 0 ? totalWidth / projectDuration : dayWidth
  const toX = (day: number) => day * xScale
  const toY = (percent: number) => graphTop + graphHeight * (1 - percent / 100)

  const buildLinePoints = (curve: CurvePoint[]): number[] => {
    const pts: number[] = []
    for (const p of curve) {
      pts.push(toX(p.day), toY(p.percent))
    }
    return pts
  }

  const plannedPoints = buildLinePoints(plannedCurve)
  const actualPoints = buildLinePoints(actualCurve)

  // Y軸目盛り
  const yLabels = [0, 25, 50, 75, 100]

  return (
    <>
      {/* 半透明背景 */}
      <Rect
        x={0}
        y={0}
        width={totalWidth}
        height={totalHeight}
        fill="rgba(255, 255, 255, 0.6)"
        listening={false}
      />

      {/* Y軸目盛り線 */}
      {yLabels.map((pct) => {
        const y = toY(pct)
        return (
          <Line
            key={`scurve-ygrid-${pct}`}
            points={[0, y, totalWidth, y]}
            stroke="#E5E7EB"
            strokeWidth={0.5}
            dash={[4, 4]}
            listening={false}
          />
        )
      })}
      {yLabels.map((pct) => (
        <Text
          key={`scurve-ylabel-${pct}`}
          x={2}
          y={toY(pct) - 5}
          text={`${pct}%`}
          fontSize={8}
          fill="#9CA3AF"
          listening={false}
        />
      ))}

      {/* 計画曲線（青・実線） */}
      {plannedPoints.length >= 4 && (
        <Line
          points={plannedPoints}
          stroke="#3B82F6"
          strokeWidth={2}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}

      {/* 実績曲線（緑・破線） */}
      {actualPoints.length >= 4 && (
        <Line
          points={actualPoints}
          stroke="#16A34A"
          strokeWidth={2}
          dash={[6, 3]}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}

      {/* 凡例（右上） */}
      <Rect x={totalWidth - 130} y={4} width={126} height={18} fill="rgba(255,255,255,0.8)" cornerRadius={3} listening={false} />
      <Line points={[totalWidth - 125, 13, totalWidth - 105, 13]} stroke="#3B82F6" strokeWidth={2} listening={false} />
      <Text x={totalWidth - 100} y={7} text="計画" fontSize={9} fill="#3B82F6" listening={false} />
      <Line points={[totalWidth - 65, 13, totalWidth - 45, 13]} stroke="#16A34A" strokeWidth={2} dash={[4, 2]} listening={false} />
      <Text x={totalWidth - 40} y={7} text="実績" fontSize={9} fill="#16A34A" listening={false} />
    </>
  )
}
