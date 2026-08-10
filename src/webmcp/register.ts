/**
 * WebMCPツール登録
 *
 * document.modelContext（WebMCP対応ブラウザ or Cloudflare WebMCPブリッジ）が
 * 存在するときだけ工程表操作ツールを登録する。
 * 未対応環境では何もしない（通常ユーザーへの影響ゼロ）。
 */

import { ALL_TOOLS } from './tools'
import { trackToolUse } from './telemetry'
import type { ModelContextTool } from './types'

export const CON_SCHE_TOOL_NAMES = ALL_TOOLS.map((t) => t.name) as readonly string[]

/** execute を利用テレメトリ付きにラップする */
function withTelemetry(tool: ModelContextTool): ModelContextTool {
  return {
    ...tool,
    execute: (args) => {
      trackToolUse(tool.name)
      return tool.execute(args)
    },
  }
}

export function registerConScheTools(): void {
  if (typeof document === 'undefined') return
  const modelContext = document.modelContext
  if (!modelContext || typeof modelContext.registerTool !== 'function') return

  for (const tool of ALL_TOOLS) {
    try {
      void modelContext.registerTool(withTelemetry(tool))
    } catch (e) {
      // 1つの登録失敗で他のツールやアプリ本体を巻き込まない
      console.warn(`[webmcp] ツール登録失敗: ${tool.name}`, e)
    }
  }
}
