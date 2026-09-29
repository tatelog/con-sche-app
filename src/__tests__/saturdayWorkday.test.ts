import { describe, it, expect, beforeEach } from 'vitest'
import { isNonWorkday } from '@/utils/dateUtils'
import { isWorkDay, countWorkDays } from '@/types/calendar'
import type { ProjectCalendar } from '@/types/calendar'
import { useCalendarStore } from '@/stores/calendarStore'

/**
 * 仕様（2026-09-29 生和コーポレーション様お問い合わせ）
 * 「土曜日が作業日になる場合、土曜日の作業がカウントされるようにしたい」
 *
 * - 土曜に個別で「稼働日」(status: 'workday') を設定した日は、非稼働日として扱わない
 * - その日は稼働日判定で true、日数計算で 1 日として数える
 * - 何も設定していない土曜は非稼働のまま
 * - 平日に「全休」(status: 'holiday') を設定した日は非稼働
 */

// ローカル正午で作る（isNonWorkday / isWorkDay はローカル日付で比較する）
function localNoon(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12, 0, 0)
}

// 2026-10-02(金) / 10-03(土) / 10-04(日) / 10-05(月) / 10-01(木)
const calendar: ProjectCalendar = {
  id: 'c',
  projectId: 'p',
  startDate: '2026-09-28',
  workDays: [1, 2, 3, 4, 5],
  holidays: [
    { date: '2026-10-03', name: '稼働日', type: 'custom', status: 'workday' },
    { date: '2026-10-01', name: '全休', type: 'custom', status: 'holiday' },
  ],
  events: [],
}

describe('土曜を個別に稼働日にした場合', () => {
  it('isNonWorkday は false（非稼働日として扱わない）', () => {
    expect(isNonWorkday(localNoon(2026, 10, 3), calendar)).toBe(false)
  })

  it('types/calendar の isWorkDay は true', () => {
    expect(isWorkDay(localNoon(2026, 10, 3), calendar)).toBe(true)
  })

  it('countWorkDays で 1 日として数える（金曜の1稼働日後が土曜になる）', () => {
    // countWorkDays は開始日を含まず N 稼働日後を返す。
    // 土曜が稼働日なら 10/2(金) の1稼働日後は 10/3(土)。数えられていなければ 10/5(月)
    const end = countWorkDays(localNoon(2026, 10, 2), 1, calendar)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth() + 1).toBe(10)
    expect(end.getDate()).toBe(3)
  })

  describe('calendarStore.isWorkDay', () => {
    beforeEach(() => {
      useCalendarStore.setState({ calendar })
    })
    it('true になる', () => {
      expect(useCalendarStore.getState().isWorkDay(localNoon(2026, 10, 3))).toBe(true)
    })
  })
})

describe('回帰', () => {
  it('何も設定していない日曜は非稼働のまま', () => {
    expect(isNonWorkday(localNoon(2026, 10, 4), calendar)).toBe(true)
    expect(isWorkDay(localNoon(2026, 10, 4), calendar)).toBe(false)
  })

  it('平日に全休を設定した日は非稼働', () => {
    expect(isNonWorkday(localNoon(2026, 10, 1), calendar)).toBe(true)
    expect(isWorkDay(localNoon(2026, 10, 1), calendar)).toBe(false)
  })

  it('何も設定していない平日は稼働', () => {
    expect(isNonWorkday(localNoon(2026, 10, 5), calendar)).toBe(false)
    expect(isWorkDay(localNoon(2026, 10, 5), calendar)).toBe(true)
  })
})
