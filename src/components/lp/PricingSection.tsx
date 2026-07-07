import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PRICING } from '../../data/lpContent';
import SectionContainer from './shared/SectionContainer';

export default function PricingSection() {
  const { free, paid } = PRICING;
  return (
    <SectionContainer id="pricing" bgColor="gray">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-3">{PRICING.title}</h2>
      <p className="text-center text-slate-500 mb-14">{PRICING.subtitle}</p>
      <div className="max-w-3xl mx-auto">
        {/* 無料プラン */}
        <div className="relative bg-white rounded-2xl shadow-lg ring-2 ring-primary-600 p-8 flex flex-col">
          <div className="mb-6 text-center">
            <div className="text-4xl font-black text-slate-800">{free.name}</div>
            <p className="text-sm text-slate-500 mt-3 leading-relaxed">{free.desc}</p>
          </div>
          <ul className="space-y-3 mb-6 grid sm:grid-cols-2 gap-x-6">
            {free.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check size={18} className="text-primary-600 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-600">{f}</span>
              </li>
            ))}
          </ul>
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <p className="text-xs text-slate-500 leading-relaxed">{free.note}</p>
          </div>
          <Link
            to={free.ctaLink}
            className="block text-center rounded-xl px-4 py-3 text-base font-bold bg-primary-600 text-white hover:bg-primary-700 shadow-lg transition-all duration-300"
          >
            {free.cta}
          </Link>
        </div>

        {/* システム連携（有償） */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 text-center">
          <h3 className="text-lg font-bold text-slate-800 mb-2">{paid.title}</h3>
          <p className="text-sm text-slate-500 mb-4 leading-relaxed">{paid.desc}</p>
          <div className="flex items-center justify-center gap-4">
            <a
              href={paid.ctaLink}
              className="inline-block rounded-xl px-6 py-2.5 text-sm font-bold border-2 border-primary-600 text-primary-600 hover:bg-primary-50 transition-colors"
            >
              {paid.cta}
            </a>
            <Link to="/api-docs" className="text-sm text-slate-500 underline hover:text-slate-700">
              APIドキュメント
            </Link>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
