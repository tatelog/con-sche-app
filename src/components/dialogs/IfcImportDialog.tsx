/**
 * IFCファイルインポートダイアログ
 * ファイルアップロード、パース進捗表示、結果プレビュー
 */

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileType2, AlertCircle, CheckCircle, Loader2, FolderOpen } from 'lucide-react'
import { useIfcStore } from '@/stores/ifcStore'
import { parseIfcFile } from '@/utils/ifcParser'
import { MAX_FILE_SIZE } from '@/types/ifc'

export function IfcImportDialog() {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOpen = useIfcStore((state) => state.isImportDialogOpen)
  const closeDialog = useIfcStore((state) => state.closeImportDialog)
  const status = useIfcStore((state) => state.status)
  const error = useIfcStore((state) => state.error)
  const progress = useIfcStore((state) => state.progress)
  const currentResult = useIfcStore((state) => state.currentResult)
  const setStatus = useIfcStore((state) => state.setStatus)
  const setError = useIfcStore((state) => state.setError)
  const setProgress = useIfcStore((state) => state.setProgress)
  const setCurrentResult = useIfcStore((state) => state.setCurrentResult)
  const initializeMappings = useIfcStore((state) => state.initializeMappings)
  const createSession = useIfcStore((state) => state.createSession)
  const openMappingPanel = useIfcStore((state) => state.openMappingPanel)
  const reset = useIfcStore((state) => state.reset)

  const handleFileSelect = useCallback(async (file: File) => {
    // 拡張子チェック
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setError({
        code: 'INVALID_IFC',
        message: 'IFCファイル（.ifc）を選択してください',
      })
      return
    }

    // サイズチェック
    if (file.size > MAX_FILE_SIZE) {
      setError({
        code: 'FILE_TOO_LARGE',
        message: `ファイルサイズが上限（300MB）を超えています: ${formatFileSize(file.size)}`,
      })
      return
    }

    setStatus('parsing')
    setError(null)
    setProgress(0)

    try {
      const result = await parseIfcFile(file, setProgress)
      setCurrentResult(result)
      initializeMappings(result)
      createSession(file.name, file.size, result)
      setStatus('success')
    } catch (e) {
      const err = e as { code?: string; message?: string }
      setError({
        code: (err.code as 'PARSE_ERROR') || 'PARSE_ERROR',
        message: err.message || 'IFCファイルの解析に失敗しました',
      })
      setStatus('error')
    }
  }, [setStatus, setError, setProgress, setCurrentResult, initializeMappings, createSession])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const isDemo = window.location.pathname === '/demo'

  const handleLoadSample = useCallback(async () => {
    try {
      const res = await fetch('/sample/sample-building.ifc')
      if (!res.ok) throw new Error('サンプルファイルの取得に失敗しました')
      const blob = await res.blob()
      const file = new File([blob], 'RC庁舎サンプルモデル.ifc', { type: 'application/octet-stream' })
      handleFileSelect(file)
    } catch {
      setError({ code: 'UNKNOWN', message: 'サンプルBIMファイルの読み込みに失敗しました' })
    }
  }, [handleFileSelect, setError])

  const handleClose = () => {
    reset()
    closeDialog()
  }

  const handleProceedToMapping = () => {
    closeDialog()
    openMappingPanel()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />

      {/* ダイアログ */}
      <div className="relative bg-white rounded-lg shadow-xl w-[540px] max-w-[90vw] max-h-[90vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileType2 size={24} className="text-blue-600" />
            <h3 className="text-lg font-bold">IFCファイルのインポート</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          {/* アップロードエリア（初期状態またはエラー時） */}
          {(status === 'idle' || status === 'error') && (
            <>
              {isDemo ? (
                /* デモモード: サンプルBIM読み込み */
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <FolderOpen size={48} className="mx-auto text-blue-500 mb-4" />
                  <p className="text-gray-700 font-medium mb-1">サンプルBIMモデル</p>
                  <p className="text-gray-500 text-sm mb-4">RC庁舎サンプルモデル.ifc（8.3MB）</p>
                  <button
                    onClick={handleLoadSample}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                  >
                    読み込む
                  </button>
                  <p className="text-gray-400 text-xs mt-4">
                    IFC2x3形式のBIMモデルを解析し、階層・室情報を抽出します
                  </p>
                </div>
              ) : (
                /* 通常モード: ファイルアップロード */
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">
                    IFCファイルをドラッグ＆ドロップ
                  </p>
                  <p className="text-gray-400 text-sm mb-4">または</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    ファイルを選択
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ifc"
                    className="hidden"
                    onChange={handleInputChange}
                  />
                  <p className="text-gray-400 text-xs mt-4">
                    対応形式: IFC2x3, IFC4, IFC4x3（最大300MB）
                  </p>
                </div>
              )}

              {/* エラー表示 */}
              {status === 'error' && error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-700 font-medium">{error.message}</p>
                    {error.details && (
                      <p className="text-red-600 text-sm mt-1">{error.details}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* パース中 */}
          {status === 'parsing' && (
            <div className="text-center py-8">
              <Loader2 size={48} className="mx-auto text-blue-600 animate-spin mb-4" />
              <p className="text-gray-700 font-medium mb-2">IFCファイルを解析中...</p>
              <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-gray-500 text-sm mt-2">{progress}%</p>
            </div>
          )}

          {/* 成功 - 結果プレビュー */}
          {status === 'success' && currentResult && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={24} className="text-green-500" />
                <span className="text-green-700 font-medium">解析完了</span>
              </div>

              {/* 統計情報 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-gray-700 mb-3">抽出結果</h4>
                <div className="grid grid-cols-2 gap-4">
                  <StatItem label="ファイル名" value={currentResult.stats.fileName} />
                  <StatItem label="ファイルサイズ" value={formatFileSize(currentResult.stats.fileSize)} />
                  <StatItem label="IFCスキーマ" value={currentResult.stats.schema} />
                  <StatItem label="解析時間" value={`${(currentResult.stats.parseTimeMs / 1000).toFixed(1)}秒`} />
                  <StatItem label="建物階数" value={`${currentResult.stats.storeyCount}階`} highlight />
                  <StatItem label="室数" value={`${currentResult.stats.spaceCount}室`} highlight />
                  <StatItem label="数量セット" value={`${currentResult.stats.quantitySetCount}件`} />
                </div>
              </div>

              {/* 階層プレビュー */}
              {currentResult.storeys.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-700 mb-2">階層構成</h4>
                  <div className="max-h-40 overflow-y-auto">
                    {currentResult.storeys.map((storey) => {
                      const spaces = currentResult.spaces.filter(
                        (s) => s.storeyId === storey.expressId
                      )
                      return (
                        <div
                          key={storey.expressId}
                          className="flex items-center justify-between py-1 border-b border-gray-200 last:border-0"
                        >
                          <span className="text-gray-700">{storey.name}</span>
                          <span className="text-gray-500 text-sm">
                            {spaces.length}室 / 標高 {storey.elevation.toFixed(1)}m
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            キャンセル
          </button>
          {status === 'success' && (
            <button
              onClick={handleProceedToMapping}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              マッピング設定へ
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatItem({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <dt className="text-gray-500 text-sm">{label}</dt>
      <dd className={`font-medium ${highlight ? 'text-blue-600' : 'text-gray-800'}`}>
        {value}
      </dd>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
