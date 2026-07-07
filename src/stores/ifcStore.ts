/**
 * IFC連携用 Zustand ストア
 * IFCファイルのパース結果とマッピング設定を管理
 */

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  IfcImportResult,
  IfcSession,
  IfcToConScheMapping,
  FloorMapping,
  RoomMapping,
  ParserStatus,
  ParserError,
  MappingAction,
} from '@/types/ifc'

interface IfcState {
  // パーサー状態
  status: ParserStatus
  error: ParserError | null
  progress: number // 0-100

  // 現在のインポート結果
  currentResult: IfcImportResult | null
  currentSessionId: string | null

  // マッピング設定
  floorMappings: FloorMapping[]
  roomMappings: RoomMapping[]

  // 履歴
  sessions: Map<string, IfcSession>

  // ダイアログ状態
  isImportDialogOpen: boolean
  isMappingPanelOpen: boolean

  // アクション - パーサー
  setStatus: (status: ParserStatus) => void
  setError: (error: ParserError | null) => void
  setProgress: (progress: number) => void
  setCurrentResult: (result: IfcImportResult | null) => void

  // アクション - マッピング
  initializeMappings: (result: IfcImportResult) => void
  updateFloorMapping: (ifcStoreyId: number, updates: Partial<FloorMapping>) => void
  updateRoomMapping: (ifcSpaceId: number, updates: Partial<RoomMapping>) => void
  setAllFloorActions: (action: MappingAction) => void
  setAllRoomActions: (action: MappingAction) => void

  // アクション - セッション
  createSession: (fileName: string, fileSize: number, result: IfcImportResult) => string
  saveMapping: () => void
  loadSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  getSessions: () => IfcSession[]

  // アクション - ダイアログ
  openImportDialog: () => void
  closeImportDialog: () => void
  openMappingPanel: () => void
  closeMappingPanel: () => void

  // アクション - リセット
  reset: () => void
}

export const useIfcStore = create<IfcState>((set, get) => ({
  // 初期状態
  status: 'idle',
  error: null,
  progress: 0,
  currentResult: null,
  currentSessionId: null,
  floorMappings: [],
  roomMappings: [],
  sessions: new Map(),
  isImportDialogOpen: false,
  isMappingPanelOpen: false,

  // パーサー状態
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? 'error' : get().status }),
  setProgress: (progress) => set({ progress }),
  setCurrentResult: (result) => set({ currentResult: result }),

  // マッピング初期化
  initializeMappings: (result) => {
    // 階のマッピング初期化
    const floorMappings: FloorMapping[] = result.storeys
      .sort((a, b) => a.elevation - b.elevation)
      .map((storey) => ({
        ifcStoreyId: storey.expressId,
        ifcStoreyName: storey.name,
        ifcElevation: storey.elevation,
        conScheFloorId: null,
        conScheFloorName: storey.name,
        action: 'create' as MappingAction,
      }))

    // 部屋のマッピング初期化
    const roomMappings: RoomMapping[] = result.spaces.map((space) => ({
      ifcSpaceId: space.expressId,
      ifcSpaceName: space.name,
      ifcStoreyId: space.storeyId,
      ifcArea: space.area,
      ifcVolume: space.volume,
      ifcHeight: space.height,
      quantities: space.quantities,
      boundaries: space.boundaries,
      conScheRoomId: null,
      conScheRoomName: space.name,
      action: 'create' as MappingAction,
    }))

    set({ floorMappings, roomMappings })
  },

  // マッピング更新
  updateFloorMapping: (ifcStoreyId, updates) => {
    set((state) => ({
      floorMappings: state.floorMappings.map((m) =>
        m.ifcStoreyId === ifcStoreyId ? { ...m, ...updates } : m
      ),
    }))
  },

  updateRoomMapping: (ifcSpaceId, updates) => {
    set((state) => ({
      roomMappings: state.roomMappings.map((m) =>
        m.ifcSpaceId === ifcSpaceId ? { ...m, ...updates } : m
      ),
    }))
  },

  setAllFloorActions: (action) => {
    set((state) => ({
      floorMappings: state.floorMappings.map((m) => ({ ...m, action })),
    }))
  },

  setAllRoomActions: (action) => {
    set((state) => ({
      roomMappings: state.roomMappings.map((m) => ({ ...m, action })),
    }))
  },

  // セッション管理
  createSession: (fileName, fileSize, result) => {
    const sessionId = uuidv4()
    const session: IfcSession = {
      id: sessionId,
      projectId: 'default',
      fileName,
      fileSize,
      schema: result.stats.schema,
      importedAt: new Date().toISOString(),
      stats: result.stats,
    }

    set((state) => {
      const newSessions = new Map(state.sessions)
      newSessions.set(sessionId, session)
      return { sessions: newSessions, currentSessionId: sessionId }
    })

    return sessionId
  },

  saveMapping: () => {
    const state = get()
    if (!state.currentSessionId) return

    const mapping: IfcToConScheMapping = {
      sessionId: state.currentSessionId,
      floors: state.floorMappings,
      rooms: state.roomMappings,
      createdAt: new Date().toISOString(),
    }

    set((state) => {
      const session = state.sessions.get(state.currentSessionId!)
      if (!session) return state

      const newSessions = new Map(state.sessions)
      newSessions.set(state.currentSessionId!, { ...session, mapping })
      return { sessions: newSessions }
    })
  },

  loadSession: (sessionId) => {
    const session = get().sessions.get(sessionId)
    if (!session) return

    set({ currentSessionId: sessionId })

    if (session.mapping) {
      set({
        floorMappings: session.mapping.floors,
        roomMappings: session.mapping.rooms,
      })
    }
  },

  deleteSession: (sessionId) => {
    set((state) => {
      const newSessions = new Map(state.sessions)
      newSessions.delete(sessionId)
      return {
        sessions: newSessions,
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
      }
    })
  },

  getSessions: () => Array.from(get().sessions.values()),

  // ダイアログ
  openImportDialog: () => set({ isImportDialogOpen: true }),
  closeImportDialog: () => set({ isImportDialogOpen: false }),
  openMappingPanel: () => set({ isMappingPanelOpen: true }),
  closeMappingPanel: () => set({ isMappingPanelOpen: false }),

  // リセット
  reset: () => {
    set({
      status: 'idle',
      error: null,
      progress: 0,
      currentResult: null,
      currentSessionId: null,
      floorMappings: [],
      roomMappings: [],
    })
  },
}))
