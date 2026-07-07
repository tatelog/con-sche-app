import { FAQ } from '../../data/lpContent';
import SectionContainer from './shared/SectionContainer';
import FAQItem from './shared/FAQItem';

export default function FAQSection() {
  return (
    <SectionContainer id="faq" bgColor="white">
      <h2 className="text-3xl font-black text-slate-800 text-center mb-14">{FAQ.title}</h2>
      <div className="max-w-3xl mx-auto">
        {FAQ.items.map((item) => (
          <FAQItem key={item.q} question={item.q} answer={item.a} link={'link' in item ? item.link : undefined} />
        ))}
      </div>
    </SectionContainer>
  );
}
