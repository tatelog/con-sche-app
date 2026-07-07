import type { Task, Dependency } from '@/types'
import { v4 as uuidv4 } from 'uuid'

// 18か月目（仕上げ工事中心）のサンプル工程
// 80億RC造事務所ビル、24か月工期

export function createSampleSchedule(): { tasks: Task[]; dependencies: Dependency[] } {
  const tasks: Task[] = []
  const dependencies: Dependency[] = []

  // タスクIDを事前に生成
  const ids = {
    // 躯体残工事
    slab18F: uuidv4(),
    parapetWork: uuidv4(),

    // 外装工事
    curtainWall: uuidv4(),
    exteriorTile: uuidv4(),
    sealant: uuidv4(),

    // 内装下地
    lgsPartition: uuidv4(),
    ceilingFrame: uuidv4(),
    floorBase: uuidv4(),

    // 設備配管・配線
    hvacDuct: uuidv4(),
    sprinkler: uuidv4(),
    electricConduit: uuidv4(),
    plumbing: uuidv4(),

    // 内装仕上げ
    plasterboard: uuidv4(),
    ceilingBoard: uuidv4(),
    floorTile: uuidv4(),
    painting: uuidv4(),

    // 建具
    steelDoor: uuidv4(),
    aluminumSash: uuidv4(),

    // 外構
    extPaving: uuidv4(),
    planting: uuidv4(),
  }

  // ========== タスク定義 ==========

  // 躯体残工事
  tasks.push({
    id: ids.slab18F,
    name: '18階スラブ打設',
    quantity: { value: 450, unit: 'm3' },
    unitRate: { value: 30, unit: 'm3/日' },
    crewSize: 8,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 0, ef: 2, ls: 0, lf: 2, totalFloat: 0, freeFloat: 0, isCritical: true,
    position: { x: 100, y: 100 },
    type: 'task',
    note: '最上階スラブ',
  })

  tasks.push({
    id: ids.parapetWork,
    name: 'パラペット・笠木',
    quantity: { value: 120, unit: 'm' },
    unitRate: { value: 20, unit: 'm/日' },
    crewSize: 4,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 2, ef: 4, ls: 2, lf: 4, totalFloat: 0, freeFloat: 0, isCritical: true,
    position: { x: 300, y: 100 },
    type: 'task',
  })

  // 外装工事
  tasks.push({
    id: ids.curtainWall,
    name: 'カーテンウォール取付（12-15F）',
    quantity: { value: 800, unit: 'm2' },
    unitRate: { value: 40, unit: 'm2/日' },
    crewSize: 6,
    duration: { baseDays: 4, adjustmentDays: 0, plannedDays: 4 },
    es: 0, ef: 4, ls: 1, lf: 5, totalFloat: 1, freeFloat: 0, isCritical: false,
    position: { x: 100, y: 200 },
    type: 'task',
  })

  tasks.push({
    id: ids.exteriorTile,
    name: '外壁タイル張り（8-11F）',
    quantity: { value: 600, unit: 'm2' },
    unitRate: { value: 25, unit: 'm2/日' },
    crewSize: 5,
    duration: { baseDays: 5, adjustmentDays: 0, plannedDays: 5 },
    es: 0, ef: 5, ls: 0, lf: 5, totalFloat: 0, freeFloat: 0, isCritical: false,
    position: { x: 100, y: 300 },
    type: 'task',
  })

  tasks.push({
    id: ids.sealant,
    name: 'シーリング工事（外部）',
    quantity: { value: 2000, unit: 'm' },
    unitRate: { value: 200, unit: 'm/日' },
    crewSize: 4,
    duration: { baseDays: 3, adjustmentDays: 0, plannedDays: 3 },
    es: 5, ef: 8, ls: 6, lf: 9, totalFloat: 1, freeFloat: 0, isCritical: false,
    position: { x: 300, y: 300 },
    type: 'task',
  })

  // 内装下地
  tasks.push({
    id: ids.lgsPartition,
    name: 'LGS間仕切り（6-9F）',
    quantity: { value: 1200, unit: 'm2' },
    unitRate: { value: 60, unit: 'm2/日' },
    crewSize: 6,
    duration: { baseDays: 4, adjustmentDays: 0, plannedDays: 4 },
    es: 4, ef: 8, ls: 4, lf: 8, totalFloat: 0, freeFloat: 0, isCritical: true,
    position: { x: 500, y: 100 },
    type: 'task',
  })

  tasks.push({
    id: ids.ceilingFrame,
    name: '天井下地（6-9F）',
    quantity: { value: 2400, unit: 'm2' },
    unitRate: { value: 150, unit: 'm2/日' },
    crewSize: 5,
    duration: { baseDays: 4, adjustmentDays: 0, plannedDays: 4 },
    es: 8, ef: 12, ls: 8, lf: 12, totalFloat: 0, freeFloat: 0, isCritical: true,
    position: { x: 700, y: 100 },
    type: 'task',
  })

  tasks.push({
    id: ids.floorBase,
    name: 'OAフロア下地（4-7F）',
    quantity: { value: 2000, unit: 'm2' },
    unitRate: { value: 200, unit: 'm2/日' },
    crewSize: 6,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 4, ef: 6, ls: 6, lf: 8, totalFloat: 2, freeFloat: 0, isCritical: false,
    position: { x: 500, y: 200 },
    type: 'task',
  })

  // 設備工事
  tasks.push({
    id: ids.hvacDuct,
    name: '空調ダクト（8-11F）',
    quantity: { value: 800, unit: 'm' },
    unitRate: { value: 50, unit: 'm/日' },
    crewSize: 6,
    duration: { baseDays: 3, adjustmentDays: 0, plannedDays: 3 },
    es: 8, ef: 11, ls: 9, lf: 12, totalFloat: 1, freeFloat: 0, isCritical: false,
    position: { x: 700, y: 200 },
    type: 'task',
  })

  tasks.push({
    id: ids.sprinkler,
    name: 'スプリンクラー配管（6-9F）',
    quantity: { value: 400, unit: '箇所' },
    unitRate: { value: 50, unit: '箇所/日' },
    crewSize: 4,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 8, ef: 10, ls: 10, lf: 12, totalFloat: 2, freeFloat: 0, isCritical: false,
    position: { x: 700, y: 300 },
    type: 'task',
  })

  tasks.push({
    id: ids.electricConduit,
    name: '電気配管・配線（6-9F）',
    quantity: { value: 3000, unit: 'm' },
    unitRate: { value: 300, unit: 'm/日' },
    crewSize: 8,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 8, ef: 10, ls: 10, lf: 12, totalFloat: 2, freeFloat: 0, isCritical: false,
    position: { x: 700, y: 400 },
    type: 'task',
  })

  tasks.push({
    id: ids.plumbing,
    name: '給排水配管（6-9F）',
    quantity: { value: 600, unit: 'm' },
    unitRate: { value: 60, unit: 'm/日' },
    crewSize: 5,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 8, ef: 10, ls: 10, lf: 12, totalFloat: 2, freeFloat: 0, isCritical: false,
    position: { x: 500, y: 400 },
    type: 'task',
  })

  // 内装仕上げ
  tasks.push({
    id: ids.plasterboard,
    name: 'ボード張り（4-7F）',
    quantity: { value: 2400, unit: 'm2' },
    unitRate: { value: 120, unit: 'm2/日' },
    crewSize: 6,
    duration: { baseDays: 4, adjustmentDays: 0, plannedDays: 4 },
    es: 12, ef: 16, ls: 12, lf: 16, totalFloat: 0, freeFloat: 0, isCritical: true,
    position: { x: 900, y: 100 },
    type: 'task',
  })

  tasks.push({
    id: ids.ceilingBoard,
    name: '天井ボード（4-7F）',
    quantity: { value: 2000, unit: 'm2' },
    unitRate: { value: 150, unit: 'm2/日' },
    crewSize: 5,
    duration: { baseDays: 3, adjustmentDays: 0, plannedDays: 3 },
    es: 12, ef: 15, ls: 13, lf: 16, totalFloat: 1, freeFloat: 0, isCritical: false,
    position: { x: 900, y: 200 },
    type: 'task',
  })

  tasks.push({
    id: ids.floorTile,
    name: 'タイルカーペット（2-5F）',
    quantity: { value: 1600, unit: 'm2' },
    unitRate: { value: 200, unit: 'm2/日' },
    crewSize: 4,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 16, ef: 18, ls: 16, lf: 18, totalFloat: 0, freeFloat: 0, isCritical: true,
    position: { x: 1100, y: 100 },
    type: 'task',
  })

  tasks.push({
    id: ids.painting,
    name: '塗装工事（4-7F）',
    quantity: { value: 3000, unit: 'm2' },
    unitRate: { value: 200, unit: 'm2/日' },
    crewSize: 5,
    duration: { baseDays: 3, adjustmentDays: 0, plannedDays: 3 },
    es: 16, ef: 19, ls: 17, lf: 20, totalFloat: 1, freeFloat: 0, isCritical: false,
    position: { x: 1100, y: 200 },
    type: 'task',
  })

  // 建具
  tasks.push({
    id: ids.steelDoor,
    name: 'SD建具取付（4-9F）',
    quantity: { value: 80, unit: '箇所' },
    unitRate: { value: 10, unit: '箇所/日' },
    crewSize: 4,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 16, ef: 18, ls: 18, lf: 20, totalFloat: 2, freeFloat: 0, isCritical: false,
    position: { x: 1100, y: 300 },
    type: 'task',
  })

  tasks.push({
    id: ids.aluminumSash,
    name: 'アルミサッシ取付（12-15F）',
    quantity: { value: 60, unit: '箇所' },
    unitRate: { value: 8, unit: '箇所/日' },
    crewSize: 4,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 4, ef: 6, ls: 4, lf: 6, totalFloat: 0, freeFloat: 0, isCritical: false,
    position: { x: 300, y: 200 },
    type: 'task',
  })

  // 外構
  tasks.push({
    id: ids.extPaving,
    name: '外構舗装（駐車場）',
    quantity: { value: 800, unit: 'm2' },
    unitRate: { value: 100, unit: 'm2/日' },
    crewSize: 6,
    duration: { baseDays: 2, adjustmentDays: 0, plannedDays: 2 },
    es: 18, ef: 20, ls: 18, lf: 20, totalFloat: 0, freeFloat: 0, isCritical: true,
    position: { x: 1300, y: 100 },
    type: 'task',
  })

  tasks.push({
    id: ids.planting,
    name: '植栽工事',
    quantity: { value: 50, unit: '本' },
    unitRate: { value: 15, unit: '本/日' },
    crewSize: 3,
    duration: { baseDays: 1, adjustmentDays: 0, plannedDays: 1 },
    es: 20, ef: 21, ls: 20, lf: 21, totalFloat: 0, freeFloat: 0, isCritical: true,
    position: { x: 1500, y: 100 },
    type: 'task',
  })

  // ========== 依存関係定義 ==========

  // 躯体系
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.slab18F,
    successorTaskId: ids.parapetWork,
    relationType: 'FS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: 'スラブ硬化後にパラペット施工' },
    status: 'confirmed',
  })

  // パラペット→LGS
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.parapetWork,
    successorTaskId: ids.lgsPartition,
    relationType: 'FS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '躯体完了後に内装下地開始' },
    status: 'confirmed',
  })

  // カーテンウォール→アルミサッシ
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.curtainWall,
    successorTaskId: ids.aluminumSash,
    relationType: 'SS',
    lag: 2,
    reasonType: 'crew',
    basis: { why: '同一班での施工、2日ずらし' },
    status: 'confirmed',
  })

  // 外壁タイル→シーリング
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.exteriorTile,
    successorTaskId: ids.sealant,
    relationType: 'FS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: 'タイル完了後にシーリング' },
    status: 'confirmed',
  })

  // LGS→天井下地
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.lgsPartition,
    successorTaskId: ids.ceilingFrame,
    relationType: 'FS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '壁下地完了後に天井下地' },
    status: 'confirmed',
  })

  // LGS→OAフロア
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.lgsPartition,
    successorTaskId: ids.floorBase,
    relationType: 'SS',
    lag: 0,
    reasonType: 'logistics',
    basis: { why: '並行施工可能' },
    status: 'confirmed',
  })

  // 天井下地→各設備
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.ceilingFrame,
    successorTaskId: ids.hvacDuct,
    relationType: 'SS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '天井内設備工事' },
    status: 'confirmed',
  })

  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.ceilingFrame,
    successorTaskId: ids.sprinkler,
    relationType: 'SS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '天井内スプリンクラー' },
    status: 'confirmed',
  })

  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.ceilingFrame,
    successorTaskId: ids.electricConduit,
    relationType: 'SS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '天井内電気配線' },
    status: 'confirmed',
  })

  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.ceilingFrame,
    successorTaskId: ids.plumbing,
    relationType: 'SS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '配管工事' },
    status: 'confirmed',
  })

  // 天井下地→ボード張り
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.ceilingFrame,
    successorTaskId: ids.plasterboard,
    relationType: 'FS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '下地完了後にボード張り' },
    status: 'confirmed',
  })

  // ボード→天井ボード
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.plasterboard,
    successorTaskId: ids.ceilingBoard,
    relationType: 'SS',
    lag: 0,
    reasonType: 'crew',
    basis: { why: '同時進行' },
    status: 'confirmed',
  })

  // ボード→タイルカーペット
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.plasterboard,
    successorTaskId: ids.floorTile,
    relationType: 'FS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '壁仕上げ後に床仕上げ' },
    status: 'confirmed',
  })

  // ボード→塗装
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.plasterboard,
    successorTaskId: ids.painting,
    relationType: 'FS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: 'ボード後に塗装' },
    status: 'confirmed',
  })

  // ボード→SD建具
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.plasterboard,
    successorTaskId: ids.steelDoor,
    relationType: 'FS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '壁完了後に建具' },
    status: 'confirmed',
  })

  // タイルカーペット→外構
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.floorTile,
    successorTaskId: ids.extPaving,
    relationType: 'FS',
    lag: 0,
    reasonType: 'logistics',
    basis: { why: '内部仕上げ優先' },
    status: 'confirmed',
  })

  // 外構→植栽
  dependencies.push({
    id: uuidv4(),
    predecessorTaskId: ids.extPaving,
    successorTaskId: ids.planting,
    relationType: 'FS',
    lag: 0,
    reasonType: 'technical',
    basis: { why: '舗装後に植栽' },
    status: 'confirmed',
  })

  return { tasks, dependencies }
}
