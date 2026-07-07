import { useCallback, useRef } from 'react'
import { useUIStore } from '@/stores/uiStore'

// カレンダーヘッダーの高さ（NetworkCanvas の HEADER_HEIGHT と一致させる）
const HEADER_HEIGHT = 50
const BAR = 12 // スクロールバーの太さ(px)
const MIN_THUMB = 30 // つまみの最小長(px)

/**
 * ネットワーク工程表キャンバス用のスクロールバー（縦・横）。
 * uiStore の canvasPosition（パン）/ canvasScale / コンテンツ・ビューポート寸法から
 * つまみを描画し、ドラッグで canvasPosition を更新する。
 * コンテンツがビューを超えるときだけ該当軸のバーを表示する。
 *
 * left/top: 位置決めコンテキスト（外側の relative div）内での Stage 左上のオフセット。
 * NetworkCanvas では left=行ヘッダーパネル幅, top=ナビバー高さ を渡す。
 */
export function CanvasScrollbars({ left = 0, top = 0 }: { left?: number; top?: number }) {
  const canvasPosition = useUIStore((s) => s.canvasPosition)
  const canvasScale = useUIStore((s) => s.canvasScale)
  const content = useUIStore((s) => s.canvasContentSize)
  const viewport = useUIStore((s) => s.canvasViewport)
  const setCanvasPosition = useUIStore((s) => s.setCanvasPosition)

  const dragRef = useRef<{ axis: 'x' | 'y'; startMouse: number; startPan: number } | null>(null)

  // バーなしでの素の可視ワールド範囲（バーを出すべきかの判定用）
  const rawVisibleW = canvasScale > 0 ? viewport.width / canvasScale : 0
  const rawVisibleH = canvasScale > 0 ? (viewport.height - HEADER_HEIGHT) / canvasScale : 0
  const needX = content.width > rawVisibleW + 0.5 && viewport.width > 0
  const needY = content.height > rawVisibleH + 0.5 && viewport.height > 0

  // 実効可視領域: スクロールバー（縦=右端 / 横=下端）が覆う分を差し引く。
  // これを引かないと、バーの裏に隠れるコンテンツ最下部・右端までスクロールできない。
  const effViewW = viewport.width - (needY ? BAR : 0)
  const effViewH = viewport.height - HEADER_HEIGHT - (needX ? BAR : 0)
  const visibleW = canvasScale > 0 ? effViewW / canvasScale : 0
  const visibleH = canvasScale > 0 ? effViewH / canvasScale : 0

  const maxPanX = Math.max(0, content.width - visibleW)
  const maxPanY = Math.max(0, content.height - visibleH)

  const showX = needX
  const showY = needY

  // 横トラック長（縦バーの分だけ差し引く）
  const trackW = viewport.width - (showY ? BAR : 0)
  // 縦トラック長（ヘッダー下〜横バー上）
  const trackH = viewport.height - HEADER_HEIGHT - (showX ? BAR : 0)

  const thumbW = showX ? Math.max(MIN_THUMB, trackW * (visibleW / content.width)) : 0
  const thumbH = showY ? Math.max(MIN_THUMB, trackH * (visibleH / content.height)) : 0

  const thumbX = maxPanX > 0 ? (canvasPosition.x / maxPanX) * (trackW - thumbW) : 0
  const thumbY = maxPanY > 0 ? (canvasPosition.y / maxPanY) * (trackH - thumbH) : 0

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current
    if (!d) return
    if (d.axis === 'x') {
      const travel = trackW - thumbW
      if (travel <= 0) return
      const deltaPan = ((e.clientX - d.startMouse) / travel) * maxPanX
      const next = Math.max(0, Math.min(maxPanX, d.startPan + deltaPan))
      setCanvasPosition({ x: next, y: useUIStore.getState().canvasPosition.y })
    } else {
      const travel = trackH - thumbH
      if (travel <= 0) return
      const deltaPan = ((e.clientY - d.startMouse) / travel) * maxPanY
      const next = Math.max(0, Math.min(maxPanY, d.startPan + deltaPan))
      setCanvasPosition({ x: useUIStore.getState().canvasPosition.x, y: next })
    }
  }, [trackW, thumbW, trackH, thumbH, maxPanX, maxPanY, setCanvasPosition])

  const onMouseUp = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove])

  const startDrag = useCallback((axis: 'x' | 'y') => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const pos = useUIStore.getState().canvasPosition
    dragRef.current = {
      axis,
      startMouse: axis === 'x' ? e.clientX : e.clientY,
      startPan: axis === 'x' ? pos.x : pos.y,
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [onMouseMove, onMouseUp])

  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    background: 'rgba(100,116,139,0.55)',
    borderRadius: BAR / 2,
    cursor: 'pointer',
  }

  return (
    <>
      {/* 横スクロールバー（Stage下端） */}
      {showX && (
        <div
          style={{
            position: 'absolute',
            left,
            bottom: 0,
            width: trackW,
            height: BAR,
            background: 'rgba(241,245,249,0.9)',
            borderTop: '1px solid rgba(203,213,225,0.8)',
            zIndex: 20,
          }}
        >
          <div
            onMouseDown={startDrag('x')}
            style={{ ...thumbStyle, left: thumbX, top: 1, width: thumbW, height: BAR - 2 }}
          />
        </div>
      )}

      {/* 縦スクロールバー（Stage右端、カレンダーヘッダー下から） */}
      {showY && (
        <div
          style={{
            position: 'absolute',
            top: top + HEADER_HEIGHT,
            right: 0,
            width: BAR,
            height: trackH,
            background: 'rgba(241,245,249,0.9)',
            borderLeft: '1px solid rgba(203,213,225,0.8)',
            zIndex: 20,
          }}
        >
          <div
            onMouseDown={startDrag('y')}
            style={{ ...thumbStyle, top: thumbY, left: 1, width: BAR - 2, height: thumbH }}
          />
        </div>
      )}
    </>
  )
}
