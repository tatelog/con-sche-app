import LPHeader from '@/components/lp/LPHeader';
import LPFooter from '@/components/lp/LPFooter';

/**
 * プライバシーポリシーは運営会社（株式会社建ログ）のサイトに一本化した。
 * 個人情報を預かっているのはサービスではなく会社なので、住所・代表者・取得項目を
 * サービスごとに持つと、変わったときに全箇所を追うことになる。
 *
 * 既存のリンクやブックマーク、検索結果から /privacy に来る人がいるため、
 * ルート自体は残し、このページから会社サイトへ案内する。
 */
const COMPANY_PRIVACY_URL = 'https://tatelog.biz/privacy/';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <LPHeader />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-black text-slate-800 mb-2">プライバシーポリシー</h1>
        <p className="text-sm text-slate-400 mb-10">
          Con-Sche のプライバシーポリシーは、運営会社である株式会社建ログのサイトに掲載しています。
        </p>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            個人情報をお預かりしているのは本サービスではなく株式会社建ログのため、
            プライバシーポリシーは会社サイトに一本化しました。
            Con-Sche でお預かりする情報の取得項目・利用目的についても、
            下記のページに記載しています。
          </p>

          <a
            href={COMPANY_PRIVACY_URL}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors"
          >
            プライバシーポリシーを見る
          </a>
        </div>
      </main>

      <LPFooter />
    </div>
  );
}
