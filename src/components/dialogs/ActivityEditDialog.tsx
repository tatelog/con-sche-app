/**
 * 作業（Activity）編集ダイアログ
 * エッジ作成時に作業内容を入力するためのダイアログ
 */

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Activity } from '@/types/adm'

interface ActivityEditDialogProps {
  isOpen: boolean
  activity: Activity | null
  onSave: (updates: Partial<Activity>) => void
  onCancel: () => void
}

export function ActivityEditDialog({ isOpen, activity, onSave, onCancel }: ActivityEditDialogProps) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(1)
  const [note, setNote] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // ダイアログが開いたときにデータをリセット
  useEffect(() => {
    if (isOpen && activity) {
      setName(activity.name || '')
      setDuration(activity.duration || 1)
      setNote(activity.note || '')
      // フォーカスを名前入力欄に
      setTimeout(() => nameInputRef.current?.focus(), 100)
    }
  }, [isOpen, activity])

  // Escキーでキャンセル
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === 'Enter' && e.ctrlKey) {
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, name, duration, note])

  const handleSave = () => {
    onSave({
      name: name || '作業',
      duration,
      note,
    })
  }

  if (!isOpen || !activity) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />

      {/* ダイアログ */}
      <div className="relative bg-white rounded-lg shadow-xl w-96 max-w-[90vw]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold">作業の設定</h3>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 space-y-4">
          {/* 作業名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              作業名 <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 型枠工事"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 工数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              工数（日数）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="365"
                value={duration}
                onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500">日</span>
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メモ（任意）
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="作業の詳細や注意事項など"
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            保存 (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  )
}
