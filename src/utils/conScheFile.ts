/**
 * Con-Sche 独自ファイル形式（ZIPベース）
 *
 * .csa (con-sche-all): フルパッケージ — 全データ含む
 * .csl (con-sche-lite): ライト — 工程+カレンダー+テキストボックスのみ
 */

import JSZip from 'jszip'
import type { ADMExportData, ADMExportDataLite, ConScheManifest } from '@/stores/admStore'

// ======================================
// エクスポート
// ======================================

export async function exportFullPackage(data: ADMExportData): Promise<Blob> {
  const zip = new JSZip()

  const manifest: ConScheManifest = { format: 'con-sche-all', version: '3.0.0' }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('project.json', JSON.stringify(data.projectSettings, null, 2))
  zip.file('schedule.json', JSON.stringify({ nodes: data.nodes, activities: data.activities }, null, 2))
  zip.file('calendar.json', JSON.stringify(data.calendar, null, 2))
  zip.file('hierarchy.json', JSON.stringify(data.hierarchy, null, 2))
  zip.file('masters.json', JSON.stringify({
    zones: data.masters.zones,
    rooms: data.masters.rooms,
    details: data.masters.details,
    customMasters: data.customMasters ?? {},
    customColumnValues: data.customColumnValues ?? {},
  }, null, 2))
  zip.file('textboxes.json', JSON.stringify(data.textboxes ?? [], null, 2))

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export async function exportLitePackage(data: ADMExportDataLite): Promise<Blob> {
  const zip = new JSZip()

  const manifest: ConScheManifest = { format: 'con-sche-lite', version: '3.0.0' }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('project.json', JSON.stringify(data.projectSettings, null, 2))
  zip.file('schedule.json', JSON.stringify({ nodes: data.nodes, activities: data.activities }, null, 2))
  zip.file('calendar.json', JSON.stringify(data.calendar, null, 2))
  zip.file('textboxes.json', JSON.stringify(data.textboxes ?? [], null, 2))

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

// ======================================
// インポート
// ======================================

export type ImportResult =
  | { type: 'full'; data: ADMExportData }
  | { type: 'lite'; data: ADMExportDataLite }

export async function importPackage(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  // manifest 読み込み
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('manifest.json が見つかりません')
  const manifest: ConScheManifest = JSON.parse(await manifestFile.async('text'))

  // 共通ファイル読み込み
  const readJson = async <T>(name: string): Promise<T> => {
    const f = zip.file(name)
    if (!f) throw new Error(`${name} が見つかりません`)
    return JSON.parse(await f.async('text')) as T
  }

  const projectSettings = await readJson<ADMExportData['projectSettings']>('project.json')
  const schedule = await readJson<{ nodes: ADMExportData['nodes']; activities: ADMExportData['activities'] }>('schedule.json')
  const calendar = await readJson<ADMExportData['calendar']>('calendar.json')
  const textboxes = await readJson<NonNullable<ADMExportData['textboxes']>>('textboxes.json')

  if (manifest.format === 'con-sche-all') {
    const hierarchy = await readJson<ADMExportData['hierarchy']>('hierarchy.json')
    const mastersRaw = await readJson<ADMExportData['masters'] & {
      customMasters?: ADMExportData['customMasters']
      customColumnValues?: ADMExportData['customColumnValues']
    }>('masters.json')

    const data: ADMExportData = {
      version: manifest.version,
      exportedAt: new Date().toISOString(),
      projectSettings,
      calendar,
      nodes: schedule.nodes,
      activities: schedule.activities,
      hierarchy,
      masters: {
        zones: mastersRaw.zones,
        rooms: mastersRaw.rooms,
        details: mastersRaw.details,
      },
      textboxes,
      customMasters: mastersRaw.customMasters,
      customColumnValues: mastersRaw.customColumnValues,
    }
    return { type: 'full', data }
  }

  // lite
  const data: ADMExportDataLite = {
    version: manifest.version,
    exportedAt: new Date().toISOString(),
    projectSettings,
    calendar,
    nodes: schedule.nodes,
    activities: schedule.activities,
    textboxes,
  }
  return { type: 'lite', data }
}

// ======================================
// ダウンロードヘルパー
// ======================================

export function downloadPackage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
