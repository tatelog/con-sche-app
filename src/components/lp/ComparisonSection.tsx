import { ArrowRight } from 'lucide-react';
import { COMPARISON, APP_URL } from '../../data/lpContent';
import SectionContainer from './shared/SectionContainer';
import CTAButton from './shared/CTAButton';

export default function ComparisonSection() {
  return (
    <SectionContainer bgColor="gray">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-14">{COMPARISON.title}</h2>
      <div className="overflow-x-auto mb-10">
        <table className="w-full bg-white rounded-2xl shadow-md overflow-hidden">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-6 py-4 text-left text-sm font-bold text-slate-500">項目</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-red-400">従来のやり方</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-primary-600">Con-Sche</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.rows.map((row) => (
              <tr key={row.category} className="border-b border-slate-100 last:border-0">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800 text-sm">{row.category}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-500">{row.before}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-primary-600 flex items-center gap-2">
                    <ArrowRight size={14} className="shrink-0" />
                    {row.after}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{row.example}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-center">
        <CTAButton text="無料で使う" href={APP_URL.app} />
      </div>
    </SectionContainer>
  );
}
