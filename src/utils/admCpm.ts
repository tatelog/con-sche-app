/**
 * ADM (Arrow Diagram Method) 用の CPM 計算
 *
 * ADM形式では:
 * - 結合点（EventNode）に最早時刻(ET)・最遅時刻(LT)を計算
 * - 作業（Activity）にES/EF/LS/LF/フロートを計算
 */

import type { EventNode, Activity, ADMCPMResult } from '@/types/adm'

/**
 * ノードのトポロジカルソート（Kahnのアルゴリズム）
 * 全ノードを依存順に並べる
 */
function topologicalSortNodes(
  nodeIds: string[],
  activities: Activity[]
): string[] {
  const inDegree = new Map<string, number>()
  const adjacencyList = new Map<string, string[]>()

  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adjacencyList.set(id, [])
  }

  for (const activity of activities) {
    const current = inDegree.get(activity.toNodeId) ?? 0
    inDegree.set(activity.toNodeId, current + 1)

    const adj = adjacencyList.get(activity.fromNodeId) ?? []
    adj.push(activity.toNodeId)
    adjacencyList.set(activity.fromNodeId, adj)
  }

  const queue: string[] = []
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId)
    }
  }

  const result: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)

    const neighbors = adjacencyList.get(current) ?? []
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  return result
}

/**
 * ADM用のCPM計算
 */
export function calculateADMCPM(
  nodes: EventNode[],
  activities: Activity[]
): ADMCPMResult {
  if (nodes.length === 0) {
    return {
      nodes: [],
      activities: [],
      criticalPath: [],
      projectDuration: 0,
    }
  }

  // ノードのマップを作成
  const nodeMap = new Map<string, EventNode>()
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node })
  }

  // 作業のマップを作成
  const activityMap = new Map<string, Activity>()
  for (const activity of activities) {
    activityMap.set(activity.id, { ...activity })
  }

  // 隣接リストを構築
  const outgoing = new Map<string, Activity[]>()
  const incoming = new Map<string, Activity[]>()

  for (const node of nodes) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }

  for (const activity of activities) {
    const out = outgoing.get(activity.fromNodeId)
    if (out) out.push(activity)

    const inc = incoming.get(activity.toNodeId)
    if (inc) inc.push(activity)
  }

  // トポロジカルソート
  const nodeIds = nodes.map(n => n.id)
  const topoOrder = topologicalSortNodes(nodeIds, activities)

  if (topoOrder.length < nodeIds.length) {
    console.warn(`[CPM] トポロジカルソート不完全: ${topoOrder.length}/${nodeIds.length}ノード処理。循環の可能性あり`)
    const missing = nodeIds.filter(id => !topoOrder.includes(id))
    console.warn('[CPM] 未処理ノード:', missing)
  }

  // ======================================
  // 1. フォワードパス（最早時刻計算）
  // ======================================
  const etMap = new Map<string, number>()

  // 全ノードをET=0で初期化
  for (const nodeId of nodeIds) {
    etMap.set(nodeId, 0)
  }

  // トポロジカル順でET計算
  for (const nodeId of topoOrder) {
    const nodeET = etMap.get(nodeId) ?? 0

    const outActivities = outgoing.get(nodeId) ?? []
    for (const activity of outActivities) {
      const act = activityMap.get(activity.id)!
      act.es = nodeET
      act.ef = nodeET + activity.duration

      // 終了ノードのET = max(現在のET, この作業のEF)
      const currentET = etMap.get(activity.toNodeId) ?? 0
      etMap.set(activity.toNodeId, Math.max(currentET, act.ef))
    }
  }

  // プロジェクト工期 = 全ノードの最大ET
  // （終了ノードだけでなく全ノードを見る：孤立パスがあっても正しく計算）
  let projectDuration = 0
  for (const et of etMap.values()) {
    projectDuration = Math.max(projectDuration, et)
  }

  // デバッグ: ET=0のノードでincoming activityがあるものを検出
  for (const [nodeId, et] of etMap) {
    if (et === 0) {
      const inc = incoming.get(nodeId) ?? []
      if (inc.length > 0) {
        console.warn(`[CPM] ノード ${nodeId} はET=0だがincoming ${inc.length}件あり:`, inc.map(a => `${a.name}(${a.id})`))
      }
    }
  }

  // ======================================
  // 2. バックワードパス（最遅時刻計算）
  // ======================================
  const ltMap = new Map<string, number>()

  // 全ノードをLT=projectDurationで初期化
  for (const nodeId of nodeIds) {
    ltMap.set(nodeId, projectDuration)
  }

  // 逆トポロジカル順でLT計算
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const nodeId = topoOrder[i]
    const nodeLT = ltMap.get(nodeId) ?? projectDuration

    const incActivities = incoming.get(nodeId) ?? []
    for (const activity of incActivities) {
      const act = activityMap.get(activity.id)!
      act.lf = nodeLT
      act.ls = nodeLT - activity.duration

      // 開始ノードのLT = min(現在のLT, この作業のLS)
      const currentLT = ltMap.get(activity.fromNodeId) ?? projectDuration
      ltMap.set(activity.fromNodeId, Math.min(currentLT, act.ls))
    }
  }

  // ======================================
  // 3. フロート計算とクリティカルパス判定
  // ======================================
  const criticalPath: string[] = []

  for (const [actId, activity] of activityMap) {
    // トータルフロート = LS - ES = LF - EF
    activity.totalFloat = activity.ls - activity.es

    // フリーフロート = 後続ノードのET - この作業のEF
    const toNodeET = etMap.get(activity.toNodeId) ?? 0
    activity.freeFloat = toNodeET - activity.ef

    // クリティカルパス判定（TF = 0）
    activity.isCritical = activity.totalFloat === 0

    if (activity.isCritical) {
      criticalPath.push(actId)
    }
  }

  // ======================================
  // 4. 結果の構築
  // ======================================
  const resultNodes: EventNode[] = []
  for (const [nodeId, node] of nodeMap) {
    const et = etMap.get(nodeId) ?? 0
    const lt = ltMap.get(nodeId) ?? projectDuration
    resultNodes.push({
      ...node,
      earliestTime: et,
      latestTime: lt,
      slack: lt - et,
    })
  }

  const resultActivities: Activity[] = Array.from(activityMap.values())

  return {
    nodes: resultNodes,
    activities: resultActivities,
    criticalPath,
    projectDuration,
  }
}

/**
 * 循環検出
 */
export function detectCycle(
  nodes: EventNode[],
  activities: Activity[]
): boolean {
  const visited = new Set<string>()
  const recStack = new Set<string>()

  const adjacencyList = new Map<string, string[]>()
  for (const node of nodes) {
    adjacencyList.set(node.id, [])
  }
  for (const activity of activities) {
    const adj = adjacencyList.get(activity.fromNodeId)
    if (adj) {
      adj.push(activity.toNodeId)
    }
  }

  function dfs(nodeId: string): boolean {
    visited.add(nodeId)
    recStack.add(nodeId)

    const neighbors = adjacencyList.get(nodeId) ?? []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true
      } else if (recStack.has(neighbor)) {
        return true
      }
    }

    recStack.delete(nodeId)
    return false
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true
    }
  }

  return false
}
