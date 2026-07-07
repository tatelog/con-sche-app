/**
 * S字カーブ計算ユーティリティ
 * 計画曲線（CPMのES/EFから）と実績曲線（進捗線データから）を算出
 * LF（最遅完了時刻）の最大値を100%到達点とする
 */

import type { Activity, ProgressLine } from '@/types/adm'

export interface CurvePoint {
  day: number    // プロジェクト開始からの日数
  percent: number // 0-100
}

/**
 * 計画曲線: 各日付時点での累計完了率（CPMのES/EFから）
 * 全アクティビティのLF最大値を竣工(100%)とし、それ以降は100%で水平線
 */
export function calcPlannedCurve(
  activities: Activity[],
  projectDuration: number
): CurvePoint[] {
  if (projectDuration <= 0 || activities.length === 0) return []

  const realActivities = activities.filter(a => !a.isDummy && a.duration > 0)
  if (realActivities.length === 0) return []

  // 竣工時点 = 全アクティビティのLFの最大値
  // lf=0 は未計算の初期値なので ef にフォールバック
  const maxLF = Math.max(...realActivities.map(a => a.lf > 0 ? a.lf : a.ef))
  const totalWork = realActivities.reduce((sum, a) => sum + a.duration, 0)
  const points: CurvePoint[] = []

  for (let day = 0; day <= projectDuration; day++) {
    let completedWork = 0
    for (const a of realActivities) {
      if (day >= a.ef) {
        completedWork += a.duration
      } else if (day > a.es) {
        completedWork += (day - a.es)
      }
    }
    const percent = Math.min(100, (completedWork / totalWork) * 100)
    points.push({ day, percent })

    // maxLFに到達したら100%で打ち切り（残りはprojectDurationまで100%水平線）
    if (day >= maxLF && percent >= 100) {
      // projectDurationまで100%で延長
      if (day < projectDuration) {
        points.push({ day: projectDuration, percent: 100 })
      }
      break
    }
  }

  return points
}

/**
 * 実績曲線: 進捗線データから累計実績率
 * 各行の進捗オフセットから全体の進捗を計算
 */
export function calcActualCurve(
  activities: Activity[],
  progressLine: ProgressLine,
  projectDuration: number
): CurvePoint[] {
  if (!progressLine.baseDate || projectDuration <= 0) return []

  const realActivities = activities.filter(a => !a.isDummy && a.duration > 0)
  if (realActivities.length === 0) return []

  // 進捗オフセットから平均進捗率を推定
  const offsets = Object.values(progressLine.rowOffsets)
  if (offsets.length === 0) return []

  const avgOffset = offsets.reduce((sum, o) => sum + o, 0) / offsets.length
  const totalWork = realActivities.reduce((sum, a) => sum + a.duration, 0)

  // 基準日のプロジェクト日数を推定（baseDateXからの逆算）
  const baseDayIndex = Math.round(progressLine.baseDateX / 30) // DAY_WIDTH approximate

  const points: CurvePoint[] = []
  // 基準日までの計画曲線を実績として使い、基準日時点でオフセット分を加減
  for (let day = 0; day <= Math.min(baseDayIndex + Math.abs(avgOffset), projectDuration); day++) {
    let completedWork = 0
    for (const a of realActivities) {
      const adjustedEf = a.ef + avgOffset
      const adjustedEs = a.es + avgOffset
      if (day >= adjustedEf) {
        completedWork += a.duration
      } else if (day > adjustedEs) {
        completedWork += (day - adjustedEs)
      }
    }
    points.push({
      day,
      percent: Math.min(100, Math.max(0, (completedWork / totalWork) * 100)),
    })
  }

  return points
}
