/**
 * ADM (Arrow Diagram Method) 用の Zustand ストア
 * 日本の建設現場向け階層構造（工区・部屋・細目）対応
 */

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  saveADMProject,
  loadADMProject,
  loadAllADMProjects,
  deleteADMProject as deleteADMProjectFromDB,
} from '@/db/database'
import type { ADMProject } from '@/db/database'
import type {
  EventNode,
  Activity,
  ProjectSettings,
  Position,
  Building,
  Zone,
  Room,
  DetailCategory,
  HierarchyRow,
  MasterItem,
  ProgressLine,
} from '@/types/adm'
import { createEventNode, createActivity, createProjectSettings, createProgressLine } from '@/types/adm'
import { calculateADMCPM, detectCycle } from '@/utils/admCpm'
import { xToDate, getWorkdaysBetween, getCalendarDaysForWorkdays } from '@/utils/dateUtils'
import { useCalendarStore } from './calendarStore'
import { useTextBoxStore } from './textboxStore'
import type { TextBox } from '@/types'
import { migrateProgressLines } from '@/utils/migrateProgressLines'

// 行の高さデフォルト（projectSettings.rowHeight未初期化時のフォールバック）
const DEFAULT_ROW_HEIGHT = 40

// フロア名からソート用数値を抽出（降順ソート用: 大きい=上階）
function parseFloorNumber(name: string): number {
  if (name.toUpperCase() === 'RF' || name.toUpperCase() === 'RFL') return 999
  const match = name.match(/B?(\d+)/)
  if (!match) return 0
  const num = parseInt(match[1])
  return name.toUpperCase().startsWith('B') ? -num : num
}

// カレンダー設定型（エクスポート用）
export interface CalendarSettings {
  workDays: number[] // 稼働曜日の番号配列 [1,2,3,4,5] = 月〜金
  holidays: Array<{ date: string; name: string; status?: 'holiday' | 'workday' }> // 祝日・休日リスト
}

// エクスポート用のデータ型
export interface ADMExportData {
  version: string
  exportedAt: string
  projectSettings: ProjectSettings
  calendar: CalendarSettings
  nodes: EventNode[]
  activities: Activity[]
  hierarchy: {
    buildings?: Building[]
    zones: Zone[]
    rooms: Room[]
    detailCategories: DetailCategory[]
  }
  masters: {
    zones: MasterItem[]
    rooms: MasterItem[]
    details: MasterItem[]
  }
  // v3 追加フィールド（オプション: v2互換維持）
  textboxes?: TextBox[]
  customMasters?: Record<string, MasterItem[]>  // columnId → items
  customColumnValues?: Record<string, string>    // "columnId:rowIndex" → value
  progressLines?: ProgressLine[]
  progressLine?: ProgressLine  // v3.0互換（単一進捗線）
}

// ライトエクスポート用の型（マスタ・階層なし）
export interface ADMExportDataLite {
  version: string
  exportedAt: string
  projectSettings: ProjectSettings
  calendar: CalendarSettings
  nodes: EventNode[]
  activities: Activity[]
  textboxes?: TextBox[]
}

// ZIP manifest 型
export interface ConScheManifest {
  format: 'con-sche-all' | 'con-sche-lite'
  version: string
}

// 履歴のスナップショット型
interface HistorySnapshot {
  nodes: Map<string, EventNode>
  activities: Map<string, Activity>
  nextNodeNumber: number
  textboxes: Map<string, TextBox>
}

// 履歴の最大数
const MAX_HISTORY = 50

interface ADMState {
  // データ
  nodes: Map<string, EventNode>
  activities: Map<string, Activity>
  projectSettings: ProjectSettings

  // 階層構造
  buildings: Map<string, Building>
  zones: Map<string, Zone>
  rooms: Map<string, Room>
  detailCategories: Map<string, DetailCategory>

  // マスタデータ（テンプレート用）
  zoneMaster: Map<string, MasterItem>
  roomMaster: Map<string, MasterItem>
  detailMaster: Map<string, MasterItem>

  // カスタム列データ
  customMasters: Map<string, Map<string, MasterItem>> // columnId → masterItems
  customColumnValues: Map<string, string> // "columnId:rowIndex" → value

  // CPM計算結果
  criticalPath: string[]
  projectDuration: number

  // 選択状態
  selectedNodeId: string | null
  selectedActivityId: string | null
  selectedNodeIds: string[]       // 複数選択用
  selectedActivityIds: string[]   // 複数選択用

  // 編集モード
  editMode: 'select' | 'pathSelect' | 'draw' | 'text' | 'progress' | 'banner'
  lastSelectSubMode: 'select' | 'pathSelect'
  lastDrawSubMode: 'draw' | 'text' | 'banner'
  activityStartNodeId: string | null // 描画モードで最後に追加/選択したノード

  // 進捗線（雷線）- 複数対応
  progressLines: ProgressLine[]
  activeProgressLineId: string | null

  // 次の結合点番号
  nextNodeNumber: number

  // 履歴（Undo/Redo）
  history: HistorySnapshot[]
  future: HistorySnapshot[]
  canUndo: boolean
  canRedo: boolean

  // プロジェクトファイル管理
  currentProjectId: string | null
  currentProjectName: string
  currentProjectSiteId: string | null
  isDirty: boolean

  // アクション - プロジェクトファイル操作
  saveProject: () => Promise<void>
  loadProjectFromDB: (id: string) => Promise<void>
  saveProjectAs: (name: string, options?: { siteId?: string; siteName?: string }) => Promise<string>
  markDirty: () => void
  getAllProjects: () => Promise<ADMProject[]>
  deleteProjectFromDB: (id: string) => Promise<void>
  duplicateProject: (sourceId: string, newName: string) => Promise<string>
  renameProject: (id: string, newName: string) => Promise<void>

  // アクション - マスタ
  addMasterItem: (type: 'zone' | 'room' | 'detail', name: string) => string
  updateMasterItem: (type: 'zone' | 'room' | 'detail', id: string, name: string) => void
  deleteMasterItem: (type: 'zone' | 'room' | 'detail', id: string) => void
  getMasterItems: (type: 'zone' | 'room' | 'detail') => MasterItem[]

  // アクション - カスタム列マスタ
  addCustomMasterItem: (columnId: string, name: string) => string
  deleteCustomMasterItem: (columnId: string, itemId: string) => void
  getCustomMasterItems: (columnId: string) => MasterItem[]
  setCustomColumnValue: (columnId: string, rowIndex: number, value: string) => void
  getCustomColumnValue: (columnId: string, rowIndex: number) => string

  // アクション - 棟
  addBuilding: (name: string) => string
  updateBuilding: (id: string, updates: Partial<Building>) => void
  deleteBuilding: (id: string) => void
  getBuildingsArray: () => Building[]

  // アクション - 階層
  addZone: (name: string) => string
  updateZone: (zoneId: string, updates: Partial<Zone>) => void
  deleteZone: (zoneId: string) => void
  addRoom: (zoneId: string, name: string) => string
  updateRoom: (roomId: string, updates: Partial<Room>) => void
  deleteRoom: (roomId: string) => void
  addDetailCategory: (roomId: string, name: string) => string
  updateDetailCategory: (detailId: string, updates: Partial<DetailCategory>) => void
  deleteDetailCategory: (detailId: string) => void
  getHierarchyRows: () => HierarchyRow[]
  getRowY: (detailId: string) => number

  // アクション - ノード
  addNode: (position: Position) => string
  addNodeAtRow: (x: number, rowIndex: number) => string
  updateNode: (nodeId: string, updates: Partial<EventNode>) => void
  deleteNode: (nodeId: string) => void
  moveNode: (nodeId: string, position: Position) => void
  moveNodeWithPropagate: (nodeId: string, position: Position) => void
  mergeNodes: (sourceNodeId: string, targetNodeId: string) => void // ノードを統合

  // アクション - 作業
  addActivity: (fromNodeId: string, toNodeId: string, name?: string) => string | null
  updateActivity: (activityId: string, updates: Partial<Activity>) => void
  deleteActivity: (activityId: string) => void
  addDummyActivity: (fromNodeId: string, toNodeId: string) => string | null

  // アクション - プロジェクト設定
  updateProjectSettings: (updates: Partial<ProjectSettings>) => void

  // CPM計算
  recalculateCPM: () => void

  // 選択
  selectNode: (nodeId: string | null) => void
  selectActivity: (activityId: string | null) => void
  clearSelection: () => void
  selectAll: () => void
  selectNodes: (ids: string[]) => void
  selectActivities: (ids: string[]) => void
  toggleNodeSelection: (id: string) => void
  toggleActivitySelection: (id: string) => void

  // 編集モード
  setEditMode: (mode: ADMState['editMode']) => void
  // bannerモードでアクティビティ作成時にdisplayType設定用
  isBannerMode: () => boolean
  setActivityStartNode: (nodeId: string | null) => void
  getLastSelectSubMode: () => ADMState['lastSelectSubMode']
  getLastDrawSubMode: () => ADMState['lastDrawSubMode']

  // 進捗線
  addProgressLine: () => string  // 新規進捗線を追加、IDを返す
  setProgressBaseDate: (date: string, x: number, totalRows: number) => void
  setProgressPoint: (detailId: string, offsetDays: number) => void
  clearProgressLine: () => void  // アクティブな進捗線を削除
  clearAllProgressLines: () => void
  setActiveProgressLine: (id: string | null) => void

  // ユーティリティ
  getNode: (nodeId: string) => EventNode | undefined
  getActivity: (activityId: string) => Activity | undefined
  getNodesArray: () => EventNode[]
  getActivitiesArray: () => Activity[]
  getActivitiesFromNode: (nodeId: string) => Activity[]
  getActivitiesToNode: (nodeId: string) => Activity[]

  // データ操作
  clearAll: () => void
  importData: (data: { nodes: EventNode[]; activities: Activity[] }) => void
  exportData: () => { nodes: EventNode[]; activities: Activity[]; projectSettings: ProjectSettings }
  exportFullData: () => ADMExportData
  exportLiteData: () => ADMExportDataLite
  importFullData: (data: ADMExportData) => void
  importLiteData: (data: ADMExportDataLite) => void
  exportToJSON: () => string
  downloadJSON: (filename?: string) => void
  downloadFullPackage: (filename?: string) => Promise<void>
  downloadLitePackage: (filename?: string) => Promise<void>

  // 履歴操作（Undo/Redo）
  undo: () => void
  redo: () => void
  saveHistory: () => void

  // バッチ操作（複数操作を1つのUndoステップにまとめる）
  beginBatch: () => void
  endBatch: () => void
  isBatchOpen: () => boolean
  cancelBatch: () => void

  // フロートベース移動
  getAffectedChain: (activityId: string) => string[]
  getShiftRange: (activityId: string) => { maxLeft: number; maxRight: number; isCritical: boolean }
  shiftActivityWithFloat: (activityId: string, shiftDays: number, isChainMove?: boolean) => void
}

export const useADMStore = create<ADMState>((set, get) => ({
  nodes: new Map(),
  activities: new Map(),
  projectSettings: createProjectSettings({ id: 'default', name: '新規プロジェクト' }),

  buildings: new Map(),
  zones: new Map(),
  rooms: new Map(),
  detailCategories: new Map(),

  // マスタデータ
  zoneMaster: new Map(),
  roomMaster: new Map(),
  detailMaster: new Map(),

  // カスタム列データ
  customMasters: new Map(),
  customColumnValues: new Map(),

  criticalPath: [],
  projectDuration: 0,

  selectedNodeId: null,
  selectedActivityId: null,
  selectedNodeIds: [],
  selectedActivityIds: [],

  editMode: 'select',
  lastSelectSubMode: 'select',
  lastDrawSubMode: 'draw',
  activityStartNodeId: null,
  progressLines: [],
  activeProgressLineId: null,

  nextNodeNumber: 1,

  // 履歴
  history: [],
  future: [],
  canUndo: false,
  canRedo: false,
  _batchDepth: 0,

  // プロジェクトファイル管理
  currentProjectId: null,
  currentProjectName: '新規プロジェクト',
  currentProjectSiteId: null,
  isDirty: false,

  // ======================================
  // プロジェクトファイル操作
  // ======================================

  saveProject: async () => {
    const state = get()
    const data = state.exportFullData()
    const now = new Date().toISOString()

    if (state.currentProjectId) {
      const project: ADMProject = {
        id: state.currentProjectId,
        name: state.currentProjectName,
        data: JSON.stringify(data),
        createdAt: now,
        updatedAt: now,
      }
      const existing = await loadADMProject(state.currentProjectId)
      if (existing) {
        project.createdAt = existing.createdAt
      }
      await saveADMProject(project)
    } else {
      const id = uuidv4()
      const project: ADMProject = {
        id,
        name: state.currentProjectName,
        data: JSON.stringify(data),
        createdAt: now,
        updatedAt: now,
      }
      await saveADMProject(project)
      set({ currentProjectId: id })
    }

    set({ isDirty: false })
  },

  loadProjectFromDB: async (id: string) => {
    let data: ADMExportData | null = null
    const projectSiteId: string | null = null

    const project = await loadADMProject(id)
    if (!project) {
      throw new Error('プロジェクトが見つかりません')
    }
    const parsed = JSON.parse(project.data) as Record<string, unknown>
    if (parsed.hierarchy && parsed.nodes && parsed.activities) {
      data = parsed as unknown as ADMExportData
    }
    const projectName = project.name

    if (data) {
      get().importFullData(data)
    } else {
      // New project with no snapshot - reset to empty state
      get().clearAll()
    }
    set({
      currentProjectId: id,
      currentProjectName: projectName,
      currentProjectSiteId: projectSiteId,
      isDirty: false,
    })
  },

  saveProjectAs: async (name: string, options?: { siteId?: string; siteName?: string }) => {
    const state = get()
    const data = state.exportFullData()
    const now = new Date().toISOString()
    const id = uuidv4()

    // 別名保存時は既存プロジェクトのsiteIdを引き継ぐ
    const effectiveSiteId = options?.siteId ?? state.currentProjectSiteId ?? undefined

    const project: ADMProject = {
      id,
      name,
      data: JSON.stringify(data),
      siteId: effectiveSiteId,
      siteName: options?.siteName,
      createdAt: now,
      updatedAt: now,
    }

    await saveADMProject(project)
    set({
      currentProjectId: id,
      currentProjectName: name,
      currentProjectSiteId: effectiveSiteId || null,
      isDirty: false,
    })

    return id
  },

  markDirty: () => {
    set({ isDirty: true })
  },

  getAllProjects: async () => {
    return loadAllADMProjects()
  },

  deleteProjectFromDB: async (id: string) => {
    await deleteADMProjectFromDB(id)
    if (get().currentProjectId === id) {
      set({ currentProjectId: null, currentProjectName: '新規プロジェクト', currentProjectSiteId: null })
    }
  },

  duplicateProject: async (sourceId: string, newName: string) => {
    const source = await loadADMProject(sourceId)
    if (!source) throw new Error('プロジェクトが見つかりません')
    const now = new Date().toISOString()
    const newId = uuidv4()
    const project: ADMProject = {
      id: newId,
      name: newName,
      data: source.data,
      createdAt: now,
      updatedAt: now,
    }
    await saveADMProject(project)
    return newId
  },

  renameProject: async (id: string, newName: string) => {
    const project = await loadADMProject(id)
    if (!project) throw new Error('プロジェクトが見つかりません')
    project.name = newName
    project.updatedAt = new Date().toISOString()
    await saveADMProject(project)
    if (get().currentProjectId === id) {
      set({ currentProjectName: newName })
    }
  },

  // ======================================
  // マスタ操作
  // ======================================

  addMasterItem: (type, name) => {
    const masterKey = type === 'zone' ? 'zoneMaster' : type === 'room' ? 'roomMaster' : 'detailMaster'
    const master = get()[masterKey]

    // 同名の項目が既にあれば追加せず既存IDを返す（重複登録防止）
    const existing = Array.from(master.values()).find((m) => m.name === name)
    if (existing) return existing.id

    const id = uuidv4()
    const order = master.size

    set((state) => {
      const newMaster = new Map(state[masterKey])
      newMaster.set(id, { id, name, order })
      return { [masterKey]: newMaster }
    })

    return id
  },

  updateMasterItem: (type, id, name) => {
    const masterKey = type === 'zone' ? 'zoneMaster' : type === 'room' ? 'roomMaster' : 'detailMaster'

    set((state) => {
      const item = state[masterKey].get(id)
      if (!item) return state

      const newMaster = new Map(state[masterKey])
      newMaster.set(id, { ...item, name })
      return { [masterKey]: newMaster }
    })
  },

  deleteMasterItem: (type, id) => {
    const masterKey = type === 'zone' ? 'zoneMaster' : type === 'room' ? 'roomMaster' : 'detailMaster'

    set((state) => {
      const newMaster = new Map(state[masterKey])
      newMaster.delete(id)
      return { [masterKey]: newMaster }
    })
  },

  getMasterItems: (type) => {
    const masterKey = type === 'zone' ? 'zoneMaster' : type === 'room' ? 'roomMaster' : 'detailMaster'
    return Array.from(get()[masterKey].values()).sort((a, b) => a.order - b.order)
  },

  // ======================================
  // カスタム列マスタ操作
  // ======================================

  addCustomMasterItem: (columnId, name) => {
    // 同名の項目が既にあれば追加せず既存IDを返す（重複登録防止）
    const existingCol = get().customMasters.get(columnId)
    if (existingCol) {
      const existing = Array.from(existingCol.values()).find((m) => m.name === name)
      if (existing) return existing.id
    }

    const id = uuidv4()
    set((state) => {
      const newCustomMasters = new Map(state.customMasters)
      const colMaster = new Map(newCustomMasters.get(columnId) || new Map())
      const order = colMaster.size
      colMaster.set(id, { id, name, order })
      newCustomMasters.set(columnId, colMaster)
      return { customMasters: newCustomMasters }
    })
    return id
  },

  deleteCustomMasterItem: (columnId, itemId) => {
    set((state) => {
      const newCustomMasters = new Map(state.customMasters)
      const colMaster = new Map(newCustomMasters.get(columnId) || new Map())
      colMaster.delete(itemId)
      newCustomMasters.set(columnId, colMaster)
      return { customMasters: newCustomMasters }
    })
  },

  getCustomMasterItems: (columnId) => {
    const colMaster = get().customMasters.get(columnId)
    if (!colMaster) return []
    return Array.from(colMaster.values()).sort((a, b) => a.order - b.order)
  },

  setCustomColumnValue: (columnId, rowIndex, value) => {
    set((state) => {
      const newValues = new Map(state.customColumnValues)
      newValues.set(`${columnId}:${rowIndex}`, value)
      return { customColumnValues: newValues }
    })
  },

  getCustomColumnValue: (columnId, rowIndex) => {
    return get().customColumnValues.get(`${columnId}:${rowIndex}`) || ''
  },

  // ======================================
  // 階層操作
  // ======================================

  // ======================================
  // 棟操作
  // ======================================

  addBuilding: (name) => {
    const id = uuidv4()
    const buildings = get().buildings
    const order = buildings.size

    set((state) => {
      const newBuildings = new Map(state.buildings)
      newBuildings.set(id, { id, name, order })
      return { buildings: newBuildings }
    })

    return id
  },

  updateBuilding: (id, updates) => {
    set((state) => {
      const building = state.buildings.get(id)
      if (!building) return state

      const newBuildings = new Map(state.buildings)
      newBuildings.set(id, { ...building, ...updates })
      return { buildings: newBuildings }
    })
  },

  deleteBuilding: (id) => {
    set((state) => {
      const newBuildings = new Map(state.buildings)
      newBuildings.delete(id)
      return { buildings: newBuildings }
    })
  },

  getBuildingsArray: () => {
    return Array.from(get().buildings.values()).sort((a, b) => a.order - b.order)
  },

  addZone: (name) => {
    const id = uuidv4()
    const zones = get().zones
    const order = zones.size

    set((state) => {
      const newZones = new Map(state.zones)
      newZones.set(id, { id, name, order })
      return { zones: newZones }
    })

    return id
  },

  updateZone: (zoneId, updates) => {
    set((state) => {
      const zone = state.zones.get(zoneId)
      if (!zone) return state

      const newZones = new Map(state.zones)
      newZones.set(zoneId, { ...zone, ...updates })
      return { zones: newZones }
    })
  },

  deleteZone: (zoneId) => {
    set((state) => {
      const newZones = new Map(state.zones)
      newZones.delete(zoneId)

      // 関連する部屋も削除
      const newRooms = new Map(state.rooms)
      const newDetails = new Map(state.detailCategories)
      for (const [roomId, room] of newRooms) {
        if (room.zoneId === zoneId) {
          // 関連する細目も削除
          for (const [detailId, detail] of newDetails) {
            if (detail.roomId === roomId) {
              newDetails.delete(detailId)
            }
          }
          newRooms.delete(roomId)
        }
      }

      return { zones: newZones, rooms: newRooms, detailCategories: newDetails }
    })
  },

  addRoom: (zoneId, name) => {
    const id = uuidv4()
    const rooms = get().rooms
    const zoneRooms = Array.from(rooms.values()).filter((r) => r.zoneId === zoneId)
    const order = zoneRooms.length

    set((state) => {
      const newRooms = new Map(state.rooms)
      newRooms.set(id, { id, zoneId, name, order })
      return { rooms: newRooms }
    })

    return id
  },

  updateRoom: (roomId, updates) => {
    set((state) => {
      const room = state.rooms.get(roomId)
      if (!room) return state

      const newRooms = new Map(state.rooms)
      newRooms.set(roomId, { ...room, ...updates })
      return { rooms: newRooms }
    })
  },

  deleteRoom: (roomId) => {
    set((state) => {
      const newRooms = new Map(state.rooms)
      newRooms.delete(roomId)

      // 関連する細目も削除
      const newDetails = new Map(state.detailCategories)
      for (const [detailId, detail] of newDetails) {
        if (detail.roomId === roomId) {
          newDetails.delete(detailId)
        }
      }

      return { rooms: newRooms, detailCategories: newDetails }
    })
  },

  addDetailCategory: (roomId, name) => {
    const id = uuidv4()
    const details = get().detailCategories
    const roomDetails = Array.from(details.values()).filter((d) => d.roomId === roomId)
    const order = roomDetails.length

    set((state) => {
      const newDetails = new Map(state.detailCategories)
      newDetails.set(id, { id, roomId, name, order })
      return { detailCategories: newDetails }
    })

    return id
  },

  updateDetailCategory: (detailId, updates) => {
    set((state) => {
      const detail = state.detailCategories.get(detailId)
      if (!detail) return state

      const newDetails = new Map(state.detailCategories)
      newDetails.set(detailId, { ...detail, ...updates })
      return { detailCategories: newDetails }
    })
  },

  deleteDetailCategory: (detailId) => {
    set((state) => {
      const newDetails = new Map(state.detailCategories)
      newDetails.delete(detailId)
      return { detailCategories: newDetails }
    })
  },

  getHierarchyRows: () => {
    const buildings = Array.from(get().buildings.values()).sort((a, b) => a.order - b.order)
    const zones = Array.from(get().zones.values()).sort((a, b) => a.order - b.order)
    const rooms = Array.from(get().rooms.values())
    const details = Array.from(get().detailCategories.values())

    const rows: HierarchyRow[] = []
    let y = 0

    // 棟がある場合: 棟 → 工区 → 階 → 部屋名
    // 棟がない場合: 従来通り 工区 → 階 → 部屋名
    const buildingGroups = buildings.length > 0
      ? buildings.map(b => ({ building: b, zones: zones.filter(z => z.buildingId === b.id) }))
      : [{ building: undefined, zones }]

    for (const { building, zones: groupZones } of buildingGroups) {
      for (const zone of groupZones) {
        const zoneRooms = rooms.filter((r) => r.zoneId === zone.id).sort((a, b) => parseFloorNumber(b.name) - parseFloorNumber(a.name))

        for (const room of zoneRooms) {
          const roomDetails = details
            .filter((d) => d.roomId === room.id)
            .sort((a, b) => a.order - b.order)

          for (const detail of roomDetails) {
            rows.push({
              buildingId: building?.id,
              buildingName: building?.name,
              zoneId: zone.id,
              zoneName: zone.name,
              roomId: room.id,
              roomName: room.name,
              detailId: detail.id,
              detailName: detail.name,
              y: y,
            })
            y += (get().projectSettings.rowHeight || DEFAULT_ROW_HEIGHT)
          }
        }
      }
    }

    return rows
  },

  getRowY: (detailId) => {
    const rows = get().getHierarchyRows()
    const row = rows.find((r) => r.detailId === detailId)
    return row ? row.y : 0
  },

  // ======================================
  // ノード操作
  // ======================================

  addNode: (position) => {
    get().saveHistory() // 履歴保存

    const id = uuidv4()
    const number = get().nextNodeNumber

    const node = createEventNode({
      id,
      number,
      position,
    })

    set((state) => {
      const newNodes = new Map(state.nodes)
      newNodes.set(id, node)
      return {
        nodes: newNodes,
        nextNodeNumber: state.nextNodeNumber + 1,
      }
    })

    return id
  },

  addNodeAtRow: (x, rowIndex) => {
    const rows = get().getHierarchyRows()
    const rh = get().projectSettings.rowHeight || DEFAULT_ROW_HEIGHT
    const y = rowIndex < rows.length ? rows[rowIndex].y + rh / 2 : rowIndex * rh + rh / 2
    return get().addNode({ x, y })
  },

  updateNode: (nodeId, updates) => {
    set((state) => {
      const node = state.nodes.get(nodeId)
      if (!node) return state

      const newNodes = new Map(state.nodes)
      newNodes.set(nodeId, { ...node, ...updates })
      return { nodes: newNodes }
    })
  },

  deleteNode: (nodeId) => {
    get().saveHistory() // 履歴保存

    set((state) => {
      const newNodes = new Map(state.nodes)
      newNodes.delete(nodeId)

      const newActivities = new Map(state.activities)
      for (const [actId, act] of newActivities) {
        if (act.fromNodeId === nodeId || act.toNodeId === nodeId) {
          newActivities.delete(actId)
        }
      }

      return {
        nodes: newNodes,
        activities: newActivities,
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      }
    })

    get().recalculateCPM()
  },

  moveNode: (nodeId, position) => {
    get().saveHistory() // 履歴保存（Undo対応）
    set((state) => {
      const node = state.nodes.get(nodeId)
      if (!node) return state

      const newNodes = new Map(state.nodes)
      newNodes.set(nodeId, { ...node, position })
      return { nodes: newNodes }
    })
  },

  // ノード移動 + 後続ノードの再帰的伝播（歩掛計算等でduration変更時に使用）
  // 拡大時: 後続ノードを前方へ押し出す
  // 縮小時: 全incomingの最大requiredXまで後方へ引き戻す
  moveNodeWithPropagate: (nodeId, position) => {
    get().saveHistory()

    const ps = get().projectSettings
    const cal = useCalendarStore.getState().calendar
    const sd = new Date(ps.startDate)
    const dw = ps.dayWidth || 30

    // あるノードに入る全アクティビティから、最低限必要なX座標を計算
    const calcMinX = (targetNodeId: string, nodesSnap: Map<string, EventNode>): number => {
      const incoming = get().getActivitiesToNode(targetNodeId)
      let minX = 0
      for (const act of incoming) {
        const fromNode = nodesSnap.get(act.fromNodeId)
        if (!fromNode) continue

        if (act.isDummy) {
          minX = Math.max(minX, fromNode.position.x)
        } else if (act.duration > 0) {
          const calDays = getCalendarDaysForWorkdays(
            fromNode.position.x, act.duration, sd, dw, cal
          )
          minX = Math.max(minX, fromNode.position.x + calDays * dw)
        }
      }
      return minX
    }

    set((state) => {
      const newNodes = new Map(state.nodes)
      const node = newNodes.get(nodeId)
      if (!node) return state

      newNodes.set(nodeId, { ...node, position })

      // BFS で後続ノードを再帰的に伝播（拡大・縮小両対応）
      const queue = [nodeId]
      const visited = new Set<string>()

      while (queue.length > 0) {
        const currentId = queue.shift()!
        if (visited.has(currentId)) continue
        visited.add(currentId)

        const outgoing = get().getActivitiesFromNode(currentId)
        for (const act of outgoing) {
          const toNode = newNodes.get(act.toNodeId)
          if (!toNode) continue

          // 全incomingを考慮した最低限必要なX
          const requiredX = calcMinX(act.toNodeId, newNodes)

          // 現在位置と異なれば更新（前方押し出し・後方引き戻し両方）
          if (toNode.position.x !== requiredX) {
            newNodes.set(act.toNodeId, {
              ...toNode,
              position: { ...toNode.position, x: requiredX },
            })
            if (!visited.has(act.toNodeId)) {
              queue.push(act.toNodeId)
            }
          }
        }
      }

      return { nodes: newNodes }
    })
  },

  mergeNodes: (sourceNodeId, targetNodeId) => {
    if (sourceNodeId === targetNodeId) return

    get().saveHistory() // 履歴保存

    set((state) => {
      const sourceNode = state.nodes.get(sourceNodeId)
      const targetNode = state.nodes.get(targetNodeId)
      if (!sourceNode || !targetNode) return state

      // sourceNodeに接続されている作業をtargetNodeに付け替え
      const newActivities = new Map(state.activities)
      const activitiesToDelete: string[] = []

      for (const [actId, act] of newActivities) {
        let newFromNodeId = act.fromNodeId
        let newToNodeId = act.toNodeId

        if (act.fromNodeId === sourceNodeId) {
          newFromNodeId = targetNodeId
        }
        if (act.toNodeId === sourceNodeId) {
          newToNodeId = targetNodeId
        }

        // 自己ループになる場合は削除
        if (newFromNodeId === newToNodeId) {
          activitiesToDelete.push(actId)
        } else if (newFromNodeId !== act.fromNodeId || newToNodeId !== act.toNodeId) {
          // 同じ接続が既に存在するか確認
          let duplicate = false
          for (const [otherId, other] of newActivities) {
            if (otherId !== actId && other.fromNodeId === newFromNodeId && other.toNodeId === newToNodeId) {
              duplicate = true
              activitiesToDelete.push(actId)
              break
            }
          }
          if (!duplicate) {
            newActivities.set(actId, { ...act, fromNodeId: newFromNodeId, toNodeId: newToNodeId })
          }
        }
      }

      // 削除対象の作業を削除
      for (const actId of activitiesToDelete) {
        newActivities.delete(actId)
      }

      // sourceNodeを削除
      const newNodes = new Map(state.nodes)
      newNodes.delete(sourceNodeId)

      return {
        nodes: newNodes,
        activities: newActivities,
        selectedNodeId: state.selectedNodeId === sourceNodeId ? targetNodeId : state.selectedNodeId,
      }
    })

    get().recalculateCPM()
  },

  // ======================================
  // 作業操作
  // ======================================

  addActivity: (fromNodeId, toNodeId, name) => {
    if (fromNodeId === toNodeId) return null

    const activities = get().activities
    for (const act of activities.values()) {
      if (act.fromNodeId === fromNodeId && act.toNodeId === toNodeId) {
        return null
      }
    }

    const nodes = get().getNodesArray()
    const existingActivities = get().getActivitiesArray()
    const testActivity = { id: 'test', fromNodeId, toNodeId } as Activity

    if (detectCycle(nodes, [...existingActivities, testActivity])) {
      console.warn('循環する依存関係は作成できません')
      return null
    }

    get().saveHistory() // 履歴保存

    // ノード間の稼働日数を自動計算
    const fromNode = get().getNode(fromNodeId)
    const toNode = get().getNode(toNodeId)
    let duration = 1
    if (fromNode && toNode) {
      const ps = get().projectSettings
      const cal = useCalendarStore.getState().calendar
      duration = Math.max(0, getWorkdaysBetween(
        fromNode.position.x, toNode.position.x,
        new Date(ps.startDate), ps.dayWidth || 30, cal
      ))
    }

    const id = uuidv4()
    const activity = createActivity({
      id,
      name: name ?? `作業${get().activities.size + 1}`,
      fromNodeId,
      toNodeId,
      duration,
    })

    // アクティビティ追加 + CPM計算を1回のset()でアトミックに実行
    set((state) => {
      const newActivities = new Map(state.activities)
      newActivities.set(id, activity)

      // CPM計算
      const allNodes = Array.from(state.nodes.values())
      const allActivities = Array.from(newActivities.values())
      try {
        const cpmResult = calculateADMCPM(allNodes, allActivities)
        const resultNodes = new Map(state.nodes)
        for (const n of cpmResult.nodes) resultNodes.set(n.id, n)
        const resultActivities = new Map<string, Activity>()
        for (const a of cpmResult.activities) resultActivities.set(a.id, a)
        return {
          nodes: resultNodes,
          activities: resultActivities,
          criticalPath: cpmResult.criticalPath,
          projectDuration: cpmResult.projectDuration,
        }
      } catch (e) {
        console.error('[addActivity] CPM計算エラー:', e)
        return { activities: newActivities }
      }
    })

    return id
  },

  updateActivity: (activityId, updates) => {
    set((state) => {
      const activity = state.activities.get(activityId)
      if (!activity) return state

      const newActivities = new Map(state.activities)

      let newDisplaySettings = activity.displaySettings
      if (updates.displaySettings) {
        newDisplaySettings = {
          ...activity.displaySettings,
          ...updates.displaySettings,
        }
      }

      newActivities.set(activityId, {
        ...activity,
        ...updates,
        displaySettings: newDisplaySettings,
      })

      // duration変更時はCPM再計算もアトミックに実行
      if (updates.duration !== undefined) {
        const allNodes = Array.from(state.nodes.values())
        const allActivities = Array.from(newActivities.values())
        try {
          const cpmResult = calculateADMCPM(allNodes, allActivities)
          const resultNodes = new Map(state.nodes)
          for (const n of cpmResult.nodes) resultNodes.set(n.id, n)
          const resultActivities = new Map<string, Activity>()
          for (const a of cpmResult.activities) resultActivities.set(a.id, a)
          return {
            nodes: resultNodes,
            activities: resultActivities,
            criticalPath: cpmResult.criticalPath,
            projectDuration: cpmResult.projectDuration,
          }
        } catch (e) {
          console.error('[updateActivity] CPM計算エラー:', e)
          return { activities: newActivities }
        }
      }

      return { activities: newActivities }
    })
  },

  deleteActivity: (activityId) => {
    get().saveHistory() // 履歴保存

    set((state) => {
      const newActivities = new Map(state.activities)
      newActivities.delete(activityId)

      // CPM再計算もアトミックに実行
      const allNodes = Array.from(state.nodes.values())
      const allActivities = Array.from(newActivities.values())
      try {
        const cpmResult = calculateADMCPM(allNodes, allActivities)
        const resultNodes = new Map(state.nodes)
        for (const n of cpmResult.nodes) resultNodes.set(n.id, n)
        const resultActivities = new Map<string, Activity>()
        for (const a of cpmResult.activities) resultActivities.set(a.id, a)
        return {
          nodes: resultNodes,
          activities: resultActivities,
          criticalPath: cpmResult.criticalPath,
          projectDuration: cpmResult.projectDuration,
          selectedActivityId:
            state.selectedActivityId === activityId ? null : state.selectedActivityId,
        }
      } catch (e) {
        console.error('[deleteActivity] CPM計算エラー:', e)
        return {
          activities: newActivities,
          selectedActivityId:
            state.selectedActivityId === activityId ? null : state.selectedActivityId,
        }
      }
    })
  },

  addDummyActivity: (fromNodeId, toNodeId) => {
    if (fromNodeId === toNodeId) return null

    const activities = get().activities
    for (const act of activities.values()) {
      if (act.fromNodeId === fromNodeId && act.toNodeId === toNodeId) {
        return null
      }
    }

    const nodes = get().getNodesArray()
    const existingActivities = get().getActivitiesArray()
    const testActivity = { id: 'test', fromNodeId, toNodeId } as Activity
    if (detectCycle(nodes, [...existingActivities, testActivity])) {
      console.warn('循環する依存関係は作成できません')
      return null
    }

    get().saveHistory()

    const id = uuidv4()
    const activity = createActivity({
      id,
      name: 'ダミー',
      fromNodeId,
      toNodeId,
      duration: 0,
      isDummy: true,
      displaySettings: {
        showName: false,
        showDuration: false,
        showCrew: false,
        lineColor: '#9CA3AF',
        lineStyle: 'dashed',
        lineWidth: 1,
      },
    })

    // ダミー追加 + CPM計算を1回のset()でアトミックに実行
    set((state) => {
      const newActivities = new Map(state.activities)
      newActivities.set(id, activity)

      const allNodes = Array.from(state.nodes.values())
      const allActivities = Array.from(newActivities.values())
      try {
        const cpmResult = calculateADMCPM(allNodes, allActivities)
        const resultNodes = new Map(state.nodes)
        for (const n of cpmResult.nodes) resultNodes.set(n.id, n)
        const resultActivities = new Map<string, Activity>()
        for (const a of cpmResult.activities) resultActivities.set(a.id, a)
        return {
          nodes: resultNodes,
          activities: resultActivities,
          criticalPath: cpmResult.criticalPath,
          projectDuration: cpmResult.projectDuration,
        }
      } catch (e) {
        console.error('[addDummyActivity] CPM計算エラー:', e)
        return { activities: newActivities }
      }
    })

    return id
  },

  // ======================================
  // プロジェクト設定
  // ======================================

  updateProjectSettings: (updates) => {
    set((state) => {
      const newSettings = { ...state.projectSettings, ...updates }
      // workplaceName変更時はcurrentProjectNameも同期
      const nameUpdate = updates.workplaceName !== undefined
        ? { currentProjectName: updates.workplaceName || '新規プロジェクト' }
        : {}

      // rowHeight変更時はノードのY座標を比例再計算
      let nodesUpdate: { nodes: Map<string, import('@/types/adm').EventNode> } | Record<string, never> = {}
      if (updates.rowHeight !== undefined && updates.rowHeight !== state.projectSettings.rowHeight) {
        const oldRH = state.projectSettings.rowHeight || DEFAULT_ROW_HEIGHT
        const newRH = updates.rowHeight
        const newNodes = new Map(state.nodes)
        for (const [id, node] of newNodes) {
          const rowIndex = Math.round((node.position.y - oldRH / 2) / oldRH)
          const newY = rowIndex * newRH + newRH / 2
          newNodes.set(id, { ...node, position: { x: node.position.x, y: newY } })
        }
        nodesUpdate = { nodes: newNodes }
      }

      return { projectSettings: newSettings, ...nameUpdate, ...nodesUpdate }
    })
  },

  // ======================================
  // CPM計算
  // ======================================

  recalculateCPM: () => {
    const nodes = get().getNodesArray()
    const activities = get().getActivitiesArray()

    try {
      const result = calculateADMCPM(nodes, activities)

      set((state) => {
        const newNodes = new Map(state.nodes)
        for (const node of result.nodes) {
          newNodes.set(node.id, node)
        }

        const newActivities = new Map(state.activities)
        for (const activity of result.activities) {
          newActivities.set(activity.id, activity)
        }

        return {
          nodes: newNodes,
          activities: newActivities,
          criticalPath: result.criticalPath,
          projectDuration: result.projectDuration,
        }
      })
    } catch (error) {
      console.error('CPM計算エラー:', error)
    }
  },

  // ======================================
  // 選択
  // ======================================

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId, selectedActivityId: null, selectedNodeIds: [], selectedActivityIds: [] })
  },

  selectActivity: (activityId) => {
    set({ selectedNodeId: null, selectedActivityId: activityId, selectedNodeIds: [], selectedActivityIds: [] })
  },

  clearSelection: () => {
    set({ selectedNodeId: null, selectedActivityId: null, selectedNodeIds: [], selectedActivityIds: [] })
  },

  selectAll: () => {
    const state = get()
    const allNodeIds = Array.from(state.nodes.keys())
    const allActivityIds = Array.from(state.activities.keys())
    set({
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: allNodeIds,
      selectedActivityIds: allActivityIds,
    })
  },

  selectNodes: (ids) => {
    set({
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: ids,
      selectedActivityIds: [],
    })
  },

  selectActivities: (ids) => {
    set({
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: [],
      selectedActivityIds: ids,
    })
  },

  toggleNodeSelection: (id) => {
    const state = get()
    const currentIds = [...state.selectedNodeIds]
    const index = currentIds.indexOf(id)
    if (index >= 0) {
      currentIds.splice(index, 1)
    } else {
      currentIds.push(id)
    }
    set({
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: currentIds,
    })
  },

  toggleActivitySelection: (id) => {
    const state = get()
    const currentIds = [...state.selectedActivityIds]
    const index = currentIds.indexOf(id)
    if (index >= 0) {
      currentIds.splice(index, 1)
    } else {
      currentIds.push(id)
    }
    set({
      selectedNodeId: null,
      selectedActivityId: null,
      selectedActivityIds: currentIds,
    })
  },

  // ======================================
  // 編集モード
  // ======================================

  setEditMode: (mode) => {
    // モード変更時に開いているバッチを閉じる
    if (get().isBatchOpen()) get().endBatch()
    const updates: Partial<ADMState> = { editMode: mode, activityStartNodeId: null }
    if (mode === 'select' || mode === 'pathSelect') {
      updates.lastSelectSubMode = mode
    } else if (mode === 'draw' || mode === 'text' || mode === 'banner') {
      updates.lastDrawSubMode = mode
    }
    set(updates)
  },

  setActivityStartNode: (nodeId) => {
    set({ activityStartNodeId: nodeId })
  },

  getLastSelectSubMode: () => get().lastSelectSubMode,
  getLastDrawSubMode: () => get().lastDrawSubMode,
  isBannerMode: () => get().editMode === 'banner',

  // ======================================
  // 進捗線
  // ======================================

  addProgressLine: () => {
    const pl = createProgressLine()
    const lines = [...get().progressLines, pl]
    set({ progressLines: lines, activeProgressLineId: pl.id })
    get().markDirty()
    return pl.id
  },

  setProgressBaseDate: (date, x, totalRows) => {
    const state = get()
    let activeId = state.activeProgressLineId
    let lines = [...state.progressLines]

    // アクティブな進捗線がない場合は新規作成
    if (!activeId) {
      const pl = createProgressLine()
      activeId = pl.id
      lines.push(pl)
    }

    const offsets: Record<number, number> = {}
    for (let i = 0; i < totalRows; i++) {
      offsets[i] = 0
    }

    lines = lines.map(pl =>
      pl.id === activeId
        ? { ...pl, baseDate: date, baseDateX: x, rowOffsets: offsets, visible: true }
        : pl
    )
    set({ progressLines: lines, activeProgressLineId: activeId })
    get().markDirty()
  },

  setProgressPoint: (detailId, offsetDays) => {
    const state = get()
    const activeId = state.activeProgressLineId
    if (!activeId) return
    const lines = state.progressLines.map(pl =>
      pl.id === activeId
        ? { ...pl, rowOffsets: { ...pl.rowOffsets, [detailId]: offsetDays } }
        : pl
    )
    set({ progressLines: lines })
    get().markDirty()
  },

  clearProgressLine: () => {
    const state = get()
    const activeId = state.activeProgressLineId
    if (!activeId) return
    const lines = state.progressLines.filter(pl => pl.id !== activeId)
    set({
      progressLines: lines,
      activeProgressLineId: lines.length > 0 ? lines[lines.length - 1].id : null,
    })
    get().markDirty()
  },

  clearAllProgressLines: () => {
    set({ progressLines: [], activeProgressLineId: null })
    get().markDirty()
  },

  setActiveProgressLine: (id) => {
    set({ activeProgressLineId: id })
  },

  // ======================================
  // ユーティリティ
  // ======================================

  getNode: (nodeId) => get().nodes.get(nodeId),
  getActivity: (activityId) => get().activities.get(activityId),
  getNodesArray: () => Array.from(get().nodes.values()),
  getActivitiesArray: () => Array.from(get().activities.values()),

  getActivitiesFromNode: (nodeId) => {
    return get().getActivitiesArray().filter((a) => a.fromNodeId === nodeId)
  },

  getActivitiesToNode: (nodeId) => {
    return get().getActivitiesArray().filter((a) => a.toNodeId === nodeId)
  },

  // ======================================
  // データ操作
  // ======================================

  clearAll: () => {
    set({
      buildings: new Map(),
      zones: new Map(),
      rooms: new Map(),
      detailCategories: new Map(),
      zoneMaster: new Map(),
      roomMaster: new Map(),
      detailMaster: new Map(),
      nodes: new Map(),
      activities: new Map(),
      criticalPath: [],
      projectDuration: 0,
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: [],
      selectedActivityIds: [],
      nextNodeNumber: 1,
      progressLines: [],
      activeProgressLineId: null,
    })
  },

  importData: (data) => {
    const newNodes = new Map<string, EventNode>()
    for (const node of data.nodes) {
      newNodes.set(node.id, node)
    }

    const newActivities = new Map<string, Activity>()
    for (const activity of data.activities) {
      newActivities.set(activity.id, activity)
    }

    let maxNumber = 0
    for (const node of data.nodes) {
      if (node.number > maxNumber) {
        maxNumber = node.number
      }
    }

    set({
      nodes: newNodes,
      activities: newActivities,
      nextNodeNumber: maxNumber + 1,
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: [],
      selectedActivityIds: [],
    })

    get().recalculateCPM()
  },

  exportData: () => ({
    nodes: get().getNodesArray(),
    activities: get().getActivitiesArray(),
    projectSettings: get().projectSettings,
  }),

  exportFullData: () => {
    const state = get()
    const calendarState = useCalendarStore.getState()

    // 日付計算用のパラメータ
    const startDate = new Date(state.projectSettings.startDate)
    const dayWidth = state.projectSettings.dayWidth

    // ノードに日付を付与
    const nodesWithDates = Array.from(state.nodes.values()).map(node => ({
      ...node,
      date: (() => {
        try {
          const d = xToDate(node.position.x, startDate, dayWidth)
          return d.toISOString().split('T')[0]
        } catch { return undefined }
      })(),
    }))

    // ノードIDから日付を引くためのマップ
    const nodeDateMap = new Map<string, string | undefined>()
    for (const node of nodesWithDates) {
      nodeDateMap.set(node.id, node.date)
    }

    // アクティビティに開始日・終了日を付与
    const activitiesWithDates = Array.from(state.activities.values()).map(activity => ({
      ...activity,
      startDate: nodeDateMap.get(activity.fromNodeId),
      endDate: nodeDateMap.get(activity.toNodeId),
    }))

    return {
      version: '3.0.0',
      exportedAt: new Date().toISOString(),
      projectSettings: state.projectSettings,
      calendar: {
        workDays: calendarState.calendar?.workDays ?? [1, 2, 3, 4, 5],
        holidays: calendarState.calendar?.holidays?.map(h => ({
          date: h.date,
          name: h.name,
          status: h.status,
        })) ?? [],
      },
      nodes: nodesWithDates,
      activities: activitiesWithDates,
      hierarchy: {
        buildings: Array.from(state.buildings.values()),
        zones: Array.from(state.zones.values()),
        rooms: Array.from(state.rooms.values()),
        detailCategories: Array.from(state.detailCategories.values()),
      },
      masters: {
        zones: Array.from(state.zoneMaster.values()),
        rooms: Array.from(state.roomMaster.values()),
        details: Array.from(state.detailMaster.values()),
      },
      // v3: テキストボックス
      textboxes: useTextBoxStore.getState().getTextBoxesArray(),
      // v3: カスタム列マスタ
      customMasters: (() => {
        const result: Record<string, MasterItem[]> = {}
        for (const [colId, items] of state.customMasters.entries()) {
          result[colId] = Array.from(items.values())
        }
        return result
      })(),
      // v3: カスタム列値
      customColumnValues: Object.fromEntries(state.customColumnValues),
      // v3: 進捗線
      progressLines: state.progressLines.length > 0 ? state.progressLines : undefined,
    }
  },

  exportLiteData: (): ADMExportDataLite => {
    const state = get()
    const calendarState = useCalendarStore.getState()

    const startDate = new Date(state.projectSettings.startDate)
    const dayWidth = state.projectSettings.dayWidth

    const nodesWithDates = Array.from(state.nodes.values()).map(node => ({
      ...node,
      date: (() => {
        try {
          const d = xToDate(node.position.x, startDate, dayWidth)
          return d.toISOString().split('T')[0]
        } catch { return undefined }
      })(),
    }))

    const nodeDateMap = new Map<string, string | undefined>()
    for (const node of nodesWithDates) {
      nodeDateMap.set(node.id, node.date)
    }

    const activitiesWithDates = Array.from(state.activities.values()).map(activity => ({
      ...activity,
      startDate: nodeDateMap.get(activity.fromNodeId),
      endDate: nodeDateMap.get(activity.toNodeId),
    }))

    return {
      version: '3.0.0',
      exportedAt: new Date().toISOString(),
      projectSettings: state.projectSettings,
      calendar: {
        workDays: calendarState.calendar?.workDays ?? [1, 2, 3, 4, 5],
        holidays: calendarState.calendar?.holidays?.map(h => ({
          date: h.date,
          name: h.name,
          status: h.status,
        })) ?? [],
      },
      nodes: nodesWithDates,
      activities: activitiesWithDates,
      textboxes: useTextBoxStore.getState().getTextBoxesArray(),
    }
  },

  importFullData: (data: ADMExportData) => {
    // ノードをMapに変換（date フィールドはエクスポート時の計算値なので除去）
    const newNodes = new Map<string, EventNode>()
    for (const node of data.nodes) {
      const { date: _date, ...nodeWithoutDate } = node
      newNodes.set(node.id, nodeWithoutDate as EventNode)
    }

    // アクティビティをMapに変換（startDate/endDate はエクスポート時の計算値なので除去）
    const newActivities = new Map<string, Activity>()
    for (const activity of data.activities) {
      const { startDate: _startDate, endDate: _endDate, ...actWithoutDates } = activity
      newActivities.set(activity.id, actWithoutDates as Activity)
    }

    // 棟データをMapに変換
    const newBuildings = new Map<string, Building>()
    if (data.hierarchy.buildings) {
      for (const building of data.hierarchy.buildings) {
        newBuildings.set(building.id, building)
      }
    }

    // 階層データをMapに変換
    const newZones = new Map<string, Zone>()
    for (const zone of data.hierarchy.zones) {
      newZones.set(zone.id, zone)
    }

    const newRooms = new Map<string, Room>()
    for (const room of data.hierarchy.rooms) {
      newRooms.set(room.id, room)
    }

    const newDetailCategories = new Map<string, DetailCategory>()
    for (const detail of data.hierarchy.detailCategories) {
      newDetailCategories.set(detail.id, detail)
    }

    // マスタデータをMapに変換
    const newZoneMaster = new Map<string, MasterItem>()
    for (const item of data.masters.zones) {
      newZoneMaster.set(item.id, item)
    }

    const newRoomMaster = new Map<string, MasterItem>()
    for (const item of data.masters.rooms) {
      newRoomMaster.set(item.id, item)
    }

    const newDetailMaster = new Map<string, MasterItem>()
    for (const item of data.masters.details) {
      newDetailMaster.set(item.id, item)
    }

    // 次のノード番号を計算
    let maxNumber = 0
    for (const node of newNodes.values()) {
      if (node.number > maxNumber) {
        maxNumber = node.number
      }
    }

    // v3: カスタムマスタ復元
    const newCustomMasters = new Map<string, Map<string, MasterItem>>()
    if (data.customMasters) {
      for (const [colId, items] of Object.entries(data.customMasters)) {
        const colMap = new Map<string, MasterItem>()
        for (const item of items) {
          colMap.set(item.id, item)
        }
        newCustomMasters.set(colId, colMap)
      }
    }

    // v3: カスタム列値復元
    const newCustomColumnValues = new Map<string, string>()
    if (data.customColumnValues) {
      for (const [key, value] of Object.entries(data.customColumnValues)) {
        newCustomColumnValues.set(key, value)
      }
    }

    set({
      projectSettings: data.projectSettings,
      nodes: newNodes,
      activities: newActivities,
      buildings: newBuildings,
      zones: newZones,
      rooms: newRooms,
      detailCategories: newDetailCategories,
      zoneMaster: newZoneMaster,
      roomMaster: newRoomMaster,
      detailMaster: newDetailMaster,
      customMasters: newCustomMasters,
      customColumnValues: newCustomColumnValues,
      nextNodeNumber: maxNumber + 1,
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: [],
      selectedActivityIds: [],
      history: [],
      future: [],
      canUndo: false,
      canRedo: false,
      progressLines: (() => {
        const rawLines = data.progressLines ?? (data.progressLine ? [data.progressLine] : [])
        // マイグレーション: rowIndex→detailId
        const hierarchyRows = get().getHierarchyRows()
        return migrateProgressLines(rawLines, hierarchyRows)
      })(),
      activeProgressLineId: null,
    })

    // v3: テキストボックス復元
    if (data.textboxes && data.textboxes.length > 0) {
      const tbMap = new Map<string, TextBox>()
      for (const tb of data.textboxes) {
        tbMap.set(tb.id, tb)
      }
      useTextBoxStore.setState({ textboxes: tbMap })
    }

    // カレンダーデータのインポート
    if (data.calendar) {
      const calendarStore = useCalendarStore.getState()

      // プロジェクトIDでカレンダーを初期化
      calendarStore.initCalendar(data.projectSettings.id, data.projectSettings.startDate)

      // workDaysを設定（v1: boolean[], v2: number[] の両方に対応）
      if (data.calendar.workDays && data.calendar.workDays.length > 0) {
        let workDaysNumbers: number[]

        if (typeof data.calendar.workDays[0] === 'boolean') {
          // v1形式: boolean[] → number[] に変換
          workDaysNumbers = []
          ;(data.calendar.workDays as unknown as boolean[]).forEach((isWorkDay, index) => {
            if (isWorkDay) workDaysNumbers.push(index)
          })
        } else {
          // v2形式: number[] をそのまま使用
          workDaysNumbers = data.calendar.workDays as number[]
        }

        calendarStore.setWorkDays(workDaysNumbers)
      }

      // 祝日を設定
      if (data.calendar.holidays) {
        for (const holiday of data.calendar.holidays) {
          calendarStore.addHoliday({ date: holiday.date, name: holiday.name, status: holiday.status ?? 'holiday' })
        }
      }
    }

    get().recalculateCPM()
  },

  exportToJSON: () => {
    const data = get().exportFullData()
    return JSON.stringify(data, null, 2)
  },

  downloadJSON: (filename?: string) => {
    const json = get().exportToJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename ?? `con-sche_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  importLiteData: (data: ADMExportDataLite) => {
    // ノードをMapに変換
    const newNodes = new Map<string, EventNode>()
    for (const node of data.nodes) {
      const { date: _date, ...rest } = node as EventNode & { date?: string }
      newNodes.set(node.id, rest as EventNode)
    }

    // アクティビティをMapに変換
    const newActivities = new Map<string, Activity>()
    for (const activity of data.activities) {
      const { startDate: _s, endDate: _e, ...rest } = activity as Activity & { startDate?: string; endDate?: string }
      newActivities.set(activity.id, rest as Activity)
    }

    let maxNumber = 0
    for (const node of newNodes.values()) {
      if (node.number > maxNumber) maxNumber = node.number
    }

    set({
      projectSettings: data.projectSettings,
      nodes: newNodes,
      activities: newActivities,
      // ライトはマスタ・階層なし → 空にリセット
      buildings: new Map(),
      zones: new Map(),
      rooms: new Map(),
      detailCategories: new Map(),
      zoneMaster: new Map(),
      roomMaster: new Map(),
      detailMaster: new Map(),
      customMasters: new Map(),
      customColumnValues: new Map(),
      nextNodeNumber: maxNumber + 1,
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: [],
      selectedActivityIds: [],
      history: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })

    // テキストボックス復元
    if (data.textboxes && data.textboxes.length > 0) {
      const tbMap = new Map<string, TextBox>()
      for (const tb of data.textboxes) {
        tbMap.set(tb.id, tb)
      }
      useTextBoxStore.setState({ textboxes: tbMap })
    }

    // カレンダー復元
    if (data.calendar) {
      const calendarStore = useCalendarStore.getState()
      calendarStore.initCalendar(data.projectSettings.id, data.projectSettings.startDate)

      if (data.calendar.workDays && data.calendar.workDays.length > 0) {
        let workDaysNumbers: number[]
        if (typeof data.calendar.workDays[0] === 'boolean') {
          workDaysNumbers = []
          ;(data.calendar.workDays as unknown as boolean[]).forEach((isWorkDay, index) => {
            if (isWorkDay) workDaysNumbers.push(index)
          })
        } else {
          workDaysNumbers = data.calendar.workDays as number[]
        }
        calendarStore.setWorkDays(workDaysNumbers)
      }

      if (data.calendar.holidays) {
        for (const holiday of data.calendar.holidays) {
          calendarStore.addHoliday({ date: holiday.date, name: holiday.name, status: holiday.status ?? 'holiday' })
        }
      }
    }

    get().recalculateCPM()
  },

  downloadFullPackage: async (filename?: string) => {
    const { exportFullPackage, downloadPackage } = await import('@/utils/conScheFile')
    const data = get().exportFullData()
    const blob = await exportFullPackage(data)
    downloadPackage(blob, filename ?? `con-sche_${new Date().toISOString().split('T')[0]}.csa`)
  },

  downloadLitePackage: async (filename?: string) => {
    const { exportLitePackage, downloadPackage } = await import('@/utils/conScheFile')
    const data = get().exportLiteData()
    const blob = await exportLitePackage(data)
    downloadPackage(blob, filename ?? `con-sche_${new Date().toISOString().split('T')[0]}.csl`)
  },

  // ======================================
  // 履歴操作（Undo/Redo）
  // ======================================

  saveHistory: () => {
    const state = get()

    // バッチ中はスキップ（endBatchで1回だけ保存）
    if ((state as unknown as { _batchDepth: number })._batchDepth > 0) return

    const snapshot: HistorySnapshot = {
      nodes: new Map(state.nodes),
      activities: new Map(state.activities),
      nextNodeNumber: state.nextNodeNumber,
      textboxes: new Map(useTextBoxStore.getState().textboxes),
    }

    set((state) => {
      const newHistory = [...state.history, snapshot]
      // 履歴の最大数を超えたら古いものを削除
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift()
      }
      return {
        history: newHistory,
        future: [], // 新しい操作をしたらRedoスタックをクリア
        canUndo: true,
        canRedo: false,
      }
    })
  },

  beginBatch: () => {
    // バッチ開始時に現在状態をスナップショット保存
    const state = get()
    const depth = (state as unknown as { _batchDepth: number })._batchDepth
    if (depth === 0) {
      // 最初のbeginBatchでスナップショット保存
      const snapshot: HistorySnapshot = {
        nodes: new Map(state.nodes),
        activities: new Map(state.activities),
        nextNodeNumber: state.nextNodeNumber,
        textboxes: new Map(useTextBoxStore.getState().textboxes),
      }
      set((s) => ({
        ...s,
        _batchDepth: 1,
        _batchSnapshot: snapshot,
      } as never))
    } else {
      set((s) => ({ ...s, _batchDepth: depth + 1 } as never))
    }
  },

  endBatch: () => {
    const state = get()
    const depth = (state as unknown as { _batchDepth: number })._batchDepth
    if (depth <= 0) return

    if (depth === 1) {
      // 最後のendBatch: 保存したスナップショットを履歴に追加
      const snapshot = (state as unknown as { _batchSnapshot: HistorySnapshot })._batchSnapshot
      if (snapshot) {
        set((s) => {
          const newHistory = [...s.history, snapshot]
          if (newHistory.length > MAX_HISTORY) {
            newHistory.shift()
          }
          return {
            ...s,
            history: newHistory,
            future: [],
            canUndo: true,
            canRedo: false,
            _batchDepth: 0,
            _batchSnapshot: null,
          } as never
        })
      } else {
        set((s) => ({ ...s, _batchDepth: 0 } as never))
      }
    } else {
      set((s) => ({ ...s, _batchDepth: depth - 1 } as never))
    }
  },

  isBatchOpen: () => (get() as unknown as { _batchDepth: number })._batchDepth > 0,

  cancelBatch: () => {
    const state = get()
    const depth = (state as unknown as { _batchDepth: number })._batchDepth
    if (depth <= 0) return

    // バッチ開始時のスナップショットに巻き戻す
    const snapshot = (state as unknown as { _batchSnapshot: HistorySnapshot | null })._batchSnapshot
    if (snapshot) {
      // 巻き戻し前の状態をfutureに保存（Redo対応）
      const currentSnapshot: HistorySnapshot = {
        nodes: new Map(state.nodes),
        activities: new Map(state.activities),
        nextNodeNumber: state.nextNodeNumber,
        textboxes: new Map(useTextBoxStore.getState().textboxes),
      }
      set((s) => ({
        ...s,
        nodes: snapshot.nodes,
        activities: snapshot.activities,
        nextNodeNumber: snapshot.nextNodeNumber,
        activityStartNodeId: null,
        selectedNodeId: null,
        selectedActivityId: null,
        selectedNodeIds: [],
        selectedActivityIds: [],
        future: [...s.future, currentSnapshot],
        canRedo: true,
        _batchDepth: 0,
        _batchSnapshot: null,
      } as never))
      useTextBoxStore.setState({ textboxes: snapshot.textboxes, selectedTextBoxId: null })
      get().recalculateCPM()
    } else {
      set((s) => ({ ...s, _batchDepth: 0, _batchSnapshot: null } as never))
    }
  },

  undo: () => {
    const state = get()

    // バッチが開いている場合: cancelBatchで巻き戻す
    if (state.isBatchOpen()) {
      state.cancelBatch()
      return
    }

    if (state.history.length === 0) return

    // 現在の状態をfutureに保存
    const currentSnapshot: HistorySnapshot = {
      nodes: new Map(state.nodes),
      activities: new Map(state.activities),
      nextNodeNumber: state.nextNodeNumber,
      textboxes: new Map(useTextBoxStore.getState().textboxes),
    }

    // 履歴から最後の状態を取得
    const newHistory = [...state.history]
    const prevSnapshot = newHistory.pop()!

    set({
      nodes: prevSnapshot.nodes,
      activities: prevSnapshot.activities,
      nextNodeNumber: prevSnapshot.nextNodeNumber,
      history: newHistory,
      future: [...state.future, currentSnapshot],
      canUndo: newHistory.length > 0,
      canRedo: true,
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: [],
      selectedActivityIds: [],
      activityStartNodeId: null,
    })
    useTextBoxStore.setState({ textboxes: prevSnapshot.textboxes, selectedTextBoxId: null })

    get().recalculateCPM()
  },

  // ======================================
  // フロートベース移動
  // ======================================

  getAffectedChain: (activityId: string) => {
    const state = get()
    const startActivity = state.activities.get(activityId)
    if (!startActivity) return []

    const chain: string[] = [activityId]
    const visited = new Set<string>([activityId])

    // 後方向（downstream）: toNodeから後続をたどる
    const traceForward = (nodeId: string) => {
      const outgoing = state.getActivitiesFromNode(nodeId)
      for (const act of outgoing) {
        if (visited.has(act.id)) continue
        // ダミー作業は常に通過（FFに関係なくチェーンに含める）
        if (!act.isDummy && act.freeFloat > 0) continue
        visited.add(act.id)
        chain.push(act.id)
        traceForward(act.toNodeId)
      }
    }

    // 前方向（upstream）: fromNodeから上流をたどる
    const traceBackward = (nodeId: string) => {
      const incoming = state.getActivitiesToNode(nodeId)
      for (const act of incoming) {
        if (visited.has(act.id)) continue
        // ダミー作業は常に通過
        if (!act.isDummy && act.freeFloat > 0) continue
        visited.add(act.id)
        chain.push(act.id)
        traceBackward(act.fromNodeId)
      }
    }

    traceForward(startActivity.toNodeId)
    traceBackward(startActivity.fromNodeId)

    return chain
  },

  getShiftRange: (activityId: string) => {
    const state = get()
    const activity = state.activities.get(activityId)
    if (!activity) return { maxLeft: 0, maxRight: 0, isCritical: false }

    // クリティカルパスは後続を伴う強制移動が可能（右方向は実質無制限）
    const maxRight = activity.isCritical ? 999 : activity.totalFloat
    const DAY_WIDTH = state.projectSettings.dayWidth || 30

    // 左方向の最大移動日数を計算
    // fromNode が前方（predecessor の toNode）に近づける限界を求める
    const fromNode = state.nodes.get(activity.fromNodeId)
    if (!fromNode) return { maxLeft: 0, maxRight, isCritical: activity.isCritical }

    const predecessors = state.getActivitiesToNode(activity.fromNodeId)
    let maxLeftPx: number

    if (predecessors.length === 0) {
      // 前方に何もない → fromNode.x（0まで）が限界
      maxLeftPx = fromNode.position.x
    } else {
      // 各 predecessor の最低必要到達位置を計算
      maxLeftPx = Infinity
      for (const pred of predecessors) {
        const predFrom = state.nodes.get(pred.fromNodeId)
        if (!predFrom) continue
        const minEndX = predFrom.position.x + pred.duration * DAY_WIDTH
        maxLeftPx = Math.min(maxLeftPx, fromNode.position.x - minEndX)
      }
    }

    const maxLeft = Math.max(0, Math.floor(maxLeftPx / DAY_WIDTH))
    return { maxLeft, maxRight, isCritical: activity.isCritical }
  },

  shiftActivityWithFloat: (activityId: string, shiftDays: number, isChainMove?: boolean) => {
    const state = get()
    const activity = state.activities.get(activityId)
    if (!activity) return
    if (shiftDays === 0) return

    // 方向に応じてクランプ
    const { maxLeft, isCritical } = get().getShiftRange(activityId)
    let effectiveShift: number
    if (shiftDays > 0) {
      // 右方向: クリティカルパスは後続伝播するので制限なし、非クリティカルはTFでクランプ
      effectiveShift = isCritical ? shiftDays : Math.min(shiftDays, activity.totalFloat)
    } else {
      // 左方向: getShiftRange の maxLeft でクランプ
      effectiveShift = Math.max(shiftDays, -maxLeft)
    }
    if (effectiveShift === 0) return

    const DAY_WIDTH = state.projectSettings.dayWidth || 30
    const shiftPx = effectiveShift * DAY_WIDTH

    state.beginBatch()

    // ======================================
    // Phase 1: カスケード対象の収集
    // 対象アクティビティ + FF不足の後続実作業のみ（ダミーは含めない）
    // ダミーは伸縮で吸収し、逆転時のみ Phase 6 で補正する
    // ======================================
    const cascadeActIds = new Set<string>([activityId])

    if (isChainMove) {
      const chainIds = get().getAffectedChain(activityId)
      for (const id of chainIds) cascadeActIds.add(id)
    } else if (effectiveShift > 0) {
      // 右方向の単一移動: 後続の実作業のみFF基準で再帰的にたどる
      const traceCascade = (actId: string, remainingShift: number) => {
        const act = get().activities.get(actId)
        if (!act) return
        const outgoing = get().getActivitiesFromNode(act.toNodeId)
        for (const succ of outgoing) {
          if (cascadeActIds.has(succ.id)) continue
          if (succ.isDummy) continue // ダミーはカスケードに含めない
          if (succ.freeFloat >= remainingShift) continue
          const succRemaining = remainingShift - succ.freeFloat
          cascadeActIds.add(succ.id)
          traceCascade(succ.id, succRemaining)
        }
      }
      traceCascade(activityId, effectiveShift)
    }

    // ======================================
    // Phase 2: カスケードノードの収集
    // ======================================
    const cascadeNodeIds = new Set<string>()
    for (const actId of cascadeActIds) {
      const act = get().activities.get(actId)
      if (!act) continue
      cascadeNodeIds.add(act.fromNodeId)
      cascadeNodeIds.add(act.toNodeId)
    }

    // ======================================
    // Phase 3: 境界ノードの分割
    // 非カスケード実作業（incoming/outgoing 両方）と繋がるノードを分割しダミーで接続
    // チェーン移動ではダミー作成しない（境界ノードを除外するだけ）
    // ======================================
    const nodeRemap = new Map<string, string>() // oldNodeId → newNodeId

    if (isChainMove) {
      // チェーン移動: 非カスケード実作業と接続するノードは動かさない
      for (const nodeId of [...cascadeNodeIds]) {
        const outgoing = get().getActivitiesFromNode(nodeId)
          .filter(a => !cascadeActIds.has(a.id) && !a.isDummy)
        if (outgoing.length > 0) {
          cascadeNodeIds.delete(nodeId)
        }
      }
    } else {
      // 単体移動: 境界ノードを分割

      // 起点アクティビティの fromNode
      const startAct = get().activities.get(activityId)!
      const startFromNode = get().nodes.get(startAct.fromNodeId)
      if (startFromNode) {
        const incomingNonCascade = get().getActivitiesToNode(startAct.fromNodeId)
          .filter(a => !cascadeActIds.has(a.id) && !a.isDummy)
        const outgoingNonCascade = get().getActivitiesFromNode(startAct.fromNodeId)
          .filter(a => !cascadeActIds.has(a.id) && !a.isDummy)

        if (incomingNonCascade.length > 0 || outgoingNonCascade.length > 0) {
          const newNodeId = get().addNode({
            x: startFromNode.position.x + shiftPx,
            y: startFromNode.position.y,
          })
          nodeRemap.set(startAct.fromNodeId, newNodeId)
          cascadeNodeIds.delete(startAct.fromNodeId)
          if (outgoingNonCascade.length === 0) {
            get().addDummyActivity(startAct.fromNodeId, newNodeId)
          }
        }
      }

      // カスケード末端の toNode（incoming/outgoing 両方チェック）
      for (const actId of cascadeActIds) {
        const act = get().activities.get(actId)
        if (!act) continue
        const toNodeId = act.toNodeId
        if (nodeRemap.has(toNodeId)) continue

        const incomingNonCascade = get().getActivitiesToNode(toNodeId)
          .filter(a => !cascadeActIds.has(a.id) && !a.isDummy)
        const outgoingNonCascade = get().getActivitiesFromNode(toNodeId)
          .filter(a => !cascadeActIds.has(a.id) && !a.isDummy)

        if (incomingNonCascade.length > 0 || outgoingNonCascade.length > 0) {
          const toNode = get().nodes.get(toNodeId)
          if (!toNode) continue
          const newNodeId = get().addNode({
            x: toNode.position.x + shiftPx,
            y: toNode.position.y,
          })
          get().addDummyActivity(newNodeId, toNodeId)
          nodeRemap.set(toNodeId, newNodeId)
          cascadeNodeIds.delete(toNodeId)
        }
      }
    }

    // ======================================
    // Phase 4: ノード付け替え
    // 分割で生まれた新ノードにカスケード内アクティビティを付け替え
    // ======================================
    if (nodeRemap.size > 0) {
      set((s) => {
        const newActivities = new Map(s.activities)
        for (const actId of cascadeActIds) {
          const act = newActivities.get(actId)
          if (!act) continue
          const newFrom = nodeRemap.get(act.fromNodeId)
          const newTo = nodeRemap.get(act.toNodeId)
          if (newFrom || newTo) {
            newActivities.set(actId, {
              ...act,
              fromNodeId: newFrom ?? act.fromNodeId,
              toNodeId: newTo ?? act.toNodeId,
            })
          }
        }
        return { activities: newActivities }
      })
    }

    // ======================================
    // Phase 5: カスケードノードの移動
    // ======================================
    set((s) => {
      const newNodes = new Map(s.nodes)
      for (const nodeId of cascadeNodeIds) {
        const node = newNodes.get(nodeId)
        if (!node) continue
        newNodes.set(nodeId, {
          ...node,
          position: {
            x: node.position.x + shiftPx,
            y: node.position.y,
          },
        })
      }
      return { nodes: newNodes }
    })

    // ======================================
    // Phase 6: ダミー順序の強制
    // 全ダミーについて fromNode.x > toNode.x（逆転）なら toNode.x = fromNode.x に修正
    // 逆転修正で動いたノードの先も再帰的にチェック（実作業は duration 分、ダミーは位置のみ）
    // ======================================
    {
      const ps = state.projectSettings
      const cal = useCalendarStore.getState().calendar
      const sd = new Date(ps.startDate)
      const dw = ps.dayWidth || 30

      // 修正が必要なノードを再帰的に伝播
      const propagate = (startNodeIds: Set<string>, nodesSnapshot: Map<string, EventNode>) => {
        const queue = [...startNodeIds]
        const visited = new Set<string>()

        while (queue.length > 0) {
          const nodeId = queue.shift()!
          if (visited.has(nodeId)) continue
          visited.add(nodeId)

          const node = nodesSnapshot.get(nodeId)
          if (!node) continue

          // このノードから出る全アクティビティをチェック
          const outgoing = get().getActivitiesFromNode(nodeId)
          for (const act of outgoing) {
            const toNode = nodesSnapshot.get(act.toNodeId)
            if (!toNode) continue

            let requiredX: number
            if (act.isDummy) {
              // ダミー: fromNode.x 以上であればOK
              requiredX = node.position.x
            } else if (act.duration > 0) {
              // 実作業: fromNode.x + カレンダー日数分
              const calDays = getCalendarDaysForWorkdays(
                node.position.x, act.duration, sd, dw, cal
              )
              requiredX = node.position.x + calDays * dw
            } else {
              continue
            }

            if (toNode.position.x < requiredX) {
              nodesSnapshot.set(act.toNodeId, {
                ...toNode,
                position: { ...toNode.position, x: requiredX },
              })
              queue.push(act.toNodeId)
            }
          }
        }
      }

      set((s) => {
        const newNodes = new Map(s.nodes)
        // カスケードで動いたノード + 分割で新規作成されたノードを起点に伝播
        const startNodes = new Set<string>()
        for (const nodeId of cascadeNodeIds) startNodes.add(nodeId)
        for (const newId of nodeRemap.values()) startNodes.add(newId)
        propagate(startNodes, newNodes)
        return { nodes: newNodes }
      })
    }

    state.endBatch()
    get().recalculateCPM()
  },

  redo: () => {
    const state = get()
    if (state.future.length === 0) return

    // 現在の状態をhistoryに保存
    const currentSnapshot: HistorySnapshot = {
      nodes: new Map(state.nodes),
      activities: new Map(state.activities),
      nextNodeNumber: state.nextNodeNumber,
      textboxes: new Map(useTextBoxStore.getState().textboxes),
    }

    // futureから最後の状態を取得
    const newFuture = [...state.future]
    const nextSnapshot = newFuture.pop()!

    set({
      nodes: nextSnapshot.nodes,
      activities: nextSnapshot.activities,
      nextNodeNumber: nextSnapshot.nextNodeNumber,
      history: [...state.history, currentSnapshot],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
      selectedNodeId: null,
      selectedActivityId: null,
      selectedNodeIds: [],
      selectedActivityIds: [],
    })
    useTextBoxStore.setState({ textboxes: nextSnapshot.textboxes, selectedTextBoxId: null })

    get().recalculateCPM()
  },
}))
