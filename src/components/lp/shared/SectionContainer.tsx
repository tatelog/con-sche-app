import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  id?: string;
  bgColor: 'white' | 'gray';
  children: ReactNode;
  className?: string;
}

export default function SectionContainer({ id, bgColor, children, className = '' }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('scroll-fade-in');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id={id}
      ref={ref}
      className={`py-20 px-6 ${bgColor === 'gray' ? 'bg-slate-50' : 'bg-white'} ${className}`}
    >
      <div className="max-w-7xl mx-auto">{children}</div>
    </section>
  );
}
