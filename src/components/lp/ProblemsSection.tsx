import { ImageOff, Unlink, GitBranchPlus, HelpCircle, MessageCircle } from 'lucide-react';
import { PROBLEMS } from '../../data/lpContent';
import SectionContainer from './shared/SectionContainer';

const iconMap = { ImageOff, Unlink, GitBranchPlus, HelpCircle } as const;

export default function ProblemsSection() {
  return (
    <SectionContainer bgColor="gray">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-14">{PROBLEMS.title}</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {PROBLEMS.items.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <div key={item.title} className="bg-white p-6 rounded-2xl shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                  <Icon size={22} className="text-primary-600" strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {item.title.split(/\{(.+?)\}/).map((part, i) =>
                    i % 2 === 1
                      ? <span key={i} className="text-primary-600 underline decoration-2 underline-offset-4">{part}</span>
                      : part
                  )}
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">{item.desc}</p>
              <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
                <MessageCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-500 italic leading-relaxed">{item.quote}</p>
              </div>
            </div>
          );
        })}
      </div>
    </SectionContainer>
  );
}
