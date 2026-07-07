import { useState } from 'react'
import { Search, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useBugakariStore } from '@/stores/bugakariStore'
import type { BugakariItem } from '@/types'

interface BugakariPanelProps {
  onSelect?: (item: BugakariItem) => void
}

export function BugakariPanel({ onSelect }: BugakariPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const activeMasterId = useBugakariStore(state => state.activeMasterId)
  const getItemsArray = useBugakariStore(state => state.getItemsArray)
  const searchItems = useBugakariStore(state => state.searchItems)
  const addItem = useBugakariStore(state => state.addItem)
  const deleteItem = useBugakariStore(state => state.deleteItem)

  const items = activeMasterId ? getItemsArray(activeMasterId) : []
  const filteredItems = searchQuery ? searchItems(searchQuery) : items

  // カテゴリでグループ化
  const groupedItems = filteredItems.reduce((acc, item) => {
    const key = `${item.category1} > ${item.category2}`
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, BugakariItem[]>)

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleAddItem = () => {
    if (!activeMasterId) return
    addItem(activeMasterId, '新規歩掛')
  }

  const handleDeleteItem = (itemId: string) => {
    if (!activeMasterId) return
    deleteItem(activeMasterId, itemId)
  }

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold mb-3">歩掛マスタ</h2>

        {/* 検索 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="歩掛を検索..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {/* 追加ボタン */}
        <button
          onClick={handleAddItem}
          disabled={!activeMasterId}
          className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          新規歩掛を追加
        </button>
      </div>

      {/* 歩掛リスト */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category} className="mb-2">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
            >
              {expandedCategories.has(category) ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              {category}
              <span className="ml-auto text-gray-400 text-xs">{categoryItems.length}</span>
            </button>

            {expandedCategories.has(category) && (
              <div className="ml-4 mt-1 space-y-1">
                {categoryItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer group"
                    onClick={() => onSelect?.(item)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.code && `[${item.code}] `}
                        {item.unit}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteItem(item.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            {searchQuery ? '該当する歩掛がありません' : '歩掛データがありません'}
          </div>
        )}
      </div>

      {/* 歩掛詳細（選択時） */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-2">使用方法</h3>
        <p className="text-xs text-gray-500">
          歩掛をクリックしてタスクに適用できます。
          工期 = 数量 ÷ (歩掛 × 人工)
        </p>
      </div>
    </div>
  )
}
