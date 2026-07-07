/**
 * 進捗線（雷線）描画コンポーネント
 * 基準日を軸に各行の進捗位置をジグザグに繋いだ折れ線を表示
 * ノード（折れ点）は全行セル中央、線の端点は最上段上端〜最下段下端に延長
 */

import React from 'react'
import { Line, Circle, Text } from 'react-konva'
import type { ProgressLine, HierarchyRow } from '@/types/adm'

interface ProgressLineLayerProps {
  progressLines: ProgressLine[]
  activeProgressLineId: string | null
  dayWidth: number
  rowHeight: number
  totalRows: number
  hierarchyRows: HierarchyRow[]
  editingRowIndex?: number | null // progressモード時の編集対象行（ゴーストプレビュー用）
  showOffsetLabels?: boolean // オフセット日数ラベル表示
}

export function ProgressLineLayer({
  progressLines,
  activeProgressLineId,
  dayWidth,
  rowHeight,
  totalRows,
  hierarchyRows,
  editingRowIndex,
  showOffsetLabels = false,
}: ProgressLineLayerProps) {
  return (
    <>
      {progressLines.map((pl) => {
        if (!pl.baseDate || !pl.visible) return null
        const isActive = pl.id === activeProgressLineId
        const baseX = pl.baseDateX

        // 各行の進捗点座標を計算（detailIdベースでオフセット参照）
        const points: { x: number; y: number; offset: number; rowIndex: number }[] = []
        for (let i = 0; i < totalRows; i++) {
          const detailId = hierarchyRows[i]?.detailId
          const offset = detailId ? (pl.rowOffsets[detailId] ?? 0) : 0
          const x = baseX + offset * dayWidth
          const y = i * rowHeight + rowHeight / 2
          points.push({ x, y, offset, rowIndex: i })
        }

        // 折れ線のポイント配列（端点は基準日X位置で固定）
        const linePoints: number[] = []
        if (points.length > 0) {
          linePoints.push(baseX, 0)
          for (const p of points) {
            linePoints.push(p.x, p.y)
          }
          linePoints.push(baseX, totalRows * rowHeight)
        }

        const lineOpacity = isActive ? 1 : 0.4
        const lineColor = isActive ? '#DC2626' : '#9CA3AF'

        return (
          <React.Fragment key={pl.id}>
            {/* 雷線 */}
            {linePoints.length >= 4 && (
              <Line
                points={linePoints}
                stroke={lineColor}
                strokeWidth={isActive ? 2.5 : 1.5}
                lineCap="round"
                lineJoin="round"
                opacity={lineOpacity}
                listening={false}
              />
            )}

            {/* 編集対象行のみ黒丸マーカー（アクティブ+progressモードのみ） */}
            {isActive && editingRowIndex != null && points[editingRowIndex] && (
              <Circle
                x={points[editingRowIndex].x}
                y={points[editingRowIndex].y}
                radius={5}
                fill={points[editingRowIndex].offset > 0 ? '#16A34A' : points[editingRowIndex].offset < 0 ? '#DC2626' : '#374151'}
                stroke="white"
                strokeWidth={1.5}
                opacity={0.6}
                listening={false}
              />
            )}

            {/* オフセット日数テキスト（アクティブ線のみ、showOffsetLabelsがオンの時、0以外） */}
            {isActive && showOffsetLabels && points.map((p) => {
              if (p.offset === 0) return null
              const label = p.offset > 0 ? `+${p.offset}` : `${p.offset}`
              return (
                <Text
                  key={`progress-label-${pl.id}-${p.rowIndex}`}
                  x={p.x + 6}
                  y={p.y - 6}
                  text={label}
                  fontSize={9}
                  fill={p.offset > 0 ? '#16A34A' : '#DC2626'}
                  listening={false}
                />
              )
            })}

            {/* 基準日ラベル（アクティブ線のみ） */}
            {isActive && (
              <Text
                x={baseX}
                y={-12}
                text={pl.baseDate ?? ''}
                fontSize={8}
                fill="#6B7280"
                align="center"
                offsetX={20}
                listening={false}
              />
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}
