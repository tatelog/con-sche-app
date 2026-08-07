/**
 * WebMCP ページ内ツール — ブラウザ内AIエージェントに公開する工程表操作
 *
 * データは admStore（localStorage）のみを読み書きし、サーバーには一切送らない。
 * ローカルファースト思想を維持したままエージェント連携する層。
 *
 * ツール:
 *   get_schedule             開いている工程表の要約
 *   get_activity             作業の詳細（フロート・シフト可能範囲・影響チェーン）
 *   shift_activity           作業の日程シフト（undo可能）
 *   update_activity_duration 所要日数の変更（CPM再計算、undo可能）
 *   validate_schedule        整合チェック（循環依存・孤立ノード）
 */

import { useADMStore } from '@/stores/admStore'
import { detectCycle } from '@/utils/admCpm'
import { xToDate } from '@/utils/dateUtils'
import type { Activity } from '@/types/adm'
import type { MCPToolResult, ModelContextTool } from './types'

// ======================================
// 結果ヘルパー
// ======================================

function ok(data: unknown): MCPToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}

function err(message: string): MCPToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

/** 作業の行位置（工区・階・細目）。行ヘッダー階層が無い工程表では null */
function activityLocation(a: Activity): { building?: string; zone: string; floor: string; detail: string } | null {
  if (a.rowIndex === undefined) return null
  const row = useADMStore.getState().getHierarchyRows()[a.rowIndex]
  if (!row) return null
  return {
    ...(row.buildingName ? { building: row.buildingName } : {}),
    zone: row.zoneName,
    floor: row.roomName,
    detail: row.detailName,
  }
}

/** エージェントに返す作業サマリー */
function activitySummary(a: Activity) {
  return {
    id: a.id,
    name: a.name,
    duration: a.duration,
    es: a.es,
    ef: a.ef,
    ls: a.ls,
    lf: a.lf,
    totalFloat: a.totalFloat,
    freeFloat: a.freeFloat,
    isCritical: a.isCritical,
    isDummy: a.isDummy,
    startDate: a.startDate,
    endDate: a.endDate,
    location: activityLocation(a),
  }
}

// ======================================
// get_schedule
// ======================================

export const getScheduleTool: ModelContextTool = {
  name: 'get_schedule',
  description:
    'Get a summary of the construction schedule currently open in Con-Sche: project name, period, duration, and all activities with CPM results (ES/EF/LS/LF, float, critical path). ' +
    '今Con-Scheで開いている工程表の要約（プロジェクト名・工期・全作業のCPM計算結果）を返す。',
  inputSchema: { type: 'object', properties: {} },
  async execute() {
    const state = useADMStore.getState()
    const settings = state.projectSettings
    const activities = state.getActivitiesArray().filter((a) => !a.isDummy)
    return ok({
      projectName: settings.name,
      workplaceName: settings.workplaceName,
      startDate: settings.startDate,
      endDate: settings.endDate,
      projectDuration: state.projectDuration,
      nodeCount: state.nodes.size,
      criticalPath: state.criticalPath,
      activities: activities.map(activitySummary),
    })
  },
}

// ======================================
// get_activity
// ======================================

export const getActivityTool: ModelContextTool = {
  name: 'get_activity',
  description:
    'Get details of one activity in the open schedule: duration, CPM values, float, how many days it can shift (left/right), and which activities are affected if it moves. ' +
    '作業1件の詳細（日数・フロート・左右にずらせる日数・ずらした場合に影響する作業）を返す。',
  inputSchema: {
    type: 'object',
    properties: {
      activityId: { type: 'string', description: 'Activity ID (get it from get_schedule)' },
    },
    required: ['activityId'],
  },
  async execute(args) {
    const activityId = String(args.activityId ?? '')
    const state = useADMStore.getState()
    const activity = state.getActivity(activityId)
    if (!activity) {
      return err(`作業が見つかりません: ${activityId}。get_schedule で作業一覧を確認してください。`)
    }
    const shiftRange = state.getShiftRange(activityId)
    const affectedChain = state.getAffectedChain(activityId)
    return ok({
      ...activitySummary(activity),
      shiftRange: {
        maxLeft: shiftRange.maxLeft,
        maxRight: shiftRange.maxRight,
        isCritical: shiftRange.isCritical,
      },
      affectedActivityIds: affectedChain.filter((id) => id !== activityId),
    })
  },
}

// ======================================
// shift_activity
// ======================================

export const shiftActivityTool: ModelContextTool = {
  name: 'shift_activity',
  description:
    'Shift an activity by N days (positive = later, negative = earlier) within its allowed range. Critical activities push their successors. The user can undo this. ' +
    '作業をN日ずらす（正=後ろへ、負=前へ）。可能範囲は get_activity の shiftRange。ユーザーはundoで戻せる。',
  inputSchema: {
    type: 'object',
    properties: {
      activityId: { type: 'string', description: 'Activity ID' },
      shiftDays: { type: 'number', description: 'Days to shift (positive = later, negative = earlier)' },
      moveChain: {
        type: 'boolean',
        description: 'Also move the connected chain of activities (default false)',
      },
    },
    required: ['activityId', 'shiftDays'],
  },
  async execute(args) {
    const activityId = String(args.activityId ?? '')
    const shiftDays = Number(args.shiftDays)
    const moveChain = Boolean(args.moveChain)

    if (!Number.isFinite(shiftDays) || shiftDays === 0) {
      return err('shiftDays には0以外の日数を指定してください。')
    }
    const state = useADMStore.getState()
    const activity = state.getActivity(activityId)
    if (!activity) {
      return err(`作業が見つかりません: ${activityId}。get_schedule で作業一覧を確認してください。`)
    }

    const range = state.getShiftRange(activityId)
    if (shiftDays > 0 && shiftDays > range.maxRight) {
      return err(
        `シフト量が可能範囲を超えています。右方向は最大 ${range.maxRight} 日までです（指定: ${shiftDays} 日）。`
      )
    }
    if (shiftDays < 0 && -shiftDays > range.maxLeft) {
      return err(
        `シフト量が可能範囲を超えています。左方向は最大 ${range.maxLeft} 日までです（指定: ${shiftDays} 日）。`
      )
    }

    state.shiftActivityWithFloat(activityId, shiftDays, moveChain)

    const after = useADMStore.getState()
    const shifted = after.getActivity(activityId)!
    return ok({
      shifted: activitySummary(shifted),
      projectDuration: after.projectDuration,
      message: `${shifted.name} を ${shiftDays > 0 ? '+' : ''}${shiftDays} 日シフトしました。`,
    })
  },
}

// ======================================
// update_activity_duration
// ======================================

export const updateActivityDurationTool: ModelContextTool = {
  name: 'update_activity_duration',
  description:
    'Change the duration (working days) of an activity. CPM is recalculated and the new project duration is returned. The user can undo this. ' +
    '作業の所要日数を変更する。CPMが再計算され新しい工期を返す。ユーザーはundoで戻せる。',
  inputSchema: {
    type: 'object',
    properties: {
      activityId: { type: 'string', description: 'Activity ID' },
      duration: { type: 'number', description: 'New duration in days (>= 1)' },
    },
    required: ['activityId', 'duration'],
  },
  async execute(args) {
    const activityId = String(args.activityId ?? '')
    const duration = Number(args.duration)

    if (!Number.isInteger(duration) || duration < 1) {
      return err('duration には1以上の整数（日数）を指定してください。')
    }
    const state = useADMStore.getState()
    const activity = state.getActivity(activityId)
    if (!activity) {
      return err(`作業が見つかりません: ${activityId}。get_schedule で作業一覧を確認してください。`)
    }

    state.saveHistory()
    state.updateActivity(activityId, { duration, durationMode: 'manual' })

    const after = useADMStore.getState()
    const updated = after.getActivity(activityId)!
    return ok({
      updated: activitySummary(updated),
      projectDuration: after.projectDuration,
      message: `${updated.name} の日数を ${activity.duration} 日 → ${duration} 日に変更しました。`,
    })
  },
}

// ======================================
// validate_schedule
// ======================================

interface ValidationIssue {
  type: 'cycle' | 'isolated_node'
  message: string
  nodeIds?: string[]
}

export const validateScheduleTool: ModelContextTool = {
  name: 'validate_schedule',
  description:
    'Validate the open schedule: detect circular dependencies and event nodes not connected to any activity. Returns ok=true when consistent. ' +
    '開いている工程表の整合チェック（循環依存・どの作業とも繋がっていない結合点の検出）。',
  inputSchema: { type: 'object', properties: {} },
  async execute() {
    const state = useADMStore.getState()
    const nodes = state.getNodesArray()
    const activities = state.getActivitiesArray()
    const issues: ValidationIssue[] = []

    if (detectCycle(nodes, activities)) {
      issues.push({
        type: 'cycle',
        message: '循環依存があります。作業の接続がループしているため工程が成立しません。',
      })
    }

    const connectedNodeIds = new Set<string>()
    for (const a of activities) {
      connectedNodeIds.add(a.fromNodeId)
      connectedNodeIds.add(a.toNodeId)
    }
    const isolated = nodes.filter((n) => !connectedNodeIds.has(n.id))
    if (isolated.length > 0) {
      issues.push({
        type: 'isolated_node',
        message: `どの作業とも繋がっていない結合点が ${isolated.length} 個あります。`,
        nodeIds: isolated.map((n) => n.id),
      })
    }

    return ok({
      ok: issues.length === 0,
      issues,
      nodeCount: nodes.length,
      activityCount: activities.length,
    })
  },
}

// ======================================
// 日付ユーティリティ（座標→カレンダー日付）
// ======================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** 作業のカレンダー日付をノード座標から計算する。開始=fromNodeの日、終了=toNodeの前日 */
function activityDates(a: Activity): { startDate: string; endDate: string } | null {
  const state = useADMStore.getState()
  const fromNode = state.getNode(a.fromNodeId)
  const toNode = state.getNode(a.toNodeId)
  if (!fromNode || !toNode) return null
  const projectStart = new Date(state.projectSettings.startDate)
  const dayWidth = state.projectSettings.dayWidth || 30
  const start = xToDate(fromNode.position.x, projectStart, dayWidth)
  const end = xToDate(toNode.position.x, projectStart, dayWidth)
  end.setDate(end.getDate() - 1) // toNodeの日は次作業の開始日
  if (end.getTime() < start.getTime()) end.setTime(start.getTime())
  return { startDate: toISODate(start), endDate: toISODate(end) }
}

/** ローカルタイムの今日をYYYY-MM-DDで返す */
function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ======================================
// get_activities_on_date
// ======================================

export const getActivitiesOnDateTool: ModelContextTool = {
  name: 'get_activities_on_date',
  description:
    'List the activities in progress on a given date (default: today). Use this to answer "what work happens today?". ' +
    '指定日（省略時は今日）に実施中の作業一覧を返す。「今日は何の作業?」に使う。',
  inputSchema: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Date in YYYY-MM-DD (default: today)' },
    },
  },
  async execute(args) {
    const date = args.date === undefined || args.date === null ? todayISO() : String(args.date)
    if (!DATE_RE.test(date)) {
      return err(`日付は YYYY-MM-DD 形式で指定してください（指定: ${date}）。`)
    }
    const state = useADMStore.getState()
    const activities = state
      .getActivitiesArray()
      .filter((a) => !a.isDummy)
      .map((a) => ({ activity: a, dates: activityDates(a) }))
      .filter(({ dates }) => dates !== null && dates.startDate <= date && date <= dates.endDate)
      .map(({ activity, dates }) => ({ ...activitySummary(activity), ...dates }))

    return ok({
      date,
      projectName: state.projectSettings.name,
      activities,
    })
  },
}

// ======================================
// find_activities
// ======================================

export const findActivitiesTool: ModelContextTool = {
  name: 'find_activities',
  description:
    'Search activities by name and/or location (zone, floor, e.g. "3F A工区 コンクリート打設"). Multiple words are AND-matched. Returns dates plus days until start. Use this to answer "when is the concrete pour on 3F?". ' +
    '作業名や工区・階で検索する（複数語はAND）。開始日・終了日と「あと何日で開始か」を返す。「3階A工区の打設いつ?」に使う。',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Words to match against activity name and location (zone/floor/detail). Space-separated words are AND-matched.',
      },
      fromDate: {
        type: 'string',
        description: 'Base date (YYYY-MM-DD) for daysUntilStart (default: today)',
      },
    },
    required: ['query'],
  },
  async execute(args) {
    const query = String(args.query ?? '').trim()
    if (!query) {
      return err('query に検索する作業名や工区・階（部分一致）を指定してください。')
    }
    const fromDate =
      args.fromDate === undefined || args.fromDate === null ? todayISO() : String(args.fromDate)
    if (!DATE_RE.test(fromDate)) {
      return err(`fromDate は YYYY-MM-DD 形式で指定してください（指定: ${fromDate}）。`)
    }
    const tokens = query.split(/[\s　]+/).filter(Boolean)
    const state = useADMStore.getState()
    const base = new Date(fromDate)
    const matches = state
      .getActivitiesArray()
      .filter((a) => !a.isDummy)
      .filter((a) => {
        const loc = activityLocation(a)
        const haystack = [a.name, loc?.building, loc?.zone, loc?.floor, loc?.detail]
          .filter(Boolean)
          .join(' ')
        return tokens.every((t) => haystack.includes(t))
      })
      .map((a) => {
        const dates = activityDates(a)
        const daysUntilStart = dates
          ? Math.round((new Date(dates.startDate).getTime() - base.getTime()) / 86_400_000)
          : null
        return { ...activitySummary(a), ...(dates ?? {}), daysUntilStart }
      })

    return ok({ query, fromDate, matches })
  },
}

export const ALL_TOOLS: ModelContextTool[] = [
  getScheduleTool,
  getActivityTool,
  shiftActivityTool,
  updateActivityDurationTool,
  validateScheduleTool,
  getActivitiesOnDateTool,
  findActivitiesTool,
]
