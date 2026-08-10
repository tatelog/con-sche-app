import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { APP_URL } from '../../data/lpContent';
import { useLP } from '../../i18n';
import CTAButton from './shared/CTAButton';
import LanguageToggle from './LanguageToggle';

export default function LPHeader() {
  const { NAV_LINKS, HERO } = useLP();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-black tracking-tight text-primary-800">
          <span className="flex flex-col leading-none">
            <span>Con-Sche</span>
            <span className="text-xs font-semibold tracking-widest text-primary-500">コンスケ</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <LanguageToggle />
          <CTAButton text={HERO.cta1} href={APP_URL.app} />
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-6 py-4 space-y-3">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-2 text-sm font-medium text-slate-600"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <LanguageToggle className="my-2" />
          <CTAButton text={HERO.cta1} href={APP_URL.app} />
        </div>
      )}
    </header>
  );
}
