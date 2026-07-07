export interface Holiday {
  date: string // YYYY-MM-DD
  name: string
  type: 'national' | 'company' | 'custom'
  status: 'holiday' | 'workday' // 全休 or 稼働日扱い
}

export interface Event {
  id: string
  date: string
  name: string
  type: 'inspection' | 'delivery' | 'ceremony' | 'meeting' | 'other'
  note?: string
  color?: string
}

export interface ProjectCalendar {
  id: string
  projectId: string
  startDate: string
  endDate?: string
  workDays: number[] // 0=日, 1=月, ... 6=土
  holidays: Holiday[]
  events: Event[]
}

export function createProjectCalendar(
  partial: Partial<ProjectCalendar> & { id: string; projectId: string }
): ProjectCalendar {
  return {
    startDate: new Date().toISOString().split('T')[0],
    workDays: [1, 2, 3, 4, 5], // 月〜金
    holidays: [],
    events: [],
    ...partial,
  }
}

export function isWorkDay(
  date: Date,
  calendar: ProjectCalendar
): boolean {
  const dayOfWeek = date.getDay()
  if (!calendar.workDays.includes(dayOfWeek)) return false

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const dateStr = `${y}-${m}-${d}`
  const holiday = calendar.holidays.find(h => h.date === dateStr)
  if (holiday && holiday.status !== 'workday') return false

  return true
}

export function countWorkDays(
  startDate: Date,
  days: number,
  calendar: ProjectCalendar
): Date {
  let current = new Date(startDate)
  let count = 0

  while (count < days) {
    current.setDate(current.getDate() + 1)
    if (isWorkDay(current, calendar)) {
      count++
    }
  }

  return current
}

export function getWorkDaysBetween(
  startDate: Date,
  endDate: Date,
  calendar: ProjectCalendar
): number {
  let current = new Date(startDate)
  let count = 0

  while (current < endDate) {
    current.setDate(current.getDate() + 1)
    if (isWorkDay(current, calendar)) {
      count++
    }
  }

  return count
}
