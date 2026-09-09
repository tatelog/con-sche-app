import { describe, it, expect } from 'vitest'
import { useADMStore } from '@/stores/admStore'
import { useTextBoxStore } from '@/stores/textboxStore'
import { useCalendarStore } from '@/stores/calendarStore'

describe('工程表の新規作成', () => {
  it('以前の図形・保存先・履歴・個別設定を引き継がない', () => {
    const store = useADMStore.getState()
    store.newProject()
    const oldId = useADMStore.getState().projectSettings.id
    store.addNode({ x: 100, y: 60 })
    useTextBoxStore.getState().addTextBox({ x: 100, y: 100 }, '以前の注記')
    useCalendarStore.getState().addHoliday({ date: '2027-04-01', name: '現場独自の休日' })
    useADMStore.setState({
      currentProjectId: '保存済みの工程表',
      currentProjectSiteId: '以前の現場',
      customColumnValues: new Map([['custom:0', '以前の値']]),
      isDirty: true,
    })

    store.newProject()
    const next = useADMStore.getState()
    expect(next.currentProjectId).toBeNull()
    expect(next.currentProjectSiteId).toBeNull()
    expect(next.projectSettings.id).not.toBe(oldId)
    expect(next.currentProjectName).toBe('新規プロジェクト')
    expect(next.nodes.size).toBe(0)
    expect(next.activities.size).toBe(0)
    expect(next.customColumnValues.size).toBe(0)
    expect(next.history).toEqual([])
    expect(next.future).toEqual([])
    expect(next.canUndo).toBe(false)
    expect(next.isDirty).toBe(false)
    expect(useTextBoxStore.getState().textboxes.size).toBe(0)
    expect(useCalendarStore.getState().calendar?.holidays.some(h => h.name === '現場独自の休日')).toBe(false)
    next.undo()
    expect(useADMStore.getState().nodes.size).toBe(0)
  })
})
