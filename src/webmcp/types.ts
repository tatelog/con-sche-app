/**
 * WebMCP (modelContext) の型定義
 *
 * WebMCPはブラウザ内AIエージェントにページがツールを公開するための実験的標準。
 * 仕様上の入口は navigator.modelContext。document.modelContext は一部のポリフィルが使う形。
 * 2026-09-16、実験機能を有効にしたChromeで確認したところ、ブラウザが用意するのは
 * navigator 側だけだった（document 側は存在しない）ため、両方を見るようにしてある。
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
  /** W3C仕様の入口。実験機能を有効にしたChromeではこちらが生える */
  interface Navigator {
    modelContext?: ModelContext
  }
  /** 一部のポリフィルが生やす入口 */
  interface Document {
    modelContext?: ModelContext
  }
}
