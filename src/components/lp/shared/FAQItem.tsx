import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  question: string;
  answer: string;
}

export default function FAQItem({ question, answer }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-lg font-bold text-slate-800">{question}</span>
        <ChevronDown
          size={20}
          className={`text-slate-400 shrink-0 ml-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-slate-600 leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}
