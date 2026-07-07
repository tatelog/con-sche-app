import { Users, ClipboardList, Network } from 'lucide-react';
import { PHILOSOPHY } from '../../data/lpContent';
import SectionContainer from './shared/SectionContainer';

const iconMap = { Users, ClipboardList, Network } as const;

export default function PhilosophySection() {
  return (
    <SectionContainer bgColor="white">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-3">{PHILOSOPHY.title}</h2>
      <p className="text-center text-slate-500 mb-14">{PHILOSOPHY.subtitle}</p>
      <div className="grid md:grid-cols-3 gap-8">
        {PHILOSOPHY.items.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <div key={item.title} className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
              <div className="h-12 w-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                <Icon size={24} className="text-primary-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-3">
                {item.title.split(/\{(.+?)\}/).map((part, i) =>
                  i % 2 === 1
                    ? <span key={i} className="text-primary-600 underline decoration-2 underline-offset-4">{part}</span>
                    : part
                )}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">{item.desc}</p>
              <div className="border-l-4 border-primary-600 pl-4">
                <p className="text-sm font-bold text-primary-700 leading-relaxed">{item.emphasis}</p>
              </div>
            </div>
          );
        })}
      </div>
    </SectionContainer>
  );
}
