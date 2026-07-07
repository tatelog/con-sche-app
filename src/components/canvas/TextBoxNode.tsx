import { useMemo } from 'react'
import { Group, Rect, Text } from 'react-konva'
import type { TextBox } from '@/types'

interface TextBoxNodeProps {
  textbox: TextBox
  isSelected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onDragMove?: (id: string, x: number, y: number) => void
  onDoubleClick: (id: string) => void
}

// 文字幅の概算（全角≒fontSize, 半角≒fontSize*0.6）
function estimateTextWidth(text: string, fontSize: number): number {
  let w = 0
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0xff ? fontSize : fontSize * 0.6
  }
  return w
}

export function TextBoxNode({
  textbox,
  isSelected,
  onSelect,
  onDragEnd,
  onDragMove,
  onDoubleClick,
}: TextBoxNodeProps) {
  const isVertical = textbox.writingDirection === 'vertical'
  const hasBorder = textbox.showBorder
  const hasBackground = textbox.showBackground !== false
  const fs = textbox.fontSize
  const pad = 2

  // 枠線スタイル
  const borderStyle = hasBorder
    ? {
        stroke: isSelected ? '#3B82F6' : textbox.borderColor,
        strokeWidth: isSelected ? 2 : textbox.borderWidth,
      }
    : {
        stroke: isSelected ? '#3B82F6' : 'transparent',
        strokeWidth: isSelected ? 2 : 0,
      }

  // テキスト内容に合わせた自動サイズ計算
  const { effectiveWidth, effectiveHeight } = useMemo(() => {
    if (!textbox.text) {
      // 空テキスト: 最小サイズ
      return { effectiveWidth: textbox.width, effectiveHeight: textbox.height }
    }

    if (isVertical) {
      // 縦書き: \n = 列区切り（右→左）
      const columns = textbox.text.split('\n')
      const colCount = columns.length
      const maxChars = Math.max(...columns.map(c => c.length))
      const w = colCount * (fs + pad) + pad
      const h = maxChars * fs + pad * 2
      return { effectiveWidth: w, effectiveHeight: h }
    } else {
      // 横書き: \n = 行区切り
      const lines = textbox.text.split('\n')
      const lineCount = lines.length
      const maxLineWidth = Math.max(...lines.map(l => estimateTextWidth(l, fs)))
      const w = maxLineWidth + pad * 2
      const h = lineCount * (fs + pad) + pad
      return { effectiveWidth: w, effectiveHeight: h }
    }
  }, [isVertical, textbox.text, textbox.width, textbox.height, fs])

  // スナップアンカーに応じたオフセット
  const anchorX = textbox.snapAnchorX ?? 'left'
  const anchorY = textbox.snapAnchorY ?? 'center'
  const offsetX = anchorX === 'center' ? -effectiveWidth / 2 : anchorX === 'right' ? -effectiveWidth : 0
  const offsetY = anchorY === 'center' ? -effectiveHeight / 2 : anchorY === 'bottom' ? -effectiveHeight : 0

  return (
    <Group
      x={textbox.position.x + offsetX}
      y={textbox.position.y + offsetY}
      draggable
      onClick={(e) => {
        e.cancelBubble = true
        onSelect(textbox.id)
      }}
      onDblClick={(e) => {
        e.cancelBubble = true
        onDoubleClick(textbox.id)
      }}
      onDragMove={onDragMove ? (e) => {
        onDragMove(textbox.id, e.target.x() - offsetX, e.target.y() - offsetY)
      } : undefined}
      onDragEnd={(e) => onDragEnd(textbox.id, e.target.x() - offsetX, e.target.y() - offsetY)}
    >
      {/* 背景 */}
      <Rect
        width={effectiveWidth}
        height={effectiveHeight}
        fill={hasBackground ? textbox.backgroundColor : 'transparent'}
        cornerRadius={2}
        {...borderStyle}
      />

      {/* テキスト */}
      {isVertical ? (
        // 縦書き: 列ごとに右から左へ描画
        textbox.text.split('\n').map((col, colIdx) => (
          <Text
            key={colIdx}
            x={effectiveWidth - (colIdx + 1) * (fs + pad)}
            y={pad}
            width={fs + pad}
            height={effectiveHeight - pad * 2}
            text={col.split('').join('\n')}
            fontSize={fs}
            fill={textbox.fontColor}
            align="center"
            lineHeight={1}
            wrap="none"
          />
        ))
      ) : (
        <Text
          x={pad}
          y={pad}
          width={effectiveWidth - pad * 2}
          height={effectiveHeight - pad * 2}
          text={textbox.text}
          fontSize={fs}
          fill={textbox.fontColor}
          align={textbox.textAlign}
          verticalAlign="middle"
          wrap="none"
        />
      )}
    </Group>
  )
}
