import type { ProjectCalendar } from '@/types/calendar'
import type { ProjectSettings } from '@/types/adm'

/**
 * 表示モードに応じた viewStartDate を計算する共通関数
 */
export function computeViewStartDate(projectSettings: ProjectSettings): Date {
  const viewStartOffset = projectSettings.viewStartOffset || 0
  const weekStartDay = projectSettings.weekStartDay ?? 1
  const displayMode = projectSettings.displayMode

  const date = new Date(projectSettings.startDate)
  date.setDate(date.getDate() + viewStartOffset)

  if (displayMode === 'weekly3') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffToWeekStart = (today.getDay() - weekStartDay + 7) % 7
    date.setTime(today.getTime())
    date.setDate(today.getDate() - diffToWeekStart - 7 + viewStartOffset)
  } else if (displayMode === 'weekly2') {
    const currentDay = date.getDay()
    let diff = currentDay - weekStartDay
    if (diff < 0) diff += 7
    date.setDate(date.getDate() - diff)
  } else if (displayMode === 'monthly' || displayMode === 'master') {
    date.setDate(1)
  }

  return date
}

/**
 * 指定日が週末（土日）かどうか
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * 指定日が祝日かどうか（status: 'workday' の祝日は false）
 */
/** ローカル日付をYYYY-MM-DD文字列に変換（UTC変換による日付ずれを防止） */
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isHoliday(date: Date, calendar: ProjectCalendar | null): boolean {
  if (!calendar) return false
  const dateStr = toLocalDateStr(date)
  const holiday = calendar.holidays.find(h => h.date === dateStr)
  return holiday != null && holiday.status !== 'workday'
}

/**
 * 指定日が非稼働日かどうか（calendar.workDays ベース + 祝日）
 */
export function isNonWorkday(date: Date, calendar: ProjectCalendar | null): boolean {
  if (!calendar) return isWeekend(date) // フォールバック
  const dayOfWeek = date.getDay()
  if (!calendar.workDays.includes(dayOfWeek)) return true // 非稼働曜日
  // 祝日チェック: status === 'workday' の祝日は稼働日扱い
  const dateStr = toLocalDateStr(date)
  const holiday = calendar.holidays.find(h => h.date === dateStr)
  if (holiday && holiday.status !== 'workday') return true
  return false
}

/**
 * X座標から日付を計算（xToDate）
 * startDate からの dayIndex を算出し、その日数分進めた Date を返す
 */
export function xToDate(x: number, startDate: Date, dayWidth: number): Date {
  const dayIndex = Math.floor(x / dayWidth)
  const date = new Date(startDate)
  date.setDate(date.getDate() + dayIndex)
  return date
}

/**
 * 日付からX座標を計算（dateToX）
 * startDate からの経過日数 * dayWidth を返す
 */
export function dateToX(date: Date, startDate: Date, dayWidth: number): number {
  const diffTime = date.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays * dayWidth
}

/**
 * 指定範囲のX座標で非稼働日の範囲を返す
 * セル左端〜セル右端ベース: 非稼働日セル全体をカバー
 * 戻り値の各要素は { startX, endX } で非稼働日のX座標範囲
 */
export function getNonWorkdayRanges(
  startX: number,
  endX: number,
  startDate: Date,
  dayWidth: number,
  calendar: ProjectCalendar | null
): Array<{ startX: number; endX: number }> {
  const ranges: Array<{ startX: number; endX: number }> = []
  const minX = Math.min(startX, endX)
  const maxX = Math.max(startX, endX)

  // 開始日から各日をチェック
  const startDayIndex = Math.floor(minX / dayWidth)
  const endDayIndex = Math.ceil(maxX / dayWidth)

  for (let dayIndex = startDayIndex; dayIndex < endDayIndex; dayIndex++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + dayIndex)

    if (isNonWorkday(date, calendar)) {
      // セル左端〜セル右端
      const rangeStartX = dayIndex * dayWidth
      const rangeEndX = (dayIndex + 1) * dayWidth
      ranges.push({
        startX: Math.max(rangeStartX, minX),
        endX: Math.min(rangeEndX, maxX)
      })
    }
  }

  return ranges
}

/**
 * N稼働日に必要なカレンダー日数を計算
 * 開始X座標から、指定した稼働日数を完了するのに必要なカレンダー日数を返す（開始日を含む）
 */
export function getCalendarDaysForWorkdays(
  fromX: number,
  workDays: number,
  startDate: Date,
  dayWidth: number,
  calendar: ProjectCalendar | null
): number {
  if (workDays <= 0) return 0

  const startDateFromX = xToDate(fromX, startDate, dayWidth)
  let calendarDays = 1  // 開始日を含む（最低1日）
  let workDaysCount = 0
  const currentDate = new Date(startDateFromX)

  // 開始日が稼働日かチェック
  if (!isNonWorkday(currentDate, calendar)) {
    workDaysCount++
  }

  // 残りの稼働日を数える（最大1000日でループを制限）
  while (workDaysCount < workDays && calendarDays < 1000) {
    currentDate.setDate(currentDate.getDate() + 1)
    calendarDays++

    // 稼働日かどうかチェック
    if (!isNonWorkday(currentDate, calendar)) {
      workDaysCount++
    }
  }

  return calendarDays
}

/**
 * 2つのX座標間の稼働日数を計算（getCalendarDaysForWorkdaysの逆関数）
 * fromXの日付からtoXの日付の前日まで、稼働日をカウントする
 */
export function getWorkdaysBetween(
  fromX: number,
  toX: number,
  startDate: Date,
  dayWidth: number,
  calendar: ProjectCalendar | null
): number {
  if (toX <= fromX) return 0

  const fromDate = xToDate(fromX, startDate, dayWidth)
  const calendarDays = Math.round((toX - fromX) / dayWidth)
  if (calendarDays <= 0) return 0

  let count = 0
  for (let i = 0; i < calendarDays; i++) {
    const d = new Date(fromDate)
    d.setDate(d.getDate() + i)
    if (!isNonWorkday(d, calendar)) {
      count++
    }
  }
  return count
}
