/**
 * リサイズ可能なパネルコンポーネント
 */

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'

interface ResizablePanelProps {
  children: ReactNode
  width: number
  minWidth?: number
  maxWidth?: number
  position: 'left' | 'right'
  onWidthChange: (width: number) => void
  className?: string
}

export function ResizablePanel({
  children,
  width,
  minWidth = 100,
  maxWidth = 500,
  position,
  onWidthChange,
  className = '',
}: ResizablePanelProps) {
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
  }, [width])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.touches[0].clientX
    startWidthRef.current = width
  }, [width])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const delta = position === 'left'
      ? e.clientX - startXRef.current
      : startXRef.current - e.clientX

    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta))
    onWidthChange(newWidth)
  }, [isResizing, position, minWidth, maxWidth, onWidthChange])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isResizing) return

    const delta = position === 'left'
      ? e.touches[0].clientX - startXRef.current
      : startXRef.current - e.touches[0].clientX

    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + delta))
    onWidthChange(newWidth)
  }, [isResizing, position, minWidth, maxWidth, onWidthChange])

  const handleEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleEnd)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, handleMouseMove, handleTouchMove, handleEnd])

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width }}
    >
      {children}

      {/* リサイズハンドル（タッチ対応: w-3） */}
      <div
        className={`absolute top-0 ${position === 'left' ? 'right-0' : 'left-0'} w-3 h-full cursor-col-resize hover:bg-blue-400 transition-colors ${isResizing ? 'bg-blue-500' : 'bg-transparent'}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ zIndex: 10 }}
      />
    </div>
  )
}
