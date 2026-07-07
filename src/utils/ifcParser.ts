/**
 * IFCファイルパーサー
 * web-ifcを使用してIFCファイルから建物階層・室情報・数量情報を抽出
 */

import * as WebIFC from 'web-ifc'
import type {
  IfcImportResult,
  IfcProject,
  IfcSite,
  IfcBuilding,
  IfcStorey,
  IfcSpace,
  IfcSpaceQuantities,
  IfcSpaceBoundary,
  IfcQuantitySet,
  IfcQuantity,
  IfcImportStats,
  ParserError,
} from '@/types/ifc'
import { IFC_TYPES, MAX_FILE_SIZE, SUPPORTED_SCHEMAS } from '@/types/ifc'

// シングルトンのIfcAPIインスタンス
let ifcApi: WebIFC.IfcAPI | null = null
let isInitialized = false

/**
 * web-ifc WASMを初期化
 */
export async function initializeIfcParser(): Promise<void> {
  if (isInitialized && ifcApi) return

  ifcApi = new WebIFC.IfcAPI()

  // WASMファイルのパスを設定
  ifcApi.SetWasmPath('/wasm/')

  await ifcApi.Init()
  isInitialized = true
}

/**
 * IFCファイルをパースしてデータを抽出
 */
export async function parseIfcFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<IfcImportResult> {
  const startTime = performance.now()

  // ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    throw createParserError('FILE_TOO_LARGE', `ファイルサイズが上限（300MB）を超えています: ${formatFileSize(file.size)}`)
  }

  // 初期化
  onProgress?.(5)
  await initializeIfcParser()

  if (!ifcApi) {
    throw createParserError('WASM_ERROR', 'IFCパーサーの初期化に失敗しました')
  }

  // ファイル読み込み
  onProgress?.(10)
  const arrayBuffer = await file.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)

  // IFCファイルを開く
  onProgress?.(20)
  let modelID: number
  try {
    modelID = ifcApi.OpenModel(data)
  } catch (e) {
    throw createParserError('INVALID_IFC', 'IFCファイルの読み込みに失敗しました', String(e))
  }

  try {
    // スキーマ確認
    const schema = getIfcSchema(ifcApi, modelID)
    if (!SUPPORTED_SCHEMAS.includes(schema as typeof SUPPORTED_SCHEMAS[number])) {
      console.warn(`未対応のIFCスキーマ: ${schema}`)
    }

    // 各エンティティを抽出
    onProgress?.(30)
    const project = extractProject(ifcApi, modelID)

    onProgress?.(40)
    const sites = extractSites(ifcApi, modelID)

    onProgress?.(50)
    const buildings = extractBuildings(ifcApi, modelID)

    onProgress?.(60)
    const storeys = extractStoreys(ifcApi, modelID)

    onProgress?.(70)
    const spaces = extractSpaces(ifcApi, modelID)

    // IfcSpaceとIfcBuildingStoreyの関連付けを設定
    onProgress?.(80)
    assignSpacesToStoreys(ifcApi, modelID, spaces, storeys)

    onProgress?.(85)
    const quantitySets = extractQuantitySets(ifcApi, modelID)

    onProgress?.(95)

    const parseTimeMs = performance.now() - startTime

    const stats: IfcImportStats = {
      fileName: file.name,
      fileSize: file.size,
      schema,
      projectCount: project ? 1 : 0,
      siteCount: sites.length,
      buildingCount: buildings.length,
      storeyCount: storeys.length,
      spaceCount: spaces.length,
      quantitySetCount: quantitySets.length,
      parseTimeMs,
    }

    onProgress?.(100)

    return {
      project,
      sites,
      buildings,
      storeys,
      spaces,
      quantitySets,
      stats,
    }
  } finally {
    // モデルを閉じてメモリ解放
    ifcApi.CloseModel(modelID)
  }
}

/**
 * IFCスキーマバージョンを取得
 */
function getIfcSchema(_api: WebIFC.IfcAPI, _modelID: number): string {
  // web-ifcではスキーマ情報を直接取得する方法が限られているため、
  // ファイルヘッダーから推測するか、デフォルトを返す
  return 'IFC4'
}

/**
 * IfcProjectを抽出
 */
function extractProject(api: WebIFC.IfcAPI, modelID: number): IfcProject | null {
  try {
    const projectIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCPROJECT)
    if (projectIds.size() === 0) return null

    const projectId = projectIds.get(0)
    const project = api.GetLine(modelID, projectId)

    return {
      expressId: projectId,
      globalId: project.GlobalId?.value || '',
      name: project.Name?.value || 'Unnamed Project',
      description: project.Description?.value,
    }
  } catch (e) {
    console.warn('IfcProject抽出エラー:', e)
    return null
  }
}

/**
 * IfcSiteを抽出
 */
function extractSites(api: WebIFC.IfcAPI, modelID: number): IfcSite[] {
  const sites: IfcSite[] = []
  try {
    const siteIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCSITE)
    for (let i = 0; i < siteIds.size(); i++) {
      const siteId = siteIds.get(i)
      const site = api.GetLine(modelID, siteId)

      sites.push({
        expressId: siteId,
        globalId: site.GlobalId?.value || '',
        name: site.Name?.value || 'Unnamed Site',
        projectId: 0, // 後で関係性から設定
      })
    }
  } catch (e) {
    console.warn('IfcSite抽出エラー:', e)
  }
  return sites
}

/**
 * IfcBuildingを抽出
 */
function extractBuildings(api: WebIFC.IfcAPI, modelID: number): IfcBuilding[] {
  const buildings: IfcBuilding[] = []
  try {
    const buildingIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCBUILDING)
    for (let i = 0; i < buildingIds.size(); i++) {
      const buildingId = buildingIds.get(i)
      const building = api.GetLine(modelID, buildingId)

      buildings.push({
        expressId: buildingId,
        globalId: building.GlobalId?.value || '',
        name: building.Name?.value || 'Unnamed Building',
        siteId: 0, // 後で関係性から設定
      })
    }
  } catch (e) {
    console.warn('IfcBuilding抽出エラー:', e)
  }
  return buildings
}

/**
 * IfcBuildingStoreyを抽出
 */
function extractStoreys(api: WebIFC.IfcAPI, modelID: number): IfcStorey[] {
  const storeys: IfcStorey[] = []
  try {
    const storeyIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCBUILDINGSTOREY)
    for (let i = 0; i < storeyIds.size(); i++) {
      const storeyId = storeyIds.get(i)
      const storey = api.GetLine(modelID, storeyId)

      // 標高: IFCでは通常mmで格納されているのでmに変換
      const elevationRaw = storey.Elevation?.value || 0
      // 値が1000以上ならmmとみなしてmに変換、それ以外はそのまま
      const elevation = Math.abs(elevationRaw) >= 100 ? elevationRaw / 1000 : elevationRaw

      storeys.push({
        expressId: storeyId,
        globalId: storey.GlobalId?.value || '',
        name: storey.Name?.value || `階 ${i + 1}`,
        elevation,
        buildingId: 0, // 後で関係性から設定
      })
    }
  } catch (e) {
    console.warn('IfcBuildingStorey抽出エラー:', e)
  }

  // 標高順にソート
  return storeys.sort((a, b) => a.elevation - b.elevation)
}

/**
 * IfcSpaceを抽出
 */
function extractSpaces(api: WebIFC.IfcAPI, modelID: number): IfcSpace[] {
  const spaces: IfcSpace[] = []
  try {
    const spaceIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCSPACE)
    console.log(`[IFC] IfcSpace数: ${spaceIds.size()}`)

    for (let i = 0; i < spaceIds.size(); i++) {
      const spaceId = spaceIds.get(i)
      const space = api.GetLine(modelID, spaceId)

      // 基本情報
      const spaceData: IfcSpace = {
        expressId: spaceId,
        globalId: space.GlobalId?.value || '',
        name: space.Name?.value || `室 ${i + 1}`,
        longName: space.LongName?.value,
        storeyId: 0, // 後で関係性から設定
      }

      // 詳細数量情報を取得（IfcRelDefinesByPropertiesを通じて）
      const quantities = getSpaceDetailedQuantities(api, modelID, spaceId)
      spaceData.quantities = quantities

      // 後方互換用の基本数量
      spaceData.area = quantities.grossFloorArea || quantities.netFloorArea
      spaceData.volume = quantities.grossVolume || quantities.netVolume
      spaceData.height = quantities.height

      // 境界面情報を取得（IfcRelSpaceBoundaryを通じて）
      spaceData.boundaries = getSpaceBoundaries(api, modelID, spaceId)

      // デバッグ: 最初の5つの部屋の情報をログ出力（詳細展開）
      if (i < 5) {
        const q = spaceData.quantities
        console.log(`[IFC] Space ${i}: ${spaceData.name}`, {
          grossFloorArea: q?.grossFloorArea,
          netFloorArea: q?.netFloorArea,
          grossVolume: q?.grossVolume,
          height: q?.height,
          calculatedFromGeometry: q?.calculatedFromGeometry,
          profileType: q?.profileType,
          boundaryCount: spaceData.boundaries?.length || 0,
        })
      }

      spaces.push(spaceData)
    }
  } catch (e) {
    console.warn('IfcSpace抽出エラー:', e)
  }
  return spaces
}

/**
 * IfcSpaceをIfcBuildingStoreyに関連付ける
 * IfcRelContainedInSpatialStructure または IfcRelAggregates を使用
 */
function assignSpacesToStoreys(
  api: WebIFC.IfcAPI,
  modelID: number,
  spaces: IfcSpace[],
  storeys: IfcStorey[]
): void {
  try {
    // expressIdで検索しやすいようにMapを作成
    const spaceMap = new Map<number, IfcSpace>()
    for (const space of spaces) {
      spaceMap.set(space.expressId, space)
    }

    // IfcRelContainedInSpatialStructure から関連付けを取得
    const relContainedIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCRELCONTAINEDINSPATIALSTRUCTURE)
    for (let i = 0; i < relContainedIds.size(); i++) {
      const relId = relContainedIds.get(i)
      const rel = api.GetLine(modelID, relId)

      // RelatingStructure（含む側 = Storey）を取得
      const relatingStructureRef = rel.RelatingStructure
      if (!relatingStructureRef?.value) continue

      const storeyId = relatingStructureRef.value

      // RelatedElements（含まれる側 = Space等）を取得
      const relatedElements = rel.RelatedElements
      if (!relatedElements) continue

      for (const elemRef of relatedElements) {
        if (!elemRef?.value) continue
        const space = spaceMap.get(elemRef.value)
        if (space) {
          space.storeyId = storeyId
        }
      }
    }

    // IfcRelAggregates からも関連付けを取得（一部のIFCファイルではこちらを使用）
    const relAggregatesIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCRELAGGREGATES)
    for (let i = 0; i < relAggregatesIds.size(); i++) {
      const relId = relAggregatesIds.get(i)
      const rel = api.GetLine(modelID, relId)

      // RelatingObject（親 = Storey）を取得
      const relatingObjectRef = rel.RelatingObject
      if (!relatingObjectRef?.value) continue

      // Storeyかどうか確認
      const storeyExists = storeys.some((s) => s.expressId === relatingObjectRef.value)
      if (!storeyExists) continue

      const storeyId = relatingObjectRef.value

      // RelatedObjects（子 = Space等）を取得
      const relatedObjects = rel.RelatedObjects
      if (!relatedObjects) continue

      for (const objRef of relatedObjects) {
        if (!objRef?.value) continue
        const space = spaceMap.get(objRef.value)
        if (space && space.storeyId === 0) {
          space.storeyId = storeyId
        }
      }
    }
  } catch (e) {
    console.warn('Space-Storey関連付けエラー:', e)
  }
}

/**
 * IfcSpaceの詳細数量情報を取得
 * Base Quantitiesがない場合はジオメトリから計算する
 */
function getSpaceDetailedQuantities(
  api: WebIFC.IfcAPI,
  modelID: number,
  spaceId: number
): IfcSpaceQuantities {
  const result: IfcSpaceQuantities = {}
  let debugLogged = false

  try {
    // IfcRelDefinesByPropertiesを検索
    const relIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCRELDEFINESBYPROPERTIES)
    for (let i = 0; i < relIds.size(); i++) {
      const relId = relIds.get(i)
      const rel = api.GetLine(modelID, relId)

      // このスペースに関連するか確認
      const relatedObjects = rel.RelatedObjects
      if (!relatedObjects) continue

      let isRelated = false
      for (let j = 0; j < relatedObjects.length; j++) {
        if (relatedObjects[j]?.value === spaceId) {
          isRelated = true
          break
        }
      }

      if (!isRelated) continue

      // プロパティセットを取得
      const propSetRef = rel.RelatingPropertyDefinition
      if (!propSetRef?.value) continue

      const propSet = api.GetLine(modelID, propSetRef.value)

      // デバッグ: プロパティセットの内容をログ
      if (!debugLogged && spaceId < 1000) {
        console.log(`[IFC] PropSet for space ${spaceId}:`, {
          name: propSet.Name?.value,
          type: propSet.type,
          hasQuantities: !!propSet.Quantities,
          hasProperties: !!propSet.HasProperties,
        })
        debugLogged = true
      }

      // Quantitiesがある場合（IfcElementQuantity）
      if (propSet.Quantities) {
        for (const qRef of propSet.Quantities) {
          if (!qRef?.value) continue
          const quantity = api.GetLine(modelID, qRef.value)

          const name = (quantity.Name?.value || '').toLowerCase()
          const areaValue = quantity.AreaValue?.value
          const volumeValue = quantity.VolumeValue?.value
          const lengthValue = quantity.LengthValue?.value

          // 床面積
          if (name.includes('grossfloorarea') || name === 'gross floor area') {
            result.grossFloorArea = convertAreaUnit(areaValue)
          } else if (name.includes('netfloorarea') || name === 'net floor area') {
            result.netFloorArea = convertAreaUnit(areaValue)
          }
          // 天井面積
          else if (name.includes('grossceilingarea') || name === 'gross ceiling area') {
            result.grossCeilingArea = convertAreaUnit(areaValue)
          }
          // 壁面積
          else if (name.includes('grosswallarea') || name === 'gross wall area') {
            result.grossWallArea = convertAreaUnit(areaValue)
          } else if (name.includes('netwallarea') || name === 'net wall area') {
            result.netWallArea = convertAreaUnit(areaValue)
          }
          // 体積
          else if (name.includes('grossvolume') || name === 'gross volume') {
            result.grossVolume = convertVolumeUnit(volumeValue)
          } else if (name.includes('netvolume') || name === 'net volume') {
            result.netVolume = convertVolumeUnit(volumeValue)
          }
          // 高さ
          else if (name === 'height' || name === '高さ') {
            result.height = convertLengthUnit(lengthValue)
          } else if (name.includes('finishfloorheight')) {
            result.finishFloorHeight = convertLengthUnit(lengthValue)
          } else if (name.includes('finishceilingheight')) {
            result.finishCeilingHeight = convertLengthUnit(lengthValue)
          }
          // 汎用マッチング（上記で取れなかった場合）
          else if (areaValue !== undefined && !result.grossFloorArea) {
            if (name.includes('area') || name.includes('面積')) {
              result.grossFloorArea = convertAreaUnit(areaValue)
            }
          } else if (volumeValue !== undefined && !result.grossVolume) {
            if (name.includes('volume') || name.includes('体積')) {
              result.grossVolume = convertVolumeUnit(volumeValue)
            }
          }
        }
      }

      // HasPropertiesがある場合（IfcPropertySet）- ArchiCAD等ではこちらに数量がある場合も
      if (propSet.HasProperties) {
        for (const propRef of propSet.HasProperties) {
          if (!propRef?.value) continue
          const prop = api.GetLine(modelID, propRef.value)

          const name = (prop.Name?.value || '').toLowerCase()
          const nominalValue = prop.NominalValue?.value

          if (nominalValue === undefined) continue

          // 面積関連
          if (name.includes('area') || name.includes('面積')) {
            const areaVal = convertAreaUnit(nominalValue)
            if (name.includes('floor') || name.includes('床')) {
              if (!result.grossFloorArea) result.grossFloorArea = areaVal
            } else if (name.includes('wall') || name.includes('壁')) {
              if (!result.grossWallArea) result.grossWallArea = areaVal
            } else if (name.includes('ceiling') || name.includes('天井')) {
              if (!result.grossCeilingArea) result.grossCeilingArea = areaVal
            } else if (!result.grossFloorArea) {
              result.grossFloorArea = areaVal
            }
          }
          // 体積
          else if (name.includes('volume') || name.includes('体積') || name.includes('容積')) {
            if (!result.grossVolume) result.grossVolume = convertVolumeUnit(nominalValue)
          }
          // 高さ
          else if (name.includes('height') || name.includes('高さ')) {
            if (!result.height) result.height = convertLengthUnit(nominalValue)
          }
        }
      }
    }
  } catch (e) {
    console.warn('詳細数量情報取得エラー:', e)
  }

  // フォールバック: Base Quantitiesから床面積が取得できなかった場合はジオメトリから計算
  if (!result.grossFloorArea && !result.netFloorArea) {
    const geometryQuantities = getSpaceQuantitiesFromGeometry(api, modelID, spaceId)
    if (geometryQuantities) {
      console.log(`[IFC] Space ${spaceId}: ジオメトリから数量計算 (${geometryQuantities.profileType})`, {
        area: geometryQuantities.grossFloorArea?.toFixed(2),
        height: geometryQuantities.height?.toFixed(2),
        volume: geometryQuantities.grossVolume?.toFixed(2),
      })
      return {
        ...result,
        ...geometryQuantities,
      }
    }
  }

  return result
}

/**
 * IfcSpaceの境界面情報を取得
 */
function getSpaceBoundaries(
  api: WebIFC.IfcAPI,
  modelID: number,
  spaceId: number
): IfcSpaceBoundary[] {
  const boundaries: IfcSpaceBoundary[] = []

  try {
    // IfcRelSpaceBoundaryを検索
    const relIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCRELSPACEBOUNDARY)
    for (let i = 0; i < relIds.size(); i++) {
      const relId = relIds.get(i)
      const rel = api.GetLine(modelID, relId)

      // このスペースに関連するか確認
      const relatingSpaceRef = rel.RelatingSpace
      if (!relatingSpaceRef?.value || relatingSpaceRef.value !== spaceId) continue

      // 関連する建築要素を取得
      const relatedElementRef = rel.RelatedBuildingElement
      let elementType: IfcSpaceBoundary['type'] = 'other'
      let elementName: string | undefined
      let elementId: number | undefined

      if (relatedElementRef?.value) {
        const elemId = relatedElementRef.value as number
        elementId = elemId
        try {
          const element = api.GetLine(modelID, elemId)
          elementName = element.Name?.value
          const elementTypeId = element.type

          // 要素タイプを判定
          if (elementTypeId === IFC_TYPES.IFCWALL || elementTypeId === IFC_TYPES.IFCWALLSTANDARDCASE) {
            elementType = 'wall'
          } else if (elementTypeId === IFC_TYPES.IFCSLAB) {
            // スラブは床か天井かをObjectPlacement等から判断（簡易的に名前で判定）
            const slabName = (element.Name?.value || '').toLowerCase()
            if (slabName.includes('ceiling') || slabName.includes('天井')) {
              elementType = 'ceiling'
            } else {
              elementType = 'floor'
            }
          } else if (elementTypeId === IFC_TYPES.IFCCOVERING) {
            const coveringName = (element.Name?.value || '').toLowerCase()
            if (coveringName.includes('ceiling') || coveringName.includes('天井')) {
              elementType = 'ceiling'
            } else if (coveringName.includes('floor') || coveringName.includes('床')) {
              elementType = 'floor'
            } else {
              elementType = 'wall'
            }
          } else if (elementTypeId === IFC_TYPES.IFCDOOR) {
            elementType = 'door'
          } else if (elementTypeId === IFC_TYPES.IFCWINDOW) {
            elementType = 'window'
          }
        } catch {
          // 要素取得に失敗した場合は無視
        }
      }

      // 内部/外部の区分
      let internalOrExternal: IfcSpaceBoundary['internalOrExternal']
      const physicalOrVirtual = rel.InternalOrExternalBoundary?.value
      if (physicalOrVirtual === 'INTERNAL') {
        internalOrExternal = 'internal'
      } else if (physicalOrVirtual === 'EXTERNAL') {
        internalOrExternal = 'external'
      } else if (physicalOrVirtual === 'EXTERNAL_EARTH') {
        internalOrExternal = 'external_earth'
      } else if (physicalOrVirtual === 'EXTERNAL_WATER') {
        internalOrExternal = 'external_water'
      } else if (physicalOrVirtual === 'EXTERNAL_FIRE') {
        internalOrExternal = 'external_fire'
      }

      // 面積を取得（ConnectionGeometryから計算が必要だが、簡易的にはRelatedBuildingElementの数量から取得）
      let area: number | undefined
      if (elementId) {
        const elementQuantities = getElementBaseQuantityArea(api, modelID, elementId)
        if (elementQuantities) {
          area = elementQuantities
        }
      }

      boundaries.push({
        type: elementType,
        relatedElementId: elementId,
        relatedElementName: elementName,
        area,
        internalOrExternal,
      })
    }
  } catch (e) {
    console.warn('境界面情報取得エラー:', e)
  }

  return boundaries
}

/**
 * 要素のBaseQuantityから面積を取得
 */
function getElementBaseQuantityArea(
  api: WebIFC.IfcAPI,
  modelID: number,
  elementId: number
): number | undefined {
  try {
    const relIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCRELDEFINESBYPROPERTIES)
    for (let i = 0; i < relIds.size(); i++) {
      const relId = relIds.get(i)
      const rel = api.GetLine(modelID, relId)

      const relatedObjects = rel.RelatedObjects
      if (!relatedObjects) continue

      let isRelated = false
      for (let j = 0; j < relatedObjects.length; j++) {
        if (relatedObjects[j]?.value === elementId) {
          isRelated = true
          break
        }
      }

      if (!isRelated) continue

      const propSetRef = rel.RelatingPropertyDefinition
      if (!propSetRef?.value) continue

      const propSet = api.GetLine(modelID, propSetRef.value)
      if (!propSet.Quantities) continue

      for (const qRef of propSet.Quantities) {
        if (!qRef?.value) continue
        const quantity = api.GetLine(modelID, qRef.value)
        const name = (quantity.Name?.value || '').toLowerCase()

        if (name.includes('area') && quantity.AreaValue?.value !== undefined) {
          return convertAreaUnit(quantity.AreaValue.value)
        }
      }
    }
  } catch {
    // エラーは無視
  }
  return undefined
}

/**
 * 面積単位変換（mm²→m²）
 */
function convertAreaUnit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  // 値が大きすぎる場合はmm²とみなしてm²に変換
  return value > 10000 ? value / 1000000 : value
}

/**
 * 体積単位変換（mm³→m³）
 */
function convertVolumeUnit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  // 値が大きすぎる場合はmm³とみなしてm³に変換
  return value > 1000000000 ? value / 1000000000 : value
}

/**
 * 長さ単位変換（mm→m）
 */
function convertLengthUnit(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  // 値が100以上ならmmとみなしてmに変換
  return Math.abs(value) >= 100 ? value / 1000 : value
}

// ======================================
// ジオメトリからの数量計算（フォールバック）
// ======================================

/**
 * Shoelace formula（ガウスの面積公式）で多角形の面積を計算
 * @param points 頂点座標の配列 [{x, y}, ...]
 * @returns 面積（mm²）
 */
function calculatePolygonArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0

  let area = 0
  const n = points.length

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }

  return Math.abs(area) / 2
}

/**
 * IfcPolylineから頂点座標を抽出
 */
function extractPolylinePoints(
  api: WebIFC.IfcAPI,
  modelID: number,
  polylineId: number
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []

  try {
    const polyline = api.GetLine(modelID, polylineId)
    const pointRefs = polyline.Points

    if (!pointRefs) return points

    for (const pointRef of pointRefs) {
      if (!pointRef?.value) continue
      const point = api.GetLine(modelID, pointRef.value)
      const coords = point.Coordinates

      if (coords && coords.length >= 2) {
        points.push({
          x: coords[0]?.value ?? 0,
          y: coords[1]?.value ?? 0,
        })
      }
    }
  } catch (e) {
    console.warn('Polyline座標抽出エラー:', e)
  }

  return points
}

/**
 * IfcExtrudedAreaSolidからSweptAreaプロファイルを取得し面積を計算
 */
function getExtrudedAreaProfile(
  api: WebIFC.IfcAPI,
  modelID: number,
  extrudedSolidId: number
): { area: number; depth: number; profileType: IfcSpaceQuantities['profileType'] } | null {
  try {
    const extrudedSolid = api.GetLine(modelID, extrudedSolidId)

    // Depthを取得
    const depth = extrudedSolid.Depth?.value ?? 0

    // SweptAreaを取得
    const sweptAreaRef = extrudedSolid.SweptArea
    if (!sweptAreaRef?.value) return null

    const sweptArea = api.GetLine(modelID, sweptAreaRef.value)
    const profileTypeId = sweptArea.type

    // IfcArbitraryClosedProfileDef: 任意の閉じたプロファイル
    if (profileTypeId === IFC_TYPES.IFCARBITRARYCLOSEDPROFILEDEF) {
      const outerCurveRef = sweptArea.OuterCurve
      if (!outerCurveRef?.value) return null

      const outerCurve = api.GetLine(modelID, outerCurveRef.value)

      // IfcPolylineの場合
      if (outerCurve.type === IFC_TYPES.IFCPOLYLINE) {
        const points = extractPolylinePoints(api, modelID, outerCurveRef.value)
        const area = calculatePolygonArea(points)
        return { area, depth, profileType: 'arbitrary' }
      }

      return null
    }

    // IfcRectangleProfileDef: 矩形プロファイル
    if (profileTypeId === IFC_TYPES.IFCRECTANGLEPROFILEDEF) {
      const xDim = sweptArea.XDim?.value ?? 0
      const yDim = sweptArea.YDim?.value ?? 0
      const area = xDim * yDim
      return { area, depth, profileType: 'rectangle' }
    }

    // IfcCircleProfileDef: 円形プロファイル
    if (profileTypeId === IFC_TYPES.IFCCIRCLEPROFILEDEF) {
      const radius = sweptArea.Radius?.value ?? 0
      const area = Math.PI * radius * radius
      return { area, depth, profileType: 'circle' }
    }

    return { area: 0, depth, profileType: 'other' }
  } catch (e) {
    console.warn('ExtrudedAreaSolid解析エラー:', e)
    return null
  }
}

/**
 * IfcSpaceのRepresentationからIfcExtrudedAreaSolidを探す
 */
function findExtrudedAreaSolid(
  api: WebIFC.IfcAPI,
  modelID: number,
  spaceId: number,
  debug: boolean = false
): number | null {
  try {
    const space = api.GetLine(modelID, spaceId)
    const representationRef = space.Representation

    if (!representationRef?.value) {
      if (debug) console.log(`[IFC Geo] Space ${spaceId}: Representation なし`)
      return null
    }

    const productDefShape = api.GetLine(modelID, representationRef.value)
    const representations = productDefShape.Representations

    if (!representations) {
      if (debug) console.log(`[IFC Geo] Space ${spaceId}: Representations なし`)
      return null
    }

    // 各ShapeRepresentationを走査
    for (const reprRef of representations) {
      if (!reprRef?.value) continue

      const shapeRepr = api.GetLine(modelID, reprRef.value)
      const items = shapeRepr.Items

      if (!items) continue

      // Itemsから IfcExtrudedAreaSolid を探す
      for (const itemRef of items) {
        if (!itemRef?.value) continue

        const item = api.GetLine(modelID, itemRef.value)
        if (debug) console.log(`[IFC Geo] Space ${spaceId}: Item type = ${item.type}`)
        if (item.type === IFC_TYPES.IFCEXTRUDEDAREASOLID) {
          return itemRef.value
        }
      }
    }

    if (debug) console.log(`[IFC Geo] Space ${spaceId}: ExtrudedAreaSolid 見つからず`)
    return null
  } catch (e) {
    console.warn('ExtrudedAreaSolid検索エラー:', e)
    return null
  }
}

/**
 * IfcSpaceのFootPrint(GeometricCurveSet)からPolylineを探して面積を計算
 * ArchiCADなどBrepで出力するソフト向けのフォールバック
 */
function getAreaFromFootPrint(
  api: WebIFC.IfcAPI,
  modelID: number,
  spaceId: number,
  debug: boolean = false
): number | null {
  try {
    const space = api.GetLine(modelID, spaceId)
    const representationRef = space.Representation

    if (!representationRef?.value) return null

    const productDefShape = api.GetLine(modelID, representationRef.value)
    const representations = productDefShape.Representations

    if (!representations) return null

    // FootPrintを探す
    for (const reprRef of representations) {
      if (!reprRef?.value) continue

      const shapeRepr = api.GetLine(modelID, reprRef.value)
      const reprId = shapeRepr.RepresentationIdentifier?.value

      // FootPrintを探す
      if (reprId === 'FootPrint') {
        const items = shapeRepr.Items
        if (!items) continue

        for (const itemRef of items) {
          if (!itemRef?.value) continue

          const item = api.GetLine(modelID, itemRef.value)

          // GeometricCurveSetの場合
          if (item.type === IFC_TYPES.IFCGEOMETRICCURVESET) {
            const elements = item.Elements
            if (!elements) continue

            for (const elemRef of elements) {
              if (!elemRef?.value) continue
              const elem = api.GetLine(modelID, elemRef.value)

              // Polylineを探す
              if (elem.type === IFC_TYPES.IFCPOLYLINE) {
                const points = extractPolylinePoints(api, modelID, elemRef.value)
                if (points.length >= 3) {
                  const area = calculatePolygonArea(points)
                  if (debug) console.log(`[IFC Geo] Space ${spaceId}: FootPrint area = ${area}mm²`)
                  return area
                }
              }
            }
          }

          // 直接Polylineの場合
          if (item.type === IFC_TYPES.IFCPOLYLINE) {
            const points = extractPolylinePoints(api, modelID, itemRef.value)
            if (points.length >= 3) {
              const area = calculatePolygonArea(points)
              if (debug) console.log(`[IFC Geo] Space ${spaceId}: FootPrint Polyline area = ${area}mm²`)
              return area
            }
          }
        }
      }
    }

    if (debug) console.log(`[IFC Geo] Space ${spaceId}: FootPrint 見つからず`)
    return null
  } catch (e) {
    console.warn('FootPrint面積計算エラー:', e)
    return null
  }
}

// ジオメトリデバッグ用カウンター
let geometryDebugCount = 0

/**
 * ジオメトリから数量を計算（Base Quantitiesがない場合のフォールバック）
 * 1. IfcExtrudedAreaSolidから計算（Revit等）
 * 2. FootPrintのPolylineから計算（ArchiCAD等のBrep出力）
 */
function getSpaceQuantitiesFromGeometry(
  api: WebIFC.IfcAPI,
  modelID: number,
  spaceId: number
): IfcSpaceQuantities | null {
  try {
    // 最初の5件のみデバッグ出力
    const debug = geometryDebugCount < 5
    geometryDebugCount++

    // 方法1: IfcExtrudedAreaSolidから計算
    const extrudedSolidId = findExtrudedAreaSolid(api, modelID, spaceId, debug)
    if (extrudedSolidId) {
      const profileData = getExtrudedAreaProfile(api, modelID, extrudedSolidId)
      if (profileData && profileData.area > 0) {
        // mm² → m², mm → m, mm³ → m³ に変換
        const areaM2 = profileData.area / 1000000
        const heightM = profileData.depth / 1000
        const volumeM3 = (profileData.area * profileData.depth) / 1000000000

        return {
          grossFloorArea: areaM2,
          height: heightM,
          grossVolume: volumeM3,
          calculatedFromGeometry: true,
          profileType: profileData.profileType,
        }
      }
    }

    // 方法2: FootPrintのPolylineから面積を計算（ArchiCAD等向け）
    const footPrintArea = getAreaFromFootPrint(api, modelID, spaceId, debug)
    if (footPrintArea && footPrintArea > 0) {
      // mm² → m² に変換
      const areaM2 = footPrintArea / 1000000

      if (debug) console.log(`[IFC Geo] Space ${spaceId}: FootPrintから面積計算 = ${areaM2.toFixed(2)}m²`)

      return {
        grossFloorArea: areaM2,
        calculatedFromGeometry: true,
        profileType: 'arbitrary', // FootPrintは多角形
      }
    }

    if (debug) console.log(`[IFC Geo] Space ${spaceId}: ジオメトリから面積計算できず`)
    return null
  } catch (e) {
    console.warn('ジオメトリからの数量計算エラー:', e)
    return null
  }
}

/**
 * IfcElementQuantityを抽出
 */
function extractQuantitySets(api: WebIFC.IfcAPI, modelID: number): IfcQuantitySet[] {
  const quantitySets: IfcQuantitySet[] = []
  try {
    const qSetIds = api.GetLineIDsWithType(modelID, IFC_TYPES.IFCELEMENTQUANTITY)
    for (let i = 0; i < qSetIds.size(); i++) {
      const qSetId = qSetIds.get(i)
      const qSet = api.GetLine(modelID, qSetId)

      const quantities: IfcQuantity[] = []
      if (qSet.Quantities) {
        for (const qRef of qSet.Quantities) {
          if (!qRef?.value) continue
          const quantity = api.GetLine(modelID, qRef.value)

          const qData: IfcQuantity = {
            name: quantity.Name?.value || '',
            type: 'length',
            value: 0,
          }

          // 数量タイプと値を判定
          if (quantity.LengthValue?.value !== undefined) {
            qData.type = 'length'
            qData.value = quantity.LengthValue.value
          } else if (quantity.AreaValue?.value !== undefined) {
            qData.type = 'area'
            qData.value = quantity.AreaValue.value
          } else if (quantity.VolumeValue?.value !== undefined) {
            qData.type = 'volume'
            qData.value = quantity.VolumeValue.value
          } else if (quantity.CountValue?.value !== undefined) {
            qData.type = 'count'
            qData.value = quantity.CountValue.value
          } else if (quantity.WeightValue?.value !== undefined) {
            qData.type = 'weight'
            qData.value = quantity.WeightValue.value
          } else if (quantity.TimeValue?.value !== undefined) {
            qData.type = 'time'
            qData.value = quantity.TimeValue.value
          }

          quantities.push(qData)
        }
      }

      quantitySets.push({
        expressId: qSetId,
        name: qSet.Name?.value || '',
        elementId: 0, // 関係性から設定
        quantities,
      })
    }
  } catch (e) {
    console.warn('IfcElementQuantity抽出エラー:', e)
  }
  return quantitySets
}

/**
 * パーサーエラーを作成
 */
function createParserError(
  code: ParserError['code'],
  message: string,
  details?: string
): ParserError {
  return { code, message, details }
}

/**
 * ファイルサイズをフォーマット
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * パーサーを破棄（メモリ解放）
 */
export function disposeIfcParser(): void {
  if (ifcApi) {
    ifcApi = null
    isInitialized = false
  }
}
