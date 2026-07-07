/**
 * マスターデータ管理ダイアログ
 * 工区、階数/部屋、細目などのマスターデータを管理
 */

import { useState } from 'react'
import { useADMStore } from '@/stores/admStore'

interface MasterDataDialogProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'zone' | 'room' | 'detail'

export function MasterDataDialog({ isOpen, onClose }: MasterDataDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('zone')
  const [newItemName, setNewItemName] = useState('')
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const zones = useADMStore((state) => state.zones)
  const rooms = useADMStore((state) => state.rooms)
  const detailCategories = useADMStore((state) => state.detailCategories)
  const addZone = useADMStore((state) => state.addZone)
  const updateZone = useADMStore((state) => state.updateZone)
  const deleteZone = useADMStore((state) => state.deleteZone)
  const addRoom = useADMStore((state) => state.addRoom)
  const updateRoom = useADMStore((state) => state.updateRoom)
  const deleteRoom = useADMStore((state) => state.deleteRoom)
  const addDetailCategory = useADMStore((state) => state.addDetailCategory)
  const updateDetailCategory = useADMStore((state) => state.updateDetailCategory)
  const deleteDetailCategory = useADMStore((state) => state.deleteDetailCategory)

  const zonesArray = Array.from(zones.values()).sort((a, b) => a.order - b.order)
  const roomsArray = Array.from(rooms.values()).sort((a, b) => a.order - b.order)
  const detailsArray = Array.from(detailCategories.values()).sort((a, b) => a.order - b.order)

  if (!isOpen) return null

  const handleAddItem = () => {
    if (!newItemName.trim()) return

    switch (activeTab) {
      case 'zone':
        addZone(newItemName.trim())
        break
      case 'room':
        if (selectedParentId) {
          addRoom(selectedParentId, newItemName.trim())
        }
        break
      case 'detail':
        if (selectedParentId) {
          addDetailCategory(selectedParentId, newItemName.trim())
        }
        break
    }
    setNewItemName('')
  }

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const handleSaveEdit = () => {
    if (!editingId || !editingName.trim()) {
      setEditingId(null)
      return
    }

    switch (activeTab) {
      case 'zone':
        updateZone(editingId, { name: editingName.trim() })
        break
      case 'room':
        updateRoom(editingId, { name: editingName.trim() })
        break
      case 'detail':
        updateDetailCategory(editingId, { name: editingName.trim() })
        break
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleDelete = (id: string) => {
    if (!confirm('削除してもよろしいですか？関連するデータも削除されます。')) return

    switch (activeTab) {
      case 'zone':
        deleteZone(id)
        break
      case 'room':
        deleteRoom(id)
        break
      case 'detail':
        deleteDetailCategory(id)
        break
    }
  }

  const renderZoneTab = () => (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">新規工区</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="工区名"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          />
          <button
            onClick={handleAddItem}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            追加
          </button>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left w-12">順番</th>
              <th className="px-3 py-2 text-left">工区名</th>
              <th className="px-3 py-2 text-left w-20">部屋数</th>
              <th className="px-3 py-2 text-center w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {zonesArray.map((zone, index) => {
              const zoneRooms = roomsArray.filter((r) => r.zoneId === zone.id)
              const isEditing = editingId === zone.id
              return (
                <tr key={zone.id} className="border-t">
                  <td className="px-3 py-2">{index + 1}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="w-full px-2 py-1 border rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{zone.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{zoneRooms.length}件</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleStartEdit(zone.id, zone.name)}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                      title="編集"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(zone.id)}
                      className="text-red-600 hover:text-red-800"
                      title="削除"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              )
            })}
            {zonesArray.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  工区がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderRoomTab = () => (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">工区を選択</label>
        <select
          value={selectedParentId || ''}
          onChange={(e) => setSelectedParentId(e.target.value || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">-- 工区を選択 --</option>
          {zonesArray.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
      </div>

      {selectedParentId && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">新規階数/部屋</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="例: 1F, 2F, 101号室"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            />
            <button
              onClick={handleAddItem}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              追加
            </button>
          </div>
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">工区</th>
              <th className="px-3 py-2 text-left">階数/部屋</th>
              <th className="px-3 py-2 text-left w-20">細目数</th>
              <th className="px-3 py-2 text-center w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {roomsArray.map((room) => {
              const zone = zones.get(room.zoneId)
              const roomDetails = detailsArray.filter((d) => d.roomId === room.id)
              const isEditing = editingId === room.id
              return (
                <tr key={room.id} className="border-t">
                  <td className="px-3 py-2 text-gray-500">{zone?.name}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="w-full px-2 py-1 border rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{room.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{roomDetails.length}件</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleStartEdit(room.id, room.name)}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                      title="編集"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(room.id)}
                      className="text-red-600 hover:text-red-800"
                      title="削除"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              )
            })}
            {roomsArray.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  階数/部屋がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderDetailTab = () => (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">階数/部屋を選択</label>
        <select
          value={selectedParentId || ''}
          onChange={(e) => setSelectedParentId(e.target.value || null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">-- 階数/部屋を選択 --</option>
          {roomsArray.map((room) => {
            const zone = zones.get(room.zoneId)
            return (
              <option key={room.id} value={room.id}>
                {zone?.name} &gt; {room.name}
              </option>
            )
          })}
        </select>
      </div>

      {selectedParentId && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">新規細目</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="例: 躯体, 内装, 設備"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            />
            <button
              onClick={handleAddItem}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              追加
            </button>
          </div>
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">工区</th>
              <th className="px-3 py-2 text-left">階数/部屋</th>
              <th className="px-3 py-2 text-left">細目</th>
              <th className="px-3 py-2 text-center w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {detailsArray.map((detail) => {
              const room = rooms.get(detail.roomId)
              const zone = room ? zones.get(room.zoneId) : null
              const isEditing = editingId === detail.id
              return (
                <tr key={detail.id} className="border-t">
                  <td className="px-3 py-2 text-gray-500">{zone?.name}</td>
                  <td className="px-3 py-2 text-gray-500">{room?.name}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="w-full px-2 py-1 border rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{detail.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleStartEdit(detail.id, detail.name)}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                      title="編集"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(detail.id)}
                      className="text-red-600 hover:text-red-800"
                      title="削除"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              )
            })}
            {detailsArray.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  細目がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">マスターデータ管理</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b">
          <button
            onClick={() => {
              setActiveTab('zone')
              setSelectedParentId(null)
              setNewItemName('')
              setEditingId(null)
            }}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'zone'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            工区
          </button>
          <button
            onClick={() => {
              setActiveTab('room')
              setSelectedParentId(null)
              setNewItemName('')
              setEditingId(null)
            }}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'room'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            階数/部屋
          </button>
          <button
            onClick={() => {
              setActiveTab('detail')
              setSelectedParentId(null)
              setNewItemName('')
              setEditingId(null)
            }}
            className={`px-6 py-3 text-sm font-medium ${
              activeTab === 'detail'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            細目
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'zone' && renderZoneTab()}
          {activeTab === 'room' && renderRoomTab()}
          {activeTab === 'detail' && renderDetailTab()}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
