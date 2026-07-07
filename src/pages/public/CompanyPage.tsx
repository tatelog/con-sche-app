import LPHeader from '@/components/lp/LPHeader';
import LPFooter from '@/components/lp/LPFooter';

const TH = 'py-3 pr-6 text-left text-sm font-bold text-slate-600 align-top w-40 whitespace-nowrap';
const TD = 'py-3 text-sm text-slate-600 leading-relaxed whitespace-pre-line';

export default function CompanyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <LPHeader />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-black text-slate-800 mb-2">運営会社</h1>
        <p className="text-sm text-slate-400 mb-10">
          Con-Sche は建ログ株式会社が運営する無料のネットワーク工程表アプリケーションです。
          外部システムとのAPI連携・組み込み利用（OEM）のご相談は個別契約にて承ります。
        </p>

        <table className="w-full">
          <tbody className="divide-y divide-slate-200">
            {[
              ['会社名', '株式会社建ログ'],
              ['代表者氏名', '石川豊'],
              ['所在地', '〒674-0058 兵庫県明石市東朝霧丘23-24-2'],
              ['メールアドレス', 'con-sche@tatelog.biz'],
              ['事業内容', '建設業向けAI活用・データ活用支援、業務アプリケーションの開発・提供'],
              ['サービス利用料', '無料（外部システムとのAPI連携・組み込み利用は個別契約）'],
            ].map(([label, value]) => (
              <tr key={label}>
                <th className={TH}>{label}</th>
                <td className={TD}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      <LPFooter />
    </div>
  );
}
