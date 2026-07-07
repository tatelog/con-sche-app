/**
 * Con-Sche - ADM形式ネットワーク工程表アプリケーション
 */

import { useState, useEffect, useCallback } from 'react'
import { NetworkCanvas } from '@/components/canvas/NetworkCanvas'
import { PropertiesPanel } from '@/components/panels/PropertiesPanel'
import { Toolbar } from '@/components/menus/Toolbar'
import { ResizablePanel } from '@/components/common/ResizablePanel'
import { ProjectSettingsDialog } from '@/components/dialogs/ProjectSettingsDialog'
import { TutorialOverlay } from '@/components/TutorialOverlay'
import { CursorHint } from '@/components/CursorHint'
import { IfcImportDialog } from '@/components/dialogs/IfcImportDialog'
import { IfcMappingPanel } from '@/components/panels/IfcMappingPanel'
import { useADMStore } from '@/stores/admStore'
import { useUIStore } from '@/stores/uiStore'
import { PanelRightOpen, X } from 'lucide-react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

function App() {
  const isMobile = useIsMobile()
  const [mobilePanel, setMobilePanel] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // パネル幅をストアから取得
  const projectSettings = useADMStore((state) => state.projectSettings)
  const updateProjectSettings = useADMStore((state) => state.updateProjectSettings)

  // 設定ダイアログの状態
  const showProjectSettingsDialog = useUIStore((state) => state.showProjectSettingsDialog)
  const toggleProjectSettingsDialog = useUIStore((state) => state.toggleProjectSettingsDialog)
  const showPropertiesPanel = useUIStore((state) => state.showPropertiesPanel)

  const propertiesPanelWidth = isMobile ? 0 : (showPropertiesPanel ? projectSettings.propertiesPanelWidth : 0)

  // パネル幅の更新ハンドラ
  const handlePropertiesWidthChange = useCallback(
    (width: number) => {
      updateProjectSettings({ propertiesPanelWidth: width })
    },
    [updateProjectSettings]
  )

  // ツールバー高さ: モバイル=88px (48+40), デスクトップ=48px
  const toolbarHeight = isMobile ? 88 : 48

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth - propertiesPanelWidth,
        height: window.innerHeight - toolbarHeight,
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [propertiesPanelWidth, toolbarHeight])

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Toolbar isMobile={isMobile} />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-gray-50">
          {dimensions.width > 0 && (
            <NetworkCanvas
              width={dimensions.width}
              height={dimensions.height}
            />
          )}
        </div>
        {/* デスクトップ: サイドパネル */}
        {!isMobile && showPropertiesPanel && (
          <ResizablePanel
            width={projectSettings.propertiesPanelWidth}
            minWidth={200}
            maxWidth={500}
            position="right"
            onWidthChange={handlePropertiesWidthChange}
          >
            <PropertiesPanel />
          </ResizablePanel>
        )}
      </div>

      {/* モバイル: プロパティパネル オーバーレイ */}
      {isMobile && (
        <>
          {/* 背景暗幕 */}
          <div
            className={`fixed inset-0 bg-black/40 z-40 mobile-overlay-backdrop ${mobilePanel ? 'open' : ''}`}
            onClick={() => setMobilePanel(false)}
          />
          {/* パネル */}
          <div className={`fixed inset-y-0 right-0 w-[85vw] max-w-[400px] z-50 bg-white shadow-xl mobile-overlay-panel ${mobilePanel ? 'open' : ''}`}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-700">プロパティ</span>
              <button onClick={() => setMobilePanel(false)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto h-full pb-12">
              <PropertiesPanel />
            </div>
          </div>
          {/* フローティングボタン */}
          {!mobilePanel && (
            <button
              onClick={() => setMobilePanel(true)}
              className="fixed bottom-6 right-4 z-30 w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center active:bg-primary-700"
            >
              <PanelRightOpen size={20} />
            </button>
          )}
        </>
      )}

      {/* プロジェクト設定ダイアログ */}
      <ProjectSettingsDialog
        isOpen={showProjectSettingsDialog}
        onClose={toggleProjectSettingsDialog}
      />

      {/* 初回チュートリアル（?ボタンで再表示可） */}
      <TutorialOverlay />

      {/* ドラッグ制約の理由表示（カーソル追従） */}
      <CursorHint />

      {/* IFCインポートダイアログ */}
      <IfcImportDialog />

      {/* IFCマッピングパネル */}
      <IfcMappingPanel />
    </div>
  )
}

export default App
