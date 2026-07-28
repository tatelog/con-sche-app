/**
 * ADM形式用のツールバー
 * 描画モード: クリックでノード追加、ノード間クリックで作業追加
 */

import { useState, useRef, useEffect } from 'react'
import {
  MousePointer2,
  MousePointerClick,
  PencilLine,
  FolderPen,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  HelpCircle,
  FolderOpen,
  Save,
  SaveAll,
  Printer,
  ChevronDown,
  Settings,
  FileType2,
  Waypoints,
  FileSpreadsheet,
  PanelRightClose,
  PanelRightOpen,
  Hexagon,
  FileUp,
  Download,
  Menu,
} from 'lucide-react'
import { useADMStore } from '@/stores/admStore'
import { exportToCSV, downloadCSV } from '@/utils/csvExport'
import { useUIStore } from '@/stores/uiStore'
import { usePrintStore } from '@/stores/printStore'
import { useAutoSave } from '@/hooks/useAutoSave'
import { HeaderExtras } from '@/components/HeaderExtras'
import { SaveAsDialog } from '@/components/dialogs/SaveAsDialog'
import { PrintPreviewDialog } from '@/components/dialogs/PrintPreviewDialog'
import { ProjectListDialog } from '@/components/dialogs/ProjectListDialog'
import { importPackage } from '@/utils/conScheFile'

// ドロップダウンメニューコンポーネント
interface DropdownMenuProps {
  trigger: React.ReactNode
  items: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; title?: string }[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

function DropdownMenu({ trigger, items, isOpen, onToggle, onClose }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  return (
    <div ref={menuRef} className="relative">
      <div onClick={onToggle}>{trigger}</div>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px] z-50">
          {items.map((item, index) => (
            <button
              key={index}
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                if (item.disabled) return
                item.onClick()
                onClose()
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                item.disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Toolbar({ isMobile = false }: { isMobile?: boolean }) {
  const [selectMenuOpen, setSelectMenuOpen] = useState(false)
  const [drawMenuOpen, setDrawMenuOpen] = useState(false)
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)

  const editMode = useADMStore((state) => state.editMode)
  const setEditMode = useADMStore((state) => state.setEditMode)
  const updateProjectSettings = useADMStore((state) => state.updateProjectSettings)
  const undo = useADMStore((state) => state.undo)
  const redo = useADMStore((state) => state.redo)
  const canUndo = useADMStore((state) => state.canUndo)
  const canRedo = useADMStore((state) => state.canRedo)
  const exportFullData = useADMStore((state) => state.exportFullData)
  const saveProject = useADMStore((state) => state.saveProject)
  const currentProjectId = useADMStore((state) => state.currentProjectId)
  const currentProjectName = useADMStore((state) => state.currentProjectName)
  const isDirty = useADMStore((state) => state.isDirty)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editingName) nameInputRef.current?.focus() }, [editingName])

  const canvasScale = useUIStore((state) => state.canvasScale)
  const setCanvasScale = useUIStore((state) => state.setCanvasScale)
  const resetCanvasPosition = useUIStore((state) => state.resetCanvasPosition)
  const toggleProjectSettingsDialog = useUIStore((state) => state.toggleProjectSettingsDialog)

  const captureCanvas = useUIStore((state) => state.captureCanvas)
  const setCanvasImageData = usePrintStore((state) => state.setCanvasImageData)
  const setCaptureInfo = usePrintStore((state) => state.setCaptureInfo)

  const projectSettings = useADMStore((state) => state.projectSettings)

  const { isSaving: autoSaving, lastSaveTime } = useAutoSave()
  const [projectListOpen, setProjectListOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const mobileMoreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!mobileMoreOpen) return
    const handle = (e: MouseEvent) => {
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(e.target as Node)) setMobileMoreOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [mobileMoreOpen])

  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false)
  const desktopMoreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!desktopMoreOpen) return
    const handle = (e: MouseEvent) => {
      if (desktopMoreRef.current && !desktopMoreRef.current.contains(e.target as Node)) setDesktopMoreOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [desktopMoreOpen])

  // ツールバー幅に応じてアイコンサイズ・ギャップを動的に変更
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [tb, setTb] = useState({ icon: 20, chevron: 14, subChevron: 12, sectionGap: 16, innerGap: 4 })
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      const t = Math.max(0, Math.min(1, (w - 900) / (1280 - 900)))
      setTb({
        icon: Math.round(15 + t * 5),
        chevron: Math.round(10 + t * 4),
        subChevron: Math.round(8 + t * 4),
        sectionGap: Math.round(4 + t * 12),
        innerGap: Math.round(1 + t * 3),
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const importFullData = useADMStore((state) => state.importFullData)
  const importLiteData = useADMStore((state) => state.importLiteData)
  const downloadFullPackage = useADMStore((state) => state.downloadFullPackage)

  // ローカルファイル（.csa/.csl）を読み込んで開く
  const handleFileOpen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (isDirty && !confirm('未保存の変更があります。破棄してファイルを開きますか？')) return
    try {
      const result = await importPackage(file)
      if (result.type === 'full') {
        importFullData(result.data)
      } else {
        importLiteData(result.data)
      }
    } catch (err) {
      alert(`ファイルの読み込みに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    }
  }

  // 選択系グループ: select ↔ pathSelect
  const isSelectGroup = editMode === 'select' || editMode === 'pathSelect'
  const SelectIcon = editMode === 'pathSelect' ? MousePointerClick : MousePointer2
  const selectLabel = editMode === 'pathSelect' ? 'パス選択' : '選択'

  // 描画系グループ: draw ↔ text ↔ banner（progressは独立）
  const isDrawGroup = editMode === 'draw' || editMode === 'text' || editMode === 'banner'
  const DrawIcon = editMode === 'banner' ? Hexagon : editMode === 'text' ? FolderPen : PencilLine
  const drawLabel = editMode === 'banner' ? 'バナー' : editMode === 'text' ? 'テキスト' : '描画'

  // 進捗線は独立モード
  const isProgressMode = editMode === 'progress'

  const showPropertiesPanel = useUIStore((state) => state.showPropertiesPanel)
  const togglePropertiesPanel = useUIStore((state) => state.togglePropertiesPanel)
  const openTutorial = useUIStore((state) => state.openTutorial)

  const handleZoomIn = () => {
    const newScale = Math.min(canvasScale * 1.2, 3)
    setCanvasScale(newScale)
  }

  const handleZoomOut = () => {
    const newScale = Math.max(canvasScale / 1.2, 0.1)
    setCanvasScale(newScale)
  }

  const handleResetView = () => {
    setCanvasScale(1)
    resetCanvasPosition()
  }

  const closeAllMenus = () => {
    setSelectMenuOpen(false)
    setDrawMenuOpen(false)
    setDesktopMoreOpen(false)
    setMobileMoreOpen(false)
  }

  const captureForPrint = () => {
    if (captureCanvas) {
      const result = captureCanvas()
      if (result) {
        setCanvasImageData(result.imageData)
        setCaptureInfo({
          viewStartDate: result.viewStartDate,
          effectiveTotalDays: result.effectiveTotalDays,
          totalRows: result.totalRows,
        })
      }
    }
  }

  // フォルダメニュー項目
  const projectMenuItems = [
    {
      icon: <Save size={16} />,
      label: '上書き保存',
      onClick: () => {
        closeAllMenus()
        if (currentProjectId) {
          saveProject()
        } else {
          setSaveAsOpen(true)
        }
      },
    },
    {
      icon: <SaveAll size={16} />,
      label: '別名で保存...',
      onClick: () => {
        closeAllMenus()
        setSaveAsOpen(true)
      },
    },
    {
      icon: <FolderOpen size={16} />,
      label: '工程表を開く...',
      onClick: () => {
        closeAllMenus()
        setProjectListOpen(true)
      },
    },
    {
      icon: <FileUp size={16} />,
      label: 'ファイルを開く... (.csa/.csl)',
      onClick: () => {
        closeAllMenus()
        fileInputRef.current?.click()
      },
    },
    {
      icon: <Download size={16} />,
      label: 'ファイルへ保存 (.csa)',
      onClick: () => {
        closeAllMenus()
        downloadFullPackage()
      },
    },
    {
      icon: <FileType2 size={16} />,
      label: 'IFCインポート（準備中）',
      onClick: () => {},
      disabled: true,
      title: 'IFCインポートは現在準備中です',
    },
  ]

  // モバイル: 1段ツールバー（ズームUIはピンチ操作で代替）
  if (isMobile) {
    return (
      <>
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-2 gap-1">
          {/* ハンバーガーメニュー（左端） */}
          <div ref={mobileMoreRef} className="relative shrink-0">
            <button
              onClick={() => { closeAllMenus(); setMobileMoreOpen(!mobileMoreOpen) }}
              className={`p-1.5 rounded ${mobileMoreOpen ? 'bg-gray-100 text-blue-600' : 'text-gray-600'}`}
              title="メニュー"
            >
              <Menu size={18} />
            </button>
            {mobileMoreOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-52 py-1 text-sm">
                {projectMenuItems.map((item, i) => (
                  <button
                    key={i}
                    disabled={item.disabled}
                    title={item.title}
                    onClick={() => { if (!item.disabled) { item.onClick(); setMobileMoreOpen(false) } }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left ${item.disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {item.icon}<span>{item.label}</span>
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { closeAllMenus(); captureForPrint(); setPrintPreviewOpen(true); setMobileMoreOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                >
                  <Printer size={14} /><span>印刷 / PDF出力...</span>
                </button>
                <button
                  onClick={() => {
                    closeAllMenus()
                    const data = exportFullData()
                    const csv = exportToCSV(data)
                    const filename = `${data.projectSettings.name || '工程表'}.csv`
                    downloadCSV(csv, filename)
                    setMobileMoreOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                >
                  <FileSpreadsheet size={14} /><span>CSV出力</span>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { closeAllMenus(); toggleProjectSettingsDialog(); setMobileMoreOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                >
                  <Settings size={14} /><span>設定</span>
                </button>
                {openTutorial && (
                  <button
                    onClick={() => { openTutorial(); setMobileMoreOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                  >
                    <HelpCircle size={14} /><span>操作ガイド</span>
                  </button>
                )}
                <div className="border-t border-gray-100 my-1" />
                <div className="px-2 py-1 flex items-center">
                  <HeaderExtras compact />
                </div>
              </div>
            )}
          </div>

          {/* ロゴ + プロジェクト名 */}
          <div className="font-bold text-base text-gray-800 flex items-center gap-1 shrink-0">
            <span className="flex flex-col leading-none w-9">
              <span className="text-sm">Con-Sche</span>
              <span className="text-[7px] font-semibold tracking-widest text-gray-400">コンスケ</span>
            </span>
            <span
              className="text-xs font-normal text-gray-500 truncate max-w-[60px] cursor-pointer"
              onClick={() => { setNameInput(currentProjectName); setEditingName(true) }}
            >
              - {currentProjectName}{isDirty ? ' *' : ''}
            </span>
          </div>

          <div className="w-px h-5 bg-gray-300 mx-0.5 shrink-0" />

          {/* 選択モード */}
          <DropdownMenu
            isOpen={selectMenuOpen}
            onToggle={() => { setSelectMenuOpen(!selectMenuOpen); setDrawMenuOpen(false) }}
            onClose={() => setSelectMenuOpen(false)}
            trigger={
              <button className={`p-1.5 rounded transition-colors flex items-center gap-0.5 ${isSelectGroup ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}>
                <SelectIcon size={16} />
                <ChevronDown size={10} />
              </button>
            }
            items={[
              { icon: <MousePointer2 size={16} />, label: '選択', onClick: () => setEditMode('select') },
              { icon: <MousePointerClick size={16} />, label: 'パス選択', onClick: () => setEditMode('pathSelect') },
            ]}
          />

          {/* 描画モード */}
          <DropdownMenu
            isOpen={drawMenuOpen}
            onToggle={() => { setDrawMenuOpen(!drawMenuOpen); setSelectMenuOpen(false) }}
            onClose={() => setDrawMenuOpen(false)}
            trigger={
              <button className={`p-1.5 rounded transition-colors flex items-center gap-0.5 ${isDrawGroup ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}>
                <DrawIcon size={16} />
                <ChevronDown size={10} />
              </button>
            }
            items={[
              { icon: <PencilLine size={16} />, label: '描画', onClick: () => setEditMode('draw') },
              { icon: <FolderPen size={16} />, label: 'テキスト', onClick: () => setEditMode('text') },
              { icon: <Hexagon size={16} />, label: 'バナー', onClick: () => setEditMode('banner') },
            ]}
          />

          {/* 進捗線 */}
          <button
            onClick={() => setEditMode('progress')}
            className={`p-1.5 rounded transition-colors ${isProgressMode ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
          >
            <Waypoints size={16} />
          </button>

          {/* Undo/Redo */}
          <button onClick={undo} disabled={!canUndo} className={`p-1.5 rounded ${canUndo ? 'text-gray-600' : 'text-gray-300'}`}>
            <Undo2 size={16} />
          </button>
          <button onClick={redo} disabled={!canRedo} className={`p-1.5 rounded ${canRedo ? 'text-gray-600' : 'text-gray-300'}`}>
            <Redo2 size={16} />
          </button>

          <div className="w-px h-5 bg-gray-300 mx-0.5 shrink-0" />

          {/* 右端: 行数/行高 */}
          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            <input
              type="number" min="5" max="100"
              value={projectSettings.displayRows}
              onChange={(e) => {
                const rows = parseInt(e.target.value) || 20
                updateProjectSettings({ displayRows: rows, paperSize: 'custom' as const })
              }}
              className="w-9 px-0.5 py-0.5 text-xs border rounded text-center"
              title="表示行数"
            />
            <input
              type="number" min="20" max="80" step="2"
              value={projectSettings.rowHeight || 40}
              onChange={(e) => updateProjectSettings({ rowHeight: Number(e.target.value) || 40 })}
              className="w-9 px-0.5 py-0.5 text-xs border rounded text-center"
              title="行高"
            />
          </div>
        </div>

        {/* プロジェクト名編集モーダル（モバイル） */}
        {editingName && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingName(false)}>
            <div className="bg-white rounded-lg p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <label className="text-sm text-gray-600 mb-2 block">プロジェクト名</label>
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = nameInput.trim()
                    if (trimmed) updateProjectSettings({ workplaceName: trimmed })
                    setEditingName(false)
                  }
                  if (e.key === 'Escape') setEditingName(false)
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <div className="flex gap-2 mt-3 justify-end">
                <button onClick={() => setEditingName(false)} className="px-3 py-1.5 text-sm text-gray-500">キャンセル</button>
                <button
                  onClick={() => {
                    const trimmed = nameInput.trim()
                    if (trimmed) updateProjectSettings({ workplaceName: trimmed })
                    setEditingName(false)
                  }}
                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg"
                >保存</button>
              </div>
            </div>
          </div>
        )}

        {/* ダイアログ */}
        <SaveAsDialog isOpen={saveAsOpen} onClose={() => setSaveAsOpen(false)} />
        <PrintPreviewDialog isOpen={printPreviewOpen} onClose={() => setPrintPreviewOpen(false)} projectSettings={projectSettings} />
        <ProjectListDialog isOpen={projectListOpen} onClose={() => setProjectListOpen(false)} />
        <input ref={fileInputRef} type="file" accept=".csa,.csl" className="hidden" onChange={handleFileOpen} />
      </>
    )
  }

  // デスクトップ: 従来の1段ツールバー
  return (
    <div ref={toolbarRef} className="h-12 bg-white border-b border-gray-200 flex items-center px-4" style={{ gap: tb.sectionGap }}>
      {/* ロゴ + プロジェクト名（クリックで編集） */}
      {/* ハンバーガーメニュー（左端） */}
      <div ref={desktopMoreRef} className="relative border-r border-gray-200 pr-2">
        <button
          onClick={() => { closeAllMenus(); setDesktopMoreOpen(!desktopMoreOpen) }}
          className={`p-2 rounded hover:bg-gray-100 transition-colors ${desktopMoreOpen ? 'bg-gray-100 text-blue-600' : 'text-gray-600'}`}
          title="メニュー"
        >
          <Menu size={tb.icon} />
        </button>
        {desktopMoreOpen && (
          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-52 py-1 text-sm">
            {projectMenuItems.map((item, i) => (
              <button
                key={i}
                onClick={() => { item.onClick(); setDesktopMoreOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700"
              >
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { captureForPrint(); setPrintPreviewOpen(true); setDesktopMoreOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700"
            >
              <Printer size={14} /><span>印刷 / PDF出力...</span>
            </button>
            <button
              onClick={() => {
                const data = exportFullData()
                const csv = exportToCSV(data)
                const filename = `${data.projectSettings.name || '工程表'}.csv`
                downloadCSV(csv, filename)
                setDesktopMoreOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700"
            >
              <FileSpreadsheet size={14} /><span>CSV出力</span>
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { toggleProjectSettingsDialog(); setDesktopMoreOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700"
            >
              <Settings size={14} /><span>設定</span>
            </button>
            {openTutorial && (
              <button
                onClick={() => { openTutorial(); setDesktopMoreOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700"
              >
                <HelpCircle size={14} /><span>操作ガイド</span>
              </button>
            )}
            <div className="border-t border-gray-100 my-1" />
            <div className="px-2 py-1 flex items-center">
              <HeaderExtras compact />
            </div>
          </div>
        )}
      </div>

      {/* ロゴ + プロジェクト名（クリックで編集） */}
      <div className="font-bold text-gray-800 border-r border-gray-200 pr-4 flex items-center gap-2">
        <span className="flex flex-col leading-none w-9">
          <span className="text-sm">Con-Sche</span>
          <span className="text-[7px] font-semibold tracking-widest text-gray-400">コンスケ</span>
        </span>
        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => {
              const trimmed = nameInput.trim()
              if (trimmed) updateProjectSettings({ workplaceName: trimmed })
              setEditingName(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() }
              if (e.key === 'Escape') { setEditingName(false) }
            }}
            className="text-sm font-normal text-gray-700 border-b border-blue-400 bg-transparent outline-none max-w-[200px] px-0.5"
          />
        ) : (
          <span
            className="text-sm font-normal text-gray-500 truncate max-w-[200px] cursor-pointer hover:text-gray-700 hover:underline"
            onClick={() => { setNameInput(currentProjectName); setEditingName(true) }}
            title="クリックして編集"
          >
            - {currentProjectName}{isDirty ? ' *' : ''}
          </span>
        )}
        {!editingName && (
          <span className="text-[10px] text-slate-400 ml-1">
            {autoSaving ? '保存中...' : lastSaveTime ? `自動保存済 ${lastSaveTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
        )}
      </div>

      {/* 編集モード切替 + 元に戻す/やり直し */}
      <div className="flex items-center border-r border-gray-200 pr-4" style={{ gap: tb.innerGap }}>
        {/* 選択モードメニュー */}
        <DropdownMenu
          isOpen={selectMenuOpen}
          onToggle={() => {
            setSelectMenuOpen(!selectMenuOpen)
            setDrawMenuOpen(false)
          }}
          onClose={() => setSelectMenuOpen(false)}
          trigger={
            <button
              className={`p-2 rounded hover:bg-gray-100 transition-colors flex items-center gap-0.5 ${
                isSelectGroup ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
              }`}
              title={selectLabel}
            >
              <SelectIcon size={tb.icon} />
              <ChevronDown size={tb.subChevron} />
            </button>
          }
          items={[
            {
              icon: <MousePointer2 size={16} />,
              label: '選択',
              onClick: () => setEditMode('select'),
            },
            {
              icon: <MousePointerClick size={16} />,
              label: 'パス選択',
              onClick: () => setEditMode('pathSelect'),
            },
          ]}
        />

        {/* 描画モードメニュー */}
        <DropdownMenu
          isOpen={drawMenuOpen}
          onToggle={() => {
            setDrawMenuOpen(!drawMenuOpen)
            setSelectMenuOpen(false)
          }}
          onClose={() => setDrawMenuOpen(false)}
          trigger={
            <button
              className={`p-2 rounded hover:bg-gray-100 transition-colors flex items-center gap-0.5 ${
                isDrawGroup ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
              }`}
              title={drawLabel}
            >
              <DrawIcon size={tb.icon} />
              <ChevronDown size={tb.subChevron} />
            </button>
          }
          items={[
            {
              icon: <PencilLine size={16} />,
              label: '描画',
              onClick: () => setEditMode('draw'),
            },
            {
              icon: <FolderPen size={16} />,
              label: 'テキスト',
              onClick: () => setEditMode('text'),
            },
            {
              icon: <Hexagon size={16} />,
              label: 'バナー',
              onClick: () => setEditMode('banner'),
            },
          ]}
        />

        {/* 進捗線（独立ボタン） */}
        <button
          onClick={() => setEditMode('progress')}
          className={`p-2 rounded hover:bg-gray-100 transition-colors ${
            isProgressMode ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
          }`}
          title="進捗線（雷線）"
        >
          <Waypoints size={tb.icon} />
        </button>

        {/* 元に戻す */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`p-2 rounded transition-colors ${
            canUndo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="元に戻す (Ctrl+Z)"
        >
          <Undo2 size={tb.icon} />
        </button>

        {/* やり直し */}
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`p-2 rounded transition-colors ${
            canRedo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="やり直し (Ctrl+Y)"
        >
          <Redo2 size={tb.icon} />
        </button>

      </div>

      {/* ズーム */}
      <div className="flex items-center" style={{ gap: tb.innerGap }}>
        <button
          onClick={handleZoomOut}
          className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          title="縮小"
        >
          <ZoomOut size={tb.icon} />
        </button>
        <button
          onClick={handleResetView}
          className="text-sm text-gray-600 w-16 text-center hover:bg-gray-100 rounded py-1 transition-colors"
          title="表示をリセット"
        >
          {Math.round(canvasScale * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          title="拡大"
        >
          <ZoomIn size={tb.icon} />
        </button>
      </div>

      {/* プロパティパネルトグル */}
      <button
        onClick={togglePropertiesPanel}
        className={`p-2 rounded hover:bg-gray-100 transition-colors ${
          showPropertiesPanel ? 'text-blue-600' : 'text-gray-600'
        }`}
        title={showPropertiesPanel ? 'プロパティパネルを非表示' : 'プロパティパネルを表示'}
      >
        {showPropertiesPanel ? <PanelRightClose size={tb.icon} /> : <PanelRightOpen size={tb.icon} />}
      </button>

      {/* 右端クラスタ: 行数/行高（常時表示） */}
      <div className="ml-auto flex items-center gap-2 min-w-0 shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          <label className="text-xs text-gray-500">行数:</label>
          <input
            type="number"
            min="5"
            max="100"
            value={projectSettings.displayRows}
            onChange={(e) => {
              const rows = parseInt(e.target.value) || 20
              updateProjectSettings({ displayRows: rows, paperSize: 'custom' as const })
            }}
            className="w-14 px-1 py-1 text-sm border rounded text-center"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <label className="text-xs text-gray-500">行高:</label>
          <input
            type="number"
            min="20"
            max="80"
            step="2"
            value={projectSettings.rowHeight || 40}
            onChange={(e) => updateProjectSettings({ rowHeight: Number(e.target.value) || 40 })}
            className="w-12 px-1 py-1 text-sm border rounded text-center"
          />
        </div>
      </div>

      {/* ダイアログ */}
      <SaveAsDialog
        isOpen={saveAsOpen}
        onClose={() => setSaveAsOpen(false)}
      />
      <PrintPreviewDialog
        isOpen={printPreviewOpen}
        onClose={() => setPrintPreviewOpen(false)}
        projectSettings={projectSettings}
      />
      <ProjectListDialog isOpen={projectListOpen} onClose={() => setProjectListOpen(false)} />
      <input ref={fileInputRef} type="file" accept=".csa,.csl" className="hidden" onChange={handleFileOpen} />
    </div>
  )
}
