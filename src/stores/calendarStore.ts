import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ProjectCalendar, Holiday, Event } from '@/types'
import { createProjectCalendar } from '@/types'

// 日本の祝日（2024-2026年）
const japanHolidays: Holiday[] = [
  { date: '2025-01-01', name: '元日', type: 'national', status: 'holiday' },
  { date: '2025-01-13', name: '成人の日', type: 'national', status: 'holiday' },
  { date: '2025-02-11', name: '建国記念の日', type: 'national', status: 'holiday' },
  { date: '2025-02-23', name: '天皇誕生日', type: 'national', status: 'holiday' },
  { date: '2025-03-20', name: '春分の日', type: 'national', status: 'holiday' },
  { date: '2025-04-29', name: '昭和の日', type: 'national', status: 'holiday' },
  { date: '2025-05-03', name: '憲法記念日', type: 'national', status: 'holiday' },
  { date: '2025-05-04', name: 'みどりの日', type: 'national', status: 'holiday' },
  { date: '2025-05-05', name: 'こどもの日', type: 'national', status: 'holiday' },
  { date: '2025-07-21', name: '海の日', type: 'national', status: 'holiday' },
  { date: '2025-08-11', name: '山の日', type: 'national', status: 'holiday' },
  { date: '2025-09-15', name: '敬老の日', type: 'national', status: 'holiday' },
  { date: '2025-09-23', name: '秋分の日', type: 'national', status: 'holiday' },
  { date: '2025-10-13', name: 'スポーツの日', type: 'national', status: 'holiday' },
  { date: '2025-11-03', name: '文化の日', type: 'national', status: 'holiday' },
  { date: '2025-11-23', name: '勤労感謝の日', type: 'national', status: 'holiday' },
  { date: '2026-01-01', name: '元日', type: 'national', status: 'holiday' },
  { date: '2026-01-12', name: '成人の日', type: 'national', status: 'holiday' },
  { date: '2026-02-11', name: '建国記念の日', type: 'national', status: 'holiday' },
  { date: '2026-02-23', name: '天皇誕生日', type: 'national', status: 'holiday' },
  { date: '2026-03-20', name: '春分の日', type: 'national', status: 'holiday' },
]

interface CalendarState {
  calendar: ProjectCalendar | null

  initCalendar: (projectId: string, startDate?: string) => void
  setStartDate: (date: string) => void
  setWorkDays: (days: number[]) => void

  addHoliday: (holiday: Omit<Holiday, 'type' | 'status'> & { type?: Holiday['type']; status?: Holiday['status'] }) => void
  removeHoliday: (date: string) => void
  updateHoliday: (date: string, updates: Partial<Holiday>) => void
  loadNationalHolidays: () => void

  addEvent: (event: Omit<Event, 'id'>) => string
  updateEvent: (eventId: string, updates: Partial<Event>) => void
  removeEvent: (eventId: string) => void

  isWorkDay: (date: Date) => boolean
  countWorkDays: (startDate: Date, days: number) => Date
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  calendar: null,

  initCalendar: (projectId, startDate) => {
    const calendar = createProjectCalendar({
      id: uuidv4(),
      projectId,
      startDate: startDate ?? new Date().toISOString().split('T')[0],
      holidays: [...japanHolidays],
    })
    set({ calendar })
  },

  setStartDate: (date) => {
    set(state => {
      if (!state.calendar) return state
      return { calendar: { ...state.calendar, startDate: date } }
    })
  },

  setWorkDays: (days) => {
    set(state => {
      if (!state.calendar) return state
      return { calendar: { ...state.calendar, workDays: days } }
    })
  },

  addHoliday: (holiday) => {
    set(state => {
      if (!state.calendar) return state
      const existing = state.calendar.holidays.find(h => h.date === holiday.date)
      if (existing) return state

      return {
        calendar: {
          ...state.calendar,
          holidays: [...state.calendar.holidays, { ...holiday, type: holiday.type ?? 'custom', status: holiday.status ?? 'holiday' }],
        },
      }
    })
  },

  updateHoliday: (date, updates) => {
    set(state => {
      if (!state.calendar) return state
      return {
        calendar: {
          ...state.calendar,
          holidays: state.calendar.holidays.map(h =>
            h.date === date ? { ...h, ...updates } : h
          ),
        },
      }
    })
  },

  removeHoliday: (date) => {
    set(state => {
      if (!state.calendar) return state
      return {
        calendar: {
          ...state.calendar,
          holidays: state.calendar.holidays.filter(h => h.date !== date),
        },
      }
    })
  },

  loadNationalHolidays: () => {
    set(state => {
      if (!state.calendar) return state
      const existingDates = new Set(state.calendar.holidays.map(h => h.date))
      const newHolidays = japanHolidays.filter(h => !existingDates.has(h.date))
      return {
        calendar: {
          ...state.calendar,
          holidays: [...state.calendar.holidays, ...newHolidays],
        },
      }
    })
  },

  addEvent: (event) => {
    const id = uuidv4()
    set(state => {
      if (!state.calendar) return state
      return {
        calendar: {
          ...state.calendar,
          events: [...state.calendar.events, { ...event, id }],
        },
      }
    })
    return id
  },

  updateEvent: (eventId, updates) => {
    set(state => {
      if (!state.calendar) return state
      return {
        calendar: {
          ...state.calendar,
          events: state.calendar.events.map(e => (e.id === eventId ? { ...e, ...updates } : e)),
        },
      }
    })
  },

  removeEvent: (eventId) => {
    set(state => {
      if (!state.calendar) return state
      return {
        calendar: {
          ...state.calendar,
          events: state.calendar.events.filter(e => e.id !== eventId),
        },
      }
    })
  },

  isWorkDay: (date) => {
    const calendar = get().calendar
    if (!calendar) return true

    const dayOfWeek = date.getDay()
    if (!calendar.workDays.includes(dayOfWeek)) return false

    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    const holiday = calendar.holidays.find(h => h.date === dateStr)
    if (holiday && holiday.status !== 'workday') return false

    return true
  },

  countWorkDays: (startDate, days) => {
    const calendar = get().calendar
    if (!calendar) {
      const result = new Date(startDate)
      result.setDate(result.getDate() + days)
      return result
    }

    let current = new Date(startDate)
    let count = 0

    while (count < days) {
      current.setDate(current.getDate() + 1)
      if (get().isWorkDay(current)) {
        count++
      }
    }

    return current
  },
}))
