/**
 * IFC連携機能の型定義
 * IFCファイルから抽出するデータとcon-scheへのマッピング用
 */

// ======================================
// IFCから抽出するデータ型
// ======================================

/** IFC建物階層（IfcBuildingStorey） */
export interface IfcStorey {
  expressId: number
  globalId: string
  name: string
  elevation: number // 標高 (m)
  buildingId: number // 所属するIfcBuildingのexpressId
}

/** IFC室の数量情報 */
export interface IfcSpaceQuantities {
  // 床
  grossFloorArea?: number // 総床面積 (m²)
  netFloorArea?: number // 有効床面積 (m²)
  // 天井
  grossCeilingArea?: number // 総天井面積 (m²)
  // 壁
  grossWallArea?: number // 総壁面積 (m²)
  netWallArea?: number // 有効壁面積（開口部除く）(m²)
  // 体積・高さ
  grossVolume?: number // 総体積 (m³)
  netVolume?: number // 有効体積 (m³)
  height?: number // 高さ (m)
  finishFloorHeight?: number // 床仕上げ高さ (m)
  finishCeilingHeight?: number // 天井仕上げ高さ (m)
  // ジオメトリ計算メタデータ
  calculatedFromGeometry?: boolean // ジオメトリから計算されたか
  profileType?: 'arbitrary' | 'rectangle' | 'circle' | 'other' // プロファイルタイプ
}

/** IFC室の境界面情報 */
export interface IfcSpaceBoundary {
  type: 'floor' | 'ceiling' | 'wall' | 'door' | 'window' | 'other'
  relatedElementId?: number // 関連する建築要素のexpressId
  relatedElementName?: string // 関連する建築要素の名前
  area?: number // 面積 (m²)
  internalOrExternal?: 'internal' | 'external' | 'external_earth' | 'external_water' | 'external_fire'
}

/** IFC室（IfcSpace） */
export interface IfcSpace {
  expressId: number
  globalId: string
  name: string
  longName?: string
  storeyId: number // 所属するIfcBuildingStoreyのexpressId
  // 基本数量（後方互換）
  area?: number // 床面積 (m²)
  volume?: number // 体積 (m³)
  height?: number // 高さ (m)
  // 詳細数量
  quantities?: IfcSpaceQuantities
  // 境界面情報
  boundaries?: IfcSpaceBoundary[]
}

/** IFC数量セット（IfcElementQuantity） */
export interface IfcQuantitySet {
  expressId: number
  name: string
  elementId: number // 関連する要素のexpressId
  quantities: IfcQuantity[]
}

/** IFC数量値 */
export interface IfcQuantity {
  name: string
  type: 'length' | 'area' | 'volume' | 'count' | 'weight' | 'time'
  value: number
  unit?: string
}

/** IFC建物（IfcBuilding） */
export interface IfcBuilding {
  expressId: number
  globalId: string
  name: string
  siteId: number
}

/** IFCサイト（IfcSite） */
export interface IfcSite {
  expressId: number
  globalId: string
  name: string
  projectId: number
}

/** IFCプロジェクト（IfcProject） */
export interface IfcProject {
  expressId: number
  globalId: string
  name: string
  description?: string
}

// ======================================
// インポート結果
// ======================================

/** IFCファイルのインポート結果 */
export interface IfcImportResult {
  project: IfcProject | null
  sites: IfcSite[]
  buildings: IfcBuilding[]
  storeys: IfcStorey[]
  spaces: IfcSpace[]
  quantitySets: IfcQuantitySet[]
  stats: IfcImportStats
}

/** インポート統計 */
export interface IfcImportStats {
  fileName: string
  fileSize: number // bytes
  schema: string // IFC2x3, IFC4, IFC4x3
  projectCount: number
  siteCount: number
  buildingCount: number
  storeyCount: number
  spaceCount: number
  quantitySetCount: number
  parseTimeMs: number
}

// ======================================
// マッピング設定
// ======================================

/** マッピングアクション */
export type MappingAction = 'create' | 'update' | 'skip'

/** 階のマッピング設定 */
export interface FloorMapping {
  ifcStoreyId: number
  ifcStoreyName: string
  ifcElevation: number
  conScheFloorId: string | null // nullなら新規作成
  conScheFloorName: string
  action: MappingAction
}

/** 部屋のマッピング設定 */
export interface RoomMapping {
  ifcSpaceId: number
  ifcSpaceName: string
  ifcStoreyId: number
  ifcArea?: number
  ifcVolume?: number
  ifcHeight?: number
  // 詳細数量
  quantities?: IfcSpaceQuantities
  // 境界面情報
  boundaries?: IfcSpaceBoundary[]
  conScheRoomId: string | null // nullなら新規作成
  conScheRoomName: string
  action: MappingAction
}

/** IFCからcon-scheへのマッピング設定 */
export interface IfcToConScheMapping {
  sessionId: string
  floors: FloorMapping[]
  rooms: RoomMapping[]
  createdAt: string
  appliedAt?: string
}

// ======================================
// IFCセッション（DBに保存）
// ======================================

/** IFCインポートセッション */
export interface IfcSession {
  id: string
  projectId: string
  fileName: string
  fileSize: number
  schema: string
  importedAt: string
  stats: IfcImportStats
  mapping?: IfcToConScheMapping
}

// ======================================
// パーサー状態
// ======================================

/** パーサーの状態 */
export type ParserStatus = 'idle' | 'loading' | 'parsing' | 'success' | 'error'

/** パーサーエラー */
export interface ParserError {
  code: 'FILE_TOO_LARGE' | 'INVALID_IFC' | 'WASM_ERROR' | 'PARSE_ERROR' | 'UNKNOWN'
  message: string
  details?: string
}

// ======================================
// 定数
// ======================================

/** サポートするIFCスキーマ */
export const SUPPORTED_SCHEMAS = ['IFC2X3', 'IFC4', 'IFC4X3'] as const
export type SupportedSchema = (typeof SUPPORTED_SCHEMAS)[number]

/** 最大ファイルサイズ (300MB) */
export const MAX_FILE_SIZE = 300 * 1024 * 1024

/** IFCエンティティタイプ（web-ifc用） */
export const IFC_TYPES = {
  IFCPROJECT: 103090709,
  IFCSITE: 4097777520,
  IFCBUILDING: 4031249490,
  IFCBUILDINGSTOREY: 3124254112,
  IFCSPACE: 3856911033,
  IFCELEMENTQUANTITY: 1883228015,
  IFCQUANTITYLENGTH: 931644368,
  IFCQUANTITYAREA: 2044713172,
  IFCQUANTITYVOLUME: 3252649465,
  IFCQUANTITYCOUNT: 2093928680,
  IFCQUANTITYWEIGHT: 825690147,
  IFCQUANTITYTIME: 3252649466,
  IFCRELDEFINESBYPROPERTIES: 4186316022,
  IFCRELAGGREGATES: 160246688,
  IFCRELCONTAINEDINSPATIALSTRUCTURE: 3242617779,
  IFCRELSPACEBOUNDARY: 3451746338,
  IFCWALL: 2391406946,
  IFCWALLSTANDARDCASE: 3512223829,
  IFCSLAB: 1529196076,
  IFCCOVERING: 1973544240,
  IFCDOOR: 395920057,
  IFCWINDOW: 3304561284,
  IFCOPENINGELEMENT: 3588315303,
  // ジオメトリ関連
  IFCEXTRUDEDAREASOLID: 477187591,
  IFCARBITRARYCLOSEDPROFILEDEF: 3798115385,
  IFCRECTANGLEPROFILEDEF: 3615266464,
  IFCCIRCLEPROFILEDEF: 1520743889,
  IFCPOLYLINE: 3724593414,
  IFCGEOMETRICCURVESET: 987898635,
  IFCCARTESIANPOINT: 1123145078,
  IFCSHAPEREPRESENTATION: 4240577450,
  IFCPRODUCTDEFINITIONSHAPE: 2095639259,
} as const
