/**
 * 連携API（v1）の公開ドキュメント。
 * ベースURLはビルド時の VITE_API_BASE を表示に使うため、環境と記載が乖離しない。
 * エンドポイント仕様の正本は workers/api/src/v1.ts。変更時は両方更新すること。
 */

import { Link } from 'react-router-dom';
import LPHeader from '@/components/lp/LPHeader';
import LPFooter from '@/components/lp/LPFooter';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || 'https://（APIサーバーURL）';

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-slate-800 text-slate-100 rounded-lg p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <LPHeader />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-black text-slate-800 mb-2">連携API ドキュメント</h1>
        <p className="text-sm text-slate-400 mb-10">
          外部システムやAIエージェントから、CPM計算・工程ファイル変換を呼び出せます。
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-2">認証</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              利用者登録時に発行されるAPIコード（<code className="bg-slate-100 px-1 rounded">cs_live_...</code>）を
              Authorizationヘッダーに指定します。
            </p>
            <Code>{`Authorization: Bearer cs_live_xxxxxxxx...`}</Code>
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mt-3 text-xs text-amber-800 leading-relaxed">
              <span className="font-bold">APIコードは登録完了画面に1回だけ表示され、再発行できません。</span>
              紛失した場合は<a href="/#contact" className="underline">お問い合わせ</a>ください。
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-2">ベースURL</h2>
            <Code>{API_BASE}</Code>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-2">無料枠と消費ポイント</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              無料枠は<span className="font-bold">月90ポイント</span>です。読み取り系（計算・変換）は1リクエスト2pt、
              リクエストが成功した場合のみ消費されます。超過すると429が返ります。
              現在の消費量はレスポンスヘッダー <code className="bg-slate-100 px-1 rounded">X-ConSche-Usage</code> と
              利用量照会APIで確認できます。無料枠を超える利用は個別契約にて承ります（
              <a href="/#contact" className="underline text-primary-600">お問い合わせ</a>）。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-2">POST /api/v1/cpm — CPM計算（2pt）</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              結合点（nodes）と作業（activities）からクリティカルパス・フロート・全体工期を計算します。
              calendar を指定すると稼働日ベースの日付（開始日・終了日）も返します。
            </p>
            <Code>{`curl -X POST ${API_BASE}/api/v1/cpm \\
  -H "Authorization: Bearer cs_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "nodes": [{"id":"n1"},{"id":"n2"},{"id":"n3"}],
    "activities": [
      {"id":"a1","name":"掘削","fromNodeId":"n1","toNodeId":"n2","duration":5},
      {"id":"a2","name":"躯体","fromNodeId":"n2","toNodeId":"n3","duration":10}
    ],
    "calendar": {"startDate":"2026-08-01","workDays":[1,2,3,4,5]}
  }'

# → 200 { projectDuration, projectEndDate, criticalPath,
#          nodes: [{ earliestTime, latestTime, slack, ... }],
#          activities: [{ es, ef, ls, lf, totalFloat, isCritical, startDate, endDate, ... }] }`}</Code>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-2">POST /api/v1/convert — ファイル変換（2pt）</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              双方向の変換です。JSONを送るとエディタで開ける .csa ファイル（ZIP）が返り、
              .csaファイルをバイナリで送ると工程JSONが返ります。Content-Typeで判別します。
            </p>
            <Code>{`# 工程JSON → .csaファイル
curl -X POST ${API_BASE}/api/v1/convert \\
  -H "Authorization: Bearer cs_live_xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "name":"新築A工区", "nodes":[...], "activities":[...] }' \\
  -o schedule.csa

# .csaファイル → 工程JSON
curl -X POST ${API_BASE}/api/v1/convert \\
  -H "Authorization: Bearer cs_live_xxxx" \\
  -H "Content-Type: application/zip" \\
  --data-binary @schedule.csa`}</Code>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-2">GET /api/v1/usage — 利用量照会（0pt）</h2>
            <Code>{`curl ${API_BASE}/api/v1/usage \\
  -H "Authorization: Bearer cs_live_xxxx"

# → 200 { month: "2026-07", usedPoints: 12, limitPoints: 90 }`}</Code>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-700 mb-2">エラー</h2>
            <ul className="text-sm text-slate-600 leading-relaxed list-disc pl-5 space-y-1">
              <li><span className="font-mono">401</span> — APIコード未指定・無効</li>
              <li><span className="font-mono">400 / 422</span> — 入力不正（エラーメッセージに理由を返します）</li>
              <li><span className="font-mono">429</span> — 月間無料枠の超過</li>
            </ul>
            <p className="text-sm text-slate-500 leading-relaxed mt-3">
              APIの利用はすべてリクエストログに記録されます。詳細は
              <Link to="/terms" className="underline">利用規約</Link>・
              <Link to="/privacy" className="underline">プライバシーポリシー</Link>をご覧ください。
            </p>
          </section>
        </div>
      </main>

      <LPFooter />
    </div>
  );
}
