/**
 * プロジェクト設定ダイアログ
 * 表示期間、レイアウト、ヘッダー列などの設定
 */

import { useState } from 'react'
import { useADMStore } from '@/stores/admStore'
import { PAPER_ROW_DEFAULTS } from '@/types/adm'
import type { LayoutPaperSize, HeaderColumnType, CalendarHeaderRowType } from '@/types/adm'

interface ProjectSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ProjectSettingsDialog({ isOpen, onClose }: ProjectSettingsDialogProps) {
  const projectSettings = useADMStore((state) => state.projectSettings)
  const updateProjectSettings = useADMStore((state) => state.updateProjectSettings)

  // マスタ操作
  const getMasterItems = useADMStore((state) => state.getMasterItems)
  const addMasterItem = useADMStore((state) => state.addMasterItem)
  const deleteMasterItem = useADMStore((state) => state.deleteMasterItem)
  const getCustomMasterItems = useADMStore((state) => state.getCustomMasterItems)
  const addCustomMasterItem = useADMStore((state) => state.addCustomMasterItem)
  const deleteCustomMasterItem = useADMStore((state) => state.deleteCustomMasterItem)

  // 棟マスタ操作
  const getBuildingsArray = useADMStore((state) => state.getBuildingsArray)
  const addBuilding = useADMStore((state) => state.addBuilding)
  const deleteBuilding = useADMStore((state) => state.deleteBuilding)

  // マスタ編集モーダル
  const [masterEditModal, setMasterEditModal] = useState<{
    type: 'zone' | 'room' | 'detail' | 'grid' | 'custom' | 'building'
    label: string
    columnId?: string
  } | null>(null)
  const [newMasterItemName, setNewMasterItemName] = useState('')

  // ドラッグ状態
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)

  // ヘッダー列の表示切替
  const handleColumnVisibilityChange = (columnId: string, visible: boolean) => {
    const newColumns = projectSettings.headerColumns.map((col) =>
      col.id === columnId ? { ...col, visible } : col
    )
    updateProjectSettings({ headerColumns: newColumns })
  }

  // ヘッダー列の幅変更
  const handleColumnWidthChange = (columnId: string, width: number) => {
    const newColumns = projectSettings.headerColumns.map((col) =>
      col.id === columnId ? { ...col, width: Math.max(30, Math.min(200, width)) } : col
    )
    updateProjectSettings({ headerColumns: newColumns })
  }

  // ドラッグ&ドロップハンドラー
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedColumnId(columnId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    if (!draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null)
      return
    }

    const sortedColumns = [...projectSettings.headerColumns].sort((a, b) => a.order - b.order)
    const draggedIndex = sortedColumns.findIndex((col) => col.id === draggedColumnId)
    const targetIndex = sortedColumns.findIndex((col) => col.id === targetColumnId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumnId(null)
      return
    }

    // 順番を入れ替え
    const newColumns = projectSettings.headerColumns.map((col) => {
      if (col.id === draggedColumnId) {
        return { ...col, order: sortedColumns[targetIndex].order }
      }
      if (col.id === targetColumnId) {
        return { ...col, order: sortedColumns[draggedIndex].order }
      }
      return col
    })

    updateProjectSettings({ headerColumns: newColumns })
    setDraggedColumnId(null)
  }

  // カレンダーヘッダー行設定
  const ALL_HEADER_ROW_TYPES: CalendarHeaderRowType[] = ['fiscalYear', 'year', 'month', 'day', 'weekday', 'holiday']
  const HEADER_ROW_LABELS: Record<CalendarHeaderRowType, string> = {
    fiscalYear: '年度', year: '年', month: '月', day: '日', weekday: '曜日', holiday: '祝日名',
  }
  const [headerDragIdx, setHeaderDragIdx] = useState<number | null>(null)
  const currentHeaderRows = projectSettings.calendarHeaderRows ?? ['day', 'weekday']
  const monthlyWeeklyLabel = projectSettings.monthlyWeeklyLabel ?? false

  const removeHeaderRow = (idx: number) => {
    updateProjectSettings({ calendarHeaderRows: currentHeaderRows.filter((_, i) => i !== idx) })
  }
  const addHeaderRow = (type: CalendarHeaderRowType) => {
    if (currentHeaderRows.length >= 3) return
    updateProjectSettings({ calendarHeaderRows: [...currentHeaderRows, type] })
  }
  const onHeaderDragStart = (e: React.DragEvent, idx: number) => {
    setHeaderDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onHeaderDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (headerDragIdx === null || headerDragIdx === idx) return
    const newRows = [...currentHeaderRows]
    const [removed] = newRows.splice(headerDragIdx, 1)
    newRows.splice(idx, 0, removed)
    updateProjectSettings({ calendarHeaderRows: newRows })
    setHeaderDragIdx(idx)
  }
  const onHeaderDragEnd = () => setHeaderDragIdx(null)

  // マスタ種別を取得
  const getMasterType = (columnType: HeaderColumnType): 'zone' | 'room' | 'detail' | 'grid' | 'building' | null => {
    switch (columnType) {
      case 'building':
        return 'building'
      case 'zone':
        return 'zone'
      case 'floor':
        return 'room'
      case 'detail':
        return 'detail'
      case 'grid':
        return 'grid'
      default:
        return null
    }
  }

  // マスタラベルを取得
  const getMasterLabel = (columnType: HeaderColumnType): string => {
    switch (columnType) {
      case 'building':
        return '棟マスタ'
      case 'zone':
        return '工区マスタ'
      case 'floor':
        return '階数マスタ'
      case 'detail':
        return '部屋名マスタ'
      case 'grid':
        return '通りマスタ'
      default:
        return ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* ダイアログ */}
      <div className="relative bg-white rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">工程表設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* 作業所名 */}
          <section className="mb-6">
            <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded" />
              作業所名
            </h3>
            <input
              type="text"
              value={projectSettings.workplaceName || ''}
              onChange={(e) => updateProjectSettings({ workplaceName: e.target.value })}
              className="w-full px-3 py-2 border rounded text-sm"
              placeholder="○○ビル新築工事"
            />
          </section>

          {/* 工期設定 */}
          <section className="mb-6">
            <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded" />
              工期設定
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">開始日</label>
                <input
                  type="date"
                  value={projectSettings.startDate}
                  onChange={(e) => {
                    const newStartDate = e.target.value
                    const start = new Date(newStartDate)
                    const end = new Date(projectSettings.endDate)
                    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                    const newTotalDays = Math.max(1, diffDays)
                    updateProjectSettings({
                      startDate: newStartDate,
                      totalProjectDays: newTotalDays,
                      ...(projectSettings.displayMode === 'master' ? { displayDays: newTotalDays } : {}),
                    })
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">終了日</label>
                <input
                  type="date"
                  value={projectSettings.endDate}
                  onChange={(e) => {
                    const newEndDate = e.target.value
                    const start = new Date(projectSettings.startDate)
                    const end = new Date(newEndDate)
                    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                    const newTotalDays = Math.max(1, diffDays)
                    updateProjectSettings({
                      endDate: newEndDate,
                      totalProjectDays: newTotalDays,
                      ...(projectSettings.displayMode === 'master' ? { displayDays: newTotalDays } : {}),
                    })
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              全体工期: {projectSettings.totalProjectDays}日間
            </p>
          </section>

          {/* 表示設定 */}
          <section className="mb-6">
            <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-green-500 rounded" />
              表示設定
            </h3>

            {/* 表示モード */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">表示モード</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateProjectSettings({ displayMode: 'weekly2', displayDays: 14 })}
                  className={`px-3 py-1.5 text-sm rounded ${
                    projectSettings.displayMode === 'weekly2'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  週間(2週)
                </button>
                <button
                  onClick={() => updateProjectSettings({ displayMode: 'weekly3', displayDays: 21 })}
                  className={`px-3 py-1.5 text-sm rounded ${
                    projectSettings.displayMode === 'weekly3'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  週間(3週)
                </button>
                <button
                  onClick={() => updateProjectSettings({ displayMode: 'monthly', displayDays: 31 })}
                  className={`px-3 py-1.5 text-sm rounded ${
                    projectSettings.displayMode === 'monthly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  月次
                </button>
                <button
                  onClick={() => updateProjectSettings({ displayMode: 'master', displayDays: projectSettings.totalProjectDays })}
                  className={`px-3 py-1.5 text-sm rounded ${
                    projectSettings.displayMode === 'master'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  マスター
                </button>
              </div>
            </div>

            {/* 週開始曜日（週次表示用） */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">週開始曜日（週次表示用）</label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateProjectSettings({ weekStartDay: 1 })}
                  className={`px-4 py-1.5 text-sm rounded ${
                    projectSettings.weekStartDay === 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  月曜始まり
                </button>
                <button
                  onClick={() => updateProjectSettings({ weekStartDay: 0 })}
                  className={`px-4 py-1.5 text-sm rounded ${
                    projectSettings.weekStartDay === 0
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  日曜始まり
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ※ 月次・マスター表示は1日始まり固定です
              </p>
            </div>

            {/* 行の高さ */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">行の高さ (px)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={24}
                  max={80}
                  step={2}
                  value={projectSettings.rowHeight || 40}
                  onChange={(e) => updateProjectSettings({ rowHeight: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-10 text-right">{projectSettings.rowHeight || 40}</span>
              </div>
            </div>

            {/* カレンダーヘッダー行設定 */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                カレンダーヘッダー行
                <span className="text-xs text-gray-400 ml-1">（最大3行）</span>
              </label>
              <div className="flex gap-4 items-start">
                {/* テーブル型UI */}
                <div className="flex-1 min-w-0">
                  <div className="border border-gray-200 rounded overflow-hidden">
                    {currentHeaderRows.map((rowType, idx) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => onHeaderDragStart(e, idx)}
                        onDragOver={(e) => onHeaderDragOver(e, idx)}
                        onDragEnd={onHeaderDragEnd}
                        className={`flex items-center gap-2 px-2 py-1.5 border-b border-gray-100 last:border-b-0 bg-white select-none ${headerDragIdx === idx ? 'opacity-40' : ''}`}
                      >
                        <span className="text-gray-300 text-sm cursor-grab">⠿</span>
                        <span className="text-xs text-gray-700 flex-1">{HEADER_ROW_LABELS[rowType]}</span>
                        <button onClick={() => removeHeaderRow(idx)} className="text-gray-300 hover:text-red-400 text-sm leading-none px-0.5">×</button>
                      </div>
                    ))}
                    {currentHeaderRows.length === 0 && (
                      <div className="px-2 py-2 text-xs text-gray-400 text-center">行を追加してください</div>
                    )}
                  </div>
                  {currentHeaderRows.length < 3 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ALL_HEADER_ROW_TYPES.filter(t => !currentHeaderRows.includes(t)).map(rowType => (
                        <button key={rowType} onClick={() => addHeaderRow(rowType)} className="text-xs px-2 py-0.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-100">
                          +{HEADER_ROW_LABELS[rowType]}
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mt-3">
                    <input
                      type="checkbox"
                      checked={monthlyWeeklyLabel}
                      onChange={(e) => updateProjectSettings({ monthlyWeeklyLabel: e.target.checked })}
                    />
                    月次・マスター表示時：日付・曜日を7日おきで表示
                  </label>
                </div>
                {/* プレビュー */}
                <div className="shrink-0">
                  <div className="text-xs text-gray-500 mb-1">プレビュー</div>
                  {(() => {
                    const DAY_W = 22
                    const PREV_H = 50
                    const rowCount = Math.max(1, currentHeaderRows.length)
                    const rowH = PREV_H / rowCount
                    const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']
                    const samples = Array.from({ length: 14 }, (_, k) => new Date(2026, 6, 14 + k))
                    return (
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', display: 'inline-block' }}>
                        <svg width={DAY_W * 14} height={PREV_H} style={{ display: 'block' }}>
                          {samples.map((d, si) => {
                            const isWE = d.getDay() === 0 || d.getDay() === 6
                            return (
                              <g key={si} transform={`translate(${si * DAY_W}, 0)`}>
                                <rect width={DAY_W} height={PREV_H} fill={isWE ? '#FEE2E2' : '#F3F4F6'} stroke="#e5e7eb" strokeWidth={0.5} />
                                <g style={{ overflow: 'visible' }}>
                                  {currentHeaderRows.map((rowType, ri) => {
                                    const ty = ri * rowH + rowH * 0.68
                                    const hidden = monthlyWeeklyLabel && (rowType === 'day' || rowType === 'weekday') && si % 7 !== 0
                                    let label = ''
                                    if (!hidden) {
                                      switch (rowType) {
                                        case 'year':
                                          label = (si === 0 || (d.getMonth() === 0 && d.getDate() === 1)) ? `${d.getFullYear()}` : ''
                                          break
                                        case 'fiscalYear': {
                                          const isBound = si === 0 || (d.getMonth() === 3 && d.getDate() === 1)
                                          if (isBound) {
                                            const fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
                                            label = `${fy}年度`
                                          }
                                          break
                                        }
                                        case 'month':
                                          label = (si === 0 || d.getDate() === 1) ? `${d.getMonth() + 1}月` : ''
                                          break
                                        case 'day': label = `${d.getDate()}`; break
                                        case 'weekday': label = DAY_NAMES[d.getDay()]; break
                                        case 'holiday': label = ''; break
                                      }
                                    }
                                    if (!label) return null
                                    const isSpanLabel = rowType === 'year' || rowType === 'fiscalYear' || rowType === 'month'
                                    const fill = rowType === 'holiday' ? '#1D4ED8' : (rowType === 'weekday' ? (isWE ? '#DC2626' : '#6B7280') : (isWE ? '#DC2626' : '#374151'))
                                    const fs = Math.max(5.5, Math.min(9, rowH * 0.55))
                                    return (
                                      <text key={ri} x={isSpanLabel ? 2 : DAY_W / 2} y={ty} fontSize={fs} textAnchor={isSpanLabel ? 'start' : 'middle'} fill={fill}>{label}</text>
                                    )
                                  })}
                                </g>
                              </g>
                            )
                          })}
                        </svg>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </section>

          {/* レイアウト設定 */}
          <section className="mb-6">
            <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-purple-500 rounded" />
              レイアウト設定
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* 用紙サイズ */}
              <div>
                <label className="block text-sm text-gray-600 mb-2">用紙サイズ</label>
                <div className="flex gap-2">
                  {(['A4', 'A3', 'A2', 'A1'] as LayoutPaperSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        const rows = PAPER_ROW_DEFAULTS[size][projectSettings.paperOrientation]
                        updateProjectSettings({ paperSize: size, displayRows: rows })
                      }}
                      className={`px-4 py-1.5 text-sm rounded ${
                        projectSettings.paperSize === size
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* 用紙方向 */}
              <div>
                <label className="block text-sm text-gray-600 mb-2">用紙方向</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const rows = PAPER_ROW_DEFAULTS[projectSettings.paperSize]['portrait']
                      updateProjectSettings({ paperOrientation: 'portrait', displayRows: rows })
                    }}
                    className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                      projectSettings.paperOrientation === 'portrait'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <span className="inline-block w-3 h-4 border border-current" />
                    縦
                  </button>
                  <button
                    onClick={() => {
                      const rows = PAPER_ROW_DEFAULTS[projectSettings.paperSize]['landscape']
                      updateProjectSettings({ paperOrientation: 'landscape', displayRows: rows })
                    }}
                    className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                      projectSettings.paperOrientation === 'landscape'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <span className="inline-block w-4 h-3 border border-current" />
                    横
                  </button>
                </div>
              </div>
            </div>

          </section>

          {/* デフォルト作業表示 */}
          <section className="mb-6">
            <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-yellow-500 rounded" />
              デフォルト作業表示
            </h3>

            {/* テキスト配置 */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">テキスト配置</label>
              <div className="flex gap-2">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() =>
                      updateProjectSettings({
                        defaultActivityDisplay: {
                          ...projectSettings.defaultActivityDisplay,
                          textAlign: align,
                        },
                      })
                    }
                    className={`px-4 py-1.5 text-sm rounded ${
                      (projectSettings.defaultActivityDisplay.textAlign ?? 'center') === align
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {align === 'left' ? '左' : align === 'center' ? '中央' : '右'}
                  </button>
                ))}
              </div>
            </div>

            {/* 引き出し線スタイル */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">引き出し線スタイル</label>
              <div className="flex gap-2">
                {(['line', 'underline'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() =>
                      updateProjectSettings({
                        defaultActivityDisplay: {
                          ...projectSettings.defaultActivityDisplay,
                          leaderLineStyle: style,
                        },
                      })
                    }
                    className={`px-4 py-1.5 text-sm rounded ${
                      (projectSettings.defaultActivityDisplay.leaderLineStyle ?? 'line') === style
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {style === 'line' ? '直線のみ' : '下線付き'}
                  </button>
                ))}
              </div>
            </div>

            {/* エッジ曲がり角R */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">エッジ曲がり角R</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={projectSettings.defaultActivityDisplay.edgeCornerRadius ?? projectSettings.edgeCornerRadius}
                  onChange={(e) =>
                    updateProjectSettings({
                      defaultActivityDisplay: {
                        ...projectSettings.defaultActivityDisplay,
                        edgeCornerRadius: Math.max(0, Math.min(20, parseInt(e.target.value) || 0)),
                      },
                    })
                  }
                  className="w-20 px-2 py-1.5 border rounded text-sm text-center"
                />
                <span className="text-sm text-gray-500">px</span>
              </div>
            </div>

            {/* 棟セレクター表示 */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={projectSettings.showBuildingSelector ?? false}
                  onChange={(e) => updateProjectSettings({ showBuildingSelector: e.target.checked })}
                  className="rounded"
                />
                棟セレクター表示
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                ON: ナビバーに棟切替セレクターを表示し、棟列を非表示にします
              </p>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              ※ 新規作業のデフォルト設定です。個別の作業は右パネルで変更できます。
            </p>
          </section>

          {/* ヘッダー列設定 */}
          <section>
            <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-orange-500 rounded" />
              ヘッダー列設定
            </h3>
            <div className="space-y-2">
              {projectSettings.headerColumns
                .sort((a, b) => a.order - b.order)
                .map((col) => {
                  const masterType = getMasterType(col.type)
                  return (
                    <div
                      key={col.id}
                      className={`flex items-center gap-2 p-2 bg-gray-50 rounded transition-colors ${
                        draggedColumnId === col.id ? 'opacity-50 bg-blue-100' : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragEnd={() => setDraggedColumnId(null)}
                    >
                      {/* ドラッグハンドル */}
                      <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none">
                        ⋮⋮
                      </div>
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={(e) => handleColumnVisibilityChange(col.id, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm min-w-[40px]">{col.label}</span>
                      {/* マスタ管理ボタン */}
                      {masterType && (
                        <button
                          onClick={() => setMasterEditModal({ type: masterType, label: getMasterLabel(col.type) })}
                          className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          マスタ
                        </button>
                      )}
                      {col.type === 'custom' && (
                        <button
                          onClick={() => setMasterEditModal({ type: 'custom', label: `${col.label}マスタ`, columnId: col.id })}
                          className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          マスタ
                        </button>
                      )}
                      <div className="flex-1" />
                      <input
                        type="number"
                        value={col.width}
                        onChange={(e) => handleColumnWidthChange(col.id, parseInt(e.target.value) || 50)}
                        className="w-16 px-2 py-1 text-sm border rounded"
                        disabled={!col.visible}
                      />
                      <span className="text-xs text-gray-400">px</span>
                      {col.type === 'custom' && (
                        <button
                          onClick={() => {
                            const newColumns = projectSettings.headerColumns.filter((c) => c.id !== col.id)
                            updateProjectSettings({ headerColumns: newColumns })
                          }}
                          className="text-red-400 hover:text-red-600 text-sm ml-1"
                          title="カスタム列を削除"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
            <button
              onClick={() => {
                const name = prompt('カスタム列名を入力')
                if (name && name.trim()) {
                  const maxOrder = Math.max(...projectSettings.headerColumns.map((c) => c.order), -1)
                  const newCol = {
                    id: `col-custom-${Date.now()}`,
                    type: 'custom' as const,
                    label: name.trim(),
                    width: 60,
                    order: maxOrder + 1,
                    visible: true,
                  }
                  updateProjectSettings({ headerColumns: [...projectSettings.headerColumns, newCol] })
                }
              }}
              className="mt-2 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
            >
              + カスタム列追加
            </button>
          </section>
        </div>

        {/* マスタ編集モーダル */}
        {masterEditModal && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
            <div className="bg-white rounded-lg shadow-xl w-[350px] max-h-[400px] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <h3 className="font-medium">{masterEditModal.label}</h3>
                <button
                  onClick={() => {
                    setMasterEditModal(null)
                    setNewMasterItemName('')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="p-4 max-h-[250px] overflow-y-auto">
                {(() => {
                  const items = masterEditModal.type === 'building'
                    ? getBuildingsArray()
                    : masterEditModal.type === 'custom' && masterEditModal.columnId
                      ? getCustomMasterItems(masterEditModal.columnId)
                      : getMasterItems(masterEditModal.type as 'zone' | 'room' | 'detail' | 'grid')
                  return items.length > 0 ? (
                    <div className="space-y-1">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <span className="flex-1 text-sm">{item.name}</span>
                          <button
                            onClick={() => {
                              if (masterEditModal.type === 'building') {
                                deleteBuilding(item.id)
                              } else if (masterEditModal.type === 'custom' && masterEditModal.columnId) {
                                deleteCustomMasterItem(masterEditModal.columnId, item.id)
                              } else {
                                deleteMasterItem(masterEditModal.type as 'zone' | 'room' | 'detail' | 'grid', item.id)
                              }
                            }}
                            className="text-red-400 hover:text-red-600 text-sm"
                            title="削除"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-4">
                      マスタ項目がありません
                    </p>
                  )
                })()}
              </div>
              <div className="p-3 border-t bg-gray-50 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMasterItemName}
                    onChange={(e) => setNewMasterItemName(e.target.value)}
                    placeholder="新規追加..."
                    className="flex-1 px-3 py-1.5 text-sm border rounded focus:border-blue-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newMasterItemName.trim()) {
                        if (masterEditModal.type === 'building') {
                          addBuilding(newMasterItemName.trim())
                        } else if (masterEditModal.type === 'custom' && masterEditModal.columnId) {
                          addCustomMasterItem(masterEditModal.columnId, newMasterItemName.trim())
                        } else {
                          addMasterItem(masterEditModal.type as 'zone' | 'room' | 'detail' | 'grid', newMasterItemName.trim())
                        }
                        setNewMasterItemName('')
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newMasterItemName.trim()) {
                        if (masterEditModal.type === 'building') {
                          addBuilding(newMasterItemName.trim())
                        } else if (masterEditModal.type === 'custom' && masterEditModal.columnId) {
                          addCustomMasterItem(masterEditModal.columnId, newMasterItemName.trim())
                        } else {
                          addMasterItem(masterEditModal.type as 'zone' | 'room' | 'detail' | 'grid', newMasterItemName.trim())
                        }
                        setNewMasterItemName('')
                      }
                    }}
                    disabled={!newMasterItemName.trim()}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    追加
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const csv = `名前\n`
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${masterEditModal.label}_template.csv`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    テンプレートDL
                  </button>
                  <label className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 cursor-pointer">
                    インポート
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          const text = ev.target?.result as string
                          const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
                          // ヘッダー行をスキップ
                          const dataLines = lines.slice(1)
                          for (const line of dataLines) {
                            const name = line.replace(/^"(.*)"$/, '$1').trim()
                            if (name) {
                              if (masterEditModal.type === 'building') {
                                addBuilding(name)
                              } else if (masterEditModal.type === 'custom' && masterEditModal.columnId) {
                                addCustomMasterItem(masterEditModal.columnId, name)
                              } else {
                                addMasterItem(masterEditModal.type as 'zone' | 'room' | 'detail' | 'grid', name)
                              }
                            }
                          }
                        }
                        reader.readAsText(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="flex justify-end px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
