/**
 * IFCマッピング設定パネル
 * IFCから抽出した階・室情報をcon-scheのFloor/Roomにマッピング
 */

import { useState, useMemo, useCallback } from 'react'
import {
  X,
  Building2,
  DoorOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { useIfcStore } from '@/stores/ifcStore'
import { useADMStore } from '@/stores/admStore'
import { getMappingStats, validateMapping } from '@/utils/ifcMapper'
import { saveRoomQuantities, type RoomQuantity, type QuantityType, type QuantityUnit } from '@/db/database'
import type { MappingAction, FloorMapping, RoomMapping, IfcToConScheMapping, IfcSpaceQuantities } from '@/types/ifc'

type TabType = 'floors' | 'rooms'

export function IfcMappingPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('floors')
  const [expandedStoreys, setExpandedStoreys] = useState<Set<number>>(new Set())

  const isOpen = useIfcStore((state) => state.isMappingPanelOpen)
  const closePanel = useIfcStore((state) => state.closeMappingPanel)
  const floorMappings = useIfcStore((state) => state.floorMappings)
  const roomMappings = useIfcStore((state) => state.roomMappings)
  const currentResult = useIfcStore((state) => state.currentResult)
  const currentSessionId = useIfcStore((state) => state.currentSessionId)
  const updateFloorMapping = useIfcStore((state) => state.updateFloorMapping)
  const updateRoomMapping = useIfcStore((state) => state.updateRoomMapping)
  const setAllFloorActions = useIfcStore((state) => state.setAllFloorActions)
  const setAllRoomActions = useIfcStore((state) => state.setAllRoomActions)
  const saveMapping = useIfcStore((state) => state.saveMapping)
  const reset = useIfcStore((state) => state.reset)

  // 現在のマッピング設定
  const currentMapping = useMemo((): IfcToConScheMapping | null => {
    if (!currentSessionId) return null
    return {
      sessionId: currentSessionId,
      floors: floorMappings,
      rooms: roomMappings,
      createdAt: new Date().toISOString(),
    }
  }, [currentSessionId, floorMappings, roomMappings])

  // 統計情報
  const stats = useMemo(() => {
    if (!currentMapping) return null
    return getMappingStats(currentMapping)
  }, [currentMapping])

  // バリデーション
  const validation = useMemo(() => {
    if (!currentMapping) return { isValid: true, errors: [], warnings: [] }
    return validateMapping(currentMapping)
  }, [currentMapping])

  // 階ごとの部屋グループ
  const roomsByStorey = useMemo(() => {
    const grouped = new Map<number, RoomMapping[]>()
    for (const rm of roomMappings) {
      const list = grouped.get(rm.ifcStoreyId) || []
      list.push(rm)
      grouped.set(rm.ifcStoreyId, list)
    }
    return grouped
  }, [roomMappings])

  const toggleStorey = (storeyId: number) => {
    setExpandedStoreys((prev) => {
      const next = new Set(prev)
      if (next.has(storeyId)) {
        next.delete(storeyId)
      } else {
        next.add(storeyId)
      }
      return next
    })
  }

  // ADMStoreからアクションを取得
  const addZone = useADMStore((state) => state.addZone)
  const addRoom = useADMStore((state) => state.addRoom)
  const addDetailCategory = useADMStore((state) => state.addDetailCategory)
  const zones = useADMStore((state) => state.zones)

  // 数量情報をRoomQuantityレコードに変換
  const convertToRoomQuantities = useCallback((
    roomId: string,
    quantities: IfcSpaceQuantities | undefined,
    sourceRef: string
  ): RoomQuantity[] => {
    if (!quantities) return []

    const result: RoomQuantity[] = []
    const now = new Date().toISOString()

    const addQuantity = (
      type: QuantityType,
      value: number | undefined,
      unit: QuantityUnit
    ) => {
      if (value !== undefined && value > 0) {
        result.push({
          id: `${roomId}-${type}`,
          roomId,
          quantityType: type,
          value,
          unit,
          source: 'ifc',
          sourceRef,
          calculatedFromGeometry: quantities.calculatedFromGeometry,
          updatedAt: now,
        })
      }
    }

    // 面積系 (m2)
    addQuantity('grossFloorArea', quantities.grossFloorArea, 'm2')
    addQuantity('netFloorArea', quantities.netFloorArea, 'm2')
    addQuantity('grossWallArea', quantities.grossWallArea, 'm2')
    addQuantity('netWallArea', quantities.netWallArea, 'm2')
    addQuantity('grossCeilingArea', quantities.grossCeilingArea, 'm2')

    // 体積系 (m3)
    addQuantity('grossVolume', quantities.grossVolume, 'm3')
    addQuantity('netVolume', quantities.netVolume, 'm3')

    // 高さ系 (m)
    addQuantity('height', quantities.height, 'm')
    addQuantity('finishFloorHeight', quantities.finishFloorHeight, 'm')
    addQuantity('finishCeilingHeight', quantities.finishCeilingHeight, 'm')

    return result
  }, [])

  const handleApply = async () => {
    if (!currentSessionId) return

    try {
      // 1. 階（Floor）の処理 - 工区とRoomを作成
      const floorIdMap = new Map<number, string>() // ifcStoreyId → conScheRoomId

      for (const floor of floorMappings) {
        if (floor.action === 'skip') continue

        if (floor.action === 'create') {
          // 既存の工区を使用するか、新規作成
          let zoneId: string
          if (zones.size > 0) {
            // 最初の工区を使用
            zoneId = Array.from(zones.keys())[0]
          } else {
            // 工区がなければ作成
            zoneId = addZone('デフォルト工区')
          }

          // 階をRoomとして追加
          const roomId = addRoom(zoneId, floor.conScheFloorName)
          floorIdMap.set(floor.ifcStoreyId, roomId)

          // 細目を作成（躯体、内装、設備など）
          addDetailCategory(roomId, '躯体')
          addDetailCategory(roomId, '内装')
          addDetailCategory(roomId, '設備')
        }
      }

      // 2. 部屋（Room）の数量情報をRoomQuantityテーブルに保存
      const allQuantities: RoomQuantity[] = []

      for (const room of roomMappings) {
        if (room.action === 'skip') continue

        // 部屋名をIDとして使用（IFCのGlobalIdベース）
        const roomId = `ifc-space-${room.ifcSpaceId}`

        const quantities = convertToRoomQuantities(
          roomId,
          room.quantities,
          currentSessionId
        )
        allQuantities.push(...quantities)
      }

      // DBに保存
      if (allQuantities.length > 0) {
        await saveRoomQuantities(allQuantities)
      }

      // 3. マッピング設定を保存
      saveMapping()

      const createdFloors = floorMappings.filter(f => f.action === 'create').length
      const createdQuantities = allQuantities.length

      alert(
        `適用完了:\n` +
        `・階: ${createdFloors}件作成\n` +
        `・数量情報: ${createdQuantities}件保存`
      )

      // パネルを閉じる
      handleClose()
    } catch (error) {
      console.error('IFCマッピング適用エラー:', error)
      alert('適用中にエラーが発生しました。')
    }
  }

  const handleClose = () => {
    reset()
    closePanel()
  }

  if (!isOpen || !currentResult) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />

      {/* パネル */}
      <div className="relative bg-white rounded-lg shadow-xl w-[720px] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold">IFCマッピング設定</h3>
            <p className="text-sm text-gray-500">{currentResult.stats.fileName}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b flex-shrink-0">
          <TabButton
            active={activeTab === 'floors'}
            onClick={() => setActiveTab('floors')}
            icon={<Building2 size={16} />}
            label={`階 (${floorMappings.length})`}
          />
          <TabButton
            active={activeTab === 'rooms'}
            onClick={() => setActiveTab('rooms')}
            icon={<DoorOpen size={16} />}
            label={`部屋 (${roomMappings.length})`}
          />
        </div>

        {/* 一括操作 */}
        <div className="flex items-center gap-2 p-3 bg-gray-50 border-b flex-shrink-0">
          <span className="text-sm text-gray-600">一括設定:</span>
          <button
            onClick={() => {
              if (activeTab === 'floors') setAllFloorActions('create')
              else setAllRoomActions('create')
            }}
            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            <Plus size={12} className="inline mr-1" />
            すべて新規
          </button>
          <button
            onClick={() => {
              if (activeTab === 'floors') setAllFloorActions('update')
              else setAllRoomActions('update')
            }}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            <RefreshCw size={12} className="inline mr-1" />
            すべて更新
          </button>
          <button
            onClick={() => {
              if (activeTab === 'floors') setAllFloorActions('skip')
              else setAllRoomActions('skip')
            }}
            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            すべてスキップ
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'floors' && (
            <FloorMappingList
              mappings={floorMappings}
              onUpdate={updateFloorMapping}
            />
          )}

          {activeTab === 'rooms' && (
            <RoomMappingList
              mappings={roomMappings}
              floorMappings={floorMappings}
              roomsByStorey={roomsByStorey}
              expandedStoreys={expandedStoreys}
              onToggleStorey={toggleStorey}
              onUpdate={updateRoomMapping}
            />
          )}
        </div>

        {/* 統計 & バリデーション */}
        {stats && (
          <div className="p-4 border-t bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <StatBadge label="新規" count={stats.floors.create + stats.rooms.create} color="green" />
                <StatBadge label="更新" count={stats.floors.update + stats.rooms.update} color="blue" />
                <StatBadge label="スキップ" count={stats.floors.skip + stats.rooms.skip} color="gray" />
              </div>
              {!validation.isValid && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertTriangle size={16} />
                  <span>エラーがあります</span>
                </div>
              )}
            </div>

            {validation.errors.length > 0 && (
              <div className="mt-2 text-sm text-red-600">
                {validation.errors.map((err, i) => (
                  <div key={i}>・{err}</div>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="mt-2 text-sm text-yellow-600">
                {validation.warnings.map((warn, i) => (
                  <div key={i}>・{warn}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 p-4 border-t flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleApply}
            disabled={!validation.isValid}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check size={16} />
            適用
          </button>
        </div>
      </div>
    </div>
  )
}

// ======================================
// サブコンポーネント
// ======================================

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? 'text-blue-600 border-b-2 border-blue-600'
          : 'text-gray-600 hover:text-gray-800'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function StatBadge({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: 'green' | 'blue' | 'gray'
}) {
  const colors = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded ${colors[color]}`}>
      {label}: {count}
    </span>
  )
}

function ActionSelect({
  value,
  onChange,
}: {
  value: MappingAction
  onChange: (action: MappingAction) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as MappingAction)}
      className={`px-2 py-1 text-sm border rounded ${
        value === 'create'
          ? 'bg-green-50 border-green-300'
          : value === 'update'
          ? 'bg-blue-50 border-blue-300'
          : 'bg-gray-50 border-gray-300'
      }`}
    >
      <option value="create">新規作成</option>
      <option value="update">更新</option>
      <option value="skip">スキップ</option>
    </select>
  )
}

function FloorMappingList({
  mappings,
  onUpdate,
}: {
  mappings: FloorMapping[]
  onUpdate: (id: number, updates: Partial<FloorMapping>) => void
}) {
  return (
    <div className="space-y-2">
      {mappings.map((mapping) => (
        <div
          key={mapping.ifcStoreyId}
          className="flex items-center gap-4 p-3 bg-white border rounded-lg"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-gray-400 flex-shrink-0" />
              <span className="font-medium truncate">{mapping.ifcStoreyName}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              標高: {mapping.ifcElevation.toFixed(2)}m
            </div>
          </div>
          <div className="text-gray-400">→</div>
          <div className="w-40">
            <input
              type="text"
              value={mapping.conScheFloorName}
              onChange={(e) =>
                onUpdate(mapping.ifcStoreyId, { conScheFloorName: e.target.value })
              }
              className="w-full px-2 py-1 text-sm border rounded"
              placeholder="階名"
            />
          </div>
          <ActionSelect
            value={mapping.action}
            onChange={(action) => onUpdate(mapping.ifcStoreyId, { action })}
          />
        </div>
      ))}

      {mappings.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          階情報がありません
        </div>
      )}
    </div>
  )
}

function RoomMappingList({
  mappings,
  floorMappings,
  roomsByStorey,
  expandedStoreys,
  onToggleStorey,
  onUpdate,
}: {
  mappings: RoomMapping[]
  floorMappings: FloorMapping[]
  roomsByStorey: Map<number, RoomMapping[]>
  expandedStoreys: Set<number>
  onToggleStorey: (storeyId: number) => void
  onUpdate: (id: number, updates: Partial<RoomMapping>) => void
}) {
  return (
    <div className="space-y-2">
      {floorMappings.map((floor) => {
        const rooms = roomsByStorey.get(floor.ifcStoreyId) || []
        const isExpanded = expandedStoreys.has(floor.ifcStoreyId)

        return (
          <div key={floor.ifcStoreyId} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => onToggleStorey(floor.ifcStoreyId)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={16} className="text-gray-400" />
              ) : (
                <ChevronRight size={16} className="text-gray-400" />
              )}
              <Building2 size={16} className="text-gray-500" />
              <span className="font-medium">{floor.ifcStoreyName}</span>
              <span className="text-sm text-gray-500 ml-auto">{rooms.length}室</span>
            </button>

            {isExpanded && rooms.length > 0 && (
              <div className="border-t divide-y">
                {rooms.map((room) => (
                  <RoomMappingItem
                    key={room.ifcSpaceId}
                    room={room}
                    onUpdate={onUpdate}
                  />
                ))}
              </div>
            )}

            {isExpanded && rooms.length === 0 && (
              <div className="p-3 pl-10 text-sm text-gray-500">
                この階に部屋はありません
              </div>
            )}
          </div>
        )
      })}

      {mappings.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          部屋情報がありません
        </div>
      )}
    </div>
  )
}

function RoomMappingItem({
  room,
  onUpdate,
}: {
  room: RoomMapping
  onUpdate: (id: number, updates: Partial<RoomMapping>) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const q = room.quantities
  const boundaries = room.boundaries || []

  // 境界面を種類ごとに集計
  const wallBoundaries = boundaries.filter((b) => b.type === 'wall')
  const floorBoundaries = boundaries.filter((b) => b.type === 'floor')
  const ceilingBoundaries = boundaries.filter((b) => b.type === 'ceiling')

  const hasQuantities = q && (q.grossFloorArea || q.grossWallArea || q.grossCeilingArea)
  const hasBoundaries = boundaries.length > 0

  return (
    <div className="border-b last:border-b-0">
      {/* メイン行 */}
      <div className="flex items-center gap-4 p-3 pl-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {(hasQuantities || hasBoundaries) && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-gray-600"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            <DoorOpen size={14} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm truncate">{room.ifcSpaceName}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex gap-3 items-center">
            {room.ifcArea && <span>床: {room.ifcArea.toFixed(1)}m²</span>}
            {q?.grossWallArea && <span>壁: {q.grossWallArea.toFixed(1)}m²</span>}
            {q?.grossCeilingArea && <span>天井: {q.grossCeilingArea.toFixed(1)}m²</span>}
            {!room.ifcArea && !q?.grossWallArea && !q?.grossCeilingArea && (
              <span className="text-gray-400">数量情報なし</span>
            )}
            {q?.calculatedFromGeometry && (
              <span className="px-1 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px]">
                ジオメトリ
              </span>
            )}
          </div>
        </div>
        <div className="text-gray-400 text-sm">→</div>
        <div className="w-32">
          <input
            type="text"
            value={room.conScheRoomName}
            onChange={(e) =>
              onUpdate(room.ifcSpaceId, { conScheRoomName: e.target.value })
            }
            className="w-full px-2 py-1 text-sm border rounded"
            placeholder="部屋名"
          />
        </div>
        <ActionSelect
          value={room.action}
          onChange={(action) => onUpdate(room.ifcSpaceId, { action })}
        />
      </div>

      {/* 詳細展開 */}
      {isExpanded && (
        <div className="pl-16 pr-4 pb-3 bg-gray-50">
          {/* 詳細数量 */}
          {q && (
            <div className="mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-1">
                <span>数量情報</span>
                {q.calculatedFromGeometry && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px]">
                    ジオメトリ計算
                    {q.profileType && ` (${q.profileType === 'rectangle' ? '矩形' : q.profileType === 'arbitrary' ? '多角形' : q.profileType === 'circle' ? '円形' : 'その他'})`}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {q.grossFloorArea && (
                  <QuantityItem label="床面積(総)" value={q.grossFloorArea} unit="m²" />
                )}
                {q.netFloorArea && (
                  <QuantityItem label="床面積(有効)" value={q.netFloorArea} unit="m²" />
                )}
                {q.grossCeilingArea && (
                  <QuantityItem label="天井面積" value={q.grossCeilingArea} unit="m²" />
                )}
                {q.grossWallArea && (
                  <QuantityItem label="壁面積(総)" value={q.grossWallArea} unit="m²" />
                )}
                {q.netWallArea && (
                  <QuantityItem label="壁面積(有効)" value={q.netWallArea} unit="m²" />
                )}
                {q.grossVolume && (
                  <QuantityItem label="体積" value={q.grossVolume} unit="m³" />
                )}
                {q.height && (
                  <QuantityItem label="高さ" value={q.height} unit="m" />
                )}
              </div>
            </div>
          )}

          {/* 境界面情報 */}
          {hasBoundaries && (
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">境界面</div>
              <div className="space-y-1 text-xs">
                {wallBoundaries.length > 0 && (
                  <BoundaryGroup label="壁" boundaries={wallBoundaries} />
                )}
                {floorBoundaries.length > 0 && (
                  <BoundaryGroup label="床" boundaries={floorBoundaries} />
                )}
                {ceilingBoundaries.length > 0 && (
                  <BoundaryGroup label="天井" boundaries={ceilingBoundaries} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function QuantityItem({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-white px-2 py-1 rounded border">
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{value.toFixed(2)} {unit}</div>
    </div>
  )
}

function BoundaryGroup({
  label,
  boundaries,
}: {
  label: string
  boundaries: { relatedElementName?: string; area?: number; internalOrExternal?: string }[]
}) {
  const totalArea = boundaries.reduce((sum, b) => sum + (b.area || 0), 0)
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-600 w-12">{label}:</span>
      <span className="font-medium">{boundaries.length}面</span>
      {totalArea > 0 && (
        <span className="text-gray-500">（計 {totalArea.toFixed(1)}m²）</span>
      )}
    </div>
  )
}
