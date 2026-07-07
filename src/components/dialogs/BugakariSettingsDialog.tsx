import { useBugakariStore } from '@/stores/bugakariStore'
import { DOKEN_TYPES } from '@/data/bugakariMaster'

interface Props {
  open: boolean
  onClose: () => void
}

export function BugakariSettingsDialog({ open, onClose }: Props) {
  const enabledDokenCodes = useBugakariStore(s => s.enabledDokenCodes)
  const toggleDokenCode = useBugakariStore(s => s.toggleDokenCode)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl p-5 w-80"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-gray-800 mb-3">土建コード設定</h3>
        <p className="text-xs text-gray-500 mb-3">
          歩掛マスタに表示する土建コードを選択してください。
        </p>
        <div className="space-y-2">
          {DOKEN_TYPES.map(dt => (
            <label key={dt.code} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabledDokenCodes.has(dt.code)}
                onChange={() => toggleDokenCode(dt.code)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">
                {dt.code}. {dt.name}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
