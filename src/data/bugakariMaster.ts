// 歩掛マスタデータ（公共標仕ベース + CSVデータ）

export interface BugakariRecord {
  dokenCode: number      // 1=土木, 2=建築, 3=住宅, 4=造園, 5=ダム
  categoryName: string   // 工種区分
  detailName: string     // 工種細目
  occupation: string     // 職種
  rate: number           // 歩掛（m³/人日等）
  unit: string           // 単位
}

// 土建コード定義
export const DOKEN_TYPES: { code: number; name: string }[] = [
  { code: 1, name: '土木' },
  { code: 2, name: '建築' },
  { code: 3, name: '住宅' },
  { code: 4, name: '造園' },
  { code: 5, name: 'ダム' },
]

// 公共標仕カテゴリマスタ（hasData=false はCSVにないためグレーアウト）
export interface CategoryMaster {
  name: string
  hasData: boolean
}

export const CATEGORY_MASTERS: CategoryMaster[] = [
  { name: '型枠', hasData: true },
  { name: 'とび・土工', hasData: true },
  { name: '鉄筋', hasData: true },
  { name: '左官', hasData: true },
  { name: 'コンクリート', hasData: true },
  { name: '電工', hasData: true },
  { name: '空調衛生', hasData: true },
  { name: '配管', hasData: true },
  { name: '防水', hasData: false },
  { name: 'タイル', hasData: false },
  { name: '石', hasData: false },
  { name: '金属', hasData: false },
  { name: '木工', hasData: false },
  { name: '屋根', hasData: false },
  { name: '建具', hasData: false },
  { name: 'ガラス', hasData: false },
  { name: '内装', hasData: false },
  { name: '舗装', hasData: false },
  { name: '塗装', hasData: false },
  { name: '鉄骨', hasData: false },
  { name: '杭地業', hasData: false },
]

// CSVベース歩掛データ（重複除去済み、約90件ユニーク）
export const BUGAKARI_DATA: BugakariRecord[] = [
  // === 土木 (1) ===
  { dokenCode: 1, categoryName: 'とび・土工', detailName: '根切り工事', occupation: '土工', rate: 2.5, unit: 'm³' },
  { dokenCode: 1, categoryName: 'とび・土工', detailName: '根切り工事', occupation: '普通作業員', rate: 1.8, unit: 'm³' },
  { dokenCode: 1, categoryName: 'とび・土工', detailName: '埋戻し工事', occupation: '土工', rate: 3.0, unit: 'm³' },
  { dokenCode: 1, categoryName: 'とび・土工', detailName: '埋戻し工事', occupation: '普通作業員', rate: 2.0, unit: 'm³' },
  { dokenCode: 1, categoryName: 'コンクリート', detailName: 'コンクリート打設', occupation: '土工', rate: 8.0, unit: 'm³' },
  { dokenCode: 1, categoryName: 'コンクリート', detailName: 'コンクリート打設', occupation: '普通作業員', rate: 5.0, unit: 'm³' },
  { dokenCode: 1, categoryName: 'コンクリート', detailName: 'コンクリート打設', occupation: '土木一般世話役', rate: 15.0, unit: 'm³' },
  { dokenCode: 1, categoryName: '型枠', detailName: '型枠工事（土木）', occupation: '型わく工', rate: 3.5, unit: 'm²' },
  { dokenCode: 1, categoryName: '型枠', detailName: '型枠工事（土木）', occupation: '普通作業員', rate: 2.0, unit: 'm²' },
  { dokenCode: 1, categoryName: '鉄筋', detailName: '鉄筋工事（土木）', occupation: '鉄筋工', rate: 0.15, unit: 't' },
  { dokenCode: 1, categoryName: '鉄筋', detailName: '鉄筋工事（土木）', occupation: '普通作業員', rate: 0.08, unit: 't' },

  // === 建築 (2) ===
  // 型枠
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事', occupation: '型わく工', rate: 0.157, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事', occupation: '普通作業員', rate: 0.100, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事', occupation: '土木一般世話役', rate: 0.031, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事（壁）', occupation: '型わく工', rate: 0.180, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事（壁）', occupation: '普通作業員', rate: 0.110, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事（柱）', occupation: '型わく工', rate: 0.200, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事（柱）', occupation: '普通作業員', rate: 0.120, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事（梁）', occupation: '型わく工', rate: 0.210, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事（梁）', occupation: '普通作業員', rate: 0.130, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事（スラブ）', occupation: '型わく工', rate: 0.140, unit: 'm²' },
  { dokenCode: 2, categoryName: '型枠', detailName: '型枠工事（スラブ）', occupation: '普通作業員', rate: 0.090, unit: 'm²' },
  // とび・土工
  { dokenCode: 2, categoryName: 'とび・土工', detailName: '足場工事', occupation: 'とび工', rate: 1.5, unit: 'm²' },
  { dokenCode: 2, categoryName: 'とび・土工', detailName: '足場工事', occupation: '普通作業員', rate: 0.8, unit: 'm²' },
  { dokenCode: 2, categoryName: 'とび・土工', detailName: '根切り工事', occupation: '土工', rate: 2.0, unit: 'm³' },
  { dokenCode: 2, categoryName: 'とび・土工', detailName: '根切り工事', occupation: '普通作業員', rate: 1.5, unit: 'm³' },
  { dokenCode: 2, categoryName: 'とび・土工', detailName: '山留め工事', occupation: 'とび工', rate: 0.5, unit: 'm²' },
  { dokenCode: 2, categoryName: 'とび・土工', detailName: '山留め工事', occupation: '普通作業員', rate: 0.3, unit: 'm²' },
  // 鉄筋
  { dokenCode: 2, categoryName: '鉄筋', detailName: '鉄筋工事', occupation: '鉄筋工', rate: 0.12, unit: 't' },
  { dokenCode: 2, categoryName: '鉄筋', detailName: '鉄筋工事', occupation: '普通作業員', rate: 0.06, unit: 't' },
  { dokenCode: 2, categoryName: '鉄筋', detailName: '鉄筋工事（柱・梁）', occupation: '鉄筋工', rate: 0.10, unit: 't' },
  { dokenCode: 2, categoryName: '鉄筋', detailName: '鉄筋工事（柱・梁）', occupation: '普通作業員', rate: 0.05, unit: 't' },
  { dokenCode: 2, categoryName: '鉄筋', detailName: '鉄筋工事（壁・スラブ）', occupation: '鉄筋工', rate: 0.14, unit: 't' },
  { dokenCode: 2, categoryName: '鉄筋', detailName: '鉄筋工事（壁・スラブ）', occupation: '普通作業員', rate: 0.07, unit: 't' },
  // コンクリート
  { dokenCode: 2, categoryName: 'コンクリート', detailName: 'コンクリート打設', occupation: 'コンクリート工', rate: 10.0, unit: 'm³' },
  { dokenCode: 2, categoryName: 'コンクリート', detailName: 'コンクリート打設', occupation: '普通作業員', rate: 6.0, unit: 'm³' },
  { dokenCode: 2, categoryName: 'コンクリート', detailName: 'コンクリート打設', occupation: '土木一般世話役', rate: 20.0, unit: 'm³' },
  { dokenCode: 2, categoryName: 'コンクリート', detailName: 'コンクリート打設（壁）', occupation: 'コンクリート工', rate: 8.0, unit: 'm³' },
  { dokenCode: 2, categoryName: 'コンクリート', detailName: 'コンクリート打設（壁）', occupation: '普通作業員', rate: 5.0, unit: 'm³' },
  // 左官
  { dokenCode: 2, categoryName: '左官', detailName: 'モルタル塗り', occupation: '左官', rate: 4.0, unit: 'm²' },
  { dokenCode: 2, categoryName: '左官', detailName: 'モルタル塗り', occupation: '普通作業員', rate: 2.0, unit: 'm²' },
  { dokenCode: 2, categoryName: '左官', detailName: 'コンクリート直押え', occupation: '左官', rate: 8.0, unit: 'm²' },
  { dokenCode: 2, categoryName: '左官', detailName: 'コンクリート直押え', occupation: '普通作業員', rate: 4.0, unit: 'm²' },
  // 電工
  { dokenCode: 2, categoryName: '電工', detailName: '電気配線工事', occupation: '電工', rate: 5.0, unit: '箇所' },
  { dokenCode: 2, categoryName: '電工', detailName: '電気配線工事', occupation: '普通作業員', rate: 3.0, unit: '箇所' },
  { dokenCode: 2, categoryName: '電工', detailName: '照明器具取付', occupation: '電工', rate: 8.0, unit: '台' },
  { dokenCode: 2, categoryName: '電工', detailName: '分電盤取付', occupation: '電工', rate: 1.0, unit: '面' },
  // 空調衛生
  { dokenCode: 2, categoryName: '空調衛生', detailName: '配管工事', occupation: '配管工', rate: 3.0, unit: 'm' },
  { dokenCode: 2, categoryName: '空調衛生', detailName: '配管工事', occupation: '普通作業員', rate: 2.0, unit: 'm' },
  { dokenCode: 2, categoryName: '空調衛生', detailName: 'ダクト工事', occupation: '板金工', rate: 2.5, unit: 'm²' },
  { dokenCode: 2, categoryName: '空調衛生', detailName: 'ダクト工事', occupation: '普通作業員', rate: 1.5, unit: 'm²' },
  { dokenCode: 2, categoryName: '空調衛生', detailName: '衛生器具取付', occupation: '配管工', rate: 2.0, unit: '台' },
  // 配管
  { dokenCode: 2, categoryName: '配管', detailName: '給水管工事', occupation: '配管工', rate: 4.0, unit: 'm' },
  { dokenCode: 2, categoryName: '配管', detailName: '給水管工事', occupation: '普通作業員', rate: 2.5, unit: 'm' },
  { dokenCode: 2, categoryName: '配管', detailName: '排水管工事', occupation: '配管工', rate: 3.5, unit: 'm' },
  { dokenCode: 2, categoryName: '配管', detailName: '排水管工事', occupation: '普通作業員', rate: 2.0, unit: 'm' },

  // === 住宅 (3) ===
  { dokenCode: 3, categoryName: '型枠', detailName: '型枠工事（基礎）', occupation: '型わく工', rate: 0.130, unit: 'm²' },
  { dokenCode: 3, categoryName: '型枠', detailName: '型枠工事（基礎）', occupation: '普通作業員', rate: 0.080, unit: 'm²' },
  { dokenCode: 3, categoryName: '鉄筋', detailName: '鉄筋工事（基礎）', occupation: '鉄筋工', rate: 0.10, unit: 't' },
  { dokenCode: 3, categoryName: '鉄筋', detailName: '鉄筋工事（基礎）', occupation: '普通作業員', rate: 0.05, unit: 't' },
  { dokenCode: 3, categoryName: 'コンクリート', detailName: 'コンクリート打設（基礎）', occupation: 'コンクリート工', rate: 12.0, unit: 'm³' },
  { dokenCode: 3, categoryName: 'コンクリート', detailName: 'コンクリート打設（基礎）', occupation: '普通作業員', rate: 7.0, unit: 'm³' },
  { dokenCode: 3, categoryName: 'とび・土工', detailName: '根切り工事', occupation: '土工', rate: 3.0, unit: 'm³' },
  { dokenCode: 3, categoryName: '左官', detailName: 'モルタル塗り', occupation: '左官', rate: 5.0, unit: 'm²' },
  { dokenCode: 3, categoryName: '電工', detailName: '電気配線工事', occupation: '電工', rate: 6.0, unit: '箇所' },
  { dokenCode: 3, categoryName: '空調衛生', detailName: '配管工事', occupation: '配管工', rate: 4.0, unit: 'm' },

  // === 造園 (4) ===
  { dokenCode: 4, categoryName: 'とび・土工', detailName: '整地工事', occupation: '造園工', rate: 15.0, unit: 'm²' },
  { dokenCode: 4, categoryName: 'とび・土工', detailName: '整地工事', occupation: '普通作業員', rate: 10.0, unit: 'm²' },
  { dokenCode: 4, categoryName: 'コンクリート', detailName: 'コンクリート舗装', occupation: 'コンクリート工', rate: 8.0, unit: 'm²' },
  { dokenCode: 4, categoryName: 'コンクリート', detailName: 'コンクリート舗装', occupation: '普通作業員', rate: 5.0, unit: 'm²' },
  { dokenCode: 4, categoryName: '左官', detailName: '左官仕上げ', occupation: '左官', rate: 5.0, unit: 'm²' },

  // === ダム (5) ===
  { dokenCode: 5, categoryName: 'コンクリート', detailName: 'ダムコンクリート打設', occupation: 'コンクリート工', rate: 6.0, unit: 'm³' },
  { dokenCode: 5, categoryName: 'コンクリート', detailName: 'ダムコンクリート打設', occupation: '普通作業員', rate: 4.0, unit: 'm³' },
  { dokenCode: 5, categoryName: 'コンクリート', detailName: 'ダムコンクリート打設', occupation: '土木一般世話役', rate: 12.0, unit: 'm³' },
  { dokenCode: 5, categoryName: '型枠', detailName: '型枠工事（ダム）', occupation: '型わく工', rate: 2.5, unit: 'm²' },
  { dokenCode: 5, categoryName: '型枠', detailName: '型枠工事（ダム）', occupation: '普通作業員', rate: 1.5, unit: 'm²' },
  { dokenCode: 5, categoryName: '鉄筋', detailName: '鉄筋工事（ダム）', occupation: '鉄筋工', rate: 0.08, unit: 't' },
  { dokenCode: 5, categoryName: 'とび・土工', detailName: '掘削工事', occupation: '土工', rate: 5.0, unit: 'm³' },
  { dokenCode: 5, categoryName: 'とび・土工', detailName: '掘削工事', occupation: '普通作業員', rate: 3.0, unit: 'm³' },
]

// ヘルパー: 有効な土建コードでフィルタしたカテゴリ一覧を取得
export function getFilteredCategories(enabledDokenCodes: Set<number>): CategoryMaster[] {
  const activeCategories = new Set(
    BUGAKARI_DATA
      .filter(r => enabledDokenCodes.has(r.dokenCode))
      .map(r => r.categoryName)
  )

  return CATEGORY_MASTERS.map(cat => ({
    ...cat,
    hasData: cat.hasData && activeCategories.has(cat.name),
  }))
}

// ヘルパー: カテゴリに属する工種細目一覧（ユニーク）
export function getDetailsForCategory(
  categoryName: string,
  enabledDokenCodes: Set<number>
): string[] {
  const details = new Set<string>()
  for (const r of BUGAKARI_DATA) {
    if (r.categoryName === categoryName && enabledDokenCodes.has(r.dokenCode)) {
      details.add(r.detailName)
    }
  }
  return Array.from(details)
}

// ヘルパー: 工種細目に属する職種+歩掛一覧
export function getLaborForDetail(
  categoryName: string,
  detailName: string,
  enabledDokenCodes: Set<number>
): { occupation: string; rate: number; unit: string }[] {
  return BUGAKARI_DATA
    .filter(r =>
      r.categoryName === categoryName &&
      r.detailName === detailName &&
      enabledDokenCodes.has(r.dokenCode)
    )
    .map(r => ({ occupation: r.occupation, rate: r.rate, unit: r.unit }))
}
