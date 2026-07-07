import type {ReactNode} from 'react';

export default function PropertyPanel(): ReactNode {
  return (
    <svg
      viewBox="0 0 260 480"
      style={{width: '100%', maxWidth: 260, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff'}}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow-r" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
        </marker>
      </defs>

      {/* ヘッダー */}
      <rect x="0" y="0" width="260" height="35" fill="#f8fafc" rx="8" />
      <text x="15" y="23" fontSize="12" fill="#1e293b" fontWeight="bold">アクティビティ - 基本設定</text>

      {/* 作業名 */}
      <text x="15" y="55" fontSize="10" fill="#64748b">作業名</text>
      <rect x="15" y="60" width="230" height="28" rx="4" fill="#fff" stroke="#cbd5e1" />
      <text x="25" y="79" fontSize="10" fill="#1e293b">基礎配筋工事</text>

      {/* 工期計算モード */}
      <text x="15" y="110" fontSize="10" fill="#64748b">工期計算モード</text>
      <rect x="15" y="115" width="100" height="24" rx="4" fill="#3b82f6" />
      <text x="35" y="131" fontSize="9" fill="#fff">手動入力</text>
      <rect x="119" y="115" width="100" height="24" rx="4" fill="#e2e8f0" />
      <text x="139" y="131" fontSize="9" fill="#475569">歩掛計算</text>

      {/* 所要日数 */}
      <text x="15" y="160" fontSize="10" fill="#64748b">所要日数</text>
      <rect x="15" y="165" width="100" height="28" rx="4" fill="#fff" stroke="#cbd5e1" />
      <text x="25" y="184" fontSize="10" fill="#1e293b">5</text>
      <text x="120" y="184" fontSize="10" fill="#94a3b8">日</text>

      {/* チェックボックス */}
      <rect x="15" y="200" width="14" height="14" rx="2" fill="#fff" stroke="#cbd5e1" />
      <text x="35" y="212" fontSize="10" fill="#475569">ダミー</text>
      <rect x="100" y="200" width="14" height="14" rx="2" fill="#3b82f6" stroke="#3b82f6" />
      <text x="94" y="207" fontSize="9" fill="#fff">✓</text>
      <text x="120" y="212" fontSize="10" fill="#475569">日数表示</text>

      {/* 区切り */}
      <line x1="0" y1="230" x2="260" y2="230" stroke="#e2e8f0" />

      {/* CPM結果 */}
      <text x="15" y="250" fontSize="11" fill="#1e293b" fontWeight="bold">CPM計算結果</text>

      {/* ES/EF */}
      <text x="15" y="275" fontSize="10" fill="#64748b">ES（最早開始）</text>
      <text x="170" y="275" fontSize="10" fill="#1e293b" fontWeight="bold">0</text>
      <text x="15" y="295" fontSize="10" fill="#64748b">EF（最早完了）</text>
      <text x="170" y="295" fontSize="10" fill="#1e293b" fontWeight="bold">5</text>

      {/* LS/LF */}
      <text x="15" y="315" fontSize="10" fill="#64748b">LS（最遅開始）</text>
      <text x="170" y="315" fontSize="10" fill="#1e293b" fontWeight="bold">0</text>
      <text x="15" y="335" fontSize="10" fill="#64748b">LF（最遅完了）</text>
      <text x="170" y="335" fontSize="10" fill="#1e293b" fontWeight="bold">5</text>

      {/* フロート */}
      <text x="15" y="355" fontSize="10" fill="#64748b">TF（トータルフロート）</text>
      <text x="200" y="355" fontSize="10" fill="#1e293b" fontWeight="bold">0</text>
      <text x="15" y="375" fontSize="10" fill="#64748b">FF（フリーフロート）</text>
      <text x="200" y="375" fontSize="10" fill="#1e293b" fontWeight="bold">0</text>

      {/* クリティカルパス */}
      <rect x="15" y="390" width="130" height="22" rx="4" fill="#FEE2E2" />
      <text x="25" y="405" fontSize="10" fill="#EF4444" fontWeight="bold">クリティカルパス</text>

      {/* 区切り */}
      <line x1="0" y1="425" x2="260" y2="425" stroke="#e2e8f0" />

      {/* 詳細設定 */}
      <text x="15" y="445" fontSize="11" fill="#1e293b" fontWeight="bold">▶ 詳細設定</text>
      <text x="25" y="465" fontSize="9" fill="#94a3b8">線の種類 / 色 / 太さ / 経路設定...</text>

      {/* 朱書き */}
      <rect x="105" y="100" width="140" height="16" rx="3" fill="#FEE2E2" stroke="#EF4444" strokeWidth="0.5" />
      <text x="175" y="112" fontSize="8" fill="#EF4444" textAnchor="middle" fontWeight="bold">歩掛計算に切替可能</text>

      <rect x="150" y="386" width="95" height="16" rx="3" fill="#FEE2E2" stroke="#EF4444" strokeWidth="0.5" />
      <text x="197" y="398" fontSize="8" fill="#EF4444" textAnchor="middle" fontWeight="bold">TF=0で赤表示</text>
    </svg>
  );
}
