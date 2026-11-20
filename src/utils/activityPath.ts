export function computeIdealPathPoints(
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

