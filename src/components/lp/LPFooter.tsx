import { Link } from 'react-router-dom';
import { FOOTER } from '../../data/lpContent';

export default function LPFooter() {
  return (
    <footer className="bg-slate-800 text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm text-slate-400">&copy; 2026 Con-Sche</span>
          <div className="flex flex-wrap items-center gap-6">
            {FOOTER.links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
