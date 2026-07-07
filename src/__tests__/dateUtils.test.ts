import { describe, it, expect } from 'vitest'
import {
  isWeekend,
  isHoliday,
  isNonWorkday,
  xToDate,
  dateToX,
  getNonWorkdayRanges,
  getCalendarDaysForWorkdays,
} from '@/utils/dateUtils'
import type { ProjectCalendar } from '@/types/calendar'

/**
 * テスト用ヘルパー: UTCの正午で日付を作成する。
 * isHoliday は toISOString() (UTC基準) で日付文字列を比較するため、
 * ローカルタイムゾーン(JST等)との日付ずれを避けるためにUTC正午を使用する。
 * getDay() 等のローカル系メソッドもJST(UTC+9)では同日の21時になるため安全。
 */
function utcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0))
}

const testCalendar: ProjectCalendar = {
  id: 'test',
  projectId: 'test',
  startDate: '2026-02-01',
  workDays: [1, 2, 3, 4, 5], // 月〜金
  holidays: [
    { date: '2026-02-11', name: '建国記念日', type: 'national', status: 'holiday' },
  ],
  events: [],
}

describe('isWeekend', () => {
  it('月曜日(2026-02-02)はfalseを返す', () => {
    const monday = utcNoon(2026, 1, 2)
    expect(isWeekend(monday)).toBe(false)
  })

  it('土曜日(2026-02-07)はtrueを返す', () => {
    const saturday = utcNoon(2026, 1, 7)
    expect(isWeekend(saturday)).toBe(true)
  })

  it('日曜日(2026-02-08)はtrueを返す', () => {
    const sunday = utcNoon(2026, 1, 8)
    expect(isWeekend(sunday)).toBe(true)
  })
})

describe('isHoliday', () => {
  it('祝日リストに含まれる日(2026-02-11, 建国記念日)はtrueを返す', () => {
    const holiday = utcNoon(2026, 1, 11)
    expect(isHoliday(holiday, testCalendar)).toBe(true)
  })

  it('祝日リストにない平日はfalseを返す', () => {
    const workday = utcNoon(2026, 1, 2) // 月曜
    expect(isHoliday(workday, testCalendar)).toBe(false)
  })

  it('calendar=nullの場合はfalseを返す', () => {
    const holiday = utcNoon(2026, 1, 11)
    expect(isHoliday(holiday, null)).toBe(false)
  })
})

describe('isNonWorkday', () => {
  it('土曜 + calendar有り → true', () => {
    const saturday = utcNoon(2026, 1, 7)
    expect(isNonWorkday(saturday, testCalendar)).toBe(true)
  })

  it('平日 + 祝日(status:holiday) → true', () => {
    // 2026-02-11(水曜日)は建国記念日
    const holiday = utcNoon(2026, 1, 11)
    expect(isNonWorkday(holiday, testCalendar)).toBe(true)
  })

  it('平日 + 祝日(status:workday) → false（稼働日扱い）', () => {
    const calendarWithWorkdayHoliday: ProjectCalendar = {
      ...testCalendar,
      holidays: [
        { date: '2026-02-11', name: '建国記念日', type: 'national', status: 'workday' },
      ],
    }
    const holiday = utcNoon(2026, 1, 11)
    expect(isNonWorkday(holiday, calendarWithWorkdayHoliday)).toBe(false)
  })

  it('平日 + 非祝日 → false', () => {
    const workday = utcNoon(2026, 1, 2) // 月曜
    expect(isNonWorkday(workday, testCalendar)).toBe(false)
  })

  it('calendar.workDaysに含まれない曜日 → true', () => {
    const calendarNoWednesday: ProjectCalendar = {
      ...testCalendar,
      workDays: [1, 2, 4, 5], // 水曜(3)を除外
    }
    const wednesday = utcNoon(2026, 1, 4) // 2026-02-04は水曜
    expect(isNonWorkday(wednesday, calendarNoWednesday)).toBe(true)
  })
})

describe('xToDate', () => {
  const startDate = utcNoon(2026, 1, 2) // 2026-02-02(月曜)
  const dayWidth = 30

  it('x=0 → startDateと同じ日', () => {
    const result = xToDate(0, startDate, dayWidth)
    expect(result.getFullYear()).toBe(startDate.getFullYear())
    expect(result.getMonth()).toBe(startDate.getMonth())
    expect(result.getDate()).toBe(startDate.getDate())
  })

  it('x=30 → startDate+1日', () => {
    const result = xToDate(30, startDate, dayWidth)
    const expected = new Date(startDate)
    expected.setDate(expected.getDate() + 1)
    expect(result.getFullYear()).toBe(expected.getFullYear())
    expect(result.getMonth()).toBe(expected.getMonth())
    expect(result.getDate()).toBe(expected.getDate())
  })

  it('x=60 → startDate+2日', () => {
    const result = xToDate(60, startDate, dayWidth)
    const expected = new Date(startDate)
    expected.setDate(expected.getDate() + 2)
    expect(result.getFullYear()).toBe(expected.getFullYear())
    expect(result.getMonth()).toBe(expected.getMonth())
    expect(result.getDate()).toBe(expected.getDate())
  })
})

describe('dateToX', () => {
  const startDate = utcNoon(2026, 1, 2) // 2026-02-02(月曜)
  const dayWidth = 30

  it('dateToX(startDate, startDate, 30) → 0', () => {
    expect(dateToX(startDate, startDate, dayWidth)).toBe(0)
  })

  it('dateToX(startDate+1日, startDate, 30) → 30', () => {
    const nextDay = new Date(startDate)
    nextDay.setDate(nextDay.getDate() + 1)
    expect(dateToX(nextDay, startDate, dayWidth)).toBe(30)
  })

  it('dateToX(startDate+2日, startDate, 30) → 60', () => {
    const twoDaysLater = new Date(startDate)
    twoDaysLater.setDate(twoDaysLater.getDate() + 2)
    expect(dateToX(twoDaysLater, startDate, dayWidth)).toBe(60)
  })
})

describe('xToDate / dateToX round-trip', () => {
  const startDate = utcNoon(2026, 1, 2)
  const dayWidth = 30

  it('dateToX(xToDate(x)) は x を dayWidth 境界に丸めた値と一致する', () => {
    // x がちょうど dayWidth の倍数の場合
    const x = 90
    const date = xToDate(x, startDate, dayWidth)
    const result = dateToX(date, startDate, dayWidth)
    expect(result).toBe(x)
  })

  it('dayWidth 境界でないxはfloor丸めされる', () => {
    // x=45 → dayIndex=1 → dateToX = 30
    const x = 45
    const date = xToDate(x, startDate, dayWidth)
    const result = dateToX(date, startDate, dayWidth)
    expect(result).toBe(30) // Math.floor(45/30) = 1, 1*30 = 30
  })
})

describe('getNonWorkdayRanges', () => {
  // startDate=2026-02-02(月曜), dayWidth=30
  // セル左端ベース: dayIndex=5(土) → 150-180, dayIndex=6(日) → 180-210
  const startDate = utcNoon(2026, 1, 2)
  const dayWidth = 30

  it('月〜金(x=15~135)の範囲 → 非稼働日なし → []', () => {
    const ranges = getNonWorkdayRanges(15, 135, startDate, dayWidth, testCalendar)
    expect(ranges).toEqual([])
  })

  it('月〜土(x=15~180)の範囲 → 土(150-180)', () => {
    // dayIndex 5(土)セル: 150-180
    const ranges = getNonWorkdayRanges(15, 180, startDate, dayWidth, testCalendar)
    expect(ranges).toContainEqual({ startX: 150, endX: 180 })
  })

  it('祝日を含む範囲で祝日が検出される', () => {
    // 2026-02-11は startDate(2/2) から9日目 → dayIndex=9 → セル: 270-300
    const ranges = getNonWorkdayRanges(15, 315, startDate, dayWidth, testCalendar)
    // 土(dayIndex=5): 150-180, 日(dayIndex=6): 180-210, 祝日(dayIndex=9): 270-300
    expect(ranges).toContainEqual({ startX: 150, endX: 180 })
    expect(ranges).toContainEqual({ startX: 180, endX: 210 })
    expect(ranges).toContainEqual({ startX: 270, endX: 300 })
  })
})

describe('getCalendarDaysForWorkdays', () => {
  // startDate=2026-02-02(月曜), dayWidth=30
  const startDate = utcNoon(2026, 1, 2)
  const dayWidth = 30

  it('稼働日5日、月曜開始（土日非稼働） → カレンダー日数=5', () => {
    // fromX=0 → 2/2(月)開始, 稼働日5日 → 月火水木金で5日
    const result = getCalendarDaysForWorkdays(0, 5, startDate, dayWidth, testCalendar)
    expect(result).toBe(5)
  })

  it('稼働日6日、月曜開始 → カレンダー日数=8（月〜金＋土日＋翌月曜）', () => {
    // fromX=0 → 2/2(月)開始, 稼働日6日 → 月火水木金(5) + 土日(非稼働2) + 月(1) = 8日
    const result = getCalendarDaysForWorkdays(0, 6, startDate, dayWidth, testCalendar)
    expect(result).toBe(8)
  })

  it('稼働日0日 → 0', () => {
    const result = getCalendarDaysForWorkdays(0, 0, startDate, dayWidth, testCalendar)
    expect(result).toBe(0)
  })

  it('calendar=null（全日稼働） → workDays=5なら5日', () => {
    const result = getCalendarDaysForWorkdays(0, 5, startDate, dayWidth, null)
    expect(result).toBe(5)
  })
})
