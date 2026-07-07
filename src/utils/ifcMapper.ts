/**
 * IFCからcon-scheへのマッピングロジック
 * 階・部屋情報をcon-scheのデータ構造に変換
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  IfcImportResult,
  FloorMapping,
  RoomMapping,
  IfcToConScheMapping,
  MappingAction,
} from '@/types/ifc'
import type { Floor, Room, Kouku } from '@/db/database'

// ======================================
// 自動マッピング
// ======================================

/**
 * IFCの階情報から既存Floor候補を自動マッチング
 */
export function autoMatchFloors(
  ifcStoreys: IfcImportResult['storeys'],
  existingFloors: Floor[]
): FloorMapping[] {
  return ifcStoreys.map((storey) => {
    // 名前の正規化
    const normalizedIfcName = normalizeFloorName(storey.name)

    // 既存Floorとのマッチング
    const matchedFloor = existingFloors.find((f) => {
      const normalizedExisting = normalizeFloorName(f.name)
      return normalizedIfcName === normalizedExisting
    })

    return {
      ifcStoreyId: storey.expressId,
      ifcStoreyName: storey.name,
      ifcElevation: storey.elevation,
      conScheFloorId: matchedFloor?.id || null,
      conScheFloorName: matchedFloor?.name || storey.name,
      action: matchedFloor ? 'update' : 'create',
    }
  })
}

/**
 * IFCの室情報から既存Room候補を自動マッチング
 */
export function autoMatchRooms(
  ifcSpaces: IfcImportResult['spaces'],
  existingRooms: Room[],
  floorMappings: FloorMapping[]
): RoomMapping[] {
  return ifcSpaces.map((space) => {
    // 名前の正規化
    const normalizedIfcName = normalizeRoomName(space.name)

    // 既存Roomとのマッチング（名前＋階層で判定）
    const floorMapping = floorMappings.find((fm) => fm.ifcStoreyId === space.storeyId)
    const matchedRoom = existingRooms.find((r) => {
      const normalizedExisting = normalizeRoomName(r.name)
      const sameFloor = floorMapping?.conScheFloorId && r.floorId === floorMapping.conScheFloorId
      return normalizedIfcName === normalizedExisting && sameFloor
    })

    return {
      ifcSpaceId: space.expressId,
      ifcSpaceName: space.name,
      ifcStoreyId: space.storeyId,
      ifcArea: space.area,
      ifcVolume: space.volume,
      ifcHeight: space.height,
      conScheRoomId: matchedRoom?.id || null,
      conScheRoomName: matchedRoom?.name || space.name,
      action: matchedRoom ? 'update' : 'create',
    }
  })
}

// ======================================
// マッピング適用
// ======================================

/**
 * マッピングを適用してFloor/Roomを生成・更新
 */
export function applyMapping(
  mapping: IfcToConScheMapping,
  projectId: string,
  existingFloors: Floor[],
  existingRooms: Room[],
  existingKoukus: Kouku[]
): {
  floorsToCreate: Floor[]
  floorsToUpdate: Floor[]
  roomsToCreate: Room[]
  roomsToUpdate: Room[]
} {
  const floorsToCreate: Floor[] = []
  const floorsToUpdate: Floor[] = []
  const roomsToCreate: Room[] = []
  const roomsToUpdate: Room[] = []

  // 階のマッピングID対応表
  const floorIdMap = new Map<number, string>() // ifcStoreyId -> conScheFloorId

  // 階の処理
  const maxFloorOrder = Math.max(0, ...existingFloors.map((f) => f.order))
  let nextFloorOrder = maxFloorOrder + 1

  for (const fm of mapping.floors) {
    if (fm.action === 'skip') continue

    if (fm.action === 'create') {
      const newId = uuidv4()
      floorsToCreate.push({
        id: newId,
        projectId,
        name: fm.conScheFloorName,
        level: Math.round(fm.ifcElevation * 1000), // mm単位で保存
        order: nextFloorOrder++,
      })
      floorIdMap.set(fm.ifcStoreyId, newId)
    } else if (fm.action === 'update' && fm.conScheFloorId) {
      const existing = existingFloors.find((f) => f.id === fm.conScheFloorId)
      if (existing) {
        floorsToUpdate.push({
          ...existing,
          name: fm.conScheFloorName,
          level: Math.round(fm.ifcElevation * 1000),
        })
        floorIdMap.set(fm.ifcStoreyId, fm.conScheFloorId)
      }
    }
  }

  // 部屋の処理
  const maxRoomOrder = Math.max(0, ...existingRooms.map((r) => parseInt(r.id.slice(-4), 16) || 0))
  let nextRoomOrder = maxRoomOrder + 1

  // デフォルト工区を取得または作成用フラグ
  const defaultKouku = existingKoukus[0]

  for (const rm of mapping.rooms) {
    if (rm.action === 'skip') continue

    const floorId = floorIdMap.get(rm.ifcStoreyId) || null

    if (rm.action === 'create') {
      roomsToCreate.push({
        id: uuidv4(),
        projectId,
        name: rm.conScheRoomName,
        area_m2: rm.ifcArea,
        height_m: rm.ifcHeight,
        floorId: floorId || undefined,
        koukuId: defaultKouku?.id,
      })
      nextRoomOrder++
    } else if (rm.action === 'update' && rm.conScheRoomId) {
      const existing = existingRooms.find((r) => r.id === rm.conScheRoomId)
      if (existing) {
        roomsToUpdate.push({
          ...existing,
          name: rm.conScheRoomName,
          area_m2: rm.ifcArea ?? existing.area_m2,
          height_m: rm.ifcHeight ?? existing.height_m,
          floorId: floorId || existing.floorId,
        })
      }
    }
  }

  return {
    floorsToCreate,
    floorsToUpdate,
    roomsToCreate,
    roomsToUpdate,
  }
}

// ======================================
// 名前の正規化
// ======================================

/**
 * 階名を正規化（比較用）
 */
function normalizeFloorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/階$/g, 'f')
    .replace(/^(\d+)f$/g, '$1f')
    .replace(/b(\d+)f?/g, 'b$1')
    .replace(/rf?$/g, 'rf')
    .replace(/地下(\d+)/g, 'b$1')
    .replace(/屋上/g, 'rf')
}

/**
 * 室名を正規化（比較用）
 */
function normalizeRoomName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\-_]/g, '')
    .replace(/室$/g, '')
    .replace(/room$/gi, '')
}

// ======================================
// バリデーション
// ======================================

/**
 * マッピング設定のバリデーション
 */
export function validateMapping(mapping: IfcToConScheMapping): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // 重複チェック: 同じcon-scheFloorIdに複数のIFC階をマッピングしていないか
  const floorTargetIds = mapping.floors
    .filter((f) => f.action !== 'skip' && f.conScheFloorId)
    .map((f) => f.conScheFloorId)
  const duplicateFloorTargets = floorTargetIds.filter(
    (id, index) => floorTargetIds.indexOf(id) !== index
  )
  if (duplicateFloorTargets.length > 0) {
    errors.push(`同じ階に複数のIFC階がマッピングされています`)
  }

  // 重複チェック: 同じcon-scheRoomIdに複数のIFC室をマッピングしていないか
  const roomTargetIds = mapping.rooms
    .filter((r) => r.action !== 'skip' && r.conScheRoomId)
    .map((r) => r.conScheRoomId)
  const duplicateRoomTargets = roomTargetIds.filter(
    (id, index) => roomTargetIds.indexOf(id) !== index
  )
  if (duplicateRoomTargets.length > 0) {
    errors.push(`同じ部屋に複数のIFC室がマッピングされています`)
  }

  // 警告: すべてスキップの場合
  const allFloorsSkipped = mapping.floors.every((f) => f.action === 'skip')
  const allRoomsSkipped = mapping.rooms.every((r) => r.action === 'skip')
  if (allFloorsSkipped && allRoomsSkipped) {
    warnings.push('すべての項目がスキップに設定されています')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

// ======================================
// 統計情報
// ======================================

/**
 * マッピングの統計情報を取得
 */
export function getMappingStats(mapping: IfcToConScheMapping): {
  floors: { create: number; update: number; skip: number }
  rooms: { create: number; update: number; skip: number }
} {
  const countByAction = (items: { action: MappingAction }[]) => ({
    create: items.filter((i) => i.action === 'create').length,
    update: items.filter((i) => i.action === 'update').length,
    skip: items.filter((i) => i.action === 'skip').length,
  })

  return {
    floors: countByAction(mapping.floors),
    rooms: countByAction(mapping.rooms),
  }
}
