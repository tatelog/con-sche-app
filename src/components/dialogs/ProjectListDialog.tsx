/**
 * プロジェクト一覧ダイアログ
 * IndexedDBに保存されたプロジェクトを一覧表示し、開く・削除する
 */

import { useState, useEffect } from 'react'
import { X, FolderOpen, Trash2 } from 'lucide-react'
import { useADMStore } from '@/stores/admStore'
import type { ADMProject } from '@/db/database'

interface ProjectListDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ProjectListDialog({ isOpen, onClose }: ProjectListDialogProps) {
  const [projects, setProjects] = useState<ADMProject[]>([])
  const [loading, setLoading] = useState(false)

  const getAllProjects = useADMStore((state) => state.getAllProjects)
  const loadProjectFromDB = useADMStore((state) => state.loadProjectFromDB)
  const deleteProjectFromDB = useADMStore((state) => state.deleteProjectFromDB)
  const isDirty = useADMStore((state) => state.isDirty)

  // ダイアログが開いたときにプロジェクト一覧を取得
  useEffect(() => {
    if (isOpen) {
      fetchProjects()
    }
  }, [isOpen])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const list = await getAllProjects()
      setProjects(list)
    } catch (err) {
      console.error('工程表一覧の取得に失敗:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = async (id: string) => {
    if (isDirty) {
      if (!confirm('未保存の変更があります。破棄して工程表を開きますか？')) {
        return
      }
    }

    try {
      await loadProjectFromDB(id)
      onClose()
    } catch (err) {
      alert(`工程表の読み込みに失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" を削除しますか？この操作は取り消せません。`)) {
      return
    }

    try {
      await deleteProjectFromDB(id)
      await fetchProjects()
    } catch (err) {
      alert(`削除に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* ダイアログ */}
      <div className="relative bg-white rounded-lg shadow-xl w-[500px] max-h-[70vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">工程表を開く</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 overflow-y-auto max-h-[calc(70vh-130px)]">
          {loading ? (
            <div className="text-center py-8 text-gray-500">読み込み中...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              保存された工程表がありません
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      最終更新: {formatDate(project.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpen(project.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    title="開く"
                  >
                    <FolderOpen size={14} />
                    開く
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-end px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
