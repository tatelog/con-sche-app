/**
 * Con-Sche - ADM形式ネットワーク工程表アプリケーション
 */

import { useState, useEffect, useCallback, useRef } from 'react'
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

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const REGISTRATION_KEY = 'consche_registration'

function App() {
  const isMobile = useIsMobile()
  const [mobilePanel, setMobilePanel] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const pingedRef = useRef(false)

  // 起動時ping: アクティブユーザーを記録する
  // customerId が無い端末（メール確認方式の登録）は登録時メールで照合し、
  // サーバーが返した customerId を保存して次回から自己修復する
  useEffect(() => {
    if (pingedRef.current) return
    pingedRef.current = true
    try {
      const raw = localStorage.getItem(REGISTRATION_KEY)
      const state = raw ? (JSON.parse(raw) as { customerId?: string; email?: string }) : {}
      const headers: Record<string, string> = {}
      if (state.customerId) {
        headers['X-Consche-Id'] = state.customerId
      } else if (state.email) {
        headers['X-Consche-Email'] = state.email
      } else {
        return
      }
      fetch(`${API_BASE}/api/ping`, { method: 'POST', headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { customerId?: string } | null) => {
          if (body?.customerId && !state.customerId) {
            localStorage.setItem(REGISTRATION_KEY, JSON.stringify({ ...state, customerId: body.customerId }))
          }
        })
        .catch(() => {})
    } catch {
      // localStorageアクセス失敗は無視
    }
  }, [])

  // 自動保存 + 起動時復元
  const nodesMap = useADMStore((state) => state.nodes)
  const currentProjectId = useADMStore((state) => state.currentProjectId)
  const exportFullData = useADMStore((state) => state.exportFullData)
  const importFullData = useADMStore((state) => state.importFullData)
  const loadProjectFromDB = useADMStore((state) => state.loadProjectFromDB)

  const DRAFT_KEY = 'consche_draft'
  const LAST_PROJECT_KEY = 'consche_last_project_id'

  // 起動時復元（マウント時1回）
  useEffect(() => {
    const lastProjectId = localStorage.getItem(LAST_PROJECT_KEY)
    if (lastProjectId) {
      loadProjectFromDB(lastProjectId).catch(() => {
        // DBに存在しない場合は下書きを試みる
        const draft = localStorage.getItem(DRAFT_KEY)
        if (draft) {
          try { importFullData(JSON.parse(draft)) } catch { /* 破損は無視 */ }
        }
        localStorage.removeItem(LAST_PROJECT_KEY)
      })
    } else {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        try { importFullData(JSON.parse(draft)) } catch { localStorage.removeItem(DRAFT_KEY) }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 保存済みプロジェクトIDを localStorage に記録
  useEffect(() => {
    if (currentProjectId) {
      localStorage.setItem(LAST_PROJECT_KEY, currentProjectId)
    }
  }, [currentProjectId])

  // 新規プロジェクト（未保存）を3秒デバウンスで localStorage に自動保存
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (currentProjectId) return  // 保存済みは useAutoSave が担当
    if (nodesMap.size === 0) return
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(exportFullData()))
      } catch { /* 容量オーバーは無視 */ }
    }, 3000)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [nodesMap, currentProjectId, exportFullData])

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

  const toolbarHeight = 48

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
