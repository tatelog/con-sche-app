import LPHeader from '@/components/lp/LPHeader';
import LPFooter from '@/components/lp/LPFooter';

const LAST_UPDATED = '2026年7月2日';

const sections = [
  {
    title: '1. 基本方針',
    body: `株式会社建ログ（以下「当社」）は、Con-Sche（以下「本サービス」）の提供にあたり、個人情報の保護に関する法令を遵守し、利用者の個人情報を適切に取り扱います。`,
  },
  {
    title: '2. 取得する情報',
    body: `当社は、本サービスの利用者登録時に以下の情報を取得します。
・氏名
・会社名
・メールアドレス
・登録時のIPアドレス（不正登録防止のため）

また、サービス改善のため、Google Analyticsによるアクセス解析を行っています（Cookieを使用した匿名の利用状況データ）。`,
  },
  {
    title: '3. 工程表データについて',
    body: `ユーザーが本サービス上で作成する工程表データ・歩掛マスタ・IFCファイル等のコンテンツは、ユーザーの端末内（ブラウザのローカルストレージ）およびユーザーが書き出したローカルファイルにのみ保存されます。当社のサーバーに送信・保存されることはありません。`,
  },
  {
    title: '4. 利用目的',
    body: `取得した情報は、以下の目的で利用します。
1. 本サービスの利用状況の把握
2. 本サービスに関する重要なお知らせの連絡
3. APIコードの発行および将来の連携サービス提供時の本人確認
4. 本サービスおよび当社サービスのご案内
5. 不正利用の防止`,
  },
  {
    title: '5. 第三者提供',
    body: `当社は、法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供しません。`,
  },
  {
    title: '6. 外部サービスの利用（国外への保存）',
    body: `登録情報の保存には、Cloudflare, Inc.（米国）のクラウドサービスを利用しています。データは暗号化して保存され、同社のデータセンター（国外を含む）で管理されます。当社は、個人情報保護法の定めに従い、適切な安全管理措置を講じている事業者を選定しています。`,
  },
  {
    title: '7. 安全管理措置',
    body: `当社は、取得した情報への不正アクセス、漏えい、滅失または毀損を防止するため、以下の措置を講じます。
・通信の暗号化（TLS）
・保存データの暗号化
・アクセス権限の最小化（読み出し用の公開エンドポイントを設けない設計）`,
  },
  {
    title: '8. 開示・訂正・削除の請求',
    body: `利用者は、当社が保有する自己の個人情報について、開示・訂正・削除を請求できます。ご希望の場合は、下記の窓口までご連絡ください。合理的な期間内に対応します。`,
  },
  {
    title: '9. お問い合わせ窓口',
    body: `個人情報の取扱いに関するお問い合わせは、以下までご連絡ください。
株式会社建ログ
メールアドレス: con-sche@tatelog.biz`,
  },
  {
    title: '10. 改定',
    body: `本ポリシーの内容は、法令の改正またはサービス内容の変更に応じて改定することがあります。改定後の内容は本ページに掲示した時点から効力を生じます。`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <LPHeader />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-black text-slate-800 mb-2">プライバシーポリシー</h1>
        <p className="text-sm text-slate-400 mb-10">最終更新日: {LAST_UPDATED}</p>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-slate-800 mb-3">{section.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{section.body}</p>
            </section>
          ))}
        </div>
      </main>

      <LPFooter />
    </div>
  );
}
