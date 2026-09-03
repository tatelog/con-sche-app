/**
 * デモ用サンプル工程表（ADM / 英語）
 *
 * 18階建てRC造オフィスビルの、18か月目（仕上げ・設備中心）の工程。
 * 外装・内装・設備・外構の4系統が並走し、クリティカルパスと
 * フロートの差が出るように組んである。
 *
 * 用途:
 * - 初見のユーザー（と審査員・エージェント）が空のキャンバスではなく
 *   実物の工程表から始められるようにする
 * - WebMCPツールを試す土台。「どれだけずらせるか」「今日は何の作業か」に
 *   意味のある答えが返る規模にしてある
 *
 * 作業名を英語にしているのは、この工程表がそのまま海外の利用者・
 * エージェントへのデモになるため。
 */
import { createActivity, createEventNode } from '@/types/adm'
import type { Activity, EventNode, ProjectSettings } from '@/types/adm'

const DAY_WIDTH = 30
const X0 = 100

/** 最早結合点時刻から素直にX座標を出す（読み込み後にCPMで再計算される） */
const x = (day: number) => X0 + day * DAY_WIDTH

/** 系統ごとのY座標。外装を上、内装を中央、設備を下に置いて流れを読ませる */
const LANE = { exterior: 120, interior: 260, services: 400 } as const

type NodeSpec = { n: number; day: number; y: number }

const NODE_SPECS: NodeSpec[] = [
  { n: 1, day: 0, y: LANE.interior },
  { n: 2, day: 8, y: LANE.interior },
  { n: 3, day: 14, y: LANE.exterior },
  { n: 4, day: 20, y: LANE.exterior },
  { n: 5, day: 18, y: LANE.interior },
  { n: 6, day: 34, y: LANE.exterior },
  { n: 7, day: 41, y: LANE.exterior },
  { n: 8, day: 26, y: LANE.services },
  { n: 9, day: 36, y: LANE.services },
  // 設備の並行作業を別の行に落とすための中間結合点。
  // 同じ結合点間に4本並べると矢印が重なって読めなくなる。
  { n: 17, day: 35, y: LANE.services + 70 },
  { n: 18, day: 33, y: LANE.services + 140 },
  { n: 19, day: 32, y: LANE.services + 210 },
  { n: 10, day: 48, y: LANE.interior },
  { n: 11, day: 56, y: LANE.interior },
  { n: 12, day: 66, y: LANE.interior },
  { n: 13, day: 73, y: LANE.interior },
  { n: 14, day: 81, y: LANE.interior },
  { n: 15, day: 91, y: LANE.interior },
  { n: 16, day: 97, y: LANE.interior },
]

const nodeId = (n: number) => `sample-node-${n}`

type ActivitySpec = {
  key: string
  name: string
  from: number
  to: number
  duration: number
  quantity?: number
  unit?: string
  crew?: number
  note?: string
  dummy?: boolean
}

/**
 * 作業。durationの差でクリティカルパスとフロートが自然に分かれる。
 * 設備4本（8→9）は同じ結合点間に並ぶので、HVAC以外にフロートが出る。
 */
const ACTIVITY_SPECS: ActivitySpec[] = [
  { key: 'slab', name: '18F Slab Pour', from: 1, to: 2, duration: 8,
    quantity: 320, unit: 'm3', crew: 6, note: 'Top floor slab' },

  // 外装系（フロートが大きい）
  { key: 'parapet', name: 'Parapet & Coping', from: 2, to: 3, duration: 6,
    quantity: 180, unit: 'm', crew: 4 },
  { key: 'curtain', name: 'Curtain Wall Installation (12-15F)', from: 2, to: 4, duration: 12,
    quantity: 96, unit: 'units', crew: 5 },
  { key: 'tile', name: 'Exterior Tile Work (8-11F)', from: 4, to: 6, duration: 14,
    quantity: 1400, unit: 'm2', crew: 8 },
  { key: 'sealant', name: 'Exterior Sealant Work', from: 6, to: 7, duration: 7,
    quantity: 620, unit: 'm', crew: 3 },
  { key: 'parapet-link', name: '', from: 3, to: 7, duration: 0, dummy: true },
  { key: 'sash', name: 'Aluminum Window Installation (12-15F)', from: 7, to: 14, duration: 9,
    quantity: 72, unit: 'units', crew: 4 },

  // 内装下地
  { key: 'stud', name: 'Steel Stud Partitions (6-9F)', from: 2, to: 5, duration: 10,
    quantity: 980, unit: 'm2', crew: 6 },
  { key: 'ceilframe', name: 'Ceiling Framing (6-9F)', from: 5, to: 8, duration: 8,
    quantity: 860, unit: 'm2', crew: 5 },

  // 設備（同じ結合点間に4本。HVACが最長なのでここが効く）
  { key: 'hvac', name: 'HVAC Ductwork (8-11F)', from: 8, to: 9, duration: 10,
    quantity: 240, unit: 'm', crew: 4 },
  { key: 'electrical', name: 'Electrical Conduit & Wiring (6-9F)', from: 8, to: 17, duration: 9,
    quantity: 1250, unit: 'm', crew: 5 },
  { key: 'electrical-link', name: '', from: 17, to: 9, duration: 0, dummy: true },
  { key: 'plumbing', name: 'Plumbing Rough-in (6-9F)', from: 8, to: 18, duration: 7,
    quantity: 180, unit: 'm', crew: 3 },
  { key: 'plumbing-link', name: '', from: 18, to: 9, duration: 0, dummy: true },
  { key: 'sprinkler', name: 'Sprinkler Piping (6-9F)', from: 8, to: 19, duration: 6,
    quantity: 310, unit: 'm', crew: 3 },
  { key: 'sprinkler-link', name: '', from: 19, to: 9, duration: 0, dummy: true },

  // 内装仕上げ（クリティカルパス）
  { key: 'drywall', name: 'Drywall Installation (4-7F)', from: 9, to: 10, duration: 12,
    quantity: 1620, unit: 'm2', crew: 7 },
  { key: 'ceilboard', name: 'Ceiling Board (4-7F)', from: 10, to: 11, duration: 8,
    quantity: 940, unit: 'm2', crew: 5 },
  { key: 'paint', name: 'Painting (4-7F)', from: 11, to: 12, duration: 10,
    quantity: 2100, unit: 'm2', crew: 6 },
  { key: 'door', name: 'Steel Door Installation (4-9F)', from: 12, to: 13, duration: 6,
    quantity: 84, unit: 'units', crew: 3 },
  { key: 'oafloor', name: 'Raised Access Floor (4-7F)', from: 12, to: 13, duration: 7,
    quantity: 1180, unit: 'm2', crew: 5 },
  { key: 'carpet', name: 'Carpet Tile (2-5F)', from: 13, to: 14, duration: 8,
    quantity: 1340, unit: 'm2', crew: 4 },

  // 外構
  { key: 'paving', name: 'Site Paving (Parking)', from: 14, to: 15, duration: 10,
    quantity: 860, unit: 'm2', crew: 5 },
  { key: 'planting', name: 'Landscape Planting', from: 15, to: 16, duration: 6,
    quantity: 42, unit: 'locations', crew: 3 },
]

export interface SampleScheduleData {
  nodes: EventNode[]
  activities: Activity[]
  projectSettings: Partial<ProjectSettings>
}

/** 開始日は「今日」に寄せる。get_activities_on_date が意味のある答えを返すようにするため */
function defaultStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0]
}

export function createSampleScheduleAdm(): SampleScheduleData {
  const nodes = NODE_SPECS.map((s) =>
    createEventNode({
      id: nodeId(s.n),
      number: s.n,
      position: { x: x(s.day), y: s.y },
      earliestTime: s.day,
      latestTime: s.day,
      slack: 0,
    })
  )

  const activities = ACTIVITY_SPECS.map((s) =>
    createActivity({
      id: `sample-act-${s.key}`,
      name: s.name,
      fromNodeId: nodeId(s.from),
      toNodeId: nodeId(s.to),
      duration: s.duration,
      durationMode: 'manual',
      isDummy: s.dummy ?? false,
      ...(s.quantity !== undefined ? { quantity: s.quantity } : {}),
      ...(s.unit ? { quantityUnit: s.unit } : {}),
      ...(s.crew !== undefined ? { laborCount: s.crew } : {}),
      ...(s.note ? { note: s.note } : {}),
      ...(s.dummy
        ? { displaySettings: { showName: false, showDuration: false, showCrew: false,
            lineColor: '#9ca3af', lineStyle: 'dashed' as const, lineWidth: 1 } }
        : {}),
    })
  )

  const start = defaultStartDate()
  const end = new Date(start)
  end.setDate(end.getDate() + 97)

  return {
    nodes,
    activities,
    projectSettings: {
      name: 'Sample — 18F Office Building (Fit-out Phase)',
      workplaceName: 'Downtown Office Tower',
      startDate: start,
      endDate: end.toISOString().split('T')[0],
      displayDays: 110,
      viewStartOffset: 0,
      totalProjectDays: 97,
      dayWidth: DAY_WIDTH,
      timeScale: 'day',
      weekStartDay: 1,
    },
  }
}
