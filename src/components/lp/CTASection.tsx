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
        <div className="flex flex-wrap justify-center gap-4">
          <CTAButton text={CTA_FINAL.cta} href={APP_URL.app} variant="white" />
          <a
            href={APP_URL.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl px-8 py-4 text-lg font-bold border-2 border-white text-white hover:bg-white/10 transition-all duration-300"
          >
            操作説明
          </a>
        </div>
      </div>
    </section>
  );
}
