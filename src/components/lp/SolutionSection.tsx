import { useState } from 'react';
import { Check, CircleAlert, Zap, ArrowDown } from 'lucide-react';
import { SOLUTION } from '../../data/lpContent';
import SectionContainer from './shared/SectionContainer';

const videoMap: Record<string, string> = {
  simple: 'simple',
  network: 'network',
  bugakari: 'bugakari',
  bim: 'ifc',
};

export default function SolutionSection() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = SOLUTION.tabs[activeTab];

  return (
    <SectionContainer bgColor="gray">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-3">{SOLUTION.title}</h2>
      <p className="text-center text-slate-500 mb-14">{SOLUTION.subtitle}</p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {SOLUTION.tabs.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(i)}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors ${
              i === activeTab
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl shadow-md p-8">
        {/* タイトル（desc） */}
        <p className="text-xl font-bold text-slate-800 mb-1">{tab.desc}</p>
        {'note' in tab && tab.note && (
          <p className="text-xs text-slate-400 mb-6">{tab.note}</p>
        )}
        {!('note' in tab && tab.note) && <div className="mb-5" />}

        <div className="grid md:grid-cols-[280px_1fr] gap-6">
          {/* Left: 課題 → 解決 → ポイント */}
          <div className="space-y-2">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CircleAlert size={15} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">課題</span>
              </div>
              <p className="text-base font-bold text-slate-700">{tab.problem}</p>
            </div>
            <div className="pl-6">
              <ArrowDown size={18} className="text-slate-300" />
            </div>
            <div className="bg-primary-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap size={15} className="text-primary-500" />
                <span className="text-xs font-bold text-primary-500 uppercase tracking-wide">解決</span>
              </div>
              <p className="text-base font-bold text-primary-700">{tab.solution}</p>
            </div>
            <div className="pt-3">
              <h4 className="font-bold text-slate-800 mb-2">ポイント</h4>
              <ul className="space-y-2">
                {tab.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <Check size={18} className="text-primary-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-600 inline-flex items-center gap-1.5 flex-wrap">
                      {point.split(/(\{mouse\}|\{leftmouse\}|\{ctrl\}|\{space\})/).map((part, i) => {
                        if (part === '{mouse}') return <img key={i} src="/mouse-right-click.svg" alt="右クリック" className="inline h-7 w-auto" />;
                        if (part === '{leftmouse}') return <img key={i} src="/mouse-left-click.svg" alt="左クリック" className="inline h-7 w-auto" />;
                        if (part === '{ctrl}') return <img key={i} src="/ctrl-key.svg" alt="Ctrl" className="inline h-7 w-auto" />;
                        if (part === '{space}') return <img key={i} src="/space-key.svg" alt="Space" className="inline h-7 w-auto" />;
                        return part;
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: デモ動画 */}
          <div className="bg-slate-900 rounded-xl overflow-hidden aspect-[16/10]">
            <video
              key={tab.id}
              className="w-full h-full object-contain"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src={`/lp/${videoMap[tab.id] ?? 'overview'}.mp4`} type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </SectionContainer>
  );
}
