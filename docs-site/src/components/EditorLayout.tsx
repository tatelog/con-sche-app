import type {ReactNode} from 'react';

type Props = {
  showAnnotations?: boolean;
};

export default function EditorLayout({showAnnotations = true}: Props): ReactNode {
  return (
    <svg
      viewBox="0 0 820 520"
      style={{width: '100%', maxWidth: 820, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff'}}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
        </marker>
      </defs>

      {/* ツールバー */}
      <rect x="0" y="0" width="820" height="50" fill="#f8fafc" stroke="#cbd5e1" />
      <text x="12" y="20" fontSize="10" fill="#64748b">プロジェクト ▾</text>
      <text x="100" y="20" fontSize="10" fill="#64748b">印刷 ▾</text>
      <text x="160" y="20" fontSize="10" fill="#64748b">設定</text>
      {/* モードボタン */}
      <rect x="240" y="8" width="56" height="24" rx="4" fill="#3b82f6" />
      <text x="250" y="24" fontSize="9" fill="#fff">選択</text>
      <rect x="300" y="8" width="56" height="24" rx="4" fill="#e2e8f0" />
      <text x="310" y="24" fontSize="9" fill="#475569">パス</text>
      <rect x="360" y="8" width="56" height="24" rx="4" fill="#e2e8f0" />
      <text x="370" y="24" fontSize="9" fill="#475569">描画</text>
      <rect x="420" y="8" width="64" height="24" rx="4" fill="#e2e8f0" />
      <text x="426" y="24" fontSize="9" fill="#475569">テキスト</text>
      {/* Undo/Redo */}
      <text x="510" y="24" fontSize="12" fill="#64748b">↩ ↪</text>
      {/* ビュー切替 */}
      <rect x="600" y="8" width="80" height="24" rx="4" fill="#3b82f6" />
      <text x="606" y="24" fontSize="9" fill="#fff">ネットワーク</text>
      <rect x="684" y="8" width="56" height="24" rx="4" fill="#e2e8f0" />
      <text x="694" y="24" fontSize="9" fill="#475569">ガント</text>
      {/* Zoom */}
      <text x="760" y="24" fontSize="10" fill="#64748b">100%</text>
      {/* ツールバーラベル */}
      <text x="410" y="45" fontSize="9" fontWeight="bold" fill="#94a3b8" textAnchor="middle">ツールバー</text>

      {/* カレンダーヘッダー */}
      <rect x="140" y="50" width="480" height="30" fill="#f1f5f9" stroke="#cbd5e1" />
      <text x="160" y="70" fontSize="9" fill="#64748b">2月</text>
      <text x="200" y="70" fontSize="8" fill="#94a3b8">3</text>
      <text x="230" y="70" fontSize="8" fill="#94a3b8">4</text>
      <text x="260" y="70" fontSize="8" fill="#94a3b8">5</text>
      <text x="290" y="70" fontSize="8" fill="#94a3b8">6</text>
      <text x="320" y="70" fontSize="8" fill="#94a3b8">7</text>
      <text x="350" y="70" fontSize="8" fill="#ef4444">8</text>
      <text x="380" y="70" fontSize="8" fill="#ef4444">9</text>
      <text x="410" y="70" fontSize="8" fill="#94a3b8">10</text>
      <text x="440" y="70" fontSize="8" fill="#94a3b8">11</text>
      <text x="470" y="70" fontSize="8" fill="#94a3b8">12</text>
      <text x="500" y="70" fontSize="8" fill="#94a3b8">13</text>
      <text x="530" y="70" fontSize="8" fill="#94a3b8">14</text>
      <text x="560" y="70" fontSize="8" fill="#ef4444">15</text>
      <text x="590" y="70" fontSize="8" fill="#ef4444">16</text>

      {/* 左ヘッダーパネル */}
      <rect x="0" y="50" width="140" height="470" fill="#f8fafc" stroke="#cbd5e1" />
      <text x="10" y="70" fontSize="9" fill="#64748b" fontWeight="bold">工区</text>
      <text x="50" y="70" fontSize="9" fill="#64748b" fontWeight="bold">階数</text>
      <text x="90" y="70" fontSize="9" fill="#64748b" fontWeight="bold">通り</text>
      <line x1="0" y1="80" x2="140" y2="80" stroke="#e2e8f0" />
      <text x="10" y="96" fontSize="8" fill="#475569">A工区</text>
      <text x="50" y="96" fontSize="8" fill="#475569">1F</text>
      <text x="90" y="96" fontSize="8" fill="#475569">X1</text>
      <text x="10" y="156" fontSize="8" fill="#475569">A工区</text>
      <text x="50" y="156" fontSize="8" fill="#475569">2F</text>
      <text x="90" y="156" fontSize="8" fill="#475569">X2</text>
      <text x="70" y="490" fontSize="9" fontWeight="bold" fill="#94a3b8" textAnchor="middle">左ヘッダー</text>

      {/* キャンバス */}
      <rect x="140" y="80" width="480" height="440" fill="#ffffff" stroke="#cbd5e1" />

      {/* ノード 1 */}
      <circle cx="200" cy="140" r="18" fill="#fff" stroke="#3b82f6" strokeWidth="2" />
      <text x="200" y="144" fontSize="12" fill="#3b82f6" textAnchor="middle" fontWeight="bold">1</text>

      {/* ノード 2 */}
      <circle cx="360" cy="140" r="18" fill="#fff" stroke="#3b82f6" strokeWidth="2" />
      <text x="360" y="144" fontSize="12" fill="#3b82f6" textAnchor="middle" fontWeight="bold">2</text>

      {/* ノード 3 */}
      <circle cx="520" cy="140" r="18" fill="#fff" stroke="#EF4444" strokeWidth="2" />
      <text x="520" y="144" fontSize="12" fill="#EF4444" textAnchor="middle" fontWeight="bold">3</text>

      {/* ノード 4 */}
      <circle cx="360" cy="260" r="18" fill="#fff" stroke="#3b82f6" strokeWidth="2" />
      <text x="360" y="264" fontSize="12" fill="#3b82f6" textAnchor="middle" fontWeight="bold">4</text>

      {/* アクティビティ 1→2 (クリティカル) */}
      <line x1="218" y1="140" x2="342" y2="140" stroke="#EF4444" strokeWidth="2.5" />
      <polygon points="340,135 350,140 340,145" fill="#EF4444" />
      <text x="280" y="132" fontSize="9" fill="#333" textAnchor="middle">基礎工事</text>
      <text x="280" y="155" fontSize="8" fill="#666" textAnchor="middle">5日</text>

      {/* アクティビティ 2→3 (クリティカル) */}
      <line x1="378" y1="140" x2="502" y2="140" stroke="#EF4444" strokeWidth="2.5" />
      <polygon points="500,135 510,140 500,145" fill="#EF4444" />
      <text x="440" y="132" fontSize="9" fill="#333" textAnchor="middle">鉄筋工事</text>
      <text x="440" y="155" fontSize="8" fill="#666" textAnchor="middle">3日</text>

      {/* アクティビティ 1→4 */}
      <line x1="212" y1="155" x2="345" y2="250" stroke="#3b82f6" strokeWidth="2" />
      <polygon points="340,245 350,252 342,255" fill="#3b82f6" />
      <text x="260" y="210" fontSize="9" fill="#333">型枠工事</text>
      <text x="260" y="222" fontSize="8" fill="#666">4日</text>

      {/* ダミー 4→2 */}
      <line x1="372" y1="245" x2="365" y2="158" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6,3" />
      <polygon points="362,162 368,152 370,163" fill="#94a3b8" />

      {/* キャンバスラベル */}
      <text x="380" y="490" fontSize="10" fontWeight="bold" fill="#94a3b8" textAnchor="middle">キャンバス（ネットワーク工程表）</text>

      {/* プロパティパネル */}
      <rect x="620" y="50" width="200" height="470" fill="#f8fafc" stroke="#cbd5e1" />
      <text x="640" y="75" fontSize="11" fill="#1e293b" fontWeight="bold">アクティビティ</text>
      <line x1="620" y1="85" x2="820" y2="85" stroke="#e2e8f0" />
      <text x="640" y="105" fontSize="9" fill="#64748b">作業名</text>
      <rect x="640" y="110" width="160" height="22" rx="3" fill="#fff" stroke="#cbd5e1" />
      <text x="648" y="126" fontSize="9" fill="#1e293b">基礎工事</text>
      <text x="640" y="155" fontSize="9" fill="#64748b">所要日数</text>
      <rect x="640" y="160" width="80" height="22" rx="3" fill="#fff" stroke="#cbd5e1" />
      <text x="648" y="176" fontSize="9" fill="#1e293b">5</text>
      <line x1="620" y1="200" x2="820" y2="200" stroke="#e2e8f0" />
      <text x="640" y="220" fontSize="10" fill="#1e293b" fontWeight="bold">CPM結果</text>
      <text x="640" y="240" fontSize="9" fill="#64748b">ES: 0  EF: 5</text>
      <text x="640" y="256" fontSize="9" fill="#64748b">LS: 0  LF: 5</text>
      <text x="640" y="272" fontSize="9" fill="#64748b">TF: 0  FF: 0</text>
      <text x="640" y="290" fontSize="9" fill="#EF4444" fontWeight="bold">クリティカルパス</text>
      <text x="720" y="490" fontSize="9" fontWeight="bold" fill="#94a3b8" textAnchor="middle">プロパティパネル</text>

      {/* 朱書き（注釈） */}
      {showAnnotations && (
        <>
          {/* ツールバー注釈 */}
          <line x1="268" y1="55" x2="268" y2="38" stroke="#EF4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />
          <rect x="190" y="55" width="160" height="18" rx="3" fill="#FEE2E2" stroke="#EF4444" strokeWidth="0.5" />
          <text x="270" y="67" fontSize="9" fill="#EF4444" textAnchor="middle" fontWeight="bold">編集モードを切り替え</text>

          {/* ビュー切替注釈 */}
          <line x1="640" y1="55" x2="640" y2="38" stroke="#EF4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />
          <rect x="580" y="55" width="130" height="18" rx="3" fill="#FEE2E2" stroke="#EF4444" strokeWidth="0.5" />
          <text x="645" y="67" fontSize="9" fill="#EF4444" textAnchor="middle" fontWeight="bold">ガント表示に切替可能</text>

          {/* クリティカルパス注釈 */}
          <rect x="320" y="95" width="180" height="18" rx="3" fill="#FEE2E2" stroke="#EF4444" strokeWidth="0.5" />
          <text x="410" y="107" fontSize="9" fill="#EF4444" textAnchor="middle" fontWeight="bold">赤い矢印 = クリティカルパス</text>
          <line x1="410" y1="113" x2="410" y2="128" stroke="#EF4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />

          {/* ダミー注釈 */}
          <rect x="380" y="300" width="130" height="18" rx="3" fill="#FEE2E2" stroke="#EF4444" strokeWidth="0.5" />
          <text x="445" y="312" fontSize="9" fill="#EF4444" textAnchor="middle" fontWeight="bold">点線 = ダミー（0日）</text>
          <line x1="380" y1="300" x2="370" y2="265" stroke="#EF4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />

          {/* プロパティ注釈 */}
          <rect x="640" y="300" width="160" height="18" rx="3" fill="#FEE2E2" stroke="#EF4444" strokeWidth="0.5" />
          <text x="720" y="312" fontSize="9" fill="#EF4444" textAnchor="middle" fontWeight="bold">選択した要素の詳細を表示</text>
        </>
      )}
    </svg>
  );
}
