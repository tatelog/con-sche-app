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

export const ALL_TOOLS: ModelContextTool[] = [
  getScheduleTool,
  getActivityTool,
  shiftActivityTool,
  updateActivityDurationTool,
  validateScheduleTool,
]
