import { Tablet, MousePointerClick, Users, ArrowRight } from 'lucide-react';
import { WORKFLOW } from '../../data/lpContent';
import SectionContainer from './shared/SectionContainer';

const iconMap = { Tablet, MousePointerClick, Users } as const;

export default function WorkflowSection() {
  return (
    <SectionContainer bgColor="white">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-14">{WORKFLOW.title}</h2>
      <div className="flex flex-col md:flex-row items-start justify-center gap-6 md:gap-4">
        {WORKFLOW.steps.map((step, i) => {
          const Icon = iconMap[step.icon];
          return (
            <div key={step.title} className="flex items-start gap-4">
              <div className="text-center max-w-[240px]">
                <div className="h-16 w-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon size={32} className="text-primary-600" />
                </div>
                <div className="text-xs font-bold text-primary-600 mb-1">STEP {i + 1}</div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
              {i < WORKFLOW.steps.length - 1 && (
                <ArrowRight size={24} className="text-slate-300 hidden md:block shrink-0 mt-[5.5rem]" />
              )}
            </div>
          );
        })}
      </div>
    </SectionContainer>
  );
}
