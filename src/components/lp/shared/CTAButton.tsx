import { Link } from 'react-router-dom';

interface Props {
  text: string;
  href: string;
  variant?: 'primary' | 'secondary' | 'white';
  disabled?: boolean;
}

export default function CTAButton({ text, href, variant = 'primary', disabled = false }: Props) {
  const base = 'inline-flex items-center justify-center rounded-xl px-8 py-4 text-lg font-bold transition-all duration-300';

  if (disabled) {
    return <span className={`${base} bg-slate-200 text-slate-400 cursor-not-allowed`}>{text}</span>;
  }

  const styles =
    variant === 'primary'
      ? `${base} bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl cta-pulse`
      : variant === 'white'
        ? `${base} bg-white text-primary-700 hover:bg-primary-50 shadow-lg hover:shadow-xl`
        : `${base} border-2 border-primary-600 text-primary-600 hover:bg-primary-50`;

  if (href.startsWith('/')) {
    return <Link to={href} className={styles}>{text}</Link>;
  }
  return <a href={href} className={styles}>{text}</a>;
}
