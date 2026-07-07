import Dexie, { type Table } from 'dexie'
import type { Task, Dependency, BugakariMasterSet, BugakariItem } from '@/types'
import type { IfcSession } from '@/types/ifc'

// プロジェクト
export interface Project {
  id: string
  name: string
  description?: string
  startDate: string
  workDays: number[]
  workHoursPerDay: number
  createdAt: string
  updatedAt: string
}

// 部屋
export interface Room {
  id: string
  projectId: string
  name: string
  code?: string
  area_m2?: number
  height_m?: number
  koukuId?: string
  floorId?: string
  note?: string
}

// 班
export interface Crew {
  id: string
  projectId: string
  name: string
  tradeType: string
  defaultSize: number
  maxSize?: number
  costPerManDay?: number
  note?: string
}

// 工区
export interface Kouku {
  id: string
  projectId: string
  name: string
  color?: string
  order: number
}

// 階数
export interface Floor {
  id: string
  projectId: string
  name: string
  level: number
  color?: string
  order: number
}

// カテゴリ
export interface Category {
  id: string
  projectId: string
  name: string
  color?: string
  order: number
}

// 祝日
export interface Holiday {
  id: string
  calendarId: string
  date: string
  name: string
  type: 'national' | 'company' | 'custom'
}

// 設定
export interface Setting {
  id: string
  key: string
  value: unknown
}

// ADMプロジェクト（ADM形式の全データをJSONで保存）
export interface ADMProject {
  id: string
  name: string
  data: string  // JSON文字列（exportFullData()の結果）
  siteId?: string
  siteName?: string
  createdAt: string
  updatedAt: string
}

// 部屋数量（IFC等から取得した詳細数量）
export type QuantityType =
  | 'grossFloorArea'
  | 'netFloorArea'
  | 'grossWallArea'
  | 'netWallArea'
  | 'grossCeilingArea'
  | 'grossVolume'
  | 'netVolume'
  | 'height'
  | 'finishFloorHeight'
  | 'finishCeilingHeight'

export type QuantityUnit = 'm2' | 'm3' | 'm'

export type QuantitySource = 'ifc' | 'manual' | 'calculated'

export interface RoomQuantity {
  id: string
  roomId: string
  quantityType: QuantityType
  value: number
  unit: QuantityUnit
  source: QuantitySource
  sourceRef?: string      // IFCセッションID、ファイル名など
  calculatedFromGeometry?: boolean  // ジオメトリから計算されたか
  updatedAt: string
}

class ConScheDatabase extends Dexie {
  projects!: Table<Project, string>
  tasks!: Table<Task, string>
  dependencies!: Table<Dependency, string>
  rooms!: Table<Room, string>
  crews!: Table<Crew, string>
  bugakariMasters!: Table<BugakariMasterSet, string>
  bugakariItems!: Table<BugakariItem, string>
  koukus!: Table<Kouku, string>
  floors!: Table<Floor, string>
  categories!: Table<Category, string>
  holidays!: Table<Holiday, string>
  settings!: Table<Setting, string>
  ifcSessions!: Table<IfcSession, string>
  roomQuantities!: Table<RoomQuantity, string>
  admProjects!: Table<ADMProject, string>

  constructor() {
    super('ConScheDB')

    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      tasks: 'id, projectId, roomId, crewId, name, type',
      dependencies: 'id, projectId, predecessorTaskId, successorTaskId, reasonType, status',
      rooms: 'id, projectId, name, koukuId, floorId',
      crews: 'id, projectId, name, tradeType',
      bugakariMasters: 'id, name, version',
      bugakariItems: 'id, masterId, code, name, category1, category2',
      koukus: 'id, projectId, name, order',
      floors: 'id, projectId, name, level, order',
      categories: 'id, projectId, name, order',
      holidays: 'id, calendarId, date, type',
      settings: 'id, key',
    })

    // Version 2: IFCセッションテーブル追加
    this.version(2).stores({
      projects: 'id, name, createdAt, updatedAt',
      tasks: 'id, projectId, roomId, crewId, name, type',
      dependencies: 'id, projectId, predecessorTaskId, successorTaskId, reasonType, status',
      rooms: 'id, projectId, name, koukuId, floorId',
      crews: 'id, projectId, name, tradeType',
      bugakariMasters: 'id, name, version',
      bugakariItems: 'id, masterId, code, name, category1, category2',
      koukus: 'id, projectId, name, order',
      floors: 'id, projectId, name, level, order',
      categories: 'id, projectId, name, order',
      holidays: 'id, calendarId, date, type',
      settings: 'id, key',
      ifcSessions: 'id, projectId, fileName, importedAt',
    })

    // Version 3: 部屋数量テーブル追加
    this.version(3).stores({
      projects: 'id, name, createdAt, updatedAt',
      tasks: 'id, projectId, roomId, crewId, name, type',
      dependencies: 'id, projectId, predecessorTaskId, successorTaskId, reasonType, status',
      rooms: 'id, projectId, name, koukuId, floorId',
      crews: 'id, projectId, name, tradeType',
      bugakariMasters: 'id, name, version',
      bugakariItems: 'id, masterId, code, name, category1, category2',
      koukus: 'id, projectId, name, order',
      floors: 'id, projectId, name, level, order',
      categories: 'id, projectId, name, order',
      holidays: 'id, calendarId, date, type',
      settings: 'id, key',
      ifcSessions: 'id, projectId, fileName, importedAt',
      roomQuantities: 'id, roomId, quantityType, source, sourceRef, updatedAt',
    })

    // Version 4: ADMプロジェクトテーブル追加
    this.version(4).stores({
      projects: 'id, name, createdAt, updatedAt',
      tasks: 'id, projectId, roomId, crewId, name, type',
      dependencies: 'id, projectId, predecessorTaskId, successorTaskId, reasonType, status',
      rooms: 'id, projectId, name, koukuId, floorId',
      crews: 'id, projectId, name, tradeType',
      bugakariMasters: 'id, name, version',
      bugakariItems: 'id, masterId, code, name, category1, category2',
      koukus: 'id, projectId, name, order',
      floors: 'id, projectId, name, level, order',
      categories: 'id, projectId, name, order',
      holidays: 'id, calendarId, date, type',
      settings: 'id, key',
      ifcSessions: 'id, projectId, fileName, importedAt',
      roomQuantities: 'id, roomId, quantityType, source, sourceRef, updatedAt',
      admProjects: 'id, name, updatedAt',
    })
  }
}

export const db = new ConScheDatabase()

// ユーティリティ関数
export async function saveProject(project: Project): Promise<void> {
  await db.projects.put(project)
}

export async function loadProject(projectId: string): Promise<Project | undefined> {
  return db.projects.get(projectId)
}

export async function loadAllProjects(): Promise<Project[]> {
  return db.projects.toArray()
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.tasks, db.dependencies, db.rooms, db.crews], async () => {
    await db.tasks.where('projectId').equals(projectId).delete()
    await db.dependencies.where('projectId').equals(projectId).delete()
    await db.rooms.where('projectId').equals(projectId).delete()
    await db.crews.where('projectId').equals(projectId).delete()
    await db.projects.delete(projectId)
  })
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await db.tasks.bulkPut(tasks)
}

export async function loadTasks(projectId: string): Promise<Task[]> {
  return db.tasks.where('projectId').equals(projectId).toArray()
}

export async function saveDependencies(dependencies: Dependency[]): Promise<void> {
  await db.dependencies.bulkPut(dependencies)
}

export async function loadDependencies(projectId: string): Promise<Dependency[]> {
  return db.dependencies.where('projectId').equals(projectId).toArray()
}

export async function saveBugakariMaster(master: BugakariMasterSet): Promise<void> {
  await db.bugakariMasters.put(master)
  await db.bugakariItems.bulkPut(master.items)
}

export async function loadBugakariMasters(): Promise<BugakariMasterSet[]> {
  const masters = await db.bugakariMasters.toArray()
  for (const master of masters) {
    master.items = await db.bugakariItems.where('masterId').equals(master.id).toArray()
  }
  return masters
}

export async function exportProjectToJSON(projectId: string): Promise<string> {
  const project = await db.projects.get(projectId)
  const tasks = await db.tasks.where('projectId').equals(projectId).toArray()
  const dependencies = await db.dependencies.where('projectId').equals(projectId).toArray()
  const rooms = await db.rooms.where('projectId').equals(projectId).toArray()
  const crews = await db.crews.where('projectId').equals(projectId).toArray()

  return JSON.stringify({
    project,
    tasks,
    dependencies,
    rooms,
    crews,
    exportedAt: new Date().toISOString(),
  }, null, 2)
}

export async function importProjectFromJSON(json: string): Promise<string> {
  const data = JSON.parse(json)

  await db.transaction('rw', [db.projects, db.tasks, db.dependencies, db.rooms, db.crews], async () => {
    if (data.project) await db.projects.put(data.project)
    if (data.tasks) await db.tasks.bulkPut(data.tasks)
    if (data.dependencies) await db.dependencies.bulkPut(data.dependencies)
    if (data.rooms) await db.rooms.bulkPut(data.rooms)
    if (data.crews) await db.crews.bulkPut(data.crews)
  })

  return data.project?.id
}

// IFCセッション関連
export async function saveIfcSession(session: IfcSession): Promise<void> {
  await db.ifcSessions.put(session)
}

export async function loadIfcSessions(projectId: string): Promise<IfcSession[]> {
  return db.ifcSessions.where('projectId').equals(projectId).toArray()
}

export async function loadIfcSession(sessionId: string): Promise<IfcSession | undefined> {
  return db.ifcSessions.get(sessionId)
}

export async function deleteIfcSession(sessionId: string): Promise<void> {
  await db.ifcSessions.delete(sessionId)
}

// RoomQuantity関連
export async function saveRoomQuantity(quantity: RoomQuantity): Promise<void> {
  await db.roomQuantities.put(quantity)
}

export async function saveRoomQuantities(quantities: RoomQuantity[]): Promise<void> {
  await db.roomQuantities.bulkPut(quantities)
}

export async function loadRoomQuantities(roomId: string): Promise<RoomQuantity[]> {
  return db.roomQuantities.where('roomId').equals(roomId).toArray()
}

export async function loadRoomQuantitiesBySource(sourceRef: string): Promise<RoomQuantity[]> {
  return db.roomQuantities.where('sourceRef').equals(sourceRef).toArray()
}

export async function deleteRoomQuantitiesByRoom(roomId: string): Promise<void> {
  await db.roomQuantities.where('roomId').equals(roomId).delete()
}

export async function deleteRoomQuantitiesBySource(sourceRef: string): Promise<void> {
  await db.roomQuantities.where('sourceRef').equals(sourceRef).delete()
}

// ADMProject関連
export async function saveADMProject(project: ADMProject): Promise<void> {
  await db.admProjects.put(project)
}

export async function loadADMProject(id: string): Promise<ADMProject | undefined> {
  return db.admProjects.get(id)
}

export async function loadAllADMProjects(): Promise<ADMProject[]> {
  return db.admProjects.orderBy('updatedAt').reverse().toArray()
}

export async function deleteADMProject(id: string): Promise<void> {
  await db.admProjects.delete(id)
}
