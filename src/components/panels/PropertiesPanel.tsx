/**
 * プロパティパネル
 * 選択中の結合点/作業の編集専用
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useADMStore } from '@/stores/admStore'
import { useUIStore } from '@/stores/uiStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { useTextBoxStore } from '@/stores/textboxStore'
import { useBugakariStore } from '@/stores/bugakariStore'
import { getCalendarDaysForWorkdays as getCalendarDaysForWorkdaysUtil } from '@/utils/dateUtils'
import { getFilteredCategories, getDetailsForCategory, getLaborForDetail } from '@/data/bugakariMaster'
import { BugakariSettingsDialog } from '@/components/dialogs/BugakariSettingsDialog'
import type { WritingDirection, SnapAnchorX, SnapAnchorY } from '@/types/textbox'

const DAY_WIDTH = 30

export function PropertiesPanel() {
  const selectedNode = useADMStore((state) =>
    state.selectedNodeId ? state.nodes.get(state.selectedNodeId) ?? null : null
  )
  const selectedActivity = useADMStore((state) =>
    state.selectedActivityId ? state.activities.get(state.selectedActivityId) ?? null : null
  )
  const updateActivity = useADMStore((state) => state.updateActivity)
  const updateNode = useADMStore((state) => state.updateNode)
  const getNode = useADMStore((state) => state.getNode)
  const moveNodeWithPropagate = useADMStore((state) => state.moveNodeWithPropagate)
  const recalculateCPM = useADMStore((state) => state.recalculateCPM)
  const projectSettings = useADMStore((state) => state.projectSettings)
  const startDate = projectSettings.startDate
  const calendar = useCalendarStore((state) => state.calendar)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [bugakariPickerOpen, setBugakariPickerOpen] = useState(false)

  // early return後に呼ばれるとhooks順序が崩れるため、全hooksをここで宣言
  const editMode = useADMStore((state) => state.editMode)
  const progressLines = useADMStore((state) => state.progressLines)
  const activeProgressLineId = useADMStore((state) => state.activeProgressLineId)
  const addProgressLine = useADMStore((state) => state.addProgressLine)
  const clearProgressLine = useADMStore((state) => state.clearProgressLine)
  const setActiveProgressLine = useADMStore((state) => state.setActiveProgressLine)
  const showSCurve = useUIStore((state) => state.showSCurve)
  const toggleSCurve = useUIStore((state) => state.toggleSCurve)
  const showProgressOffsetLabels = useUIStore((state) => state.showProgressOffsetLabels)
  const toggleProgressOffsetLabels = useUIStore((state) => state.toggleProgressOffsetLabels)

  // テキストボックス
  const selectedTextBoxId = useTextBoxStore((state) => state.selectedTextBoxId)
  const selectedTextBox = useTextBoxStore((state) =>
    state.selectedTextBoxId ? state.textboxes.get(state.selectedTextBoxId) ?? null : null
  )
  const updateTextBox = useTextBoxStore((state) => state.updateTextBox)

  // 工数変更時に toNode を自動移動する
  const updateDurationAndMoveNode = useCallback((newDuration: number, updates: Record<string, unknown> = {}) => {
    if (!selectedActivity) return
    const fromNode = getNode(selectedActivity.fromNodeId)
    const toNode = getNode(selectedActivity.toNodeId)
    if (!fromNode || !toNode) return

    // 作業データを更新
    updateActivity(selectedActivity.id, { ...updates, duration: newDuration })

    // toNode の新しいX座標を計算（fromNode.x + カレンダー日数 * DAY_WIDTH）
    const calDays = getCalendarDaysForWorkdaysUtil(fromNode.position.x, newDuration, new Date(startDate), DAY_WIDTH, calendar)
    const newToX = fromNode.position.x + calDays * DAY_WIDTH
    // 後続ノード（ダミー含む）も再帰的に伝播して逆転を防止
    moveNodeWithPropagate(toNode.id, { x: newToX, y: toNode.position.y })
    recalculateCPM()
  }, [selectedActivity, getNode, updateActivity, moveNodeWithPropagate, recalculateCPM, startDate, calendar])

  // テキストエリア自動フォーカス
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (selectedTextBoxId) {
      // Konvaキャンバスクリック後のDOM更新を待ってからフォーカス
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textareaRef.current?.focus()
        })
      })
    }
  }, [selectedTextBoxId])

  // テキストボックスが選択されている場合
  if (selectedTextBox && selectedTextBoxId) {
    return (
      <div className="h-full bg-white border-l border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">テキストボックス</h2>

        {/* テキスト入力 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">テキスト</label>
          <textarea
            ref={textareaRef}
            value={selectedTextBox.text}
            onChange={(e) => updateTextBox(selectedTextBoxId, { text: e.target.value })}
            placeholder="テキストを入力..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
          />
        </div>

        {/* 横書き / 縦書き */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">書字方向</label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (selectedTextBox.writingDirection === 'vertical') {
                  updateTextBox(selectedTextBoxId, { writingDirection: 'horizontal' as WritingDirection, width: selectedTextBox.height, height: selectedTextBox.width, snapAnchorX: 'left', snapAnchorY: 'center' })
                }
              }}
              className={`flex-1 px-3 py-1.5 text-sm rounded ${
                selectedTextBox.writingDirection !== 'vertical'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              横書き
            </button>
            <button
              onClick={() => {
                if (selectedTextBox.writingDirection !== 'vertical') {
                  updateTextBox(selectedTextBoxId, { writingDirection: 'vertical' as WritingDirection, width: selectedTextBox.height, height: selectedTextBox.width, snapAnchorX: 'center', snapAnchorY: 'top' })
                }
              }}
              className={`flex-1 px-3 py-1.5 text-sm rounded ${
                selectedTextBox.writingDirection === 'vertical'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              縦書き
            </button>
          </div>
        </div>

        {/* 色設定（横並び、チェックボックス付き） */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">文字色</label>
              <input
                type="color"
                value={selectedTextBox.fontColor}
                onChange={(e) => updateTextBox(selectedTextBoxId, { fontColor: e.target.value })}
                className="w-full h-7 rounded cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <input
                  type="checkbox"
                  checked={selectedTextBox.showBorder}
                  onChange={(e) => updateTextBox(selectedTextBoxId, { showBorder: e.target.checked })}
                  className="rounded w-3 h-3"
                />
                枠線色
              </label>
              <input
                type="color"
                value={selectedTextBox.borderColor}
                onChange={(e) => updateTextBox(selectedTextBoxId, { borderColor: e.target.value, showBorder: true })}
                className={`w-full h-7 rounded cursor-pointer ${!selectedTextBox.showBorder ? 'opacity-30' : ''}`}
              />
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <input
                  type="checkbox"
                  checked={selectedTextBox.showBackground !== false}
                  onChange={(e) => updateTextBox(selectedTextBoxId, { showBackground: e.target.checked })}
                  className="rounded w-3 h-3"
                />
                背景色
              </label>
              <input
                type="color"
                value={selectedTextBox.backgroundColor}
                onChange={(e) => updateTextBox(selectedTextBoxId, { backgroundColor: e.target.value, showBackground: true })}
                className={`w-full h-7 rounded cursor-pointer ${selectedTextBox.showBackground === false ? 'opacity-30' : ''}`}
              />
            </div>
          </div>
        </div>

        {/* スナップ位置（3x3グリッド） */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">スナップ位置</label>
          <div className="inline-grid grid-cols-3 gap-0.5">
            {(['top', 'center', 'bottom'] as SnapAnchorY[]).map((ay) =>
              (['left', 'center', 'right'] as SnapAnchorX[]).map((ax) => (
                <button
                  key={`${ax}-${ay}`}
                  onClick={() => updateTextBox(selectedTextBoxId, { snapAnchorX: ax, snapAnchorY: ay })}
                  className={`w-6 h-6 rounded-sm ${
                    (selectedTextBox.snapAnchorX ?? 'left') === ax && (selectedTextBox.snapAnchorY ?? 'center') === ay
                      ? 'bg-blue-600'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                  title={`${ay === 'top' ? '上' : ay === 'center' ? '中' : '下'}${ax === 'left' ? '左' : ax === 'center' ? '中' : '右'}`}
                />
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  // 何も選択されていない場合
  if (!selectedNode && !selectedActivity) {
    return (
      <div className="h-full bg-white border-l border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">プロパティ</h2>
        <p className="text-gray-500 text-sm">
          結合点または作業を選択してください
        </p>

        {/* 進捗線設定 */}
        {(editMode === 'progress' || progressLines.length > 0) && (
          <div className="mt-4 p-3 bg-red-50 rounded text-sm">
            <h3 className="font-medium mb-2 text-red-700">進捗線（雷線）</h3>

            {/* 進捗線リスト */}
            {progressLines.map((pl, idx) => (
              <div
                key={pl.id}
                className={`flex items-center justify-between py-1 px-2 rounded mb-1 cursor-pointer ${
                  pl.id === activeProgressLineId ? 'bg-red-100' : 'hover:bg-red-50'
                }`}
                onClick={() => setActiveProgressLine(pl.id)}
              >
                <span className="text-gray-700 text-xs">
                  #{idx + 1} {pl.baseDate ?? '未設定'}
                </span>
                {pl.id === activeProgressLineId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); clearProgressLine() }}
                    className="text-red-500 text-xs hover:text-red-700"
                    title="この進捗線を削除"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {/* 進捗線を追加 */}
            <button
              onClick={() => addProgressLine()}
              className="w-full mt-1 px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
            >
              + 進捗線を追加
            </button>

            {/* オフセット日数表示トグル */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showProgressOffsetLabels}
                onChange={toggleProgressOffsetLabels}
                className="rounded border-gray-300"
              />
              <span className="text-xs text-gray-700">オフセット日数を表示</span>
            </label>

            {editMode === 'progress' && (() => {
              const activePL = progressLines.find(pl => pl.id === activeProgressLineId)
              if (!activePL || !activePL.baseDate) {
                return <p className="text-gray-600 mt-2">キャンバスをクリックして基準日を設定</p>
              }
              return null
            })()}
          </div>
        )}

        {/* S字カーブ表示設定 */}
        <div className="mt-4 p-3 bg-green-50 rounded text-sm">
          <h3 className="font-medium mb-2 text-green-700">S字カーブ</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSCurve}
              onChange={toggleSCurve}
              className="rounded"
            />
            <span className="text-gray-700 text-xs">行内にオーバーレイ表示</span>
          </label>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded text-sm">
          <h3 className="font-medium mb-2">操作ガイド</h3>
          <ul className="text-gray-600 space-y-1">
            <li>・<b>選択</b>: ノード選択・移動</li>
            <li>・<b>描画</b>: クリックでノード追加</li>
            <li>・<b>テキスト</b>: クリックでテキストボックス追加</li>
            <li>・<b>進捗線</b>: 基準日設定→各行の進捗位置をクリック</li>
            <li>・<b>Space</b>: 描画⇔進捗線の切替</li>
            <li>・<b>右クリック</b>: 連続描画終了 / テキストモード解除</li>
            <li>・<b>Shift+右クリック</b>: コンテキストメニュー</li>
            <li>・<b>Delete</b>: 選択要素を削除</li>
            <li>・<b>Ctrl+Z</b>: 元に戻す</li>
            <li>・<b>Ctrl+Y</b>: やり直し</li>
            <li>・<b>Esc</b>: 選択解除</li>
            <li>・<b>Ctrl+;/-</b>: 拡大/縮小</li>
            <li>・<b>Ctrl+0</b>: ズームリセット</li>
            <li>・<b>ホイール</b>: 縦スクロール</li>
            <li>・<b>Shift+ホイール</b>: 横スクロール</li>
          </ul>
        </div>
      </div>
    )
  }

  // 結合点が選択されている場合
  if (selectedNode) {
    return (
      <div className="h-full bg-white border-l border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">結合点 #{selectedNode.number}</h2>

        {/* ラベル */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ラベル（オプション）
          </label>
          <input
            type="text"
            value={selectedNode.label ?? ''}
            onChange={(e) => updateNode(selectedNode.id, { label: e.target.value || undefined })}
            placeholder="例: 着工、竣工"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {/* CPM結果 */}
        <div className="mb-4 p-3 bg-blue-50 rounded">
          <h3 className="font-medium text-sm mb-2">CPM計算結果</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">最早時刻(ET):</span>
              <span className="ml-1 font-medium">{selectedNode.earliestTime}</span>
            </div>
            <div>
              <span className="text-gray-500">最遅時刻(LT):</span>
              <span className="ml-1 font-medium">{selectedNode.latestTime}</span>
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-gray-500">スラック:</span>
            <span
              className={`ml-1 font-medium ${selectedNode.slack === 0 ? 'text-red-600' : ''}`}
            >
              {selectedNode.slack}
            </span>
            {selectedNode.slack === 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                クリティカル
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 作業が選択されている場合
  if (selectedActivity) {
    const fromNode = getNode(selectedActivity.fromNodeId)
    const toNode = getNode(selectedActivity.toNodeId)
    const lineWidth = selectedActivity.displaySettings.lineWidth

    return (
      <div className="h-full bg-white border-l border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">作業</h2>

        {/* 作業名 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">作業名</label>
          <textarea
            value={selectedActivity.name}
            onChange={(e) => updateActivity(selectedActivity.id, { name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
            rows={2}
          />
        </div>

        {/* 工数入力エリア */}
        <div
          className="mb-4 p-3 rounded-md"
          style={{
            background: 'rgba(0,0,0,0.03)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {/* 工数入力モード */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">工数入力モード</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateActivity(selectedActivity.id, { durationMode: 'manual' })}
                className={`flex-1 px-3 py-1.5 text-sm rounded ${
                  selectedActivity.durationMode !== 'calculated'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                直接入力
              </button>
              <button
                onClick={() => {
                  const quantity = selectedActivity.quantity ?? 0
                  const laborCount = selectedActivity.laborCount ?? 1
                  const productivity = selectedActivity.productivity ?? 1
                  const duration = laborCount > 0 && productivity > 0 && quantity > 0
                    ? Math.ceil(quantity / (laborCount * productivity))
                    : selectedActivity.duration
                  updateDurationAndMoveNode(duration, { durationMode: 'calculated' })
                }}
                className={`flex-1 px-3 py-1.5 text-sm rounded ${
                  selectedActivity.durationMode === 'calculated'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                歩掛計算
              </button>
            </div>
          </div>

          {/* 直接入力モード */}
          {selectedActivity.durationMode !== 'calculated' && (
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">所要日数</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={selectedActivity.duration}
                  onChange={(e) => updateDurationAndMoveNode(parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <span className="text-sm text-gray-500">日</span>
              </div>
            </div>
          )}

          {/* 歩掛計算モード */}
          {selectedActivity.durationMode === 'calculated' && (
            <div className="mb-3 p-3 bg-white/60 rounded space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">作業数量</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={selectedActivity.quantity ?? 0}
                    onChange={(e) => {
                      const quantity = parseFloat(e.target.value) || 0
                      const laborCount = selectedActivity.laborCount ?? 1
                      const productivity = selectedActivity.productivity ?? 1
                      const duration = laborCount > 0 && productivity > 0
                        ? Math.ceil(quantity / (laborCount * productivity))
                        : 1
                      updateDurationAndMoveNode(duration, { quantity })
                    }}
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    value={selectedActivity.quantityUnit ?? 'm³'}
                    onChange={(e) => updateActivity(selectedActivity.id, { quantityUnit: e.target.value })}
                    placeholder="単位"
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">人工（人数）</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={selectedActivity.laborCount ?? 1}
                    onChange={(e) => {
                      const laborCount = parseInt(e.target.value) || 1
                      const quantity = selectedActivity.quantity ?? 0
                      const productivity = selectedActivity.productivity ?? 1
                      const duration = laborCount > 0 && productivity > 0
                        ? Math.ceil(quantity / (laborCount * productivity))
                        : 1
                      updateDurationAndMoveNode(duration, { laborCount })
                    }}
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-sm text-gray-500">人</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  歩掛（1人1日あたり出来高）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.1"
                    value={selectedActivity.productivity ?? 1}
                    onChange={(e) => {
                      const productivity = parseFloat(e.target.value) || 1
                      const quantity = selectedActivity.quantity ?? 0
                      const laborCount = selectedActivity.laborCount ?? 1
                      const duration = laborCount > 0 && productivity > 0
                        ? Math.ceil(quantity / (laborCount * productivity))
                        : 1
                      updateDurationAndMoveNode(duration, { productivity })
                    }}
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-sm text-gray-500">{selectedActivity.quantityUnit ?? 'm³'}/人日</span>
                  <button
                    type="button"
                    onClick={() => setBugakariPickerOpen(true)}
                    className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded"
                    title="歩掛マスタから選択"
                  >
                    …
                  </button>
                </div>
              </div>

              {/* 歩掛マスタピッカーポップアップ */}
              {bugakariPickerOpen && (
                <BugakariPickerPopup
                  onSelect={(occupation, rate, unit) => {
                    const quantity = selectedActivity.quantity ?? 0
                    const laborCount = selectedActivity.laborCount ?? 1
                    const duration = laborCount > 0 && rate > 0
                      ? Math.ceil(quantity / (laborCount * rate))
                      : 1
                    updateDurationAndMoveNode(duration, {
                      productivity: rate,
                      crewId: occupation,
                      quantityUnit: unit,
                    })
                    setBugakariPickerOpen(false)
                  }}
                  onClose={() => setBugakariPickerOpen(false)}
                />
              )}

              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">計算工数:</span>
                  <span className="text-lg font-bold text-blue-600">{selectedActivity.duration}日</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  = {selectedActivity.quantity ?? 0} ÷ ({selectedActivity.laborCount ?? 1}人 × {selectedActivity.productivity ?? 1})
                </p>
              </div>
            </div>
          )}

          {/* チェックボックス横並び */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={selectedActivity.isDummy}
                onChange={(e) => {
                  const isDummy = e.target.checked
                  updateActivity(selectedActivity.id, {
                    isDummy,
                    duration: isDummy ? 0 : selectedActivity.duration,
                    displaySettings: {
                      ...selectedActivity.displaySettings,
                      showName: !isDummy,
                      showDuration: !isDummy,
                      lineStyle: isDummy ? 'dashed' : 'solid',
                      lineColor: isDummy ? '#9CA3AF' : '#374151',
                    },
                  })
                }}
                className="rounded"
              />
              <span className="text-xs text-gray-600">ダミー</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={selectedActivity.displaySettings.showDuration}
                onChange={(e) =>
                  updateActivity(selectedActivity.id, {
                    displaySettings: {
                      ...selectedActivity.displaySettings,
                      showDuration: e.target.checked,
                    },
                  })
                }
                className="rounded"
              />
              <span className="text-xs text-gray-600">日数表示</span>
            </label>
          </div>
        </div>

        {/* 表示タイプ（矢印/バナー） */}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">表示タイプ</label>
          <div className="flex gap-1">
            <button
              onClick={() =>
                updateActivity(selectedActivity.id, {
                  displaySettings: {
                    ...selectedActivity.displaySettings,
                    displayType: 'arrow',
                  },
                })
              }
              className={`flex-1 px-2 py-1 text-xs rounded border ${
                (selectedActivity.displaySettings.displayType ?? 'arrow') === 'arrow'
                  ? 'bg-blue-100 border-blue-400 text-blue-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              矢印
            </button>
            <button
              onClick={() =>
                updateActivity(selectedActivity.id, {
                  displaySettings: {
                    ...selectedActivity.displaySettings,
                    displayType: 'banner',
                  },
                })
              }
              className={`flex-1 px-2 py-1 text-xs rounded border ${
                selectedActivity.displaySettings.displayType === 'banner'
                  ? 'bg-blue-100 border-blue-400 text-blue-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              バナー
            </button>
          </div>
        </div>

        {/* 詳細設定（トグル） */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-3 py-2 mb-2 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <span>詳細設定</span>
          <span className="text-xs">{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && <>
        {/* 線種 + 線色（1行） */}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">線種 / 線色</label>
          <div className="flex gap-2 items-center">
            <select
              value={selectedActivity.displaySettings.lineStyle}
              onChange={(e) =>
                updateActivity(selectedActivity.id, {
                  displaySettings: {
                    ...selectedActivity.displaySettings,
                    lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted',
                  },
                })
              }
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="solid">実線</option>
              <option value="dashed">破線</option>
              <option value="dotted">点線</option>
            </select>
            <input
              type="color"
              value={selectedActivity.displaySettings.lineColor}
              onChange={(e) =>
                updateActivity(selectedActivity.id, {
                  displaySettings: {
                    ...selectedActivity.displaySettings,
                    lineColor: e.target.value,
                  },
                })
              }
              className="w-8 h-8 rounded cursor-pointer border border-gray-300"
            />
          </div>
        </div>

        {/* 線幅（0.1px単位 + ±ボタン） */}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">線幅</label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const newWidth = Math.max(0.1, Math.round((lineWidth - 0.1) * 10) / 10)
                updateActivity(selectedActivity.id, {
                  displaySettings: { ...selectedActivity.displaySettings, lineWidth: newWidth },
                })
              }}
              className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              −
            </button>
            <input
              type="number"
              step={0.1}
              min={0.1}
              max={10}
              value={lineWidth}
              onChange={(e) => {
                const newWidth = Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 1))
                updateActivity(selectedActivity.id, {
                  displaySettings: { ...selectedActivity.displaySettings, lineWidth: newWidth },
                })
              }}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
            />
            <button
              onClick={() => {
                const newWidth = Math.min(10, Math.round((lineWidth + 0.1) * 10) / 10)
                updateActivity(selectedActivity.id, {
                  displaySettings: { ...selectedActivity.displaySettings, lineWidth: newWidth },
                })
              }}
              className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              +
            </button>
            <span className="text-xs text-gray-500">px</span>
          </div>
        </div>

        {/* テキスト配置（既定なし、中央デフォルト） */}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">テキスト配置</label>
          <div className="flex gap-1">
            {([
              { value: 'left' as const, label: '左' },
              { value: 'center' as const, label: '中央' },
              { value: 'right' as const, label: '右' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  updateActivity(selectedActivity.id, {
                    displaySettings: {
                      ...selectedActivity.displaySettings,
                      textAlign: opt.value,
                    },
                  })
                }
                className={`flex-1 px-2 py-1 text-xs rounded ${
                  (selectedActivity.displaySettings.textAlign ?? 'center') === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 引き出し線スタイル（既定なし、下線付きデフォルト） */}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">引き出し線スタイル</label>
          <div className="flex gap-1">
            {([
              { value: 'line' as const, label: '直線' },
              { value: 'underline' as const, label: '下線付き' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  updateActivity(selectedActivity.id, {
                    displaySettings: {
                      ...selectedActivity.displaySettings,
                      leaderLineStyle: opt.value,
                    },
                  })
                }
                className={`flex-1 px-2 py-1 text-xs rounded ${
                  (selectedActivity.displaySettings.leaderLineStyle ?? 'underline') === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ラベル位置調整（リセットボタンのみ） */}
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">ラベル位置調整</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateActivity(selectedActivity.id, { labelOffset: undefined })}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
            >
              リセット
            </button>
            <span className="text-xs text-gray-400">ドラッグで移動可能</span>
          </div>
        </div>

        {/* 経路設定（折れ点） */}
        <div className="mb-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">折れ点の数</label>
              <div className="flex gap-1">
                {[0, 1, 2].map((count) => (
                  <button
                    key={count}
                    onClick={() =>
                      updateActivity(selectedActivity.id, {
                        bendCount: count as 0 | 1 | 2,
                      })
                    }
                    className={`flex-1 px-2 py-1 text-xs rounded ${
                      (selectedActivity.bendCount ?? 1) === count
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {count === 0 ? '直線' : count === 1 ? '1回' : '2回'}
                  </button>
                ))}
              </div>
            </div>
            {(selectedActivity.bendCount ?? 1) > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">折れ方向</label>
                <div className="flex gap-1">
                  {([
                    { value: 'horizontal' as const, label: '水平' },
                    { value: 'vertical' as const, label: '垂直' },
                    { value: 'direct' as const, label: '直線' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        updateActivity(selectedActivity.id, {
                          routingMode: opt.value,
                        })
                      }
                      className={`flex-1 px-2 py-1 text-xs rounded ${
                        (selectedActivity.routingMode ?? 'vertical') === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </>}

        {/* メモ */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
          <textarea
            value={selectedActivity.note ?? ''}
            onChange={(e) => updateActivity(selectedActivity.id, { note: e.target.value || undefined })}
            placeholder="作業の詳細や注意事項など"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
          />
        </div>

        {/* CPM結果 */}
        <div className="mb-4 p-3 bg-blue-50 rounded">
          <h3 className="font-medium text-sm mb-2">
            CPM計算結果 ○{fromNode?.number}→○{toNode?.number}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>ES: {selectedActivity.es}</div>
            <div>EF: {selectedActivity.ef}</div>
            <div>LS: {selectedActivity.ls}</div>
            <div>LF: {selectedActivity.lf}</div>
          </div>
          <div className="mt-2 pt-2 border-t border-blue-200 text-sm">
            <div>
              <span className="text-gray-600">トータルフロート:</span>
              <span
                className={`ml-1 font-medium ${
                  selectedActivity.totalFloat === 0 ? 'text-red-600' : ''
                }`}
              >
                {selectedActivity.totalFloat}
              </span>
            </div>
            <div>
              <span className="text-gray-600">フリーフロート:</span>
              <span className="ml-1">{selectedActivity.freeFloat}</span>
            </div>
          </div>
          {selectedActivity.isCritical && (
            <div className="mt-2 px-2 py-1 bg-red-100 text-red-700 text-sm rounded text-center">
              クリティカルパス上
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

// 歩掛マスタ選択ポップアップ
function BugakariPickerPopup({
  onSelect,
  onClose,
}: {
  onSelect: (occupation: string, rate: number, unit: string) => void
  onClose: () => void
}) {
  const enabledDokenCodes = useBugakariStore(s => s.enabledDokenCodes)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null)

  const categories = getFilteredCategories(enabledDokenCodes)
  const details = selectedCategory ? getDetailsForCategory(selectedCategory, enabledDokenCodes) : []
  const laborItems = selectedCategory && selectedDetail
    ? getLaborForDetail(selectedCategory, selectedDetail, enabledDokenCodes)
    : []

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-w-2xl w-[600px]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <span className="text-xs font-bold text-gray-700">歩掛マスタ</span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            ⚙ 土建設定
          </button>
        </div>

        {/* 3カラム */}
        <div className="flex divide-x divide-gray-200" style={{ height: 'min(60vh, 400px)' }}>
          {/* 左: 工種区分 */}
          <div className="w-1/3 overflow-y-auto">
            <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase">工種区分</div>
            {categories.map(cat => (
              <button
                key={cat.name}
                disabled={!cat.hasData}
                onClick={() => {
                  setSelectedCategory(cat.name)
                  setSelectedDetail(null)
                }}
                className={`w-full text-left px-3 py-1.5 text-sm ${
                  !cat.hasData
                    ? 'text-gray-300 cursor-not-allowed'
                    : selectedCategory === cat.name
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {cat.hasData ? '▸ ' : '  '}{cat.name}
              </button>
            ))}
          </div>

          {/* 中: 工種細目 */}
          <div className="w-1/3 overflow-y-auto">
            <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase">工種細目</div>
            {details.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">← 工種区分を選択</p>
            )}
            {details.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDetail(d)}
                className={`w-full text-left px-3 py-1.5 text-sm ${
                  selectedDetail === d
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* 右: 職種・歩掛 */}
          <div className="w-1/3 overflow-y-auto">
            <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase">職種・歩掛</div>
            {laborItems.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">← 工種細目を選択</p>
            )}
            {laborItems.map((item, i) => (
              <button
                key={i}
                onClick={() => onSelect(item.occupation, item.rate, item.unit)}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center justify-between group"
              >
                <span className="truncate">{item.occupation}</span>
                <span className="flex items-center gap-1 text-xs">
                  <span className="font-mono">{item.rate}</span>
                  <span className="text-blue-500 opacity-0 group-hover:opacity-100">▶</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <BugakariSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
