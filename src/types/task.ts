export type TaskType = 'task' | 'milestone' | 'handoff'

export interface Position {
  x: number
  y: number
}

export interface Quantity {
  value: number
  unit: string
}

export interface UnitRate {
  value: number
  unit: string
}

export interface Duration {
  baseDays: number
  adjustmentDays: number
  plannedDays: number
}

export interface Task {
  id: string
  name: string

  // 場所・担当
  roomId?: string
  subAreaId?: string
  crewId?: string

  // 数量・歩掛・人工
  quantity: Quantity
  unitRate: UnitRate
  crewSize: number

  // 日数
  duration: Duration
  roundingRule?: 'ceil' | 'ceil_0.5' | 'round' | 'floor'

  // 計画・実績日付
  plannedStartDate?: number
  plannedEndDate?: number
  actualStartDate?: number
  actualEndDate?: number

  // CPM計算結果
  es: number
  ef: number
  ls: number
  lf: number
  totalFloat: number
  freeFloat: number
  isCritical: boolean

  // 表示
  position: Position
  type: TaskType

  // 分類
  koukuId?: string
  floorId?: string
  categoryId?: string

  // 補足
  note?: string
  assumption?: string
  color?: string
  metadata?: Record<string, unknown>
}

export function createTask(partial: Partial<Task> & { id: string; name: string }): Task {
  return {
    quantity: { value: 1, unit: '式' },
    unitRate: { value: 1, unit: '日/式' },
    crewSize: 1,
    duration: { baseDays: 1, adjustmentDays: 0, plannedDays: 1 },
    es: 0,
    ef: 0,
    ls: 0,
    lf: 0,
    totalFloat: 0,
    freeFloat: 0,
    isCritical: false,
    position: { x: 100, y: 100 },
    type: 'task',
    ...partial,
  }
}
