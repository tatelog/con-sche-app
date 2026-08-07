/**
 * WebMCP (document.modelContext) の型定義
 *
 * WebMCPはブラウザ内AIエージェントにページがツールを公開するための実験的標準。
 * Chrome 146で実験実装、Cloudflare WebMCPブリッジ（tatelog.bizゾーンで有効化済み）が
 * document.modelContext を参照する。
 * 仕様: https://github.com/webmachinelearning/webmcp
 */

export interface MCPContent {
  type: 'text'
  text: string
}

export interface MCPToolResult {
  content: MCPContent[]
  isError?: boolean
}

export interface ModelContextTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, unknown>) => Promise<MCPToolResult>
}

export interface ModelContext {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => void | Promise<void>
}

declare global {
  interface Document {
    modelContext?: ModelContext
  }
}
