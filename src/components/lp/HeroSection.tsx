import { HERO, APP_URL } from '../../data/lpContent';
import CTAButton from './shared/CTAButton';

export default function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-primary-50 to-white px-6 py-20 md:py-32">
      <div className="max-w-7xl mx-auto grid md:grid-cols-[2fr_3fr] gap-10 items-center">
        {/* Left: text */}
        <div>
          <h1 className="font-black text-slate-800 mb-6">
            <span className="text-2xl md:text-3xl lg:text-4xl">建設業のネットワーク</span><br />
            <span className="text-3xl md:text-5xl lg:text-6xl">工程表の決定版</span>
          </h1>
          <div className="text-base md:text-lg text-slate-500 leading-relaxed mb-10 space-y-1">
            <p>現場の経験×数字で工程に意味を持たせよう。</p>
            <p>「絵に描いた餅」で終わる工程表から卒業しよう。</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <CTAButton text={HERO.cta1} href={APP_URL.app} />
          </div>
        </div>

        {/* Right: アプリスクリーンショット */}
        <div className="relative">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
            {/* Windows風ブラウザクローム */}
            <div className="flex items-center px-3 py-2 bg-slate-100 border-b border-slate-200">
              {/* タブ */}
              <div className="flex items-center bg-white rounded-t-lg px-3 py-1.5 text-xs text-slate-600 font-medium border border-b-0 border-slate-200 mr-2">
                Con-Sche
                <span className="ml-2 text-slate-300 hover:text-slate-500 cursor-default">×</span>
              </div>
              <div className="flex-1" />
              {/* ウィンドウコントロール（最小化・最大化・閉じる） */}
              <div className="flex items-center gap-0">
                <div className="px-2 py-1 hover:bg-slate-200 text-slate-400 text-[10px] leading-none">─</div>
                <div className="px-2 py-1 hover:bg-slate-200 text-slate-400 text-[10px] leading-none">□</div>
                <div className="px-2 py-1 hover:bg-red-500 hover:text-white text-slate-400 text-[10px] leading-none">✕</div>
              </div>
            </div>
            {/* アドレスバー */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-slate-200">
              <div className="flex items-center gap-1 text-slate-300">
                <span className="text-xs">←</span>
                <span className="text-xs">→</span>
                <span className="text-xs ml-1">↻</span>
              </div>
              <div className="flex-1 bg-slate-100 rounded-full px-3 py-1 text-xs text-slate-500 flex items-center gap-1">
                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                con-sche.tatelog.biz
              </div>
            </div>
            <div className="aspect-video overflow-hidden">
              <img
                src="/lp/hero.png"
                alt="Con-Sche ネットワーク工程表の画面"
                className="w-full object-cover object-[center_35%]"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
