/**
 * 別名で保存ダイアログ
 * プロジェクト名を入力して新しいプロジェクトとしてIndexedDBに保存する
 */

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useADMStore } from '@/stores/admStore'

interface SaveAsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SaveAsDialog({ isOpen, onClose }: SaveAsDialogProps) {
  const currentProjectName = useADMStore((state) => state.currentProjectName)
  const saveProjectAs = useADMStore((state) => state.saveProjectAs)

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ダイアログが開いたときに初期値を設定
  useEffect(() => {
    if (isOpen) {
      setName(currentProjectName || '新規工程表')
      setSaving(false)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 100)
    }
  }, [isOpen, currentProjectName])

  // Escキーでキャンセル
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      await saveProjectAs(trimmed)
      onClose()
    } catch (err) {
      alert(`保存に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleSave()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* ダイアログ */}
      <div className="relative bg-white rounded-lg shadow-xl w-96 max-w-[90vw]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold">別名で保存</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            工程表名
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="工程表名を入力"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
