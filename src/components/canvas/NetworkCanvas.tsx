/**
 * ADM形式のネットワーク工程表キャンバス
 * 日本の建設現場向け：
 * - 左側：1〜5段の設定可能な階層ラベル
 * - 上部：カレンダー日付ヘッダー
 * - メイン：日付×行のグリッドにネットワーク図
 */

import { useRef, useCallback, useMemo, useEffect, useState } from 'react'
import { Stage, Layer, Line, Rect, Text, Group, Circle } from 'react-konva'
import type Konva from 'konva'
import { CalendarDays } from 'lucide-react'
import { useADMStore } from '@/stores/admStore'
import { useUIStore } from '@/stores/uiStore'
import type { Building } from '@/types/adm'
import { useCalendarStore } from '@/stores/calendarStore'
import { usePrintStore } from '@/stores/printStore'
import { PAPER_SIZES } from '@/types/print'
import { useTextBoxStore } from '@/stores/textboxStore'
import { TextBoxNode } from './TextBoxNode'
import { EventNodeShape, NODE_RADIUS } from './EventNodeShape'
import type { SemiCircleDirection } from './EventNodeShape'
import { ActivityArrow } from './ActivityArrow'
import { ProgressLineLayer } from './ProgressLineLayer'
import { SCurveOverlay } from './SCurveOverlay'
import { CanvasScrollbars } from './CanvasScrollbars'
import { calcPlannedCurve, calcActualCurve } from '@/utils/progressCalc'
import type { Activity } from '@/types/adm'
import {
  isWeekend as isWeekendUtil,
  isNonWorkday as isNonWorkdayUtil,
  getNonWorkdayRanges as getNonWorkdayRangesUtil,
  getCalendarDaysForWorkdays as getCalendarDaysForWorkdaysUtil,
  getWorkdaysBetween as getWorkdaysBetweenUtil,
  xToDate,
  computeViewStartDate,
} from '@/utils/dateUtils'
// ActivityEditDialog は削除（プロパティパネルで編集）

interface NetworkCanvasProps {
  width: number
  height: number
}

// レイアウト設定
const NAV_HEIGHT = 36 // ナビゲーションバーの高さ
const HEADER_HEIGHT = 50 // カレンダーヘッダーの高さ
const DEFAULT_ROW_HEIGHT = 40 // 行の高さデフォルト
const DAY_WIDTH = 30 // 1日あたりの幅

// 色設定
const HEADER_BG = '#F3F4F6' // gray-100
const GRID_COLOR = '#E5E7EB' // gray-200
const NON_WORKDAY_BG = '#F3F4F6' // gray-100 (土日祝のハッチング)

export function NetworkCanvas({ width, height }: NetworkCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)

  // ADMストア
  const nodesMap = useADMStore((state) => state.nodes)
  const activitiesMap = useADMStore((state) => state.activities)
  const criticalPath = useADMStore((state) => state.criticalPath)
  const projectSettings = useADMStore((state) => state.projectSettings)
  const updateProjectSettings = useADMStore((state) => state.updateProjectSettings)
  const selectedNodeId = useADMStore((state) => state.selectedNodeId)
  const selectedActivityId = useADMStore((state) => state.selectedActivityId)
  const selectedNodeIds = useADMStore((state) => state.selectedNodeIds)
  const selectedActivityIds = useADMStore((state) => state.selectedActivityIds)
  const editMode = useADMStore((state) => state.editMode)
  const setEditMode = useADMStore((state) => state.setEditMode)
  const lastSelectSubMode = useADMStore((state) => state.lastSelectSubMode)
  const lastDrawSubMode = useADMStore((state) => state.lastDrawSubMode)
  const activityStartNodeId = useADMStore((state) => state.activityStartNodeId)
  const getHierarchyRows = useADMStore((state) => state.getHierarchyRows)
  const getBuildingsArray = useADMStore((state) => state.getBuildingsArray)

  // テキストボックス
  const textboxesMap = useTextBoxStore((state) => state.textboxes)
  const addTextBox = useTextBoxStore((state) => state.addTextBox)
  const updateTextBox = useTextBoxStore((state) => state.updateTextBox)
  const deleteTextBox = useTextBoxStore((state) => state.deleteTextBox)
  const selectedTextBoxId = useTextBoxStore((state) => state.selectedTextBoxId)
  const selectTextBox = useTextBoxStore((state) => state.selectTextBox)

  // 棟セレクターが有効かどうか
  const showBuildingSelector = projectSettings.showBuildingSelector ?? false
  const buildings = getBuildingsArray()

  // 既存プロジェクトにbuilding列がなければ自動補完
  useEffect(() => {
    if (!projectSettings.headerColumns.some(col => col.type === 'building')) {
      const minOrder = Math.min(...projectSettings.headerColumns.map(c => c.order), 0)
      updateProjectSettings({
        headerColumns: [
          { id: 'col-building', type: 'building', label: '棟', width: 50, order: minOrder - 1, visible: false },
          ...projectSettings.headerColumns,
        ],
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 表示可能なヘッダー列を取得（棟セレクターON時はbuilding列を除外）
  const visibleColumns = useMemo(() => {
    return projectSettings.headerColumns
      .filter((col) => col.visible)
      .filter((col) => !(showBuildingSelector && col.type === 'building'))
      .sort((a, b) => a.order - b.order)
  }, [projectSettings.headerColumns, showBuildingSelector])

  // ヘッダーパネルの幅を可視列から計算（ズーム適用前）+ ハンドル列幅(20px)
  const HANDLE_COLUMN_WIDTH = 20
  const baseHeaderPanelWidth = useMemo(() => {
    return visibleColumns.reduce((sum, col) => sum + col.width, 0) + HANDLE_COLUMN_WIDTH
  }, [visibleColumns])

  const addNode = useADMStore((state) => state.addNode)
  const moveNode = useADMStore((state) => state.moveNode)
  const mergeNodes = useADMStore((state) => state.mergeNodes)
  const deleteNode = useADMStore((state) => state.deleteNode)
  const selectNode = useADMStore((state) => state.selectNode)
  const addActivity = useADMStore((state) => state.addActivity)
  const deleteActivity = useADMStore((state) => state.deleteActivity)
  const updateActivity = useADMStore((state) => state.updateActivity)
  const selectActivity = useADMStore((state) => state.selectActivity)
  const clearSelection = useADMStore((state) => state.clearSelection)
  const selectAll = useADMStore((state) => state.selectAll)
  const setActivityStartNode = useADMStore((state) => state.setActivityStartNode)
  const getNode = useADMStore((state) => state.getNode)
  const getActivity = useADMStore((state) => state.getActivity)
  const getActivitiesFromNode = useADMStore((state) => state.getActivitiesFromNode)
  const getActivitiesToNode = useADMStore((state) => state.getActivitiesToNode)

  const recalculateCPM = useADMStore((state) => state.recalculateCPM)
  const markDirty = useADMStore((state) => state.markDirty)
  const undo = useADMStore((state) => state.undo)
  const redo = useADMStore((state) => state.redo)
  const canUndo = useADMStore((state) => state.canUndo)
  const canRedo = useADMStore((state) => state.canRedo)
  const beginBatch = useADMStore((state) => state.beginBatch)
  const endBatch = useADMStore((state) => state.endBatch)
  const isBatchOpen = useADMStore((state) => state.isBatchOpen)
  const selectActivities = useADMStore((state) => state.selectActivities)
  const getAffectedChain = useADMStore((state) => state.getAffectedChain)
  const getShiftRange = useADMStore((state) => state.getShiftRange)
  const shiftActivityWithFloat = useADMStore((state) => state.shiftActivityWithFloat)
  const progressLines = useADMStore((state) => state.progressLines)
  const activeProgressLineId = useADMStore((state) => state.activeProgressLineId)
  const setProgressBaseDate = useADMStore((state) => state.setProgressBaseDate)
  const setProgressPoint = useADMStore((state) => state.setProgressPoint)
  const projectDuration = useADMStore((state) => state.projectDuration)

  // S字カーブ
  const showSCurve = useUIStore((state) => state.showSCurve)
  const showProgressOffsetLabels = useUIStore((state) => state.showProgressOffsetLabels)

  // 階層操作
  const addZone = useADMStore((state) => state.addZone)
  const updateZone = useADMStore((state) => state.updateZone)
  const addRoom = useADMStore((state) => state.addRoom)
  const updateRoom = useADMStore((state) => state.updateRoom)
  const addDetailCategory = useADMStore((state) => state.addDetailCategory)
  const updateDetailCategory = useADMStore((state) => state.updateDetailCategory)
  const deleteDetailCategory = useADMStore((state) => state.deleteDetailCategory)
  const zones = useADMStore((state) => state.zones)
  const rooms = useADMStore((state) => state.rooms)
  const detailCategories = useADMStore((state) => state.detailCategories)

  // マスタ操作
  const getMasterItems = useADMStore((state) => state.getMasterItems)
  const addMasterItem = useADMStore((state) => state.addMasterItem)

  // カスタム列操作
  const getCustomMasterItems = useADMStore((state) => state.getCustomMasterItems)
  const addCustomMasterItem = useADMStore((state) => state.addCustomMasterItem)
  const getCustomColumnValue = useADMStore((state) => state.getCustomColumnValue)
  const setCustomColumnValue = useADMStore((state) => state.setCustomColumnValue)

  // 行ヘッダー編集状態
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number
    columnType: string
    columnId?: string
    value: string
    cellRect?: { left: number; top: number; width: number; height: number }
  } | null>(null)
  const [rowActionMenu, setRowActionMenu] = useState<{
    x: number
    y: number
    rowIndex: number
  } | null>(null)
  const [hoverRowGap, setHoverRowGap] = useState<number | null>(null) // 行間ホバー位置
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null)
  const [newItemName, setNewItemName] = useState('')

  // ゴーストプレビュー用
  const [ghostPosition, setGhostPosition] = useState<{x: number, y: number} | null>(null)
  const [tbDragGhost, setTbDragGhost] = useState<{x: number, y: number} | null>(null)
  // テキストモード: 書字方向（横書き/縦書き）
  const [textModeVertical, setTextModeVertical] = useState(false)
  // 進捗線モード: ホバー中の行インデックス（ゴーストプレビュー用）
  const [progressHoverRow, setProgressHoverRow] = useState<number | null>(null)

  // ドラッグ中のノード位置（パス追従用）
  const [draggedNodePos, setDraggedNodePos] = useState<{nodeId: string, x: number, y: number} | null>(null)

  // フロート移動: ドラッグ追跡はrefで（再レンダー不要）、ハイライト表示はstateで
  const floatDragRef = useRef<{
    activityId: string
    startClientX: number
    maxRightDays: number
    maxLeftDays: number
    isChainMove: boolean
  } | null>(null)
  const [chainHighlightIds, setChainHighlightIds] = useState<string[]>([])
  const [floatDragDeltaDays, setFloatDragDeltaDays] = useState<number>(0) // ゴーストプレビュー用ドラッグ日数（負=左）

  // UIストア
  const canvasScale = useUIStore((state) => state.canvasScale)
  const canvasPosition = useUIStore((state) => state.canvasPosition)
  const setCanvasScale = useUIStore((state) => state.setCanvasScale)
  const setCanvasPosition = useUIStore((state) => state.setCanvasPosition)
  const resetCanvasPosition = useUIStore((state) => state.resetCanvasPosition)
  const setCanvasMetrics = useUIStore((state) => state.setCanvasMetrics)
  const setCaptureCanvas = useUIStore((state) => state.setCaptureCanvas)
  const currentPage = useUIStore((state) => state.currentPage)
  const setCurrentPage = useUIStore((state) => state.setCurrentPage)
  const selectedBuildingId = useUIStore((state) => state.selectedBuildingId)
  const setSelectedBuildingId = useUIStore((state) => state.setSelectedBuildingId)

  // カレンダーストア
  const calendar = useCalendarStore((state) => state.calendar)
  const addHoliday = useCalendarStore((state) => state.addHoliday)
  const removeHoliday = useCalendarStore((state) => state.removeHoliday)
  const updateHoliday = useCalendarStore((state) => state.updateHoliday)
  const printSettings = usePrintStore((state) => state.settings)

  // 配列に変換
  const nodes = useMemo(() => Array.from(nodesMap.values()), [nodesMap])
  // クリティカルパスのアクティビティを最後（最前面）に描画するためソート
  const activities = useMemo(() => {
    const arr = Array.from(activitiesMap.values())
    arr.sort((a, b) => (a.isCritical === b.isCritical ? 0 : a.isCritical ? 1 : -1))
    return arr
  }, [activitiesMap])
  // クリティカルパス上のノードを最前面に描画するためソート
  const sortedNodes = useMemo(() => {
    const criticalNodeIds = new Set<string>()
    for (const a of activities) {
      if (a.isCritical) {
        criticalNodeIds.add(a.fromNodeId)
        criticalNodeIds.add(a.toNodeId)
      }
    }
    return [...nodes].sort((a, b) => {
      const ac = criticalNodeIds.has(a.id) ? 1 : 0
      const bc = criticalNodeIds.has(b.id) ? 1 : 0
      return ac - bc
    })
  }, [nodes, activities])
  const textboxes = useMemo(() => Array.from(textboxesMap.values()), [textboxesMap])
  const allHierarchyRows = getHierarchyRows()
  const hierarchyRows = useMemo(() => {
    if (!showBuildingSelector || !selectedBuildingId) return allHierarchyRows
    return allHierarchyRows.filter(row => row.buildingId === selectedBuildingId)
  }, [allHierarchyRows, showBuildingSelector, selectedBuildingId])

  // 行の高さ（projectSettingsから取得）
  const ROW_HEIGHT = projectSettings.rowHeight || DEFAULT_ROW_HEIGHT

  // エッジの曲がり角R
  const edgeCornerRadius = projectSettings.defaultActivityDisplay.edgeCornerRadius ?? projectSettings.edgeCornerRadius

  // 空プロジェクトの場合はカレンダーのみ初期化
  useEffect(() => {
    if (nodes.length === 0 && hierarchyRows.length === 0) {
      // サンプルデータは自動ロードしない（デモページで明示的にロード）
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ズーム適用後のヘッダーパネル幅
  const headerPanelWidth = baseHeaderPanelWidth * canvasScale

  // キャンバスサイズ計算
  const canvasWidth = width - headerPanelWidth
  const canvasHeight = height - HEADER_HEIGHT - NAV_HEIGHT
  const totalDays = projectSettings.displayDays
  const rowsPerPage = projectSettings.displayRows || 20
  const allRows = Math.max(hierarchyRows.length, rowsPerPage)
  const totalPages = Math.ceil(allRows / rowsPerPage)
  const pageStartRow = currentPage * rowsPerPage
  const pageEndRow = Math.min(pageStartRow + rowsPerPage, allRows)
  const totalRows = rowsPerPage // 常にrowsPerPage行分の高さを確保

  // ページ範囲の自動補正
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1)
    }
  }, [currentPage, totalPages, setCurrentPage])

  // 表示開始位置
  const viewStartOffset = projectSettings.viewStartOffset || 0
  const weekStartDay = projectSettings.weekStartDay ?? 1 // デフォルト月曜始まり
  const displayMode = projectSettings.displayMode

  // 開始日から日付を生成（viewStartOffsetと表示モードを考慮）
  const startDate = new Date(projectSettings.startDate)
  const viewStartDate = useMemo(() => {
    return computeViewStartDate(projectSettings)
  }, [startDate, viewStartOffset, displayMode, weekStartDay])

  // viewStartDateベースの実日数オフセット（表示モード調整込み）
  const viewStartDayOffset = useMemo(() => {
    const s = new Date(projectSettings.startDate)
    const diffMs = viewStartDate.getTime() - s.getTime()
    return Math.round(diffMs / (1000 * 60 * 60 * 24))
  }, [viewStartDate, projectSettings.startDate])

  // 表示日数を計算（月次表示の場合はその月の日数を使用）
  const effectiveTotalDays = useMemo(() => {
    if (displayMode === 'monthly') {
      // その月の日数を計算
      const year = viewStartDate.getFullYear()
      const month = viewStartDate.getMonth()
      // 翌月の0日目 = 今月の最終日
      return new Date(year, month + 1, 0).getDate()
    }
    return totalDays
  }, [displayMode, viewStartDate, totalDays])

  // スクロールバー用にコンテンツ範囲とビューポート実寸を uiStore へ publish
  // viewport は Stage の実寸（行ヘッダーパネル・ナビバーを除いた領域）を渡すこと
  useEffect(() => {
    setCanvasMetrics({
      content: { width: effectiveTotalDays * DAY_WIDTH, height: totalRows * ROW_HEIGHT },
      viewport: { width: canvasWidth, height: height - NAV_HEIGHT },
    })
  }, [setCanvasMetrics, effectiveTotalDays, totalRows, ROW_HEIGHT, canvasWidth, height])

  // 印刷ページ境界の行位置を計算
  const printPageBreakRows = useMemo(() => {
    const rowHeaderWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0)
    const svgW = rowHeaderWidth + effectiveTotalDays * DAY_WIDTH
    const paperKey = (projectSettings.paperSize === 'custom' ? 'A3' : projectSettings.paperSize) as 'A4' | 'A3' | 'A2' | 'A1'
    const basePaper = PAPER_SIZES[paperKey]
    const [pw, ph] = projectSettings.paperOrientation === 'landscape'
      ? [basePaper.height, basePaper.width] : [basePaper.width, basePaper.height]
    const { margin, layout } = printSettings
    const contentWMm = pw - margin.left - margin.right
    const contentHMm = ph - margin.top - margin.bottom - layout.headerHeight - layout.footerHeight
    const svgHLimit = contentHMm * svgW / contentWMm
    const printRows = Math.max(1, Math.floor((svgHLimit - 50) / ROW_HEIGHT)) // HEADER_HEIGHT=50
    // 現在のキャンバスページ内に見えるページ境界のY座標を返す
    const breaks: number[] = []
    for (let row = printRows; row < allRows; row += printRows) {
      if (row > pageStartRow && row < pageEndRow) {
        breaks.push((row - pageStartRow) * ROW_HEIGHT)
      }
    }
    return breaks
  }, [visibleColumns, effectiveTotalDays, projectSettings, printSettings, allRows, pageStartRow, pageEndRow])

  // キャンバスキャプチャ関数を登録（印刷用）
  // コンテンツ範囲のみをキャプチャ（ビューポート余白を除外）
  useEffect(() => {
    setCaptureCanvas(() => {
      const stage = stageRef.current
      if (!stage) return null

      const mainLayer = stage.getLayers()[1] // メインキャンバスレイヤー
      const contentGroup = mainLayer?.children?.[0] as Konva.Group | undefined
      if (!mainLayer || !contentGroup) {
        const fallbackImage = stage.toDataURL({ pixelRatio: 2 })
        return {
          imageData: fallbackImage,
          viewStartDate: viewStartDate.toISOString().split('T')[0],
          effectiveTotalDays,
          totalRows,
        }
      }

      // 現在の状態を保存
      const saved = {
        clipW: mainLayer.clipWidth(),
        clipH: mainLayer.clipHeight(),
        x: contentGroup.x(),
        y: contentGroup.y(),
        sx: contentGroup.scaleX(),
        sy: contentGroup.scaleY(),
      }

      // コンテンツ全体をキャプチャするために一時変更
      const fullW = effectiveTotalDays * DAY_WIDTH
      const fullH = totalRows * ROW_HEIGHT
      mainLayer.clipWidth(fullW)
      mainLayer.clipHeight(fullH)
      contentGroup.x(0)
      contentGroup.y(0)
      contentGroup.scaleX(1)
      contentGroup.scaleY(1)
      mainLayer.draw()

      const dataURL = mainLayer.toDataURL({
        x: 0, y: 0, width: fullW, height: fullH, pixelRatio: 2,
      })

      // 復元
      mainLayer.clipWidth(saved.clipW)
      mainLayer.clipHeight(saved.clipH)
      contentGroup.x(saved.x)
      contentGroup.y(saved.y)
      contentGroup.scaleX(saved.sx)
      contentGroup.scaleY(saved.sy)
      mainLayer.draw()

      return {
        imageData: dataURL,
        viewStartDate: viewStartDate.toISOString().split('T')[0],
        effectiveTotalDays,
        totalRows,
      }
    })
    return () => setCaptureCanvas(null)
  }, [setCaptureCanvas, effectiveTotalDays, totalRows, viewStartDate, pageStartRow])

  const dates = useMemo(() => {
    const result: Date[] = []
    for (let i = 0; i < effectiveTotalDays; i++) {
      const date = new Date(viewStartDate)
      date.setDate(date.getDate() + i)
      result.push(date)
    }
    return result
  }, [viewStartDate, effectiveTotalDays])

  // 表示期間の終了日
  const viewEndDate = useMemo(() => {
    if (dates.length === 0) return viewStartDate
    return dates[dates.length - 1]
  }, [dates, viewStartDate])

  // ナビゲーション関数（表示モードに応じた移動量）
  const navigatePrev = useCallback(() => {
    let offset: number
    if (displayMode === 'weekly2' || displayMode === 'weekly3') {
      offset = 7 // 週次: 1週間ずつ移動
    } else if (displayMode === 'monthly') {
      // 月次: 前月の1日へ移動
      const current = new Date(startDate)
      current.setDate(current.getDate() + viewStartOffset)
      current.setDate(1) // 今月の1日
      current.setMonth(current.getMonth() - 1) // 前月の1日
      const diffDays = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      updateProjectSettings({ viewStartOffset: diffDays })
      return
    } else {
      offset = effectiveTotalDays
    }
    const newOffset = viewStartOffset - offset
    updateProjectSettings({ viewStartOffset: newOffset })
  }, [viewStartOffset, effectiveTotalDays, displayMode, startDate, updateProjectSettings])

  const navigateNext = useCallback(() => {
    let offset: number
    if (displayMode === 'weekly2' || displayMode === 'weekly3') {
      offset = 7 // 週次: 1週間ずつ移動
    } else if (displayMode === 'monthly') {
      // 月次: 翌月の1日へ移動
      const current = new Date(startDate)
      current.setDate(current.getDate() + viewStartOffset)
      current.setDate(1) // 今月の1日
      current.setMonth(current.getMonth() + 1) // 翌月の1日
      const diffDays = Math.floor((current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      updateProjectSettings({ viewStartOffset: diffDays })
      return
    } else {
      offset = effectiveTotalDays
    }
    const newOffset = viewStartOffset + offset
    updateProjectSettings({ viewStartOffset: newOffset })
  }, [viewStartOffset, effectiveTotalDays, displayMode, startDate, updateProjectSettings])

  const navigateToStart = useCallback(() => {
    updateProjectSettings({ viewStartOffset: 0 })
  }, [updateProjectSettings])

  const navigateToEnd = useCallback(() => {
    const maxOffset = Math.max(0, projectSettings.totalProjectDays - effectiveTotalDays)
    updateProjectSettings({ viewStartOffset: maxOffset })
  }, [projectSettings.totalProjectDays, effectiveTotalDays, updateProjectSettings])

  const navigateToToday = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const projStart = new Date(projectSettings.startDate)
    projStart.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today.getTime() - projStart.getTime()) / (1000 * 60 * 60 * 24))

    if (displayMode === 'weekly2') {
      // 2週モード: 今日が初週に入る offset
      updateProjectSettings({ viewStartOffset: diffDays })
    } else if (displayMode === 'weekly3') {
      // 3週モード: 今日が中央週に入る offset
      updateProjectSettings({ viewStartOffset: diffDays - 7 })
    } else if (displayMode === 'monthly') {
      // 月次モード: 今日の月の1日
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthOffset = Math.floor((firstOfMonth.getTime() - projStart.getTime()) / (1000 * 60 * 60 * 24))
      updateProjectSettings({ viewStartOffset: monthOffset })
    } else {
      updateProjectSettings({ viewStartOffset: diffDays })
    }
  }, [projectSettings.startDate, displayMode, updateProjectSettings])

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力フォーカスがある場合は一部のキーを無視
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'

      // テキストモード中のスペースキー: 書字方向トグル
      if (editMode === 'text' && e.key === ' ' && !isInputFocused) {
        e.preventDefault()
        setTextModeVertical(v => !v)
        return
      }

      // 描画系グループ内でSpaceキー: draw ↔ banner 切替
      if ((editMode === 'draw' || editMode === 'banner') && e.key === ' ' && !isInputFocused) {
        e.preventDefault()
        setEditMode(editMode === 'draw' ? 'banner' : 'draw')
        return
      }

      // テキストボックス選択中は文字キーをPropertiesPanelに通す
      if (selectedTextBoxId && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key !== 'Escape' && e.key !== 'Delete' && e.key !== 'Backspace'
            && e.key !== 'PageUp' && e.key !== 'PageDown'
            && e.key !== 'Home' && e.key !== 'End') {
          return
        }
      }

      // Escキーで選択解除
      if (e.key === 'Escape') {
        if (isBatchOpen()) endBatch() // 開いているバッチを閉じる
        clearSelection()
        selectTextBox(null)
        setActivityStartNode(null)
        return
      }

      // Undo: Ctrl+Z
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) undo()
        return
      }

      // Redo: Ctrl+Y または Ctrl+Shift+Z
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault()
        if (canRedo) redo()
        return
      }

      // 全選択: Ctrl+A
      if (e.ctrlKey && (e.key === 'a' || e.key === 'A') && !e.shiftKey) {
        e.preventDefault()
        selectAll()
        return
      }

      // Ctrl+= or Ctrl+; で拡大
      if (e.ctrlKey && (e.key === '=' || e.key === ';')) {
        e.preventDefault()
        const newScale = Math.min(canvasScale * 1.2, 3)
        setCanvasScale(newScale)
        return
      }

      // Ctrl+- で縮小
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault()
        const newScale = Math.max(canvasScale / 1.2, 0.1)
        setCanvasScale(newScale)
        return
      }

      // Ctrl+0 でリセット
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault()
        setCanvasScale(1)
        resetCanvasPosition()
        return
      }

      // ナビゲーション: Ctrl+←/→ で日付移動、PageUp/PageDown でページ切り替え
      if (!isInputFocused) {
        if (e.ctrlKey && e.key === 'ArrowLeft') {
          e.preventDefault()
          navigatePrev()
          return
        }
        if (e.ctrlKey && e.key === 'ArrowRight') {
          e.preventDefault()
          navigateNext()
          return
        }
        if (e.key === 'PageUp') {
          e.preventDefault()
          setCurrentPage(Math.max(0, currentPage - 1))
          return
        }
        if (e.key === 'PageDown') {
          e.preventDefault()
          setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
          return
        }
        // Home/End で開始日/終了日に移動
        if (e.key === 'Home') {
          e.preventDefault()
          navigateToStart()
          return
        }
        if (e.key === 'End') {
          e.preventDefault()
          navigateToEnd()
          return
        }
      }

      // Delete/Backspaceキーで選択中の要素を削除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInputFocused) return

        e.preventDefault()

        if (selectedTextBoxId) {
          deleteTextBox(selectedTextBoxId)
        } else if (selectedActivityId) {
          // 作業が選択されている場合
          const activity = getActivity(selectedActivityId)
          if (activity) {
            const fromNodeId = activity.fromNodeId
            const toNodeId = activity.toNodeId

            beginBatch()
            // 作業を削除
            deleteActivity(selectedActivityId)

            // 終点ノードの孤立チェック
            const toFrom = getActivitiesFromNode(toNodeId)
            const toTo = getActivitiesToNode(toNodeId)
            if (toFrom.length === 0 && toTo.length === 0) deleteNode(toNodeId)

            // 始点ノードの孤立チェック
            const fromFrom = getActivitiesFromNode(fromNodeId)
            const fromTo = getActivitiesToNode(fromNodeId)
            if (fromFrom.length === 0 && fromTo.length === 0) deleteNode(fromNodeId)
            endBatch()
          }
        } else if (selectedNodeId) {
          // ノードが選択されている場合
          deleteNode(selectedNodeId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [clearSelection, setActivityStartNode, selectedNodeId, selectedActivityId, selectedTextBoxId, deleteNode, deleteActivity, deleteTextBox, selectTextBox, getActivity, getActivitiesFromNode, getActivitiesToNode, navigatePrev, navigateNext, navigateToStart, navigateToEnd, undo, redo, canUndo, canRedo, selectAll, canvasScale, setCanvasScale, resetCanvasPosition, isBatchOpen, beginBatch, endBatch, currentPage, setCurrentPage, totalPages, editMode])

  // ホイールでスクロール / Shift+ホイールで横スクロール
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()

      if (e.evt.shiftKey) {
        // Shift+ホイール: 横方向のみスクロール
        // WindowsではShift+WheelでdeltaXに値が入る場合があるため両方チェック
        const scrollAmount = (e.evt.deltaX !== 0 ? e.evt.deltaX : e.evt.deltaY) * 0.5
        const newX = Math.max(0, canvasPosition.x + scrollAmount)
        setCanvasPosition({ ...canvasPosition, x: newX })
      } else {
        // 通常ホイール: 縦スクロール
        const scrollAmount = e.evt.deltaY * 0.5
        const newY = Math.max(0, canvasPosition.y + scrollAmount)
        setCanvasPosition({ ...canvasPosition, y: newY })
      }
    },
    [canvasPosition, setCanvasPosition]
  )

  // タッチ操作: ピンチズーム / パン / タップ選択 / ドラッグ移動
  const touchRef = useRef<{
    mode: 'none' | 'pinch' | 'pan' | 'drag'
    startTouches: { x: number; y: number }[]
    startDist: number
    startScale: number
    startPos: { x: number; y: number }
    startTime: number
    totalMovement: number
  }>({
    mode: 'none',
    startTouches: [],
    startDist: 0,
    startScale: 1,
    startPos: { x: 0, y: 0 },
    startTime: 0,
    totalMovement: 0,
  })

  const getTouchDist = (t1: Touch, t2: Touch) =>
    Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2)

  const handleTouchStart = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches
      const t = touchRef.current
      t.startTime = Date.now()
      t.totalMovement = 0
      t.startPos = { x: canvasPosition.x, y: canvasPosition.y }
      t.startScale = canvasScale

      if (touches.length >= 2) {
        // ピンチモード
        t.mode = 'pinch'
        t.startDist = getTouchDist(touches[0], touches[1])
        t.startTouches = [
          { x: touches[0].clientX, y: touches[0].clientY },
          { x: touches[1].clientX, y: touches[1].clientY },
        ]
        e.evt.preventDefault()
      } else if (touches.length === 1) {
        // ノード上かどうかはKonvaのtarget判定で区別
        const target = e.target
        const isOnNode = target !== e.currentTarget && target.getParent()?.name() !== 'background'
        t.mode = isOnNode ? 'drag' : 'pan'
        t.startTouches = [{ x: touches[0].clientX, y: touches[0].clientY }]
        if (t.mode === 'pan') e.evt.preventDefault()
      }
    },
    [canvasPosition, canvasScale]
  )

  const handleTouchMove = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      const touches = e.evt.touches
      const t = touchRef.current

      // フロートドラッグ中（タッチ）
      if (floatDragRef.current && touches.length === 1) {
        e.evt.preventDefault()
        const deltaX = touches[0].clientX - floatDragRef.current.startClientX
        const rawDays = Math.round(deltaX / (DAY_WIDTH * canvasScale))
        const clampedDays = Math.max(-floatDragRef.current.maxLeftDays,
          Math.min(rawDays, floatDragRef.current.maxRightDays))
        setFloatDragDeltaDays(clampedDays)
        return
      }

      if (t.mode === 'pinch' && touches.length >= 2) {
        e.evt.preventDefault()
        const newDist = getTouchDist(touches[0], touches[1])
        const ratio = newDist / t.startDist
        const newScale = Math.max(0.1, Math.min(3, t.startScale * ratio))
        setCanvasScale(newScale)

        // 中心点基準でパン補正
        const cx = (t.startTouches[0].x + t.startTouches[1].x) / 2
        const cy = (t.startTouches[0].y + t.startTouches[1].y) / 2
        const ncx = (touches[0].clientX + touches[1].clientX) / 2
        const ncy = (touches[0].clientY + touches[1].clientY) / 2
        const dx = (cx - ncx) / newScale
        const dy = (cy - ncy) / newScale
        setCanvasPosition({
          x: Math.max(0, t.startPos.x + dx),
          y: Math.max(0, t.startPos.y + dy),
        })
      } else if (t.mode === 'pan' && touches.length === 1) {
        e.evt.preventDefault()
        const dx = t.startTouches[0].x - touches[0].clientX
        const dy = t.startTouches[0].y - touches[0].clientY
        t.totalMovement += Math.abs(dx - (canvasPosition.x - t.startPos.x) * canvasScale)
          + Math.abs(dy - (canvasPosition.y - t.startPos.y) * canvasScale)
        setCanvasPosition({
          x: Math.max(0, t.startPos.x + dx / canvasScale),
          y: Math.max(0, t.startPos.y + dy / canvasScale),
        })
      } else if (t.mode === 'drag' && touches.length === 1) {
        const dx = touches[0].clientX - t.startTouches[0].x
        const dy = touches[0].clientY - t.startTouches[0].y
        t.totalMovement += Math.sqrt(dx * dx + dy * dy)
        // ノードドラッグはKonvaのdraggable=trueが処理
      }
    },
    [canvasScale, canvasPosition, setCanvasScale, setCanvasPosition]
  )

  const handleTouchEnd = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      // フロートドラッグ完了（タッチ）
      if (floatDragRef.current) {
        const touch = e.evt.changedTouches[0]
        if (touch) {
          const deltaX = touch.clientX - floatDragRef.current.startClientX
          const rawDays = Math.round(deltaX / (DAY_WIDTH * canvasScale))
          const daysMoved = Math.max(-floatDragRef.current.maxLeftDays,
            Math.min(rawDays, floatDragRef.current.maxRightDays))

          if (daysMoved !== 0) {
            shiftActivityWithFloat(
              floatDragRef.current.activityId,
              daysMoved,
              floatDragRef.current.isChainMove,
            )
          }
        }
        floatDragRef.current = null
        setChainHighlightIds([])
        setFloatDragDeltaDays(0)
      }

      const t = touchRef.current
      t.mode = 'none'
    },
    [canvasScale, shiftActivityWithFloat]
  )

  // 右クリック: グループ間切替 / Shift+右クリック: グループ内サブモード切替
  const handleCanvasRightClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault() // コンテキストメニューを抑制

      // 描画モードの連続描画キャンセル
      if ((editMode === 'draw' || editMode === 'banner') && activityStartNodeId) {
        if (isBatchOpen()) endBatch()
        setActivityStartNode(null)
        setGhostPosition(null)
      }

      if (e.evt.ctrlKey) {
        // Ctrl+右クリック: 同グループ内サブモード切替
        if (editMode === 'select') setEditMode('pathSelect')
        else if (editMode === 'pathSelect') setEditMode('select')
        else if (editMode === 'draw') setEditMode('text')
        else if (editMode === 'text') setEditMode('draw')
        // banner モードではCtrl+右クリックでdrawに戻る
        else if (editMode === 'banner') setEditMode('draw')
      } else {
        // 右クリック: グループ間切替
        if (editMode === 'select' || editMode === 'pathSelect') {
          setEditMode(lastDrawSubMode)
        } else if (editMode === 'draw' || editMode === 'text' || editMode === 'banner') {
          setEditMode(lastSelectSubMode)
        } else if (editMode === 'progress') {
          setEditMode(lastSelectSubMode)
        }
      }
    },
    [editMode, activityStartNodeId, setActivityStartNode, setEditMode, lastSelectSubMode, lastDrawSubMode, isBatchOpen, endBatch]
  )

  // マウス移動（ゴーストプレビュー用 + フロートドラッグプレビュー）
  const handleCanvasMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // フロートドラッグ中: ゴーストプレビュー更新（左右両方向対応）
      if (floatDragRef.current) {
        const deltaX = e.evt.clientX - floatDragRef.current.startClientX
        const rawDays = Math.round(deltaX / (DAY_WIDTH * canvasScale))
        // 右: maxRightDays でクランプ、左: -maxLeftDays でクランプ
        const clampedDays = Math.max(-floatDragRef.current.maxLeftDays,
          Math.min(rawDays, floatDragRef.current.maxRightDays))
        setFloatDragDeltaDays(clampedDays)
        return
      }

      if (editMode !== 'draw' && editMode !== 'banner' && editMode !== 'text' && editMode !== 'progress') {
        if (ghostPosition) setGhostPosition(null)
        setProgressHoverRow(null)
        return
      }

      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const x = pointer.x / canvasScale + canvasPosition.x
      const y = (pointer.y - HEADER_HEIGHT) / canvasScale + canvasPosition.y

      const rowIndex = Math.floor(y / ROW_HEIGHT)
      const snappedY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2

      const dayIndex = Math.floor(x / DAY_WIDTH)
      // テキストモードは日付中央、描画モードはセル左端にスナップ
      const snappedX = editMode === 'text'
        ? (dayIndex + viewStartDayOffset) * DAY_WIDTH + DAY_WIDTH / 2
        : (dayIndex + viewStartDayOffset) * DAY_WIDTH

      setGhostPosition({ x: snappedX - viewStartDayOffset * DAY_WIDTH, y: snappedY })  // ゴーストは画面座標
      if (editMode === 'progress') {
        setProgressHoverRow(rowIndex + pageStartRow)
      }
    },
    [editMode, canvasScale, canvasPosition, viewStartDayOffset, ghostPosition]
  )

  // キャンバスクリック（ノード追加など）
  const handleCanvasClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // 右クリックは無視（右クリックはonContextMenuで処理）
      if (e.evt.button !== 0) return

      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      // キャンバス内の座標に変換（StageはヘッダーパネルとHEADER_HEIGHTの右下に配置されている）
      // pointerはStage相対座標なので、headerPanelWidthは不要
      const x = pointer.x / canvasScale + canvasPosition.x
      const y = (pointer.y - HEADER_HEIGHT) / canvasScale + canvasPosition.y

      // 行にスナップ（セルの中央に配置）+ ページオフセットをデータ空間に変換
      const rowIndex = Math.floor(y / ROW_HEIGHT)
      const snappedY = (rowIndex + pageStartRow) * ROW_HEIGHT + ROW_HEIGHT / 2

      // 日付にスナップ（セルの左端に配置）+ viewStartDayOffsetを考慮
      const dayIndex = Math.floor(x / DAY_WIDTH)
      const snappedX = (dayIndex + viewStartDayOffset) * DAY_WIDTH

      switch (editMode) {
        case 'draw':
        case 'banner':
          // 描画/バナーモード: クリックでノード追加、前のノードがあれば作業も追加
          {
            // 近くに既存ノードがあればそれを使う（スナップ座標で一致判定）
            const SNAP_THRESHOLD = NODE_RADIUS * 2
            let existingNodeId: string | null = null
            for (const node of nodes) {
              const dx = node.position.x - snappedX
              const dy = node.position.y - snappedY
              if (Math.sqrt(dx * dx + dy * dy) < SNAP_THRESHOLD) {
                existingNodeId = node.id
                break
              }
            }

            if (!activityStartNodeId) {
              // 新チェーンの最初のクリック: バッチ開始（閉じない）
              beginBatch()
              const nodeId = existingNodeId ?? addNode({ x: snappedX, y: snappedY })
              setActivityStartNode(nodeId)
            } else {
              // 2回目以降: 接続クリック
              if (!isBatchOpen()) beginBatch() // チェーン継続時は新バッチ開始
              const nodeId = existingNodeId ?? addNode({ x: snappedX, y: snappedY })
              if (nodeId === activityStartNodeId) break // 同一ノードなら何もしない
              const activityId = addActivity(activityStartNodeId, nodeId)
              if (activityId) {
                // バナーモードでは displayType を 'banner' に設定
                if (editMode === 'banner') {
                  updateActivity(activityId, {
                    displaySettings: {
                      ...getActivity(activityId)!.displaySettings,
                      displayType: 'banner',
                    },
                  })
                }
                selectActivity(activityId) // 作業を選択（プロパティパネルで編集可能に）
              }
              endBatch() // バッチ閉じ → 履歴に追加
              setActivityStartNode(nodeId) // 次の描画のために保持
            }
          }
          break

        case 'text':
          // テキストモード: クリック位置にテキストボックス配置（日付中央にスナップ）
          {
            const textSnappedX = (dayIndex + viewStartDayOffset) * DAY_WIDTH + DAY_WIDTH / 2
            const isVert = textModeVertical
            const tbId = addTextBox(
              { x: textSnappedX, y: snappedY },
              undefined,
              {
                writingDirection: isVert ? 'vertical' : 'horizontal',
                snapAnchorX: isVert ? 'center' : 'left',
                snapAnchorY: isVert ? 'top' : 'center',
                width: isVert ? 13 : 60,
                height: isVert ? 60 : 13,
              }
            )
            selectTextBox(tbId)
            clearSelection()
          }
          break

        case 'progress':
          // 進捗線モード: クリックで基準日設定 or 行の進捗位置を更新
          {
            const activePL = progressLines.find(pl => pl.id === activeProgressLineId)
            if (!activePL || !activePL.baseDate) {
              // 基準日未設定: この日付を基準日に設定
              const dateAtClick = xToDate(snappedX, new Date(projectSettings.startDate), DAY_WIDTH)
              const dateStr = `${dateAtClick.getFullYear()}-${String(dateAtClick.getMonth() + 1).padStart(2, '0')}-${String(dateAtClick.getDate()).padStart(2, '0')}`
              setProgressBaseDate(dateStr, snappedX, totalRows)
            } else {
              // 基準日設定済み: この行の進捗位置を更新
              const offsetDays = Math.round((snappedX - activePL.baseDateX) / DAY_WIDTH)
              const adjustedRowIndex = rowIndex + pageStartRow
              const detailId = hierarchyRows[adjustedRowIndex]?.detailId
              if (detailId) setProgressPoint(detailId, offsetDays)
            }
          }
          break

        case 'select':
        case 'pathSelect':
        default:
          // 選択モード: 空白クリックで選択解除
          clearSelection()
          selectTextBox(null)
          setActivityStartNode(null)
          setChainHighlightIds([])
          floatDragRef.current = null
          break
      }
    },
    [editMode, canvasScale, canvasPosition, viewStartDayOffset, addNode, clearSelection, setActivityStartNode, activityStartNodeId, addActivity, selectActivity, beginBatch, endBatch, isBatchOpen, addTextBox, selectTextBox, textModeVertical, progressLines, activeProgressLineId, setProgressBaseDate, setProgressPoint, projectSettings.startDate]
  )

  // パス選択モード: MouseDown on Activity → フロート移動ドラッグ開始
  const handleActivityMouseDown = useCallback(
    (activityId: string, modifiers: { ctrlKey: boolean; shiftKey: boolean; clientX: number }) => {
      if (editMode !== 'pathSelect') return

      const activity = getActivity(activityId)
      if (!activity) return

      // 移動可能範囲を取得（左右両方）
      const range = getShiftRange(activityId)
      if (range.maxLeft <= 0 && range.maxRight <= 0) return // 移動不可

      // pathSelectモード: Ctrl+左クリック → チェーン全体選択
      const isChain = modifiers.ctrlKey

      if (isChain) {
        const chainIds = getAffectedChain(activityId)
        selectActivities(chainIds)
        setChainHighlightIds(chainIds)
      } else {
        selectActivity(activityId)
        setChainHighlightIds([activityId])
      }

      // ドラッグ追跡開始
      floatDragRef.current = {
        activityId,
        startClientX: modifiers.clientX,
        maxRightDays: range.maxRight,
        maxLeftDays: range.maxLeft,
        isChainMove: isChain,
      }
      setFloatDragDeltaDays(0)
    },
    [editMode, getActivity, getAffectedChain, getShiftRange, selectActivities, selectActivity]
  )

  // Stage mouseUp → フロート移動ドラッグ完了（左右両方向対応）
  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!floatDragRef.current) return

      const deltaX = e.evt.clientX - floatDragRef.current.startClientX
      const rawDays = Math.round(deltaX / (DAY_WIDTH * canvasScale))
      const daysMoved = Math.max(-floatDragRef.current.maxLeftDays,
        Math.min(rawDays, floatDragRef.current.maxRightDays))

      if (daysMoved !== 0) {
        shiftActivityWithFloat(
          floatDragRef.current.activityId,
          daysMoved,
          floatDragRef.current.isChainMove,
        )
      }

      floatDragRef.current = null
      setChainHighlightIds([])
      setFloatDragDeltaDays(0)
    },
    [canvasScale, shiftActivityWithFloat]
  )

  // ノードクリック
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      // 進捗線モードではノード/パス上のクリックもステージクリックとして処理（透過）
      if (editMode === 'progress') return
      switch (editMode) {
        case 'draw':
        case 'banner':
          // 描画/バナーモード: 既存ノードクリックで作業を追加
          if (activityStartNodeId && activityStartNodeId !== nodeId) {
            if (!isBatchOpen()) beginBatch()
            const activityId = addActivity(activityStartNodeId, nodeId)
            if (activityId && editMode === 'banner') {
              updateActivity(activityId, {
                displaySettings: {
                  ...getActivity(activityId)!.displaySettings,
                  displayType: 'banner',
                },
              })
            }
            if (activityId) {
              selectActivity(activityId)
            }
            endBatch()
          }
          setActivityStartNode(nodeId) // 次の描画のために保持
          break

        case 'select':
        default:
          // 選択モード: ノードを選択
          selectNode(nodeId)
          selectTextBox(null)
          break
      }
    },
    [editMode, activityStartNodeId, setActivityStartNode, addActivity, selectNode, beginBatch, endBatch, isBatchOpen, selectActivity, selectTextBox]
  )

  // 作業クリック
  const handleActivityClick = useCallback(
    (activityId: string, _modifiers?: { ctrlKey: boolean; shiftKey: boolean }) => {
      // パス選択モードではonMouseDownで処理済み / 進捗線モードでは無効
      if (editMode === 'pathSelect' || editMode === 'progress') return

      switch (editMode) {
        case 'select':
        default:
          setChainHighlightIds([])
          selectActivity(activityId)
          selectTextBox(null)
          break
      }
    },
    [editMode, selectActivity, selectTextBox]
  )

  // ノードドラッグ
  const handleNodeDragEnd = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      // 近くに別のノードがあるか確認（マージ判定）
      const MERGE_THRESHOLD = NODE_RADIUS * 2 // マージする距離の閾値

      for (const node of nodes) {
        if (node.id === nodeId) continue

        const dx = position.x - node.position.x
        const dy = position.y - node.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < MERGE_THRESHOLD) {
          // 近くにノードがある場合はマージ
          mergeNodes(nodeId, node.id)
          recalculateCPM()
          return
        }
      }

      // 行にスナップ（最も近いセルの中央に強制配置）
      const rowIndex = Math.max(0, Math.round((position.y - ROW_HEIGHT / 2) / ROW_HEIGHT))
      const snappedY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2

      // 日付にスナップ（最も近いセルの左端に強制配置）
      const dayIndex = Math.max(0, Math.round(position.x / DAY_WIDTH))
      let snappedX = dayIndex * DAY_WIDTH
      // const dayIndex = Math.max(0, Math.round((position.x - DAY_WIDTH / 2) / DAY_WIDTH))  // セル中央スナップ（将来用）
      // let snappedX = dayIndex * DAY_WIDTH + DAY_WIDTH / 2  // セル中央スナップ（将来用）

      // 工数制約チェック: 非稼働日を考慮したカレンダー日数ベースの距離制約
      for (const activity of activities) {
        if (activity.fromNodeId === nodeId) {
          // このノードが開始点の場合、終了ノードより左に十分離れている必要がある
          const toNode = getNode(activity.toNodeId)
          if (toNode) {
            const calDays = getCalendarDaysForWorkdaysUtil(snappedX, activity.duration, startDate, DAY_WIDTH, calendar)
            const minDistance = calDays * DAY_WIDTH
            const maxAllowedX = toNode.position.x - minDistance
            if (snappedX > maxAllowedX) {
              snappedX = maxAllowedX
            }
          }
        }

        if (activity.toNodeId === nodeId) {
          // このノードが終了点の場合、開始ノードより右に十分離れている必要がある
          const fromNode = getNode(activity.fromNodeId)
          if (fromNode) {
            const calDays = getCalendarDaysForWorkdaysUtil(fromNode.position.x, activity.duration, startDate, DAY_WIDTH, calendar)
            const minDistance = calDays * DAY_WIDTH
            const minAllowedX = fromNode.position.x + minDistance
            if (snappedX < minAllowedX) {
              snappedX = minAllowedX
            }
          }
        }
      }

      // 再度日付にスナップ（左端）
      const correctedDayIndex = Math.round(snappedX / DAY_WIDTH)
      snappedX = correctedDayIndex * DAY_WIDTH
      // snappedX = correctedDayIndex * DAY_WIDTH + DAY_WIDTH / 2  // セル中央スナップ（将来用）

      moveNode(nodeId, { x: snappedX, y: snappedY })
      recalculateCPM()
    },
    [moveNode, mergeNodes, recalculateCPM, nodes, activities, getNode, startDate, calendar]
  )

  // クリティカルパス上のノードを判定
  const isNodeOnCriticalPath = useCallback(
    (nodeId: string) => {
      for (const activity of activities) {
        if (
          (activity.fromNodeId === nodeId || activity.toNodeId === nodeId) &&
          criticalPath.includes(activity.id)
        ) {
          return true
        }
      }
      return false
    },
    [activities, criticalPath]
  )

  // ノードがエッジ上に位置するかを判定し、半円表示の方向を返す
  // エッジがノードの円内を実際に通過する場合のみ検出
  const getNodeSemiCircleDirection = useCallback(
    (nodeId: string): SemiCircleDirection => {
      const node = getNode(nodeId)
      if (!node) return null

      const nodeX = node.position.x
      const nodeY = node.position.y

      // ノード自身の接続先を確認して、水平エッジ上の半円方向を決定
      const getHorizontalSemiDir = (): 'top' | 'bottom' => {
        for (const act of activities) {
          if (act.fromNodeId === nodeId) {
            const other = getNode(act.toNodeId)
            if (other && other.position.y > nodeY + 5) return 'bottom'
          }
          if (act.toNodeId === nodeId) {
            const other = getNode(act.fromNodeId)
            if (other && other.position.y > nodeY + 5) return 'bottom'
          }
        }
        return 'top'
      }

      const lineThreshold = 3
      const nodeInnerRadius = NODE_RADIUS - 2

      for (const activity of activities) {
        if (activity.fromNodeId === nodeId || activity.toNodeId === nodeId) continue
        if (activity.isDummy) continue

        const fromNode = getNode(activity.fromNodeId)
        const toNode = getNode(activity.toNodeId)
        if (!fromNode || !toNode) continue

        // アクティビティの実際のルーティング設定を使ってパスセグメントを計算
        const bendCount = activity.bendCount ?? 1
        const routingMode = activity.routingMode ?? 'vertical'
        const fx = fromNode.position.x
        const fy = fromNode.position.y
        const tx = toNode.position.x
        const ty = toNode.position.y
        const dx = tx - fx
        const dy = ty - fy

        let isHorizontalFirst: boolean
        switch (routingMode) {
          case 'horizontal': isHorizontalFirst = true; break
          case 'vertical': isHorizontalFirst = false; break
          default: isHorizontalFirst = Math.abs(dx) >= Math.abs(dy); break
        }

        // パスのポイント列を構築（ノード中心ベース）
        let pts: number[]
        if (bendCount === 0 || (dy === 0 && dx === 0)) {
          pts = [fx, fy, tx, ty]
        } else if (bendCount === 1) {
          if (dy === 0 || dx === 0) {
            pts = [fx, fy, tx, ty]
          } else if (isHorizontalFirst) {
            pts = [fx, fy, tx, fy, tx, ty]
          } else {
            pts = [fx, fy, fx, ty, tx, ty]
          }
        } else {
          // bendCount >= 2
          if (isHorizontalFirst) {
            if (dy === 0) { pts = [fx, fy, tx, ty] }
            else { const midX = fx + dx / 2; pts = [fx, fy, midX, fy, midX, ty, tx, ty] }
          } else {
            if (dx === 0) { pts = [fx, fy, tx, ty] }
            else { const midY = fy + dy / 2; pts = [fx, fy, fx, midY, tx, midY, tx, ty] }
          }
        }

        // パスの各セグメント上にノードが乗っているか判定
        for (let i = 0; i < pts.length - 2; i += 2) {
          const sx = pts[i], sy = pts[i + 1]
          const ex = pts[i + 2], ey = pts[i + 3]
          const segDx = ex - sx
          const segDy = ey - sy
          const isHoriz = Math.abs(segDy) < 1
          const isVert = Math.abs(segDx) < 1

          if (isHoriz) {
            if (
              Math.abs(nodeY - sy) < lineThreshold &&
              nodeX > Math.min(sx, ex) + nodeInnerRadius &&
              nodeX < Math.max(sx, ex) - nodeInnerRadius
            ) {
              return getHorizontalSemiDir()
            }
          } else if (isVert) {
            if (
              Math.abs(nodeX - sx) < lineThreshold &&
              nodeY > Math.min(sy, ey) + nodeInnerRadius &&
              nodeY < Math.max(sy, ey) - nodeInnerRadius
            ) {
              // 垂直セグメントの方向で半円方向を決定
              return segDx === 0 ? (segDy > 0 ? 'left' : 'right') :
                     (dx > 0 ? 'left' : 'right')
            }
          }
        }
      }

      return null
    },
    [activities, getNode]
  )

  // 日付フォーマット
  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const formatDateFull = (date: Date) => {
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  }

  const formatDayOfWeek = (date: Date) => {
    const days = ['日', '月', '火', '水', '木', '金', '土']
    return days[date.getDay()]
  }

  const isWeekend = isWeekendUtil

  // 非稼働日かどうかを判定（workDays + 祝日ベース）
  const isNonWorkday = useCallback((date: Date) => {
    return isNonWorkdayUtil(date, calendar)
  }, [calendar])

  // 祝日を取得
  const getHolidayObj = useCallback((date: Date) => {
    if (!calendar) return null
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    return calendar.holidays.find(h => h.date === dateStr) ?? null
  }, [calendar])

  // 日付クリックで休日トグル（3状態サイクル）
  // 1: なし → 全休として追加 (status: 'holiday')
  // 2: 全休 → 稼働日に変更 (status: 'workday')
  // 3: 稼働日 → 祝日リストから削除
  const toggleHoliday = useCallback((date: Date) => {
    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const da = String(date.getDate()).padStart(2, '0')
    const dateStr = `${y}-${mo}-${da}`
    const holiday = getHolidayObj(date)
    if (!holiday) {
      // なし → 全休として追加
      addHoliday({ date: dateStr, name: '祝日', status: 'holiday' })
    } else if (holiday.status !== 'workday') {
      // 全休 → 稼働日に変更
      updateHoliday(dateStr, { status: 'workday' })
    } else {
      // 稼働日 → 削除
      removeHoliday(dateStr)
    }
    markDirty()
  }, [getHolidayObj, addHoliday, updateHoliday, removeHoliday, markDirty])

  // 稼働日数からカレンダー日数を計算
  // 開始X座標から、指定した稼働日数を完了するのに必要なカレンダー日数を返す（開始日を含む）
  const getCalendarDaysForWorkdays = useCallback((fromX: number, workDays: number): number => {
    return getCalendarDaysForWorkdaysUtil(fromX, workDays, startDate, DAY_WIDTH, calendar)
  }, [startDate, calendar])

  // X座標範囲内の非稼働日範囲を取得
  const getNonWorkdayRanges = useCallback((rangeStartX: number, rangeEndX: number): Array<{ startX: number; endX: number }> => {
    return getNonWorkdayRangesUtil(rangeStartX, rangeEndX, startDate, DAY_WIDTH, calendar)
  }, [startDate, calendar])

  // 列タイプに応じた値を取得するヘルパー
  const getColumnValue = (row: typeof hierarchyRows[0], columnType: string, rowIndex?: number, columnId?: string): string => {
    switch (columnType) {
      case 'building':
        return row.buildingName ?? ''
      case 'zone':
        return row.zoneName
      case 'floor':
        return row.roomName
      case 'grid':
        return ''
      case 'detail':
        return row.detailName
      case 'custom':
        if (columnId != null && rowIndex != null) {
          return getCustomColumnValue(columnId, rowIndex)
        }
        return ''
      default:
        return ''
    }
  }

  // 列タイプに応じた一意キーを取得（グループ化用）
  // zone/floor: IDベース（エンティティ単位で結合）
  // detail: 名前ベース（同じ階の連続する同名行が結合）
  const getColumnKey = (row: typeof hierarchyRows[0], columnType: string): string => {
    switch (columnType) {
      case 'building':
        return row.buildingId ?? ''
      case 'zone':
        return row.zoneId
      case 'floor':
        return row.roomId
      case 'grid':
        return ''
      case 'detail':
        return row.detailId
      default:
        return ''
    }
  }

  // 列タイプに応じた背景色
  const getColumnBgColor = (columnType: string) => {
    switch (columnType) {
      case 'building':
        return 'bg-amber-50'
      case 'zone':
        return 'bg-blue-50'
      case 'floor':
        return 'bg-green-50'
      case 'grid':
        return 'bg-purple-50'
      case 'detail':
        return 'bg-gray-50'
      default:
        return 'bg-white'
    }
  }

  // 行グループ情報を計算
  const rowGroupInfo = useMemo(() => {
    const info: Map<string, { isFirst: boolean; rowSpan: number }[]> = new Map()

    for (const col of visibleColumns) {
      const columnInfo: { isFirst: boolean; rowSpan: number }[] = []
      let groupStartIndex = 0
      let currentKey = hierarchyRows.length > 0 ? getColumnKey(hierarchyRows[0], col.type) : ''

      for (let i = 0; i < hierarchyRows.length; i++) {
        const rowKey = getColumnKey(hierarchyRows[i], col.type)

        if (rowKey !== currentKey || i === 0) {
          if (i > 0) {
            const groupSize = i - groupStartIndex
            columnInfo[groupStartIndex].rowSpan = groupSize
          }
          columnInfo[i] = { isFirst: true, rowSpan: 1 }
          groupStartIndex = i
          currentKey = rowKey
        } else {
          columnInfo[i] = { isFirst: false, rowSpan: 0 }
        }
      }

      if (hierarchyRows.length > 0) {
        const groupSize = hierarchyRows.length - groupStartIndex
        columnInfo[groupStartIndex].rowSpan = groupSize
      }

      info.set(col.id, columnInfo)
    }

    return info
  }, [visibleColumns, hierarchyRows])

  // 各列の左端位置を計算
  const columnLeftPositions = useMemo(() => {
    const positions: Map<string, number> = new Map()
    let left = 0
    for (const col of visibleColumns) {
      positions.set(col.id, left)
      left += col.width
    }
    return positions
  }, [visibleColumns])

  // ズーム適用後の行の高さ
  const scaledRowHeight = ROW_HEIGHT * canvasScale

  // マスタデータから選択肢を取得
  const getOptionsForColumn = useCallback((columnType: string, columnId?: string) => {
    switch (columnType) {
      case 'zone':
        return getMasterItems('zone')
      case 'floor':
        return getMasterItems('room')
      case 'detail':
        return getMasterItems('detail')
      case 'custom':
        return columnId ? getCustomMasterItems(columnId) : []
      default:
        return []
    }
  }, [getMasterItems, getCustomMasterItems])

  // 行ヘッダーのセルクリックハンドラー（マスタ選択用）
  const handleCellClick = useCallback((
    rowIndex: number,
    columnType: string,
    currentValue: string,
    cellRect: { left: number; top: number; width: number; height: number },
    columnId?: string
  ) => {
    setEditingCell({ rowIndex, columnType, columnId, value: currentValue, cellRect })
  }, [])

  // マスタから選択した値で更新（名前を直接渡す）
  const handleCellSelectChange = useCallback((selectedName: string) => {
    if (!editingCell) return

    const { rowIndex, columnType } = editingCell
    const row = hierarchyRows[rowIndex]

    if (row) {
      // 既存行の更新（選択行のみ変更、グループの他の行は変わらない）
      switch (columnType) {
        case 'zone': {
          const sameZoneRows = hierarchyRows.filter(r => r.zoneId === row.zoneId)
          if (sameZoneRows.length === 1) {
            // この工区に属する行が1つだけなら直接リネーム
            updateZone(row.zoneId, { name: selectedName })
          } else {
            // 既存の同名工区があればそこへ移動、なければ新規作成
            const existingZone = Array.from(zones.values()).find(z => z.name === selectedName && z.id !== row.zoneId)
            const targetZoneId = existingZone?.id ?? addZone(selectedName)
            // 移動先の同名階があればそこへ、なければ新規作成
            const existingRoom = Array.from(rooms.values()).find(r => r.zoneId === targetZoneId && r.name === row.roomName)
            const targetRoomId = existingRoom?.id ?? addRoom(targetZoneId, row.roomName)
            updateDetailCategory(row.detailId, { roomId: targetRoomId })
          }
          break
        }
        case 'floor': {
          const sameRoomRows = hierarchyRows.filter(r => r.roomId === row.roomId)
          if (sameRoomRows.length === 1) {
            updateRoom(row.roomId, { name: selectedName })
          } else {
            const existingRoom = Array.from(rooms.values()).find(r => r.zoneId === row.zoneId && r.name === selectedName && r.id !== row.roomId)
            const targetRoomId = existingRoom?.id ?? addRoom(row.zoneId, selectedName)
            updateDetailCategory(row.detailId, { roomId: targetRoomId })
          }
          break
        }
        case 'detail':
          updateDetailCategory(row.detailId, { name: selectedName })
          break
        case 'custom':
          if (editingCell.columnId != null) {
            setCustomColumnValue(editingCell.columnId, rowIndex, selectedName)
          }
          break
      }
    } else {
      // 空行への新規追加
      // 上の行から親情報を取得
      const prevRow = rowIndex > 0 ? hierarchyRows[rowIndex - 1] : null

      switch (columnType) {
        case 'zone': {
          // 新しい工区を作成し、階と細目も作成
          const zoneId = addZone(selectedName)
          const roomId = addRoom(zoneId, '新規階')
          addDetailCategory(roomId, '新規細目')
          break
        }
        case 'floor': {
          const zoneId = prevRow?.zoneId || Array.from(zones.keys())[0]
          if (zoneId) {
            const roomId = addRoom(zoneId, selectedName)
            addDetailCategory(roomId, '新規細目')
          }
          break
        }
        case 'detail': {
          // 上の行の階を使用して新しい細目を作成
          const roomId = prevRow?.roomId
          if (roomId) {
            addDetailCategory(roomId, selectedName)
          }
          break
        }
        case 'custom':
          if (editingCell.columnId != null) {
            setCustomColumnValue(editingCell.columnId, rowIndex, selectedName)
          }
          break
      }
    }

    setEditingCell(null)
  }, [editingCell, hierarchyRows, zones, updateZone, updateRoom, updateDetailCategory, addZone, addRoom, addDetailCategory, setCustomColumnValue])

  // セルから新規マスタ項目追加
  const handleAddCellItem = useCallback(() => {
    if (!editingCell || !newItemName.trim()) return

    const name = newItemName.trim()

    switch (editingCell.columnType) {
      case 'zone':
        addMasterItem('zone', name)
        break
      case 'floor':
        addMasterItem('room', name)
        break
      case 'detail':
        addMasterItem('detail', name)
        break
      case 'custom':
        if (editingCell.columnId) {
          addCustomMasterItem(editingCell.columnId, name)
        }
        break
    }

    setNewItemName('')
    // ドロップダウンは閉じない（続けて追加できるように）
  }, [editingCell, newItemName, addMasterItem, addCustomMasterItem])

  // ハンドルクリックでアクションメニュー表示
  const handleRowHandleClick = useCallback((e: React.MouseEvent, rowIndex: number) => {
    e.stopPropagation()
    setRowActionMenu({ x: e.clientX, y: e.clientY, rowIndex })
  }, [])

  // アクションメニューを閉じる
  const closeRowActionMenu = useCallback(() => {
    setRowActionMenu(null)
  }, [])

  // 行のY座標範囲にあるノードを取得
  const getNodesOnRow = useCallback((rowIndex: number) => {
    const rowTop = rowIndex * ROW_HEIGHT
    const rowBottom = (rowIndex + 1) * ROW_HEIGHT
    return nodes.filter(node => node.position.y >= rowTop && node.position.y < rowBottom)
  }, [nodes])

  // 行を移動（ノードも追従）
  const moveRowWithNodes = useCallback((fromRowIndex: number, toRowIndex: number) => {
    if (fromRowIndex === toRowIndex) return

    const nodesOnRow = getNodesOnRow(fromRowIndex)
    const fromY = fromRowIndex * ROW_HEIGHT
    const toY = toRowIndex * ROW_HEIGHT

    // ノードを新しい位置に移動
    nodesOnRow.forEach(node => {
      const offsetInRow = node.position.y - fromY
      moveNode(node.id, { x: node.position.x, y: toY + offsetInRow })
    })

    // 移動方向に応じて間の行のノードをシフト
    if (fromRowIndex < toRowIndex) {
      // 下に移動: 間の行を上にシフト
      for (let i = fromRowIndex + 1; i <= toRowIndex; i++) {
        const nodesOnThisRow = getNodesOnRow(i)
        nodesOnThisRow.forEach(node => {
          moveNode(node.id, { x: node.position.x, y: node.position.y - ROW_HEIGHT })
        })
      }
    } else {
      // 上に移動: 間の行を下にシフト
      for (let i = toRowIndex; i < fromRowIndex; i++) {
        const nodesOnThisRow = getNodesOnRow(i)
        nodesOnThisRow.forEach(node => {
          moveNode(node.id, { x: node.position.x, y: node.position.y + ROW_HEIGHT })
        })
      }
    }
  }, [getNodesOnRow, moveNode])

  // 行を最上段に移動
  const handleMoveToTop = useCallback(() => {
    if (rowActionMenu === null) return
    const rowIndex = rowActionMenu.rowIndex
    const row = hierarchyRows[rowIndex]
    if (!row) return

    // ノードを移動
    moveRowWithNodes(rowIndex, 0)

    const allDetails = Array.from(detailCategories.values()).sort((a, b) => a.order - b.order)
    if (allDetails.length > 0) {
      const minOrder = allDetails[0].order - 1
      updateDetailCategory(row.detailId, { order: minOrder })
    }

    closeRowActionMenu()
  }, [rowActionMenu, hierarchyRows, detailCategories, updateDetailCategory, closeRowActionMenu, moveRowWithNodes])

  // 行をグループ最上段に移動
  const handleMoveToGroupTop = useCallback(() => {
    if (rowActionMenu === null) return
    const rowIndex = rowActionMenu.rowIndex
    const row = hierarchyRows[rowIndex]
    if (!row) return

    // グループの最初の行を見つける
    const groupStartIndex = hierarchyRows.findIndex(r => r.roomId === row.roomId)
    if (groupStartIndex >= 0 && groupStartIndex !== rowIndex) {
      moveRowWithNodes(rowIndex, groupStartIndex)
    }

    const groupDetails = Array.from(detailCategories.values())
      .filter(d => d.roomId === row.roomId)
      .sort((a, b) => a.order - b.order)

    if (groupDetails.length > 0) {
      const minOrder = groupDetails[0].order - 1
      updateDetailCategory(row.detailId, { order: minOrder })
    }

    closeRowActionMenu()
  }, [rowActionMenu, hierarchyRows, detailCategories, updateDetailCategory, closeRowActionMenu, moveRowWithNodes])

  // 行を最下段に移動
  const handleMoveToBottom = useCallback(() => {
    if (rowActionMenu === null) return
    const rowIndex = rowActionMenu.rowIndex
    const row = hierarchyRows[rowIndex]
    if (!row) return

    // ノードを移動
    const lastRowIndex = hierarchyRows.length - 1
    if (rowIndex !== lastRowIndex) {
      moveRowWithNodes(rowIndex, lastRowIndex)
    }

    const allDetails = Array.from(detailCategories.values()).sort((a, b) => a.order - b.order)
    if (allDetails.length > 0) {
      const maxOrder = allDetails[allDetails.length - 1].order + 1
      updateDetailCategory(row.detailId, { order: maxOrder })
    }

    closeRowActionMenu()
  }, [rowActionMenu, hierarchyRows, detailCategories, updateDetailCategory, closeRowActionMenu, moveRowWithNodes])

  // 行をグループ最下段に移動
  const handleMoveToGroupBottom = useCallback(() => {
    if (rowActionMenu === null) return
    const rowIndex = rowActionMenu.rowIndex
    const row = hierarchyRows[rowIndex]
    if (!row) return

    // グループの最後の行を見つける
    let groupEndIndex = rowIndex
    for (let i = rowIndex + 1; i < hierarchyRows.length; i++) {
      if (hierarchyRows[i].roomId === row.roomId) {
        groupEndIndex = i
      } else {
        break
      }
    }
    if (groupEndIndex !== rowIndex) {
      moveRowWithNodes(rowIndex, groupEndIndex)
    }

    const groupDetails = Array.from(detailCategories.values())
      .filter(d => d.roomId === row.roomId)
      .sort((a, b) => a.order - b.order)

    if (groupDetails.length > 0) {
      const maxOrder = groupDetails[groupDetails.length - 1].order + 1
      updateDetailCategory(row.detailId, { order: maxOrder })
    }

    closeRowActionMenu()
  }, [rowActionMenu, hierarchyRows, detailCategories, updateDetailCategory, closeRowActionMenu, moveRowWithNodes])

  // 行を削除（ノードも削除対象の行から移動が必要な場合は考慮）
  const handleDeleteRow = useCallback(() => {
    if (rowActionMenu === null) return
    const rowIndex = rowActionMenu.rowIndex
    const row = hierarchyRows[rowIndex]
    if (row) {
      // 削除する行より下のノードを上にシフト
      const deleteY = rowIndex * ROW_HEIGHT
      nodes.forEach(node => {
        if (node.position.y > deleteY + ROW_HEIGHT) {
          moveNode(node.id, { x: node.position.x, y: node.position.y - ROW_HEIGHT })
        }
      })

      deleteDetailCategory(row.detailId)
    }
    closeRowActionMenu()
  }, [rowActionMenu, hierarchyRows, nodes, moveNode, deleteDetailCategory, closeRowActionMenu])

  // ドラッグ開始
  const handleDragStart = useCallback((e: React.DragEvent, rowIndex: number) => {
    setDraggedRowIndex(rowIndex)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  // ドラッグオーバー
  const handleDragOver = useCallback((e: React.DragEvent, rowIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverRowIndex(rowIndex)
  }, [])

  // ドラッグ終了（挿入方式: draggedRowをdragOverRow位置に挿入）
  const handleDragEnd = useCallback(() => {
    if (draggedRowIndex === null || dragOverRowIndex === null || draggedRowIndex === dragOverRowIndex) {
      setDraggedRowIndex(null)
      setDragOverRowIndex(null)
      return
    }

    const fromRow = hierarchyRows[draggedRowIndex]
    const toRow = hierarchyRows[dragOverRowIndex]
    if (!fromRow || !toRow) {
      setDraggedRowIndex(null)
      setDragOverRowIndex(null)
      return
    }

    // 1. ノードY座標を入れ替え
    const nodesOnFromRow = getNodesOnRow(draggedRowIndex)
    const nodesOnToRow = getNodesOnRow(dragOverRowIndex)
    const fromRowY = draggedRowIndex * ROW_HEIGHT
    const toRowY = dragOverRowIndex * ROW_HEIGHT

    nodesOnFromRow.forEach(node => {
      const offset = node.position.y - fromRowY
      moveNode(node.id, { x: node.position.x, y: toRowY + offset })
    })
    nodesOnToRow.forEach(node => {
      const offset = node.position.y - toRowY
      moveNode(node.id, { x: node.position.x, y: fromRowY + offset })
    })

    // 2. hierarchyRowsの新しい並びを計算
    const newRows = [...hierarchyRows]
    const [movedRow] = newRows.splice(draggedRowIndex, 1)
    newRows.splice(dragOverRowIndex, 0, movedRow)

    // 3. 移動先のroomが異なる場合、roomIdを変更
    if (fromRow.roomId !== toRow.roomId) {
      updateDetailCategory(fromRow.detailId, { roomId: toRow.roomId })
    }

    // 4. 影響するroom内のorder値を再付番
    const affectedRoomIds = new Set([fromRow.roomId, toRow.roomId])
    for (const roomId of affectedRoomIds) {
      let order = 0
      for (const row of newRows) {
        const detail = detailCategories.get(row.detailId)
        if (!detail) continue
        const effectiveRoomId = row.detailId === fromRow.detailId ? toRow.roomId : detail.roomId
        if (effectiveRoomId === roomId) {
          updateDetailCategory(row.detailId, { order: order++ })
        }
      }
    }

    setDraggedRowIndex(null)
    setDragOverRowIndex(null)
  }, [draggedRowIndex, dragOverRowIndex, hierarchyRows, detailCategories, updateDetailCategory, getNodesOnRow, moveNode])

  // 指定行以降のノードを1行分下にシフト
  const shiftNodesDown = useCallback((fromRowIndex: number) => {
    const shiftY = ROW_HEIGHT
    const fromY = fromRowIndex * ROW_HEIGHT

    nodes.forEach(node => {
      if (node.position.y >= fromY) {
        moveNode(node.id, { x: node.position.x, y: node.position.y + shiftY })
      }
    })
  }, [nodes, moveNode])

  // 行間に行を挿入（+ボタンクリック時）
  const handleInsertRowAt = useCallback((afterRowIndex: number) => {
    // 挿入位置以降のノードを下にシフト
    const insertAtRowIndex = afterRowIndex + 1
    if (insertAtRowIndex < hierarchyRows.length) {
      shiftNodesDown(insertAtRowIndex)
    }

    if (afterRowIndex < 0) {
      // 最初の行の前に挿入 - 全ノードを下にシフト、空白行（全ヘッダー空）を追加
      shiftNodesDown(0)

      const zonesArray = Array.from(zones.values()).sort((a, b) => a.order - b.order)
      const firstOrder = zonesArray.length > 0 ? zonesArray[0].order - 1 : 0
      const zoneId = addZone('')
      updateZone(zoneId, { order: firstOrder })
      const roomId = addRoom(zoneId, '')
      addDetailCategory(roomId, '')
    } else if (afterRowIndex < hierarchyRows.length) {
      // 既存行の後に挿入
      const row = hierarchyRows[afterRowIndex]
      const roomDetails = Array.from(detailCategories.values())
        .filter(d => d.roomId === row.roomId)
        .sort((a, b) => a.order - b.order)

      const currentDetail = detailCategories.get(row.detailId)
      const currentIndex = roomDetails.findIndex(d => d.id === row.detailId)

      let newOrder: number
      if (currentIndex < roomDetails.length - 1) {
        // 次の要素との間に挿入
        newOrder = (currentDetail!.order + roomDetails[currentIndex + 1].order) / 2
      } else {
        // 最後の要素の後に挿入
        newOrder = currentDetail!.order + 1
      }

      const newId = addDetailCategory(row.roomId, row.detailName)
      updateDetailCategory(newId, { order: newOrder })
    } else {
      // 空行エリアに挿入
      const zonesArray = Array.from(zones.values()).sort((a, b) => a.order - b.order)
      if (zonesArray.length > 0 && hierarchyRows.length > 0) {
        const lastRow = hierarchyRows[hierarchyRows.length - 1]
        addDetailCategory(lastRow.roomId, '新規細目')
      }
    }

    setHoverRowGap(null)
  }, [zones, rooms, detailCategories, hierarchyRows, addZone, updateZone, addRoom, addDetailCategory, updateDetailCategory, shiftNodesDown])

  // メニューを閉じるためのクリックハンドラー
  useEffect(() => {
    const handleClickOutside = () => {
      if (rowActionMenu) closeRowActionMenu()
      if (editingCell) setEditingCell(null)
    }
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [rowActionMenu, editingCell, closeRowActionMenu])

  return (
    <div className="relative flex flex-col" style={{ height }}>
      {/* ページナビゲーション（行ヘッダー幅内、totalPages > 1 のみ表示） */}
      <div className="flex items-center bg-gray-100 border-b border-gray-300" style={{ height: NAV_HEIGHT }}>
        <div className="flex items-center justify-start gap-2 pl-2 flex-shrink-0" style={{ width: headerPanelWidth }}>
          {showBuildingSelector && buildings.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">棟切替</span>
              <select
                value={selectedBuildingId ?? ''}
                onChange={(e) => {
                  setSelectedBuildingId(e.target.value || null)
                  setCurrentPage(0)
                }}
                className="px-1 py-0.5 text-xs border rounded bg-white max-w-[80px]"
              >
                <option value="">全体</option>
                {buildings.map((b: Building) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-1 py-0.5 bg-white rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ▲
              </button>
              <span className="font-medium">{currentPage + 1}/{totalPages}</span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage === totalPages - 1}
                className="px-1 py-0.5 bg-white rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ▼
              </button>
              <span className="text-gray-400">ページ</span>
            </div>
          )}
        </div>

      {/* ナビゲーションバー */}
      <div
        className="flex flex-1 items-center justify-between px-4"
      >
        <div className="flex items-center gap-1">
          <button
            onClick={navigatePrev}
            className="px-2 py-1 text-xs bg-white rounded hover:bg-gray-50"
            title="前の週へ移動"
          >
            ◀
          </button>
          <button
            onClick={navigateToToday}
            className="px-2 py-1 text-xs bg-white rounded hover:bg-gray-50"
            title="今日の日付へ移動"
          >
            <CalendarDays size={14} />
          </button>
          <button
            onClick={navigateNext}
            className="px-2 py-1 text-xs bg-white rounded hover:bg-gray-50"
            title="次の週へ移動"
          >
            ▶
          </button>
        </div>

        <div className="text-sm font-medium text-gray-700">
          {formatDateFull(viewStartDate)} 〜 {formatDateFull(viewEndDate)}
          <span className="ml-2 text-gray-500">（{effectiveTotalDays}日間）</span>
          {viewStartOffset < 0 && (
            <span className="ml-2 text-orange-500 text-xs">※過去期間</span>
          )}
        </div>

        <div style={{ width: 1 }} />
      </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左側：階層ラベル（ズーム追従） */}
        <div
          className="flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-hidden"
          style={{ width: headerPanelWidth }}
        >
          {/* ヘッダー行 */}
          <div
            className="flex border-b border-gray-300 bg-gray-100 text-xs font-medium text-gray-600"
            style={{ height: HEADER_HEIGHT }}
          >
            {/* ハンドル列のスペーサー */}
            <div
              className="flex-shrink-0 border-r border-gray-200"
              style={{ width: HANDLE_COLUMN_WIDTH }}
            />
            {visibleColumns.map((col, idx) => (
              <div
                key={col.id}
                className={`flex items-center justify-center ${idx < visibleColumns.length - 1 ? 'border-r border-gray-200' : ''}`}
                style={{ width: col.width * canvasScale, fontSize: 10 * canvasScale }}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* 階層行（相対位置コンテナ、ズーム追従、縦スクロール連動） */}
          <div
            className="relative overflow-hidden"
            style={{ height: canvasHeight }}
            onMouseLeave={() => setHoverRowGap(null)}
          >
            {/* 縦スクロールに追従するコンテナ */}
            <div
              className="absolute w-full"
              style={{
                transform: `translateY(${-canvasPosition.y * canvasScale}px)`,
              }}
            >
            {/* 行間のホバー検出エリア（+ボタン表示用）- ヘッダー右端に配置 */}
            {Array.from({ length: totalRows + 1 }).map((_, gapIndex) => (
              <div
                key={`gap-${gapIndex}`}
                className="absolute h-3 z-20"
                style={{
                  top: gapIndex * scaledRowHeight - 6,
                  left: headerPanelWidth - 20,
                  width: 40,
                }}
                onMouseEnter={() => setHoverRowGap(gapIndex)}
                onMouseLeave={() => setHoverRowGap(null)}
              >
                {/* +ボタン（ホバー時のみ表示） */}
                {hoverRowGap === gapIndex && (
                  <div
                    className="absolute flex items-center justify-center"
                    style={{ left: 0, top: 0 }}
                  >
                    <button
                      className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md hover:bg-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleInsertRowAt(gapIndex - 1)
                      }}
                      title="行を挿入"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* 全行の背景（空行含む） */}
            {Array.from({ length: totalRows }).map((_, rowIndex) => {
              const dataRowIndex = pageStartRow + rowIndex
              const row = hierarchyRows[dataRowIndex]
              const isDragging = draggedRowIndex === dataRowIndex
              const isDragOver = dragOverRowIndex === dataRowIndex && draggedRowIndex !== null

              return (
                <div
                  key={`row-bg-${rowIndex}`}
                  className={`absolute w-full border-b border-gray-200 flex ${
                    isDragging ? 'opacity-50 bg-blue-100' : ''
                  } ${isDragOver ? 'bg-blue-50 border-t-2 border-t-blue-500' : ''}`}
                  style={{ top: rowIndex * scaledRowHeight, height: scaledRowHeight }}
                  onDragOver={(e) => row ? handleDragOver(e, dataRowIndex) : undefined}
                  onDrop={(e) => e.preventDefault()}
                >
                  {/* ハンドル（ドラッグ可能 + クリックでメニュー） */}
                  {row && (
                    <div
                      className="flex items-center justify-center h-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-grab active:cursor-grabbing border-r border-gray-200"
                      style={{ width: HANDLE_COLUMN_WIDTH, fontSize: 10 * canvasScale }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, dataRowIndex)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handleRowHandleClick(e, dataRowIndex)}
                      title="ドラッグで移動 / クリックでメニュー"
                    >
                      ⋮⋮
                    </div>
                  )}
                  {!row && (
                    <div className="h-full border-r border-gray-200" style={{ width: HANDLE_COLUMN_WIDTH }} />
                  )}
                </div>
              )
            })}

            {/* グループ化されたセル（ページ範囲のみ表示） */}
            {visibleColumns.map((col) => {
              const groupInfo = rowGroupInfo.get(col.id) || []
              const leftPos = (columnLeftPositions.get(col.id) || 0) * canvasScale + HANDLE_COLUMN_WIDTH
              const bgColor = getColumnBgColor(col.type)

              // ページ範囲内のグループのみをレンダリング
              const pageGroups: Array<{ dataRowIndex: number; displayRowStart: number; displayRowSpan: number }> = []
              for (let dataIdx = 0; dataIdx < groupInfo.length; dataIdx++) {
                const info = groupInfo[dataIdx]
                if (!info || !info.isFirst) continue
                const groupEnd = dataIdx + info.rowSpan
                // ページ範囲とグループ範囲の重なりを計算
                const overlapStart = Math.max(dataIdx, pageStartRow)
                const overlapEnd = Math.min(groupEnd, pageEndRow)
                if (overlapStart < overlapEnd) {
                  pageGroups.push({
                    dataRowIndex: dataIdx,
                    displayRowStart: overlapStart - pageStartRow,
                    displayRowSpan: overlapEnd - overlapStart,
                  })
                }
              }

              return pageGroups.map(({ dataRowIndex, displayRowStart, displayRowSpan }) => {
                const row = hierarchyRows[dataRowIndex]
                const value = getColumnValue(row, col.type, dataRowIndex, col.id)

                return (
                  <div
                    key={`${col.id}-${dataRowIndex}`}
                    className={`absolute flex items-center justify-start pl-1 ${bgColor} border border-gray-300 hover:border-blue-400 cursor-pointer transition-colors`}
                    style={{
                      left: leftPos,
                      top: displayRowStart * scaledRowHeight + 1,
                      width: col.width * canvasScale - 2,
                      height: displayRowSpan * scaledRowHeight - 2,
                      fontSize: 10 * canvasScale,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      const clickY = e.clientY - rect.top
                      const rowInGroup = Math.floor(clickY / scaledRowHeight)
                      const actualRowIndex = pageStartRow + displayRowStart + Math.min(rowInGroup, displayRowSpan - 1)
                      handleCellClick(actualRowIndex, col.type, value, {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                      }, col.id)
                    }}
                  >
                    <span className="truncate px-1">{value}</span>
                  </div>
                )
              })
            })}

            {/* 空行のセル（データがない行に枠線を表示 + クリック可能） */}
            {Array.from({ length: totalRows }).map((_, rowIndex) => {
              const dataRowIndex = pageStartRow + rowIndex
              if (dataRowIndex < hierarchyRows.length) return null

              return visibleColumns.map((col) => {
                const leftPos = (columnLeftPositions.get(col.id) || 0) * canvasScale + HANDLE_COLUMN_WIDTH

                return (
                  <div
                    key={`empty-${col.id}-${rowIndex}`}
                    className="absolute border border-gray-200 bg-gray-50 hover:border-blue-300 cursor-pointer transition-colors"
                    style={{
                      left: leftPos,
                      top: rowIndex * scaledRowHeight + 1,
                      width: col.width * canvasScale - 2,
                      height: scaledRowHeight - 2,
                      fontSize: 10 * canvasScale,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      handleCellClick(dataRowIndex, col.type, '', {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                      }, col.id)
                    }}
                  />
                )
              })
            })}
            </div>
            {/* 縦スクロールコンテナ終了 */}
          </div>
        </div>

        {/* 行アクションメニュー（ハンドルクリック時） */}
        {rowActionMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-300 rounded shadow-lg py-1 min-w-[140px]"
            style={{ left: rowActionMenu.x, top: rowActionMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              onClick={handleMoveToTop}
            >
              最上段へ移動
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              onClick={handleMoveToGroupTop}
            >
              グループ最上段へ
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              onClick={handleMoveToGroupBottom}
            >
              グループ最下段へ
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              onClick={handleMoveToBottom}
            >
              最下段へ移動
            </button>
            <div className="border-t border-gray-200 my-1" />
            <button
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={handleDeleteRow}
            >
              削除
            </button>
          </div>
        )}

        {/* セル編集ドロップダウン（マスタ選択 + 追加） */}
        {editingCell && editingCell.cellRect && (
          <div
            className="fixed z-50 bg-white border border-blue-500 rounded shadow-lg"
            style={{
              left: editingCell.cellRect.left,
              top: editingCell.cellRect.top + editingCell.cellRect.height,
              minWidth: Math.max(editingCell.cellRect.width, 150),
              maxHeight: 280,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* マスタ一覧 */}
            <div className="max-h-[180px] overflow-y-auto border-b border-gray-200">
              {getOptionsForColumn(editingCell.columnType, editingCell.columnId).map((option) => (
                <button
                  key={option.id}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0 ${
                    option.name === editingCell.value ? 'bg-blue-100 font-medium' : ''
                  }`}
                  onClick={() => handleCellSelectChange(option.name)}
                >
                  {option.name}
                </button>
              ))}
              {getOptionsForColumn(editingCell.columnType, editingCell.columnId).length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">選択肢がありません</div>
              )}
            </div>
            {/* 新規追加フォーム */}
            <div className="p-2 bg-gray-50">
              <div className="flex gap-1">
                <input
                  type="text"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none"
                  placeholder="新規追加..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCellItem()
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="px-2 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 disabled:bg-gray-300"
                  onClick={handleAddCellItem}
                  disabled={!newItemName.trim()}
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 右側：キャンバス */}
        <div className="flex-1 overflow-hidden canvas-touch-none">
          <Stage
            ref={stageRef}
            width={canvasWidth}
            height={height - NAV_HEIGHT}
            onWheel={handleWheel}
            onContextMenu={handleCanvasRightClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleStageMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseLeave={() => {
              setGhostPosition(null)
              if (floatDragRef.current) {
                floatDragRef.current = null
                setChainHighlightIds([])
                setFloatDragDeltaDays(0)
              }
            }}
          >
            {/* カレンダーヘッダー（固定） */}
            <Layer>
              <Rect x={0} y={0} width={canvasWidth} height={HEADER_HEIGHT} fill={HEADER_BG} />
              {dates.map((date, i) => {
                const x = i * DAY_WIDTH * canvasScale - canvasPosition.x * canvasScale
                if (x < -DAY_WIDTH || x > canvasWidth) return null

                const weekend = isWeekend(date)
                const holidayObj = getHolidayObj(date)
                const isHolidayDay = holidayObj != null && holidayObj.status !== 'workday'
                const isWorkdayHoliday = holidayObj != null && holidayObj.status === 'workday'
                const holidayName = holidayObj?.name ?? null

                // 背景色: 祝日（全休/稼働日とも）=青, 週末=赤, 通常=灰
                let headerBg = HEADER_BG
                if (isHolidayDay || isWorkdayHoliday) {
                  headerBg = '#DBEAFE' // blue-100 祝日（全休/稼働日とも青）
                } else if (weekend) {
                  headerBg = '#FEE2E2' // red-50 週末
                }

                // テキスト色
                let textColor = '#374151'
                let subTextColor = '#6B7280'
                if (isHolidayDay || isWorkdayHoliday) {
                  textColor = '#1D4ED8'
                  subTextColor = '#1D4ED8'
                } else if (weekend) {
                  textColor = '#DC2626'
                  subTextColor = '#DC2626'
                }

                return (
                  <Group
                    key={i}
                    x={x}
                    y={0}
                    onClick={(e) => { if (e.evt.button === 0) toggleHoliday(date) }}
                    onTap={() => toggleHoliday(date)}
                    onContextMenu={(e) => {
                      e.evt.preventDefault()
                      if (holidayObj) {
                        const newName = prompt('祝日名を入力', holidayObj.name)
                        if (newName != null && newName !== '') {
                          updateHoliday(holidayObj.date, { name: newName })
                          markDirty()
                        }
                      }
                    }}
                  >
                    <Rect
                      width={DAY_WIDTH * canvasScale}
                      height={HEADER_HEIGHT}
                      fill={headerBg}
                      stroke={GRID_COLOR}
                      strokeWidth={0.5}
                    />
                    <Text
                      text={formatDate(date)}
                      fontSize={9 * canvasScale}
                      fill={textColor}
                      align="center"
                      width={DAY_WIDTH * canvasScale}
                      y={8}
                    />
                    <Text
                      text={holidayObj ? (holidayName?.slice(0, 2) ?? '休') : formatDayOfWeek(date)}
                      fontSize={8 * canvasScale}
                      fill={subTextColor}
                      align="center"
                      width={DAY_WIDTH * canvasScale}
                      y={24}
                    />
                    {/* 祝日マーク（全休/稼働日とも青） */}
                    {holidayObj && !weekend && (
                      <Text
                        text={isWorkdayHoliday ? '◯' : '●'}
                        fontSize={6 * canvasScale}
                        fill="#1D4ED8"
                        align="center"
                        width={DAY_WIDTH * canvasScale}
                        y={38}
                      />
                    )}
                  </Group>
                )
              })}
              <Line points={[0, HEADER_HEIGHT, canvasWidth, HEADER_HEIGHT]} stroke="#9CA3AF" strokeWidth={1} />
            </Layer>

            {/* メインキャンバス（スクロール対応） */}
            <Layer
              y={HEADER_HEIGHT}
              clipX={0}
              clipY={0}
              clipWidth={canvasWidth}
              clipHeight={canvasHeight}
            >
              <Group scaleX={canvasScale} scaleY={canvasScale} x={-canvasPosition.x * canvasScale} y={-canvasPosition.y * canvasScale}>
                {/* クリック可能な背景（全体をカバー） */}
                <Rect
                  x={0}
                  y={0}
                  width={effectiveTotalDays * DAY_WIDTH}
                  height={totalRows * ROW_HEIGHT}
                  fill="transparent"
                  onClick={handleCanvasClick}
                  onContextMenu={handleCanvasRightClick}
                />
                {/* 背景グリッド（クリックイベントを通過させる） */}
                {/* 全体の白背景 */}
                <Rect
                  x={0}
                  y={0}
                  width={effectiveTotalDays * DAY_WIDTH}
                  height={totalRows * ROW_HEIGHT}
                  fill="white"
                  listening={false}
                />

                {/* 列の背景（土日祝はグレーハッチング） */}
                {dates.map((date, i) => {
                  const nonWorkday = isNonWorkday(date)
                  if (!nonWorkday) return null
                  return (
                    <Rect
                      key={`col-bg-${i}`}
                      x={i * DAY_WIDTH}
                      y={0}
                      width={DAY_WIDTH}
                      height={totalRows * ROW_HEIGHT}
                      fill={NON_WORKDAY_BG}
                      listening={false}
                    />
                  )
                })}

                {/* 縦線（日付） */}
                {dates.map((date, i) => (
                  <Line
                    key={`vline-${i}`}
                    points={[i * DAY_WIDTH, 0, i * DAY_WIDTH, totalRows * ROW_HEIGHT]}
                    stroke={isNonWorkday(date) ? '#D1D5DB' : GRID_COLOR}
                    strokeWidth={0.5}
                    listening={false}
                  />
                ))}

                {/* 横線（行） */}
                {Array.from({ length: totalRows + 1 }).map((_, i) => (
                  <Line
                    key={`hline-${i}`}
                    points={[0, i * ROW_HEIGHT, effectiveTotalDays * DAY_WIDTH, i * ROW_HEIGHT]}
                    stroke={GRID_COLOR}
                    strokeWidth={0.5}
                    listening={false}
                  />
                ))}

                {/* 印刷ページ境界線 */}
                {printPageBreakRows.map((y, i) => (
                  <Line
                    key={`page-break-${i}`}
                    points={[0, y, effectiveTotalDays * DAY_WIDTH, y]}
                    stroke="#3B82F6"
                    strokeWidth={1.5}
                    dash={[8, 4]}
                    listening={false}
                  />
                ))}

                {/* 作業（矢印）- viewStartOffset + ページオフセット考慮、範囲外はクリップ */}
                {activities.map((activity) => {
                  const fromNode = getNode(activity.fromNodeId)
                  const toNode = getNode(activity.toNodeId)
                  if (!fromNode || !toNode) return null

                  // ページ範囲外のアクティビティはスキップ
                  const pageTopY = pageStartRow * ROW_HEIGHT
                  const pageBottomY = pageEndRow * ROW_HEIGHT
                  const minY = Math.min(fromNode.position.y, toNode.position.y)
                  const maxY = Math.max(fromNode.position.y, toNode.position.y)
                  if (maxY < pageTopY - ROW_HEIGHT || minY >= pageBottomY + ROW_HEIGHT) return null

                  // ドラッグ中のノード位置を反映
                  const effectiveFromPos = draggedNodePos?.nodeId === activity.fromNodeId
                    ? { x: draggedNodePos.x + viewStartDayOffset * DAY_WIDTH, y: draggedNodePos.y + pageTopY }
                    : fromNode.position
                  const effectiveToPos = draggedNodePos?.nodeId === activity.toNodeId
                    ? { x: draggedNodePos.x + viewStartDayOffset * DAY_WIDTH, y: draggedNodePos.y + pageTopY }
                    : toNode.position

                  // viewStartDayOffsetを考慮した位置調整
                  const adjustedFromX = effectiveFromPos.x - viewStartDayOffset * DAY_WIDTH
                  const adjustedToX = effectiveToPos.x - viewStartDayOffset * DAY_WIDTH

                  // 表示範囲：0 から visibleWidth まで
                  const visibleWidth = effectiveTotalDays * DAY_WIDTH

                  // 両端とも表示範囲外（同じ側）なら非表示
                  const bothLeftOfView = adjustedFromX < 0 && adjustedToX < 0
                  const bothRightOfView = adjustedFromX >= visibleWidth && adjustedToX >= visibleWidth

                  if (bothLeftOfView || bothRightOfView) return null

                  // 座標を表示範囲にクリップ
                  const clippedFromX = Math.max(0, Math.min(visibleWidth, adjustedFromX))
                  const clippedToX = Math.max(0, Math.min(visibleWidth, adjustedToX))

                  // クリップ後のY座標を計算（線形補間）
                  let clippedFromY = effectiveFromPos.y
                  let clippedToY = effectiveToPos.y

                  // 開始点が範囲外の場合、Y座標を補間
                  if (adjustedFromX !== clippedFromX && adjustedFromX !== adjustedToX) {
                    const t = (clippedFromX - adjustedFromX) / (adjustedToX - adjustedFromX)
                    clippedFromY = effectiveFromPos.y + t * (effectiveToPos.y - effectiveFromPos.y)
                  }

                  // 終点が範囲外の場合、Y座標を補間
                  if (adjustedToX !== clippedToX && adjustedFromX !== adjustedToX) {
                    const t = (clippedToX - adjustedFromX) / (adjustedToX - adjustedFromX)
                    clippedToY = effectiveFromPos.y + t * (effectiveToPos.y - effectiveFromPos.y)
                  }

                  const adjustedFromNode = {
                    ...fromNode,
                    position: { x: clippedFromX, y: clippedFromY - pageTopY },
                  }
                  const adjustedToNode = {
                    ...toNode,
                    position: { x: clippedToX, y: clippedToY - pageTopY },
                  }

                  // クリップされた場合はフラグを渡す
                  const isFromClipped = adjustedFromX !== clippedFromX
                  const isToClipped = adjustedToX !== clippedToX

                  // 稼働日を考慮したカレンダー日数を計算
                  const expectedCalendarDays = getCalendarDaysForWorkdays(
                    fromNode.position.x,
                    activity.duration
                  )

                  // 非稼働日の範囲を計算（表示座標ベース）
                  // + DAY_WIDTH で垂直線（同一X）でも少なくとも1日分の範囲を確保
                  const nonWorkdayRanges = getNonWorkdayRanges(
                    Math.min(fromNode.position.x, toNode.position.x),
                    Math.max(fromNode.position.x, toNode.position.x) + DAY_WIDTH
                  ).map(range => ({
                    startX: range.startX - viewStartDayOffset * DAY_WIDTH,
                    endX: range.endX - viewStartDayOffset * DAY_WIDTH
                  }))

                  return (
                    <ActivityArrow
                      key={activity.id}
                      activity={activity}
                      fromNode={adjustedFromNode}
                      toNode={adjustedToNode}
                      isSelected={selectedActivityId === activity.id || selectedActivityIds.includes(activity.id)}
                      isChainSelected={chainHighlightIds.includes(activity.id)}
                      maxLeftDays={chainHighlightIds.includes(activity.id) ? getShiftRange(activity.id).maxLeft : 0}
                      cornerRadius={edgeCornerRadius}
                      dayWidth={DAY_WIDTH}
                      expectedCalendarDays={expectedCalendarDays}
                      nonWorkdayRanges={nonWorkdayRanges}
                      onClick={editMode !== 'draw' ? (modifiers) => handleActivityClick(activity.id, modifiers) : undefined}
                      onMouseDown={editMode === 'pathSelect' ? (modifiers) => handleActivityMouseDown(activity.id, modifiers) : undefined}
                      isPathSelectMode={editMode === 'pathSelect'}
                      isFromClipped={isFromClipped}
                      isToClipped={isToClipped}
                      originalFromX={adjustedFromX}
                      originalFromY={effectiveFromPos.y}
                      originalToX={adjustedToX}
                      originalToY={effectiveToPos.y}
                      defaultTextAlign={projectSettings.defaultActivityDisplay.textAlign ?? 'center'}
                      defaultLeaderLineStyle={projectSettings.defaultActivityDisplay.leaderLineStyle ?? 'line'}
                      onLabelDragEnd={(offset) => updateActivity(activity.id, { labelOffset: offset })}
                    />
                  )
                })}

                {/* フロートドラッグ ゴーストプレビュー */}
                {floatDragDeltaDays !== 0 && chainHighlightIds.length > 0 && (
                  <Group opacity={0.35} listening={false}>
                    {activities
                      .filter(a => chainHighlightIds.includes(a.id))
                      .map(activity => {
                        const fromNode = nodesMap.get(activity.fromNodeId)
                        const toNode = nodesMap.get(activity.toNodeId)
                        if (!fromNode || !toNode) return null
                        const ghostShiftPx = floatDragDeltaDays * DAY_WIDTH
                        const ghostColor = floatDragDeltaDays > 0 ? '#F97316' : '#3B82F6'
                        const pageTopY = pageStartRow * ROW_HEIGHT
                        const gFromX = fromNode.position.x - viewStartDayOffset * DAY_WIDTH + ghostShiftPx
                        const gToX = toNode.position.x - viewStartDayOffset * DAY_WIDTH + ghostShiftPx
                        const gFromY = fromNode.position.y - pageTopY
                        const gToY = toNode.position.y - pageTopY

                        // アクティビティの実際のルーティングで折れ線を計算
                        const gdx = gToX - gFromX
                        const gdy = gToY - gFromY
                        const bendCount = activity.bendCount ?? 1
                        const routingMode = activity.routingMode ?? 'vertical'
                        let isHFirst: boolean
                        switch (routingMode) {
                          case 'horizontal': isHFirst = true; break
                          case 'vertical': isHFirst = false; break
                          default: isHFirst = Math.abs(gdx) >= Math.abs(gdy); break
                        }
                        let ghostPts: number[]
                        if (bendCount === 0 || (gdy === 0 && gdx === 0)) {
                          ghostPts = [gFromX, gFromY, gToX, gToY]
                        } else if (bendCount === 1) {
                          if (gdy === 0 || gdx === 0) {
                            ghostPts = [gFromX, gFromY, gToX, gToY]
                          } else if (isHFirst) {
                            ghostPts = [gFromX, gFromY, gToX, gFromY, gToX, gToY]
                          } else {
                            ghostPts = [gFromX, gFromY, gFromX, gToY, gToX, gToY]
                          }
                        } else {
                          if (isHFirst) {
                            if (gdy === 0) { ghostPts = [gFromX, gFromY, gToX, gToY] }
                            else { const midX = gFromX + gdx / 2; ghostPts = [gFromX, gFromY, midX, gFromY, midX, gToY, gToX, gToY] }
                          } else {
                            if (gdx === 0) { ghostPts = [gFromX, gFromY, gToX, gToY] }
                            else { const midY = gFromY + gdy / 2; ghostPts = [gFromX, gFromY, gFromX, midY, gToX, midY, gToX, gToY] }
                          }
                        }

                        // 始点・終点の位置（折れ線の最初と最後）
                        const startX = ghostPts[0], startY = ghostPts[1]
                        const endX = ghostPts[ghostPts.length - 2], endY = ghostPts[ghostPts.length - 1]
                        return (
                          <Group key={`ghost-${activity.id}`}>
                            <Line
                              points={ghostPts}
                              stroke={ghostColor}
                              strokeWidth={2}
                              dash={[6, 3]}
                              listening={false}
                            />
                            <Line
                              points={[startX - 4, startY - 4, startX + 4, startY + 4]}
                              stroke={ghostColor}
                              strokeWidth={1}
                              listening={false}
                            />
                            <Line
                              points={[startX + 4, startY - 4, startX - 4, startY + 4]}
                              stroke={ghostColor}
                              strokeWidth={1}
                              listening={false}
                            />
                            <Line
                              points={[endX - 4, endY - 4, endX + 4, endY + 4]}
                              stroke={ghostColor}
                              strokeWidth={1}
                              listening={false}
                            />
                            <Line
                              points={[endX + 4, endY - 4, endX - 4, endY + 4]}
                              stroke={ghostColor}
                              strokeWidth={1}
                              listening={false}
                            />
                          </Group>
                        )
                      })}
                  </Group>
                )}

                {/* 結合点（ノード）- viewStartDayOffset + ページオフセット考慮 */}
                {sortedNodes.map((node) => {
                  // バナーのみ接続ノード: 選択中のバナーに関連する場合のみ表示
                  const connActs = activities.filter(a => a.fromNodeId === node.id || a.toNodeId === node.id)
                  const isBannerOnly = connActs.length > 0 && connActs.every(a => a.displaySettings.displayType === 'banner')
                  if (isBannerOnly) {
                    const hasSelectedBanner = connActs.some(a => a.id === selectedActivityId || selectedActivityIds.includes(a.id))
                    if (!hasSelectedBanner) return null
                  }

                  // viewStartDayOffsetを考慮した位置調整
                  const adjustedX = node.position.x - viewStartDayOffset * DAY_WIDTH

                  // 表示範囲外のノードはスキップ（厳密にカット）
                  const visibleWidth = effectiveTotalDays * DAY_WIDTH
                  if (adjustedX < 0 || adjustedX >= visibleWidth) {
                    return null
                  }

                  // ページ範囲外のノードはスキップ
                  const pageTopY = pageStartRow * ROW_HEIGHT
                  const pageBottomY = pageEndRow * ROW_HEIGHT
                  if (node.position.y < pageTopY - ROW_HEIGHT || node.position.y >= pageBottomY + ROW_HEIGHT) {
                    return null
                  }

                  const adjustedNode = {
                    ...node,
                    position: { x: adjustedX, y: node.position.y - pageTopY },
                  }

                  // エッジ上にあるノードは半円表示
                  const semiCircleDir = getNodeSemiCircleDirection(node.id)

                  return (
                    <EventNodeShape
                      key={node.id}
                      node={adjustedNode}
                      isSelected={selectedNodeId === node.id || selectedNodeIds.includes(node.id)}
                      isOnCriticalPath={isNodeOnCriticalPath(node.id)}
                      semiCircleDirection={semiCircleDir}
                      onClick={() => handleNodeClick(node.id)}
                      onContextMenu={(e) => {
                        e.evt.preventDefault()
                        if ((editMode === 'draw' || editMode === 'banner') && activityStartNodeId) {
                          setActivityStartNode(null)
                        }
                      }}
                      onDragMove={(pos) => setDraggedNodePos({ nodeId: node.id, x: pos.x, y: pos.y })}
                      onDragEnd={(pos) => {
                        setDraggedNodePos(null)
                        handleNodeDragEnd(node.id, {
                          x: pos.x + viewStartDayOffset * DAY_WIDTH,
                          y: pos.y + pageStartRow * ROW_HEIGHT,
                        })
                      }}
                      draggable={editMode === 'select' || editMode === 'pathSelect'}
                    />
                  )
                })}

                {/* テキストボックス */}
                {textboxes.map((textbox) => {
                  const adjustedX = textbox.position.x - viewStartDayOffset * DAY_WIDTH
                  return (
                    <TextBoxNode
                      key={textbox.id}
                      textbox={{ ...textbox, position: { ...textbox.position, x: adjustedX, y: textbox.position.y - pageStartRow * ROW_HEIGHT } }}
                      isSelected={selectedTextBoxId === textbox.id}
                      onSelect={(id) => {
                        selectTextBox(id)
                        clearSelection()
                      }}
                      onDragMove={(_id, x, y) => {
                        const dayIndex = Math.max(0, Math.floor(x / DAY_WIDTH))
                        const ghostX = dayIndex * DAY_WIDTH + DAY_WIDTH / 2
                        const rowIndex = Math.max(0, Math.round((y - ROW_HEIGHT / 2) / ROW_HEIGHT))
                        const ghostY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2
                        setTbDragGhost({ x: ghostX, y: ghostY })
                      }}
                      onDragEnd={(id, x, y) => {
                        const dayIndex = Math.max(0, Math.floor(x / DAY_WIDTH))
                        const snappedX = (dayIndex + viewStartDayOffset) * DAY_WIDTH + DAY_WIDTH / 2
                        const rowIndex = Math.max(0, Math.round((y - ROW_HEIGHT / 2) / ROW_HEIGHT))
                        const snappedY = (rowIndex + pageStartRow) * ROW_HEIGHT + ROW_HEIGHT / 2
                        updateTextBox(id, { position: { x: snappedX, y: snappedY } })
                        setTbDragGhost(null)
                      }}
                      onDoubleClick={(id) => {
                        selectTextBox(id)
                        clearSelection()
                      }}
                    />
                  )
                })}

                {/* 進捗線（雷線） */}
                {progressLines.length > 0 && (
                  <ProgressLineLayer
                    progressLines={progressLines.filter(pl => pl.baseDate && pl.visible).map(pl => ({
                      ...pl,
                      baseDateX: pl.baseDateX - viewStartDayOffset * DAY_WIDTH,
                    }))}
                    activeProgressLineId={activeProgressLineId}
                    dayWidth={DAY_WIDTH}
                    rowHeight={ROW_HEIGHT}
                    totalRows={totalRows}
                    hierarchyRows={hierarchyRows.slice(pageStartRow, pageStartRow + totalRows)}
                    editingRowIndex={editMode === 'progress' ? (progressHoverRow != null ? progressHoverRow - pageStartRow : null) : null}
                    showOffsetLabels={showProgressOffsetLabels}
                  />
                )}

                {/* S字カーブ（行内オーバーレイ） */}
                {showSCurve && (() => {
                  const activitiesArray = Array.from(activitiesMap.values())
                  const activePL = progressLines.find(pl => pl.id === activeProgressLineId)
                  const planned = calcPlannedCurve(activitiesArray, projectDuration)
                  const actual = activePL ? calcActualCurve(activitiesArray, activePL, projectDuration) : []
                  return (
                    <SCurveOverlay
                      plannedCurve={planned}
                      actualCurve={actual}
                      totalRows={totalRows}
                      rowHeight={ROW_HEIGHT}
                      dayWidth={DAY_WIDTH}
                      effectiveTotalDays={effectiveTotalDays}
                      projectDuration={projectDuration}
                    />
                  )
                })()}

                {/* ゴーストプレビュー（テキストモード配置時） */}
                {editMode === 'text' && ghostPosition && (
                  <Group opacity={0.3} listening={false}>
                    <Rect
                      x={textModeVertical ? ghostPosition.x - 6.5 : ghostPosition.x}
                      y={textModeVertical ? ghostPosition.y : ghostPosition.y - 6.5}
                      width={textModeVertical ? 13 : 60}
                      height={textModeVertical ? 60 : 13}
                      fill="#E5E7EB"
                      stroke="#9CA3AF"
                      strokeWidth={1}
                      cornerRadius={2}
                    />
                  </Group>
                )}

                {/* ゴーストプレビュー（テキストボックス ドラッグ中） */}
                {tbDragGhost && (
                  <Group opacity={0.4} listening={false}>
                    <Rect
                      x={tbDragGhost.x - 2}
                      y={tbDragGhost.y - 2}
                      width={4}
                      height={4}
                      fill="#3B82F6"
                      cornerRadius={2}
                    />
                    <Line
                      points={[tbDragGhost.x - 8, tbDragGhost.y, tbDragGhost.x + 8, tbDragGhost.y]}
                      stroke="#3B82F6"
                      strokeWidth={0.5}
                      dash={[2, 2]}
                    />
                    <Line
                      points={[tbDragGhost.x, tbDragGhost.y - 8, tbDragGhost.x, tbDragGhost.y + 8]}
                      stroke="#3B82F6"
                      strokeWidth={0.5}
                      dash={[2, 2]}
                    />
                  </Group>
                )}

                {/* 進捗線モード: ノード/パス上でもクリック捕捉するための透明Rect */}
                {editMode === 'progress' && (
                  <Rect
                    x={-viewStartDayOffset * DAY_WIDTH}
                    y={0}
                    width={(effectiveTotalDays + viewStartDayOffset) * DAY_WIDTH}
                    height={totalRows * ROW_HEIGHT}
                    fill="transparent"
                    onClick={handleCanvasClick}
                    onMouseMove={handleCanvasMouseMove}
                  />
                )}

                {/* ゴーストプレビュー（進捗線モード時） */}
                {editMode === 'progress' && ghostPosition && (() => {
                  const activePL = progressLines.find(pl => pl.id === activeProgressLineId)
                  if (!activePL || !activePL.baseDate) {
                    // 基準日未設定: 垂直線ゴーストプレビュー
                    return (
                      <Group opacity={0.4} listening={false}>
                        <Line
                          points={[ghostPosition.x, 0, ghostPosition.x, totalRows * ROW_HEIGHT]}
                          stroke="#DC2626"
                          strokeWidth={2}
                          dash={[6, 3]}
                        />
                      </Group>
                    )
                  } else if (progressHoverRow != null) {
                    // 基準日設定済み: 編集先ゴーストプレビュー（クリック先の丸マーカー）
                    const localRow = progressHoverRow - pageStartRow
                    if (localRow >= 0 && localRow < totalRows) {
                      const y = localRow * ROW_HEIGHT + ROW_HEIGHT / 2
                      return (
                        <Group opacity={0.4} listening={false}>
                          <Circle
                            x={ghostPosition.x}
                            y={y}
                            radius={5}
                            fill="#DC2626"
                            stroke="white"
                            strokeWidth={1.5}
                          />
                        </Group>
                      )
                    }
                  }
                  return null
                })()}

                {/* ゴーストプレビュー（描画/バナーモード時） */}
                {(editMode === 'draw' || editMode === 'banner') && ghostPosition && (
                  <Group opacity={0.3} listening={false}>
                    {editMode === 'draw' ? (
                      <>
                        {/* ゴーストノード */}
                        <EventNodeShape
                          node={{
                            id: '__ghost__',
                            number: 0,
                            position: { x: ghostPosition.x, y: ghostPosition.y },
                            earliestTime: 0,
                            latestTime: 0,
                            slack: 0,
                          }}
                          isSelected={false}
                          isOnCriticalPath={false}
                          draggable={false}
                        />
                        {/* ゴーストパス（開始ノードがある場合） */}
                        {activityStartNodeId && (() => {
                          const startNode = getNode(activityStartNodeId)
                          if (!startNode) return null
                          const adjustedStartX = startNode.position.x - viewStartDayOffset * DAY_WIDTH
                          const adjustedStartNode = {
                            ...startNode,
                            position: { x: adjustedStartX, y: startNode.position.y - pageStartRow * ROW_HEIGHT },
                          }
                          const ghostToNode = {
                            id: '__ghost_to__',
                            number: 0,
                            position: { x: ghostPosition.x, y: ghostPosition.y },
                            earliestTime: 0,
                            latestTime: 0,
                            slack: 0,
                          }
                          const ghostToDataX = ghostPosition.x + viewStartDayOffset * DAY_WIDTH
                          const ghostWorkdays = getWorkdaysBetweenUtil(
                            startNode.position.x, ghostToDataX,
                            startDate, DAY_WIDTH, calendar
                          )
                          const ghostActivity: Activity = {
                            id: '__ghost_activity__',
                            fromNodeId: activityStartNodeId,
                            toNodeId: '__ghost_to__',
                            name: `${ghostWorkdays}`,
                            duration: ghostWorkdays,
                            durationMode: 'manual',
                            isDummy: true,
                            isCritical: false,
                            es: 0, ef: 0, ls: 0, lf: 0,
                            totalFloat: 0,
                            freeFloat: 0,
                            displaySettings: {
                              showName: false,
                              showDuration: false,
                              showCrew: false,
                              lineStyle: 'dashed',
                              lineColor: '#6B7280',
                              lineWidth: 1,
                            },
                          }
                          const midX = (adjustedStartX + ghostPosition.x) / 2
                          const midY = (adjustedStartNode.position.y + ghostPosition.y) / 2
                          return (
                            <Group>
                              <ActivityArrow
                                activity={ghostActivity}
                                fromNode={adjustedStartNode}
                                toNode={ghostToNode}
                                isSelected={false}
                                cornerRadius={edgeCornerRadius}
                                dayWidth={DAY_WIDTH}
                              />
                              {ghostWorkdays > 0 && (
                                <Text
                                  x={midX}
                                  y={midY - 16}
                                  text={`${ghostWorkdays}`}
                                  fontSize={11}
                                  fill="#6B7280"
                                  align="center"
                                  offsetX={0}
                                  listening={false}
                                />
                              )}
                            </Group>
                          )
                        })()}
                      </>
                    ) : (
                      <>
                        {/* バナーモードゴースト */}
                        {!activityStartNodeId ? (
                          // 開始前: 小さなヘキサゴンマーカー
                          <Line
                            points={(() => {
                              const cx = ghostPosition.x
                              const cy = ghostPosition.y
                              const r = 8
                              const tipW = 4
                              return [
                                cx - r + tipW, cy - r * 0.6,
                                cx + r - tipW, cy - r * 0.6,
                                cx + r, cy,
                                cx + r - tipW, cy + r * 0.6,
                                cx - r + tipW, cy + r * 0.6,
                                cx - r, cy,
                              ]
                            })()}
                            closed
                            fill="#3B82F6"
                            opacity={0.6}
                          />
                        ) : (() => {
                          // 接続中: ヘキサゴンバナープレビュー
                          const startNode = getNode(activityStartNodeId)
                          if (!startNode) return null
                          const fx = startNode.position.x - viewStartDayOffset * DAY_WIDTH
                          const fy = startNode.position.y - pageStartRow * ROW_HEIGHT
                          const tx = ghostPosition.x
                          const cy = fy
                          const bannerWidth = Math.abs(tx - fx)
                          const halfH = ROW_HEIGHT * 0.3
                          const tipW = Math.min(halfH * 0.8, bannerWidth * 0.15)
                          const leftX = Math.min(fx, tx)

                          const ghostToDataX = ghostPosition.x + viewStartDayOffset * DAY_WIDTH
                          const ghostWorkdays = getWorkdaysBetweenUtil(
                            startNode.position.x, ghostToDataX,
                            startDate, DAY_WIDTH, calendar
                          )

                          return (
                            <Group>
                              <Line
                                points={[
                                  leftX + tipW, cy - halfH,
                                  leftX + bannerWidth - tipW, cy - halfH,
                                  leftX + bannerWidth, cy,
                                  leftX + bannerWidth - tipW, cy + halfH,
                                  leftX + tipW, cy + halfH,
                                  leftX, cy,
                                ]}
                                closed
                                fill="#3B82F6"
                                opacity={0.4}
                                stroke="#3B82F6"
                                strokeWidth={1}
                              />
                              {ghostWorkdays > 0 && (
                                <Text
                                  x={leftX + tipW}
                                  y={cy - 6}
                                  width={bannerWidth - tipW * 2}
                                  text={`${ghostWorkdays}日`}
                                  fontSize={11}
                                  fill="#3B82F6"
                                  align="center"
                                  listening={false}
                                />
                              )}
                            </Group>
                          )
                        })()}
                      </>
                    )}
                  </Group>
                )}
              </Group>
            </Layer>

          </Stage>

          {/* キャンバススクロールバー（外側の relative div 基準で Stage 領域に重ねる） */}
          <CanvasScrollbars left={headerPanelWidth} top={NAV_HEIGHT} />

          {/* 情報オーバーレイ */}
          <div className="absolute top-20 right-4 bg-white/90 rounded px-3 py-2 text-xs shadow">
            <div className="text-gray-600">
              モード:{' '}
              <span className="font-medium text-gray-800">
                {editMode === 'select' && '選択'}
                {editMode === 'pathSelect' && 'パス選択'}
                {editMode === 'draw' && '描画'}
                {editMode === 'text' && 'テキスト'}
                {editMode === 'progress' && '進捗線'}
                {editMode === 'banner' && 'バナー'}
              </span>
            </div>
            <div className="text-gray-500 mt-1">
              拡大: {Math.round(canvasScale * 100)}%
            </div>
            {editMode === 'draw' && (
              <div className="text-blue-600 mt-1">
                {activityStartNodeId
                  ? 'クリックで次のノード追加＆接続（右クリックで終了）'
                  : 'クリックでノード追加'}
              </div>
            )}
            {editMode === 'banner' && (
              <div className="text-blue-600 mt-1">
                {activityStartNodeId
                  ? 'クリックで次のノード追加＆バナー接続（右クリックで終了）'
                  : 'クリックで開始ノード追加（Spaceで矢印モードに戻る）'}
              </div>
            )}
            {editMode === 'progress' && (
              <div className="text-red-600 mt-1">
                {(() => {
                  const activePL = progressLines.find(pl => pl.id === activeProgressLineId)
                  return !activePL || !activePL.baseDate
                    ? 'クリックで基準日を設定'
                    : 'クリックで行の進捗位置を設定'
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
