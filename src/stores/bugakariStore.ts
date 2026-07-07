import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { BugakariMasterSet, BugakariItem } from '@/types'
import { createBugakariMasterSet, createBugakariItem } from '@/types'

interface BugakariState {
  masterSets: Map<string, BugakariMasterSet>
  activeMasterId: string | null

  // 土建コード設定（歩掛マスタピッカー用）
  enabledDokenCodes: Set<number>
  toggleDokenCode: (code: number) => void

  addMasterSet: (name: string, version?: string, source?: string) => string
  deleteMasterSet: (masterId: string) => void
  setActiveMaster: (masterId: string | null) => void

  addItem: (masterId: string, name: string, category1?: string, category2?: string) => string | null
  updateItem: (masterId: string, itemId: string, updates: Partial<BugakariItem>) => void
  deleteItem: (masterId: string, itemId: string) => void

  getMasterSet: (masterId: string) => BugakariMasterSet | undefined
  getItem: (masterId: string, itemId: string) => BugakariItem | undefined
  getMasterSetsArray: () => BugakariMasterSet[]
  getItemsArray: (masterId: string) => BugakariItem[]
  searchItems: (query: string) => BugakariItem[]
}

// サンプル歩掛データ
const sampleMasterId = uuidv4()
const sampleItems: BugakariItem[] = [
  {
    id: uuidv4(),
    masterId: sampleMasterId,
    category1: '躯体工事',
    category2: '型枠工事',
    code: 'K001',
    name: '型枠工事（普通）',
    specification: '一般部',
    unit: 'm2',
    laborItems: [
      { occupation: '型枠工', rate: 0.08 },
      { occupation: '普通作業員', rate: 0.02 },
    ],
    materialItems: [],
    machineItems: [],
  },
  {
    id: uuidv4(),
    masterId: sampleMasterId,
    category1: '躯体工事',
    category2: '鉄筋工事',
    code: 'T001',
    name: '鉄筋工事（一般）',
    specification: 'D10〜D25',
    unit: 't',
    laborItems: [
      { occupation: '鉄筋工', rate: 0.5 },
      { occupation: '普通作業員', rate: 0.1 },
    ],
    materialItems: [],
    machineItems: [],
  },
  {
    id: uuidv4(),
    masterId: sampleMasterId,
    category1: '躯体工事',
    category2: 'コンクリート工事',
    code: 'C001',
    name: 'コンクリート打設',
    specification: 'ポンプ車使用',
    unit: 'm3',
    laborItems: [
      { occupation: '土工', rate: 0.015 },
      { occupation: '普通作業員', rate: 0.03 },
    ],
    materialItems: [],
    machineItems: [
      { name: 'コンクリートポンプ車', specification: '圧送能力90m3/h', hours: 0.02 },
    ],
  },
  {
    id: uuidv4(),
    masterId: sampleMasterId,
    category1: '仕上工事',
    category2: '塗装工事',
    code: 'P001',
    name: '塗装工事（内壁）',
    specification: 'EP塗り',
    unit: 'm2',
    laborItems: [
      { occupation: '塗装工', rate: 0.03 },
    ],
    materialItems: [],
    machineItems: [],
  },
  {
    id: uuidv4(),
    masterId: sampleMasterId,
    category1: '仕上工事',
    category2: 'ボード工事',
    code: 'B001',
    name: 'プラスターボード張り',
    specification: '12.5mm厚',
    unit: 'm2',
    laborItems: [
      { occupation: '内装工', rate: 0.04 },
      { occupation: '普通作業員', rate: 0.01 },
    ],
    materialItems: [],
    machineItems: [],
  },
]

const sampleMasterSet: BugakariMasterSet = {
  id: sampleMasterId,
  name: 'サンプル歩掛マスタ',
  version: '1.0',
  source: 'サンプルデータ',
  createdAt: new Date().toISOString(),
  items: sampleItems,
}

export const useBugakariStore = create<BugakariState>((set, get) => ({
  masterSets: new Map([[sampleMasterId, sampleMasterSet]]),
  activeMasterId: sampleMasterId,

  enabledDokenCodes: new Set([2]), // デフォルト: 建築のみ
  toggleDokenCode: (code) => {
    set(state => {
      const newCodes = new Set(state.enabledDokenCodes)
      if (newCodes.has(code)) {
        newCodes.delete(code)
      } else {
        newCodes.add(code)
      }
      return { enabledDokenCodes: newCodes }
    })
  },

  addMasterSet: (name, version, source) => {
    const id = uuidv4()
    const masterSet = createBugakariMasterSet({
      id,
      name,
      version: version ?? '1.0',
      source: source ?? 'ユーザー作成',
    })

    set(state => {
      const newMasterSets = new Map(state.masterSets)
      newMasterSets.set(id, masterSet)
      return { masterSets: newMasterSets }
    })

    return id
  },

  deleteMasterSet: (masterId) => {
    set(state => {
      const newMasterSets = new Map(state.masterSets)
      newMasterSets.delete(masterId)
      return {
        masterSets: newMasterSets,
        activeMasterId: state.activeMasterId === masterId ? null : state.activeMasterId,
      }
    })
  },

  setActiveMaster: (masterId) => {
    set({ activeMasterId: masterId })
  },

  addItem: (masterId, name, category1, category2) => {
    const masterSet = get().masterSets.get(masterId)
    if (!masterSet) return null

    const id = uuidv4()
    const item = createBugakariItem({
      id,
      masterId,
      name,
      category1: category1 ?? '一般',
      category2: category2 ?? '一般',
    })

    set(state => {
      const newMasterSets = new Map(state.masterSets)
      const ms = newMasterSets.get(masterId)
      if (ms) {
        newMasterSets.set(masterId, {
          ...ms,
          items: [...ms.items, item],
        })
      }
      return { masterSets: newMasterSets }
    })

    return id
  },

  updateItem: (masterId, itemId, updates) => {
    set(state => {
      const newMasterSets = new Map(state.masterSets)
      const ms = newMasterSets.get(masterId)
      if (ms) {
        const newItems = ms.items.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        )
        newMasterSets.set(masterId, { ...ms, items: newItems })
      }
      return { masterSets: newMasterSets }
    })
  },

  deleteItem: (masterId, itemId) => {
    set(state => {
      const newMasterSets = new Map(state.masterSets)
      const ms = newMasterSets.get(masterId)
      if (ms) {
        const newItems = ms.items.filter(item => item.id !== itemId)
        newMasterSets.set(masterId, { ...ms, items: newItems })
      }
      return { masterSets: newMasterSets }
    })
  },

  getMasterSet: (masterId) => get().masterSets.get(masterId),
  getItem: (masterId, itemId) => {
    const ms = get().masterSets.get(masterId)
    return ms?.items.find(item => item.id === itemId)
  },
  getMasterSetsArray: () => Array.from(get().masterSets.values()),
  getItemsArray: (masterId) => get().masterSets.get(masterId)?.items ?? [],
  searchItems: (query) => {
    const lowerQuery = query.toLowerCase()
    const results: BugakariItem[] = []
    for (const ms of get().masterSets.values()) {
      for (const item of ms.items) {
        if (
          item.name.toLowerCase().includes(lowerQuery) ||
          item.code.toLowerCase().includes(lowerQuery) ||
          item.category1.toLowerCase().includes(lowerQuery) ||
          item.category2.toLowerCase().includes(lowerQuery)
        ) {
          results.push(item)
        }
      }
    }
    return results
  },
}))
