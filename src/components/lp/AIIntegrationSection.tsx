import { Bot, Plug, ShieldCheck, ArrowRight } from 'lucide-react';
import { AI_INTEGRATION } from '../../data/lpContent';
import SectionContainer from './shared/SectionContainer';

const iconMap = { Bot, Plug, ShieldCheck } as const;

const methodColor: Record<string, string> = {
  POST: 'bg-primary-600',
  GET: 'bg-slate-500',
};

export default function AIIntegrationSection() {
  const { title, lead, items, apiSample, cta } = AI_INTEGRATION;

  return (
    <SectionContainer id="ai-integration" bgColor="white">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-4">{title}</h2>
      <p className="text-slate-600 leading-relaxed text-center max-w-3xl mx-auto mb-14">{lead}</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {items.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <div
              key={item.title}
              className="bg-white p-6 rounded-2xl shadow-lg hover:-translate-y-1 transition-transform duration-300 border border-slate-100 flex flex-col"
            >
              <div className="h-12 w-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                <Icon size={24} className="text-primary-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-3 flex-1">{item.desc}</p>
              <p className="text-xs font-medium text-primary-600">{item.note}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-3xl mx-auto">
        <p className="text-sm font-black text-slate-700 mb-4">{apiSample.label}</p>
        <ul className="space-y-3 mb-4">
          {apiSample.endpoints.map((ep) => (
            <li key={ep.path} className="flex flex-wrap items-center gap-3">
              <span
                className={`${methodColor[ep.method] ?? 'bg-slate-500'} text-white text-xs font-bold px-2 py-1 rounded`}
              >
                {ep.method}
              </span>
              <code className="text-sm font-mono text-slate-800">{ep.path}</code>
              <span className="text-sm text-slate-600">{ep.desc}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400 mb-5">{apiSample.note}</p>
        <a
          href={cta.href}
          className="inline-flex items-center gap-2 text-primary-600 font-bold text-sm hover:gap-3 transition-all"
        >
          {cta.label}
          <ArrowRight size={16} />
        </a>
      </div>
    </SectionContainer>
  );
}
