/**
 * カーソル近傍ヒント
 * ドラッグ中などに「なぜその操作ができないか」をカーソルの右下に表示する。
 * uiStore.cursorHint に文言をセットすると表示、null で消える。
 */

import { useEffect, useState } from 'react'
import { useUIStore } from '@/stores/uiStore'

export function CursorHint() {
  const hint = useUIStore((s) => s.cursorHint)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!hint) return
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [hint])

  if (!hint) return null

  return (
    <div
      className="fixed z-[9500] pointer-events-none bg-slate-800/90 text-white text-xs rounded-lg px-3 py-1.5 shadow-lg max-w-[260px] leading-relaxed"
      style={{ left: pos.x + 14, top: pos.y + 18 }}
    >
      {hint}
    </div>
  )
}
