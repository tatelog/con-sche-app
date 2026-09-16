/**
 * WebMCPツール登録
 *
 * modelContext（WebMCP対応ブラウザ or ポリフィル）が存在するときだけ
 * 工程表操作ツールを登録する。未対応環境では何もしない（通常ユーザーへの影響ゼロ）。
 *
 * 入口は2種類ある。W3C仕様は navigator.modelContext、一部のポリフィルは
 * document.modelContext を生やす。以前は document 側しか見ておらず、
 * 実験機能を有効にしたChromeでもツールが1つも登録されていなかった（2026-09-16 に実機で確認）。
 */

import { ALL_TOOLS } from './tools'
import { trackToolUse } from './telemetry'
import type { ModelContext, ModelContextTool } from './types'

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

/** 使えるほうの入口を選ぶ。navigator（標準）を優先し、無ければ document（ポリフィル）を見る */
export function resolveModelContext(
  fromNavigator: unknown,
  fromDocument: unknown,
): ModelContext | null {
  const usable = (c: unknown): c is ModelContext =>
    !!c && typeof (c as ModelContext).registerTool === 'function'
  if (usable(fromNavigator)) return fromNavigator
  if (usable(fromDocument)) return fromDocument
  return null
}

export function registerConScheTools(): void {
  if (typeof document === 'undefined') return
  const modelContext = resolveModelContext(
    typeof navigator !== 'undefined' ? navigator.modelContext : undefined,
    document.modelContext,
  )
  if (!modelContext) return

  for (const tool of ALL_TOOLS) {
    try {
      void modelContext.registerTool(withTelemetry(tool))
    } catch (e) {
      // 1つの登録失敗で他のツールやアプリ本体を巻き込まない
      console.warn(`[webmcp] ツール登録失敗: ${tool.name}`, e)
    }
  }
}
