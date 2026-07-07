import {
  Tablet, Calculator, Network, Blocks,
  Database, Route, LayoutDashboard, ClipboardCheck,
} from 'lucide-react';
import { FEATURES } from '../../data/lpContent';
import SectionContainer from './shared/SectionContainer';

const iconMap = { Tablet, Calculator, Network, Blocks, Database, Route, LayoutDashboard, ClipboardCheck } as const;

export default function FeaturesSection() {
  return (
    <SectionContainer id="features" bgColor="white">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-14">{FEATURES.title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURES.items.map((item) => {
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
              {'note' in item && item.note && (
                <p className={`text-xs font-medium ${item.note.startsWith('*') || item.note.startsWith('※') ? 'text-slate-400' : 'text-primary-600'}`}>{item.note}</p>
              )}
            </div>
          );
        })}
      </div>
    </SectionContainer>
  );
}
