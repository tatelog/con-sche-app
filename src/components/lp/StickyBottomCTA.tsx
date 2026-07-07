import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { APP_URL } from '../../data/lpContent';

export default function StickyBottomCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const bottomReached = scrollY + window.innerHeight >= document.documentElement.scrollHeight - 200;
      setVisible(scrollY > 600 && !bottomReached);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="text-white text-sm">
            <span className="font-bold">Con-Scheは無料でご利用いただけます</span>
          </div>
          <Link
            to={APP_URL.app}
            className="shrink-0 px-6 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-lg"
          >
            無料で使う
          </Link>
        </div>
      </div>
    </div>
  );
}
