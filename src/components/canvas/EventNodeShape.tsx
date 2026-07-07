/**
 * ADM形式の結合点（Event Node）コンポーネント
 * 小さな○で表示し、番号を表示
 * エッジが通過する場合は半円で表示
 */

import { Circle, Group, Text, Arc } from 'react-konva'
import type { EventNode } from '@/types/adm'

// 半円表示のための方向
export type SemiCircleDirection = 'top' | 'bottom' | 'left' | 'right' | null

interface EventNodeShapeProps {
  node: EventNode
  isSelected: boolean
  isOnCriticalPath: boolean
  showDetails?: boolean // ET/LT詳細表示
  semiCircleDirection?: SemiCircleDirection // 半円表示の方向（エッジが通過する場合）
  onClick?: () => void
  onContextMenu?: (e: { evt: MouseEvent }) => void
  onDragMove?: (position: { x: number; y: number }) => void
  onDragEnd?: (position: { x: number; y: number }) => void
  draggable?: boolean
}

// ノードサイズ（小さめ）
const NODE_RADIUS = 6
const CRITICAL_COLOR = '#DC2626' // red-600
const NORMAL_COLOR = '#374151' // gray-700
const SELECTED_COLOR = '#2563EB' // blue-600
const FILL_COLOR = '#FFFFFF'

export function EventNodeShape({
  node,
  isSelected,
  isOnCriticalPath,
  showDetails = false,
  semiCircleDirection = null,
  onClick,
  onContextMenu,
  onDragMove,
  onDragEnd,
  draggable = true,
}: EventNodeShapeProps) {
  const strokeColor = isSelected
    ? SELECTED_COLOR
    : isOnCriticalPath
      ? CRITICAL_COLOR
      : NORMAL_COLOR

  const strokeWidth = isSelected || isOnCriticalPath ? 2 : 1.5

  // 半円表示時の回転角度を計算
  const getArcRotation = (): number => {
    switch (semiCircleDirection) {
      case 'top':
        return 180 // 上半分を表示
      case 'bottom':
        return 0 // 下半分を表示
      case 'left':
        return 90 // 左半分を表示
      case 'right':
        return -90 // 右半分を表示
      default:
        return 0
    }
  }

  return (
    <Group
      x={node.position.x}
      y={node.position.y}
      draggable={draggable}
      onClick={(e) => {
        e.cancelBubble = true
        // 左クリックのみ処理（右クリックはonContextMenuで処理）
        if (e.evt.button === 0) {
          onClick?.()
        }
      }}
      onTap={onClick}
      onContextMenu={onContextMenu}
      onDragMove={(e) => {
        const pos = e.target.position()
        onDragMove?.({ x: pos.x, y: pos.y })
      }}
      onDragEnd={(e) => {
        const pos = e.target.position()
        // Konvaの内部位置をReact propsの値にリセット
        // → moveNode後の再レンダリングでスナップ座標が正しく反映される
        e.target.position({ x: node.position.x, y: node.position.y })
        onDragEnd?.({ x: pos.x, y: pos.y })
      }}
    >
      {/* メインの円または半円 */}
      {semiCircleDirection ? (
        // 半円表示
        <Arc
          innerRadius={0}
          outerRadius={NODE_RADIUS}
          angle={180}
          rotation={getArcRotation()}
          fill={FILL_COLOR}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      ) : (
        // 通常の円
        <Circle
          radius={NODE_RADIUS}
          fill={FILL_COLOR}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}

      {/* 選択時またはshowDetails時にET/LT表示 */}
      {(isSelected || showDetails) && (
        <Text
          text={`${node.earliestTime}/${node.latestTime}`}
          fontSize={8}
          fill="#6B7280"
          align="center"
          width={40}
          offsetX={20}
          y={NODE_RADIUS + 2}
        />
      )}

      {/* ラベル（オプション） */}
      {node.label && (
        <Text
          text={node.label}
          fontSize={9}
          fill="#374151"
          align="center"
          width={60}
          offsetX={30}
          y={-NODE_RADIUS - 12}
        />
      )}
    </Group>
  )
}

export { NODE_RADIUS }
