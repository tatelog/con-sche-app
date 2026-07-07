import { create } from 'zustand'
import type { Position } from '@/types'

export interface CaptureResult {
  imageData: string
  viewStartDate: string
  effectiveTotalDays: number
  totalRows: number
}

export type CanvasMode = 'select' | 'pan' | 'createTask' | 'connect'
export type DialogType = 'task' | 'dependency' | 'project' | 'bugakari' | null
export type ViewMode = 'network'

interface UIState {
  // 選択状態
  selectedTaskIds: string[]
  selectedDependencyId: string | null

  // キャンバス
  canvasMode: CanvasMode
  canvasScale: number
  canvasPosition: Position
  connectSourceId: string | null

  // スクロールバー用: 描画コンテンツのワールドサイズとビューポート実寸
  canvasContentSize: { width: number; height: number }
  canvasViewport: { width: number; height: number }
  setCanvasMetrics: (m: { content: { width: number; height: number }; viewport: { width: number; height: number } }) => void

  // ビュー
  viewMode: ViewMode
  showBugakariPanel: boolean
  showPropertiesPanel: boolean
  showProjectSettingsDialog: boolean
  showSCurve: boolean
  showProgressOffsetLabels: boolean

  // 初回チュートリアルオーバーレイ
  showTutorial: boolean
  openTutorial: () => void
  closeTutorial: () => void

  // カーソル近傍ヒント（ドラッグ中に「なぜ操作できないか」を表示。null = 非表示）
  cursorHint: string | null
  setCursorHint: (hint: string | null) => void

  // 棟セレクター
  selectedBuildingId: string | null
  setSelectedBuildingId: (id: string | null) => void

  // ダイアログ
  activeDialog: DialogType
  dialogData: unknown

  // キャンバスキャプチャ（印刷用）
  captureCanvas: (() => CaptureResult | null) | null
  setCaptureCanvas: (fn: (() => CaptureResult | null) | null) => void

  // ページング（マルチページ対応）
  currentPage: number
  setCurrentPage: (page: number) => void

  // アクション
  selectTask: (taskId: string, multi?: boolean) => void
  selectDependency: (depId: string | null) => void
  clearSelection: () => void

  setCanvasMode: (mode: CanvasMode) => void
  setCanvasScale: (scale: number) => void
  setCanvasPosition: (position: Position) => void
  resetCanvasPosition: () => void
  setConnectSource: (taskId: string | null) => void

  setViewMode: (mode: ViewMode) => void
  toggleBugakariPanel: () => void
  togglePropertiesPanel: () => void
  toggleProjectSettingsDialog: () => void
  toggleSCurve: () => void
  toggleProgressOffsetLabels: () => void

  openDialog: (type: DialogType, data?: unknown) => void
  closeDialog: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  selectedTaskIds: [],
  selectedDependencyId: null,
  captureCanvas: null,
  setCaptureCanvas: (fn) => {
    set({ captureCanvas: fn })
  },
  currentPage: 0,
  setCurrentPage: (page) => {
    set({ currentPage: page })
  },
  canvasMode: 'select',
  canvasScale: 1.2,
  canvasPosition: { x: 0, y: 0 },
  canvasContentSize: { width: 0, height: 0 },
  canvasViewport: { width: 0, height: 0 },
  connectSourceId: null,
  viewMode: 'network',
  showBugakariPanel: false,
  showPropertiesPanel: true,
  showProjectSettingsDialog: false,
  showSCurve: false,
  showProgressOffsetLabels: false,
  showTutorial: false,
  openTutorial: () => {
    set({ showTutorial: true })
  },
  closeTutorial: () => {
    set({ showTutorial: false })
  },
  cursorHint: null,
  setCursorHint: (hint) => {
    // 同じ文言の再セットは無視（ドラッグ中の高頻度呼び出し対策）
    if (get().cursorHint === hint) return
    set({ cursorHint: hint })
  },
  selectedBuildingId: null,
  setSelectedBuildingId: (id) => {
    set({ selectedBuildingId: id })
  },
  activeDialog: null,
  dialogData: null,

  selectTask: (taskId, multi = false) => {
    set(state => {
      if (multi) {
        const ids = state.selectedTaskIds.includes(taskId)
          ? state.selectedTaskIds.filter(id => id !== taskId)
          : [...state.selectedTaskIds, taskId]
        return { selectedTaskIds: ids, selectedDependencyId: null }
      }
      return { selectedTaskIds: [taskId], selectedDependencyId: null }
    })
  },

  selectDependency: (depId) => {
    set({ selectedDependencyId: depId, selectedTaskIds: [] })
  },

  clearSelection: () => {
    set({ selectedTaskIds: [], selectedDependencyId: null })
  },

  setCanvasMode: (mode) => {
    set({ canvasMode: mode, connectSourceId: null })
  },

  setCanvasScale: (scale) => {
    set({ canvasScale: Math.max(0.1, Math.min(3, scale)) })
  },

  setCanvasPosition: (position) => {
    set({ canvasPosition: position })
  },

  setCanvasMetrics: (m) => {
    const prev = get()
    // 変化がないときは再セットしない（無駄な再描画を防ぐ）
    if (
      prev.canvasContentSize.width === m.content.width &&
      prev.canvasContentSize.height === m.content.height &&
      prev.canvasViewport.width === m.viewport.width &&
      prev.canvasViewport.height === m.viewport.height
    ) return
    set({ canvasContentSize: m.content, canvasViewport: m.viewport })
  },

  resetCanvasPosition: () => {
    set({ canvasPosition: { x: 0, y: 0 } })
  },

  setConnectSource: (taskId) => {
    set({ connectSourceId: taskId })
  },

  setViewMode: (mode) => {
    set({ viewMode: mode })
  },

  toggleBugakariPanel: () => {
    set(state => ({ showBugakariPanel: !state.showBugakariPanel }))
  },

  togglePropertiesPanel: () => {
    set(state => ({ showPropertiesPanel: !state.showPropertiesPanel }))
  },

  toggleProjectSettingsDialog: () => {
    set(state => ({ showProjectSettingsDialog: !state.showProjectSettingsDialog }))
  },

  toggleSCurve: () => {
    set(state => ({ showSCurve: !state.showSCurve }))
  },

  toggleProgressOffsetLabels: () => {
    set(state => ({ showProgressOffsetLabels: !state.showProgressOffsetLabels }))
  },

  openDialog: (type, data) => {
    set({ activeDialog: type, dialogData: data })
  },

  closeDialog: () => {
    set({ activeDialog: null, dialogData: null })
  },
}))
