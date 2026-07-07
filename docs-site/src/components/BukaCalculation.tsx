import type {ReactNode} from 'react';

export default function BukaCalculation(): ReactNode {
  return (
    <svg
      viewBox="0 0 500 200"
      style={{width: '100%', maxWidth: 500, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff'}}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
        </marker>
      </defs>

      <text x="250" y="25" fontSize="13" fill="#1e293b" textAnchor="middle" fontWeight="bold">歩掛計算の仕組み</text>

      {/* 数量ボックス */}
      <rect x="20" y="50" width="100" height="50" rx="6" fill="#EFF6FF" stroke="#3b82f6" strokeWidth="1.5" />
      <text x="70" y="72" fontSize="10" fill="#3b82f6" textAnchor="middle" fontWeight="bold">数量</text>
      <text x="70" y="90" fontSize="14" fill="#1e293b" textAnchor="middle" fontWeight="bold">100 m²</text>

      {/* ÷ */}
      <text x="140" y="82" fontSize="18" fill="#64748b" textAnchor="middle">÷</text>

      {/* ( */}
      <text x="155" y="82" fontSize="24" fill="#64748b" textAnchor="middle">(</text>

      {/* 人工ボックス */}
      <rect x="165" y="50" width="100" height="50" rx="6" fill="#F0FDF4" stroke="#22c55e" strokeWidth="1.5" />
      <text x="215" y="72" fontSize="10" fill="#22c55e" textAnchor="middle" fontWeight="bold">人工</text>
      <text x="215" y="90" fontSize="14" fill="#1e293b" textAnchor="middle" fontWeight="bold">5 人</text>

      {/* × */}
      <text x="280" y="82" fontSize="18" fill="#64748b" textAnchor="middle">×</text>

      {/* 歩掛ボックス */}
      <rect x="295" y="50" width="100" height="50" rx="6" fill="#FFFBEB" stroke="#f59e0b" strokeWidth="1.5" />
      <text x="345" y="72" fontSize="10" fill="#f59e0b" textAnchor="middle" fontWeight="bold">歩掛</text>
      <text x="345" y="90" fontSize="14" fill="#1e293b" textAnchor="middle" fontWeight="bold">4 m²/人日</text>

      {/* ) */}
      <text x="405" y="82" fontSize="24" fill="#64748b" textAnchor="middle">)</text>

      {/* = */}
      <text x="425" y="82" fontSize="18" fill="#64748b" textAnchor="middle">=</text>

      {/* 結果ボックス */}
      <rect x="440" y="50" width="50" height="50" rx="6" fill="#EF4444" />
      <text x="465" y="72" fontSize="9" fill="#fff" textAnchor="middle" fontWeight="bold">日数</text>
      <text x="465" y="92" fontSize="16" fill="#fff" textAnchor="middle" fontWeight="bold">5</text>

      {/* 計算式テキスト */}
      <text x="250" y="140" fontSize="11" fill="#64748b" textAnchor="middle">
        100 m² ÷ (5人 × 4 m²/人日) = 5日
      </text>

      {/* 注釈 */}
      <rect x="130" y="155" width="240" height="18" rx="3" fill="#FEE2E2" stroke="#EF4444" strokeWidth="0.5" />
      <text x="250" y="168" fontSize="9" fill="#EF4444" textAnchor="middle" fontWeight="bold">人工を増やすと日数が減る → 工期短縮の検討に活用</text>
    </svg>
  );
}
