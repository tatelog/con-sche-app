import type { Position } from './task'

export type TextBoxStyle = 'plain' | 'balloon' | 'note' | 'warning'
export type TextAlign = 'left' | 'center' | 'right'
export type WritingDirection = 'horizontal' | 'vertical'
export type SnapAnchorX = 'left' | 'center' | 'right'
export type SnapAnchorY = 'top' | 'center' | 'bottom'

export interface TextBox {
  id: string
  position: Position
  width: number
  height: number
  text: string
  style: TextBoxStyle
  fontSize: number
  fontColor: string
  backgroundColor: string
  borderColor: string
  borderWidth: number
  textAlign: TextAlign
  rotation: number
  zIndex: number
  writingDirection: WritingDirection
  showBorder: boolean
  showBackground: boolean
  snapAnchorX: SnapAnchorX
  snapAnchorY: SnapAnchorY
  linkedTaskId?: string
}

export function createTextBox(
  partial: Partial<TextBox> & { id: string }
): TextBox {
  return {
    position: { x: 100, y: 100 },
    width: 60,
    height: 13,
    text: '',
    style: 'plain',
    fontSize: 10,
    fontColor: '#000000',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    textAlign: 'left',
    rotation: 0,
    zIndex: 0,
    writingDirection: 'horizontal',
    showBorder: true,
    showBackground: true,
    snapAnchorX: 'left',
    snapAnchorY: 'center',
    ...partial,
  }
}
