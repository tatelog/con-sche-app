// 歩掛マスタ（国交省形式対応）

export interface LaborItem {
  occupation: string
  rate: number
  costPerDay?: number
}

export interface MaterialItem {
  name: string
  specification?: string
  quantity: number
  unit: string
  unitCost?: number
}

export interface MachineItem {
  name: string
  specification: string
  hours: number
  costPerHour?: number
}

export interface CorrectionFactor {
  type: string
  name: string
  value: number
  condition?: string
}

export interface BugakariItem {
  id: string
  masterId: string
  category1: string
  category2: string
  category3?: string
  code: string
  name: string
  specification?: string
  unit: string
  laborItems: LaborItem[]
  materialItems: MaterialItem[]
  machineItems: MachineItem[]
  factors?: CorrectionFactor[]
  conditions?: string
  notes?: string
}

export interface BugakariMasterSet {
  id: string
  name: string
  version: string
  source: string
  createdAt: string
  items: BugakariItem[]
}

export function createBugakariItem(
  partial: Partial<BugakariItem> & { id: string; masterId: string; name: string }
): BugakariItem {
  return {
    category1: '一般',
    category2: '一般',
    code: '',
    unit: '式',
    laborItems: [],
    materialItems: [],
    machineItems: [],
    ...partial,
  }
}

export function createBugakariMasterSet(
  partial: Partial<BugakariMasterSet> & { id: string; name: string }
): BugakariMasterSet {
  return {
    version: '1.0',
    source: 'ユーザー作成',
    createdAt: new Date().toISOString(),
    items: [],
    ...partial,
  }
}
