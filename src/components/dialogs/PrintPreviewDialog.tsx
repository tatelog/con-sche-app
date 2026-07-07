/**
 * 印刷プレビュー・PDF出力ダイアログ
 * 右パネル: 表題欄（作業所名・工期・作成日・改訂・情報欄チェック・押印欄トグル・フッターテキスト）
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { usePrintStore } from '@/stores/printStore'
import { exportToPDF, downloadPDF } from '@/utils/pdfExport'
import { PAPER_SIZES } from '@/types/print'
import type { InfoChecks } from '@/types/print'
import type { ProjectSettings } from '@/types/adm'
import { useADMStore } from '@/stores/admStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { useTextBoxStore } from '@/stores/textboxStore'
import { useUIStore } from '@/stores/uiStore'
import { computeViewStartDate } from '@/utils/dateUtils'
import { generateAllPageSVGs } from './SvgPreviewDialog'


interface PrintPreviewDialogProps {
  isOpen: boolean
  onClose: () => void
  projectSettings: ProjectSettings
}

export function PrintPreviewDialog({
  isOpen,
  onClose,
  projectSettings,
}: PrintPreviewDialogProps) {
  const settings = usePrintStore((state) => state.settings)
  const updateSettings = usePrintStore((state) => state.updateSettings)
  const updateTitleBlock = usePrintStore((state) => state.updateTitleBlock)
  const updateLayout = usePrintStore((state) => state.updateLayout)
  const updateSealSlot = usePrintStore((state) => state.updateSealSlot)
  const addSealSlot = usePrintStore((state) => state.addSealSlot)
  const removeSealSlot = usePrintStore((state) => state.removeSealSlot)

  // SVGベースPDF出力用
  const nodesMap = useADMStore((state) => state.nodes)
  const activitiesMap = useADMStore((state) => state.activities)
  const getHierarchyRows = useADMStore((state) => state.getHierarchyRows)
  const zones = useADMStore((state) => state.zones)
  const rooms = useADMStore((state) => state.rooms)
  const detailCategories = useADMStore((state) => state.detailCategories)
  const admCalendar = useCalendarStore((state) => state.calendar)
  const textboxesMap = useTextBoxStore((state) => state.textboxes)
  const progressLines = useADMStore((state) => state.progressLines)
  const activeProgressLineId = useADMStore((state) => state.activeProgressLineId)
  const projectDuration = useADMStore((state) => state.projectDuration)
  const showSCurve = useUIStore((state) => state.showSCurve)
  const [isExporting, setIsExporting] = useState(false)
  const [previewPage, setPreviewPage] = useState(0)
  const [previewZoom, setPreviewZoom] = useState(1.5)

  // 用紙サイズ
  const paperKey = projectSettings.paperSize === 'custom' ? 'A3' : projectSettings.paperSize as 'A4' | 'A3' | 'A2' | 'A1'
  const basePaper = PAPER_SIZES[paperKey]
  const [paperWidth, paperHeight] = projectSettings.paperOrientation === 'landscape'
    ? [basePaper.height, basePaper.width]
    : [basePaper.width, basePaper.height]

  // SVGベースプレビュー生成
  const { svgPages, svgTotalPages } = useMemo(() => {
    const hierarchyRows = getHierarchyRows()
    const nodes = Array.from(nodesMap.values())
    const activities = Array.from(activitiesMap.values())
    const visibleColumns = projectSettings.headerColumns
      .filter(col => col.visible).sort((a, b) => a.order - b.order)

    const viewStartDate = computeViewStartDate(projectSettings)
    const viewStartDayOffset = Math.round(
      (viewStartDate.getTime() - new Date(projectSettings.startDate).getTime()) / (1000 * 60 * 60 * 24)
    )

    let effectiveTotalDays = projectSettings.displayDays
    if (projectSettings.displayMode === 'monthly') {
      effectiveTotalDays = new Date(viewStartDate.getFullYear(), viewStartDate.getMonth() + 1, 0).getDate()
    }
    const dates: Date[] = []
    for (let i = 0; i < effectiveTotalDays; i++) {
      const d = new Date(viewStartDate)
      d.setDate(d.getDate() + i)
      dates.push(d)
    }

    const rowHeaderWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0)
    const svgWidth = rowHeaderWidth + effectiveTotalDays * 30
    const contentWidthMm = paperWidth - settings.margin.left - settings.margin.right
    const effectiveFooterH = (settings.titleBlock.showFooterText ?? false) ? settings.layout.footerHeight : 0
    const drawAreaHeightMm = paperHeight - settings.margin.top - settings.margin.bottom
      - settings.layout.headerHeight - effectiveFooterH
    const svgHeightLimit = drawAreaHeightMm * svgWidth / contentWidthMm
    const rowH = projectSettings.rowHeight || 40
    const printRowsPerPage = Math.max(1, Math.floor((svgHeightLimit - 50) / rowH))

    const textboxes = Array.from(textboxesMap.values())
    const pages = generateAllPageSVGs(
      projectSettings, hierarchyRows, nodes, activities,
      dates, admCalendar, nodesMap, visibleColumns, viewStartDayOffset,
      printRowsPerPage, textboxes, progressLines, activeProgressLineId, showSCurve, projectDuration, settings.showLegend,
    )
    const svgHeight = 50 + printRowsPerPage * rowH // HEADER_HEIGHT + rows
    return { svgPages: pages, svgTotalPages: pages.length, svgWidth, svgHeight }
  }, [projectSettings, nodesMap, activitiesMap, zones, rooms, detailCategories, admCalendar, paperWidth, paperHeight, settings.margin, settings.layout, settings.titleBlock.showFooterText, textboxesMap, progressLines, activeProgressLineId, showSCurve, projectDuration, settings.showLegend])

  // 工期をprojectSettingsから同期
  useEffect(() => {
    if (!isOpen) return
    updateTitleBlock({
      startDate: projectSettings.startDate,
      endDate: projectSettings.endDate,
      projectName: projectSettings.workplaceName || '',
    })
  }, [isOpen, projectSettings.startDate, projectSettings.endDate, projectSettings.workplaceName]) // eslint-disable-line react-hooks/exhaustive-deps

  // 用紙サイズプリセット
  const LAYOUT_PRESETS: Record<string, { headerH: number; footerH: number; infoW: number; sealW: number; rowHdrW: number }> = {
    A4: { headerH: 25, footerH: 20, infoW: 60, sealW: 60, rowHdrW: 25 },
    A3: { headerH: 30, footerH: 25, infoW: 80, sealW: 80, rowHdrW: 30 },
    A2: { headerH: 35, footerH: 25, infoW: 90, sealW: 100, rowHdrW: 35 },
    A1: { headerH: 40, footerH: 30, infoW: 100, sealW: 120, rowHdrW: 40 },
  }

  useEffect(() => {
    if (!isOpen) return
    const preset = LAYOUT_PRESETS[projectSettings.paperSize]
    if (preset) {
      updateLayout({
        headerHeight: preset.headerH,
        footerHeight: preset.footerH,
        infoBlockWidth: preset.infoW,
        sealBlockWidth: preset.sealW,
        rowHeaderWidth: preset.rowHdrW,
      })
    }
  }, [projectSettings.paperSize]) // eslint-disable-line react-hooks/exhaustive-deps

  // プレビュースケール
  const previewScale = useMemo(() => {
    return Math.min(480 / paperWidth, 480 / paperHeight)
  }, [paperWidth, paperHeight])

  const scaledW = paperWidth * previewScale
  const scaledH = paperHeight * previewScale

  // ドラッグ（水平: headerBottom/footerTop、垂直: infoLeft/sealLeft）
  type DragType = 'headerBottom' | 'footerTop' | 'infoLeft' | 'sealLeft' | null
  const [dragging, setDragging] = useState<DragType>(null)
  const dragStartRef = useRef<{ x: number; y: number; value: number }>({ x: 0, y: 0, value: 0 })


  const handleMouseDown = useCallback((type: NonNullable<DragType>, e: React.MouseEvent) => {
    e.preventDefault()
    const { layout } = settings
    let value = 0
    if (type === 'headerBottom') value = layout.headerHeight
    else if (type === 'footerTop') value = layout.footerHeight
    else if (type === 'infoLeft') value = layout.infoBlockWidth
    else if (type === 'sealLeft') value = layout.sealBlockWidth
    dragStartRef.current = { x: e.clientX, y: e.clientY, value }
    setDragging(type)
  }, [settings])


  useEffect(() => {
    if (!dragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const { x, y, value } = dragStartRef.current
      if (dragging === 'headerBottom') {
        const deltaMm = (e.clientY - y) / previewScale
        updateLayout({ headerHeight: Math.round(Math.max(15, Math.min(80, value + deltaMm))) })
      } else if (dragging === 'footerTop') {
        const deltaMm = (e.clientY - y) / previewScale
        updateLayout({ footerHeight: Math.round(Math.max(15, Math.min(59, value - deltaMm))) })
      } else if (dragging === 'infoLeft') {
        const deltaMm = (e.clientX - x) / previewScale
        updateLayout({ infoBlockWidth: Math.round(Math.max(30, Math.min(150, value - deltaMm))) })
      } else if (dragging === 'sealLeft') {
        const deltaMm = (e.clientX - x) / previewScale
        updateLayout({ sealBlockWidth: Math.round(Math.max(30, Math.min(200, value - deltaMm))) })
      }
    }
    const handleMouseUp = () => {
      setDragging(null)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, previewScale, updateLayout])

  if (!isOpen) return null

  const { margin, layout } = settings
  const m = {
    top: margin.top * previewScale,
    right: margin.right * previewScale,
    bottom: margin.bottom * previewScale,
    left: margin.left * previewScale,
  }
  const innerW = scaledW - m.left - m.right
  const innerH = scaledH - m.top - m.bottom
  const headerH = layout.headerHeight * previewScale
  const footerH = layout.footerHeight * previewScale
  const sealSlotCount = settings.sealBlock.slots.length
  const sealMm = settings.titleBlock.showSealBlock && sealSlotCount > 0
    ? layout.sealBlockWidth : 0
  const sealW = sealMm * previewScale
  const showInfo = settings.titleBlock.showInfoBlock ?? true
  const infoMm = showInfo ? layout.infoBlockWidth : 0
  const infoW = infoMm * previewScale

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const blob = await exportToPDF({ settings, svgPages, projectSettings })
      const filename = `${projectSettings.workplaceName || '工程表'}_第${settings.titleBlock.revisionNumber || 1}版.pdf`
      downloadPDF(blob, filename)
    } catch (err) {
      alert(`PDF出力エラー: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleInfoCheck = (key: keyof InfoChecks, checked: boolean) => {
    updateTitleBlock({
      infoChecks: { ...settings.titleBlock.infoChecks, [key]: checked },
    })
  }

  const tb = settings.titleBlock
  const ic = tb.infoChecks ?? { workplaceName: true, period: true, creationDate: true, revision: true }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-[960px] h-[85vh] max-h-[85vh] overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold">印刷プレビュー / PDF出力</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              用紙: {paperKey} {projectSettings.paperOrientation === 'landscape' ? '横' : '縦'} ({paperWidth}x{paperHeight}mm)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setPreviewPage(Math.max(0, previewPage - 1))}
                disabled={previewPage === 0}
                className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-30">&#9664;</button>
              <span className="text-sm font-medium">{previewPage + 1}/{svgTotalPages} ページ</span>
              <button onClick={() => setPreviewPage(Math.min(svgTotalPages - 1, previewPage + 1))}
                disabled={previewPage === svgTotalPages - 1}
                className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-50 disabled:opacity-30">&#9654;</button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))}
                className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-50">−</button>
              <span className="text-sm font-medium w-12 text-center">{Math.round(previewZoom * 100)}%</span>
              <button onClick={() => setPreviewZoom(z => Math.min(3, z + 0.25))}
                className="px-2 py-1 text-sm bg-white border rounded hover:bg-gray-50">+</button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex flex-1 overflow-hidden">
          {/* 左: プレビュー */}
          <div className="flex-1 p-4 bg-gray-100 overflow-auto"
            onWheel={(e) => e.stopPropagation()}>
            <div style={{ width: scaledW * previewZoom, height: scaledH * previewZoom, flexShrink: 0 }}>
            <div
              className="relative bg-white shadow-lg border"
              style={{ width: scaledW, height: scaledH, cursor: dragging ? 'ns-resize' : undefined, transform: `scale(${previewZoom})`, transformOrigin: 'top left' }}
            >
              <div className="absolute border border-gray-400" style={{ left: m.left, top: m.top, width: innerW, height: innerH }} />

              {/* ヘッダー（タイトル） */}
              <div className="absolute border border-blue-400 bg-blue-50/40"
                style={{ left: m.left, top: m.top, width: innerW - Math.min(sealW, innerW) - infoW, height: headerH }}>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-blue-500 font-medium select-none truncate px-1">
                  タイトル
                </span>
                <span className="absolute left-1 text-[6px] text-blue-400 select-none" style={{ bottom: 1 }}>
                  作成日
                </span>
                <span className="absolute right-1 text-[6px] text-blue-400 select-none" style={{ bottom: 1 }}>
                  改訂
                </span>
              </div>

              {/* 情報欄 */}
              {showInfo && (
              <div className="absolute border border-emerald-400 bg-emerald-50/40"
                style={{ left: m.left + innerW - Math.min(sealW, innerW) - infoW, top: m.top, width: infoW, height: headerH }}>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-emerald-500 font-medium select-none">情報</span>
              </div>
              )}

              {/* 押印欄 */}
              {sealW > 0 && (
                <div className="absolute border-2 border-dashed border-purple-400 bg-purple-50/40"
                  style={{ left: m.left + innerW - Math.min(sealW, innerW), top: m.top, width: Math.min(sealW, innerW), height: headerH }}>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] text-purple-500 font-medium select-none">押印欄</span>
                </div>
              )}

              {/* 描画エリア */}
              <div className="absolute border border-gray-300 bg-white overflow-hidden"
                style={{ left: m.left, top: m.top + headerH, width: innerW, height: innerH - headerH - (tb.showFooterText ? footerH : 0) }}>
                {svgPages.length > 0 ? (
                  <div dangerouslySetInnerHTML={{ __html: svgPages[previewPage] || '' }}
                    style={{ width: '100%', height: '100%' }}
                    className="[&>svg]:!w-full [&>svg]:!h-full [&>svg]:!max-w-full [&>svg]:!max-h-full [&>svg]:block" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400 select-none">描画エリア</span>
                )}
              </div>

              {/* フッター */}
              {tb.showFooterText && (
              <div className="absolute border border-green-400 bg-green-50/40"
                style={{ left: m.left, top: m.top + innerH - footerH, width: innerW, height: footerH }}>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-green-600 font-medium select-none">
                  フッター
                </span>
              </div>
              )}

              {/* ドラッグハンドル: ヘッダー下端（水平） */}
              <div className="absolute bg-blue-500 hover:bg-blue-600 rounded-full z-10"
                style={{ left: m.left + innerW * 0.3, top: m.top + headerH - 3, width: innerW * 0.4, height: 6, cursor: 'ns-resize' }}
                onMouseDown={(e) => handleMouseDown('headerBottom', e)}
                title={`ヘッダー高: ${layout.headerHeight}mm`} />
              {/* ドラッグハンドル: フッター上端（水平） */}
              {tb.showFooterText && (
              <div className="absolute bg-green-500 hover:bg-green-600 rounded-full z-10"
                style={{ left: m.left + innerW * 0.3, top: m.top + innerH - footerH - 3, width: innerW * 0.4, height: 6, cursor: 'ns-resize' }}
                onMouseDown={(e) => handleMouseDown('footerTop', e)}
                title={`フッター高: ${layout.footerHeight}mm (上限59mm)`} />
              )}
              {/* ドラッグハンドル: タイトル｜情報 境界（垂直） */}
              {showInfo && (
                <div className="absolute bg-emerald-500 hover:bg-emerald-600 rounded-full z-10"
                  style={{
                    left: m.left + innerW - Math.min(sealW, innerW) - infoW - 3,
                    top: m.top + headerH * 0.15,
                    width: 6,
                    height: headerH * 0.7,
                    cursor: 'ew-resize',
                  }}
                  onMouseDown={(e) => handleMouseDown('infoLeft', e)}
                  title={`情報欄幅: ${layout.infoBlockWidth}mm`} />
              )}
              {/* ドラッグハンドル: 情報｜押印 境界（垂直） */}
              {sealW > 0 && (
                <div className="absolute bg-purple-500 hover:bg-purple-600 rounded-full z-10"
                  style={{
                    left: m.left + innerW - Math.min(sealW, innerW) - 3,
                    top: m.top + headerH * 0.15,
                    width: 6,
                    height: headerH * 0.7,
                    cursor: 'ew-resize',
                  }}
                  onMouseDown={(e) => handleMouseDown('sealLeft', e)}
                  title={`押印欄幅: ${layout.sealBlockWidth}mm`} />
              )}
            </div>
            </div>

            <div className="mt-2 text-xs text-gray-500 flex gap-4 flex-wrap">
              <span>ヘッダー: {layout.headerHeight}mm</span>
              {tb.showFooterText && <span>フッター: {layout.footerHeight}mm</span>}
              {showInfo && <span>情報欄: {layout.infoBlockWidth}mm</span>}
              {sealW > 0 && <span>押印欄: {layout.sealBlockWidth}mm</span>}
            </div>
          </div>

          {/* 右: 設定パネル（表題欄） */}
          <div className="w-[300px] border-l bg-white flex flex-col shrink-0">
            <div className="px-4 py-3 border-b bg-gray-50 shrink-0">
              <span className="text-sm font-bold text-gray-700">表題欄</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 作業所名（参照） */}
              <FieldGroup label="作業所名">
                <input type="text" readOnly
                  value={projectSettings.workplaceName || ''}
                  className="w-full px-2 py-1.5 border rounded text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  placeholder="プロパティ設定で入力" />
              </FieldGroup>

              {/* 工期（参照） */}
              <div className="grid grid-cols-2 gap-2">
                <FieldGroup label="工期開始">
                  <input type="date" readOnly value={projectSettings.startDate}
                    className="w-full px-2 py-1.5 border rounded text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                </FieldGroup>
                <FieldGroup label="工期終了">
                  <input type="date" readOnly value={projectSettings.endDate}
                    className="w-full px-2 py-1.5 border rounded text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                </FieldGroup>
              </div>

              {/* 作成日 */}
              <FieldGroup label="作成日">
                <input type="date"
                  value={tb.creationDate || tb.date || ''}
                  onChange={(e) => updateTitleBlock({ creationDate: e.target.value, date: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm" />
              </FieldGroup>

              {/* 改訂 */}
              <FieldGroup label="改訂">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-600">第</span>
                  <input type="number" min={1}
                    value={tb.revisionNumber ?? 1}
                    onChange={(e) => updateTitleBlock({ revisionNumber: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-16 px-2 py-1.5 border rounded text-sm text-center" />
                  <span className="text-sm text-gray-600">版</span>
                </div>
              </FieldGroup>

              {/* 情報欄トグル + 配下チェックボックス */}
              <div className="border-t pt-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <input type="checkbox" checked={tb.showInfoBlock ?? true}
                    onChange={(e) => updateTitleBlock({ showInfoBlock: e.target.checked })}
                    className="rounded border-gray-300" />
                  情報欄
                </label>
                {(tb.showInfoBlock ?? true) && (
                  <div className="space-y-1.5 pl-5">
                    {([
                      ['workplaceName', '作業所名'],
                      ['period', '工期'],
                      ['creationDate', '作成日'],
                      ['revision', '改訂'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={ic[key] ?? true}
                          onChange={(e) => handleInfoCheck(key, e.target.checked)}
                          className="rounded border-gray-300" />
                        <span className={ic[key] ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 押印欄トグル */}
              <div className="border-t pt-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <input type="checkbox" checked={tb.showSealBlock ?? true}
                    onChange={(e) => updateTitleBlock({ showSealBlock: e.target.checked })}
                    className="rounded border-gray-300" />
                  押印欄
                </label>
                {(tb.showSealBlock ?? true) && (
                  <div className="space-y-1.5 pl-1">
                    {settings.sealBlock.slots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-2">
                        <input type="text" value={slot.position}
                          onChange={(e) => updateSealSlot(slot.id, { position: e.target.value })}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                          placeholder="組織名" />
                        <button onClick={() => removeSealSlot(slot.id)}
                          className="text-xs text-red-500 hover:text-red-700 shrink-0">削除</button>
                      </div>
                    ))}
                    <button onClick={() => addSealSlot('')}
                      className="w-full py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50">
                      + 追加
                    </button>
                  </div>
                )}
              </div>

              {/* 凡例 */}
              <div className="border-t pt-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <input type="checkbox" checked={settings.showLegend}
                    onChange={(e) => updateSettings({ showLegend: e.target.checked })}
                    className="rounded border-gray-300" />
                  凡例
                </label>
              </div>

              {/* フッターテキスト */}
              <div className="border-t pt-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <input type="checkbox" checked={tb.showFooterText ?? false}
                    onChange={(e) => updateTitleBlock({ showFooterText: e.target.checked })}
                    className="rounded border-gray-300" />
                  フッター
                </label>
                {tb.showFooterText && (
                  <textarea rows={3}
                    value={tb.footerText || ''}
                    onChange={(e) => updateTitleBlock({ footerText: e.target.value })}
                    className="w-full px-2 py-1.5 border rounded text-sm resize-y"
                    placeholder="フッターに表示するテキスト" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border rounded-md hover:bg-gray-50">キャンセル</button>
          <button onClick={handleExportPDF} disabled={isExporting}
            className={`px-4 py-2 text-white rounded-md ${isExporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isExporting ? 'PDF出力中...' : 'PDF出力'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
