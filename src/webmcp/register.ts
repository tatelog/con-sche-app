/**
 * WebMCPツール登録
 *
 * document.modelContext（WebMCP対応ブラウザ or Cloudflare WebMCPブリッジ）が
 * 存在するときだけ工程表操作ツールを登録する。
 * 未対応環境では何もしない（通常ユーザーへの影響ゼロ）。
 */

import { ALL_TOOLS } from './tools'

export const CON_SCHE_TOOL_NAMES = ALL_TOOLS.map((t) => t.name) as readonly string[]

export function registerConScheTools(): void {
  if (typeof document === 'undefined') return
  const modelContext = document.modelContext
  if (!modelContext || typeof modelContext.registerTool !== 'function') return

  for (const tool of ALL_TOOLS) {
    try {
      void modelContext.registerTool(tool)
    } catch (e) {
      // 1つの登録失敗で他のツールやアプリ本体を巻き込まない
      console.warn(`[webmcp] ツール登録失敗: ${tool.name}`, e)
    }
  }
}
