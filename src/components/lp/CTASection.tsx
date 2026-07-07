import { CTA_FINAL, APP_URL } from '../../data/lpContent';
import CTAButton from './shared/CTAButton';

export default function CTASection() {
  return (
    <section className="bg-gradient-to-r from-primary-600 to-primary-800 px-6 py-14">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-4">
          {CTA_FINAL.title}
        </h2>
        <p className="text-base text-primary-100 mb-8">{CTA_FINAL.subtitle}</p>
        <CTAButton text={CTA_FINAL.cta} href={APP_URL.app} variant="white" />
      </div>
    </section>
  );
}
