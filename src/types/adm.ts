/**
 * ADM (Arrow Diagram Method) 形式の型定義
 *
 * ADM形式では:
 * - 結合点（EventNode）: ○で表示、プロジェクトの節目を表す
 * - 作業（Activity）: 矢印で表示、実際の作業を表す
 *
 * 日本の建設現場向けの階層構造:
 * - 工区（Zone）: 建物の大きな区分
 * - 部屋/エリア（Room）: 工区内の部屋やエリア
 * - 細目（Detail）: 具体的な作業種別
 */

// ======================================
// 基本型
// ======================================

export interface Position {
  x: number
  y: number
}

// ======================================
// 行ヘッダー設定（1〜5列で設定可能）
// ======================================

// ヘッダー列の種類
export type HeaderColumnType = 'building' | 'zone' | 'floor' | 'grid' | 'detail' | 'custom'

// ヘッダー列の定義
export interface HeaderColumn {
  id: string
  type: HeaderColumnType
  label: string // 表示ラベル（工区、階数、通り、部屋名）
  width: number // 列幅（ピクセル）
  order: number // 表示順
  visible: boolean
}

// ヘッダー列のデフォルト設定
export const DEFAULT_HEADER_COLUMNS: HeaderColumn[] = [
  { id: 'col-building', type: 'building', label: '棟', width: 50, order: 0, visible: false },
  { id: 'col-zone', type: 'zone', label: '工区', width: 60, order: 1, visible: true },
  { id: 'col-floor', type: 'floor', label: '階数', width: 50, order: 2, visible: true },
  { id: 'col-grid', type: 'grid', label: '通り', width: 50, order: 3, visible: false },
  { id: 'col-detail', type: 'detail', label: '部屋名', width: 60, order: 4, visible: true },
]

// 行データアイテム（各階層レベルのデータ）
export interface RowDataItem {
  id: string
  parentId: string | null // 親のID（最上位レベルはnull）
  columnType: HeaderColumnType // どの列に属するか
  name: string
  order: number
  color?: string
}

// 行の表示データ（展開後）
export interface RowDisplayData {
  rowId: string // この行のユニークID
  columnValues: Map<HeaderColumnType, string> // 各列の値
  columnIds: Map<HeaderColumnType, string> // 各列のデータID
  y: number // Y座標
  rowIndex: number // 行インデックス
}

// マスタデータ（テンプレート用）
export interface MasterItem {
  id: string
  name: string
  order: number
}

// 棟（Building）
export interface Building {
  id: string
  name: string
  order: number
  color?: string
}

// 旧型定義（互換性のため残す）
export interface Zone {
  id: string
  buildingId?: string
  name: string
  order: number
  color?: string
}

export interface Room {
  id: string
  zoneId: string
  name: string
  order: number
}

export interface DetailCategory {
  id: string
  roomId: string
  name: string
  order: number
}

// 階層の行を表す（表示用）- 旧形式
export interface HierarchyRow {
  buildingId?: string
  buildingName?: string
  zoneId: string
  zoneName: string
  roomId: string
  roomName: string
  detailId: string
  detailName: string
  y: number
}

// ======================================
// 結合点（Event Node）
// ======================================

export interface EventNode {
  id: string
  number: number // 結合点番号（①②③...）

  // 位置（キャンバス上）
  position: Position

  // CPM計算結果
  earliestTime: number // 最早結合点時刻（ET）
  latestTime: number // 最遅結合点時刻（LT）
  slack: number // スラック（LT - ET）

  // 表示設定
  label?: string // ラベル（オプション）

  // カレンダー日付（エクスポート時に自動計算）
  date?: string // この結合点のカレンダー日付（X座標から自動計算、ISO形式）
}

export function createEventNode(
  partial: Partial<EventNode> & { id: string; number: number }
): EventNode {
  return {
    position: { x: 100, y: 100 },
    earliestTime: 0,
    latestTime: 0,
    slack: 0,
    ...partial,
  }
}

// ======================================
// 作業（Activity）
// ======================================

export interface ActivityDisplaySettings {
  showName: boolean // 作業名表示
  showDuration: boolean // 日数表示
  showCrew: boolean // 担当班表示
  lineColor: string // 線色
  lineStyle: 'solid' | 'dashed' | 'dotted' // 線種
  lineWidth: number // 線幅
  textAlign?: 'left' | 'center' | 'right' // テキスト配置（undefined = プロジェクトデフォルト使用）
  leaderLineStyle?: 'line' | 'underline' // 引き出し線スタイル（undefined = プロジェクトデフォルト使用）
  edgeCornerRadius?: number // エッジ曲がり角R（px、undefined = プロジェクトデフォルト使用）
  displayType?: 'arrow' | 'banner' // 表示タイプ（デフォルト: 'arrow'）
}

export interface Activity {
  id: string
  name: string // 作業名（例: "型枠工事"）

  // 結合点間の接続
  fromNodeId: string // 開始結合点ID
  toNodeId: string // 終了結合点ID

  // 階層（どの細目に属するか）
  detailCategoryId?: string // 細目ID（オプション）
  rowIndex?: number // 表示行インデックス

  // 工数計算用
  quantity?: number // 作業数量（体積m³、面積m²など）
  quantityUnit?: string // 数量単位（m³、m²、個など）
  laborCount?: number // 人工（人数）
  productivity?: number // 歩掛（1人1日あたりの出来高）

  // 日数
  duration: number // 所要日数（計算結果または手入力）
  durationMode: 'manual' | 'calculated' // 工数入力モード

  // CPM計算結果
  es: number // 最早開始日 (Earliest Start)
  ef: number // 最早終了日 (Earliest Finish)
  ls: number // 最遅開始日 (Latest Start)
  lf: number // 最遅終了日 (Latest Finish)
  totalFloat: number // トータルフロート
  freeFloat: number // フリーフロート
  isCritical: boolean // クリティカルパス上か

  // 表示設定（カスタマイズ可能）
  displaySettings: ActivityDisplaySettings

  // 追加情報（オプション）
  crewId?: string // 担当班
  note?: string // メモ

  // カレンダー日付（エクスポート時に自動計算）
  startDate?: string // 開始日（fromNodeの日付、自動計算）
  endDate?: string   // 終了日（toNodeの日付、自動計算）

  // ダミー作業フラグ
  isDummy: boolean // ダミー作業（点線、日数0）

  // 経由点（矢印の曲げ）
  waypoints?: Position[]

  // 経路モード（矢印のルーティング方向）
  routingMode?: 'auto' | 'horizontal' | 'vertical' | 'direct'

  // 折れ点の数（0=直線, 1=1回曲がり, 2=2回曲がり）
  bendCount?: 0 | 1 | 2

  // 引き出し線用テキストオフセット
  labelOffset?: { x: number; y: number }
}

export function createActivity(
  partial: Partial<Activity> & {
    id: string
    name: string
    fromNodeId: string
    toNodeId: string
  }
): Activity {
  return {
    duration: 1,
    durationMode: 'manual',
    es: 0,
    ef: 0,
    ls: 0,
    lf: 0,
    totalFloat: 0,
    freeFloat: 0,
    isCritical: false,
    displaySettings: {
      showName: true,
      showDuration: true,
      showCrew: false,
      lineColor: '#374151', // gray-700
      lineStyle: 'solid',
      lineWidth: 2,
    },
    isDummy: false,
    ...partial,
  }
}

// 工数計算ヘルパー関数
export function calculateDuration(quantity: number, laborCount: number, productivity: number): number {
  if (laborCount <= 0 || productivity <= 0) return 1
  return Math.ceil(quantity / (laborCount * productivity))
}

// ======================================
// プロジェクト設定
// ======================================

// 表示モード
export type DisplayMode = 'weekly2' | 'weekly3' | 'monthly' | 'master' | 'custom'

// 用紙サイズ（print.tsから再エクスポートしつつcustomを追加）
import type { PaperOrientation as PrintPaperOrientation } from './print'
export type LayoutPaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'custom'
export type { PrintPaperOrientation as LayoutPaperOrientation }

// 用紙サイズごとのデフォルト行数（ヘッダー・マージン考慮）
export const PAPER_ROW_DEFAULTS: Record<LayoutPaperSize, Record<PrintPaperOrientation, number>> = {
  A4: { portrait: 20, landscape: 12 },
  A3: { portrait: 32, landscape: 20 },
  A2: { portrait: 48, landscape: 32 },
  A1: { portrait: 68, landscape: 48 },
  custom: { portrait: 20, landscape: 20 },
}

export interface ProjectSettings {
  id: string
  name: string
  workplaceName: string // 作業所名
  startDate: string // 開始日 (ISO 8601 YYYY-MM-DD)
  endDate: string // 終了日 (ISO 8601 YYYY-MM-DD)

  // カレンダー設定
  displayDays: number // 表示する日数
  displayMode: DisplayMode // 表示モード
  viewStartOffset: number // 表示開始位置（開始日からの日数オフセット、負数も可）
  totalProjectDays: number // マスター工程の全体日数（startDateとendDateから自動計算）
  weekStartDay: 0 | 1 // 週の開始曜日（0=日曜, 1=月曜）週次表示で使用

  // 表示設定
  timeScale: 'day' | 'week' | 'month'
  gridSize: number // グリッドサイズ（ピクセル）
  dayWidth: number // 1日あたりの幅（ピクセル）
  rowHeight: number // 行の高さ（ピクセル）

  // レイアウト設定
  paperSize: LayoutPaperSize // 用紙サイズ
  paperOrientation: PrintPaperOrientation // 用紙方向
  displayRows: number // 表示行数

  // エッジ（作業矢印）設定
  edgeCornerRadius: number // 曲がり角のR（0で直角）

  // パネル幅設定
  headerPanelWidth: number // 左側ヘッダーパネルの総幅
  propertiesPanelWidth: number // 右側プロパティパネルの幅

  // ヘッダー列設定
  headerColumns: HeaderColumn[]

  // デフォルト作業表示設定
  defaultActivityDisplay: ActivityDisplaySettings

  // 棟セレクター表示
  showBuildingSelector?: boolean
}

export function createProjectSettings(
  partial: Partial<ProjectSettings> & { id: string; name: string }
): ProjectSettings {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 90)
  return {
    workplaceName: '',
    startDate: today.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    displayDays: 21, // デフォルト3週間表示
    displayMode: 'weekly3', // デフォルトは週間工程（3週間）
    viewStartOffset: 0, // 表示開始位置
    totalProjectDays: 90, // デフォルト全体90日
    weekStartDay: 1, // デフォルトは月曜始まり
    timeScale: 'day',
    gridSize: 50,
    dayWidth: 30,
    rowHeight: 40,
    paperSize: 'A4',
    paperOrientation: 'portrait',
    displayRows: 20, // A4縦のデフォルト行数
    edgeCornerRadius: 5, // デフォルト5pxの曲がりR
    headerPanelWidth: 170,
    propertiesPanelWidth: 288,
    headerColumns: [...DEFAULT_HEADER_COLUMNS],
    defaultActivityDisplay: {
      showName: true,
      showDuration: true,
      showCrew: false,
      lineColor: '#374151',
      lineStyle: 'solid',
      lineWidth: 2,
      textAlign: 'center',
      leaderLineStyle: 'line',
      edgeCornerRadius: 5,
    },
    ...partial,
  }
}

// ======================================
// CPM計算結果
// ======================================

// ======================================
// 進捗線（雷線）
// ======================================

export interface ProgressLine {
  id: string                    // 一意ID
  baseDate: string | null       // 基準日 (ISO YYYY-MM-DD)
  baseDateX: number             // 基準日のX座標（ピクセル）
  rowOffsets: Record<string, number>  // detailId → 基準日からのオフセット日数（正=先行, 負=遅延）
  visible: boolean
}

export function createProgressLine(id?: string): ProgressLine {
  return {
    id: id ?? crypto.randomUUID(),
    baseDate: null,
    baseDateX: 0,
    rowOffsets: {},
    visible: true,
  }
}

// ======================================
// CPM計算結果
// ======================================

export interface ADMCPMResult {
  nodes: EventNode[] // ET/LT計算済み
  activities: Activity[] // ES/EF/LS/LF/フロート計算済み
  criticalPath: string[] // クリティカルパス上の作業ID
  projectDuration: number // 工期
}
