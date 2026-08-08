// LP English content
//
// 日本語（lpContent.ts）との差分だけを持つ。ここに無いキーは日本語のまま表示される。
// 全訳を待たずに公開できるよう、優先度の高いセクションから順に追加していく方針。
import type { LPContent } from '../i18n';

export const EN: Partial<LPContent> = {
  NAV_LINKS: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: 'https://tatelog.biz/contact/' },
  ],

  HERO: {
    title: 'Construction schedules that work on site',
    subtitle:
      'Arrow diagram scheduling with automatic critical path calculation. Built by someone who managed the sites.',
    cta1: 'Start free',
  },

  WORKFLOW: {
    title: 'How it works on site',
    steps: [
      {
        icon: 'Tablet' as const,
        title: 'Open it in a browser',
        desc: 'No installation. Works on tablets and phones as a PWA.',
      },
      {
        icon: 'Users' as const,
        title: 'Build the schedule from quantities',
        desc:
          'Durations are calculated from quantities and productivity rates, then adjusted through discussion with the crew.',
      },
      {
        icon: 'MousePointerClick' as const,
        title: 'Update from anywhere',
        desc: 'Simple controls mean changes take seconds, even from the field.',
      },
    ],
  },

  PRICING: {
    title: 'Pricing',
    subtitle: 'Con-Sche is free to use.',
    free: {
      name: 'Free',
      desc:
        'All features are available at no cost.\nYour schedule data is stored in your own browser and local files,\nand is never sent to our servers.',
      features: [
        'Create and edit arrow diagram (ADM) schedules',
        'Automatic critical path calculation',
        'Duration estimates from quantities and productivity rates',
        'Print / PDF / CSV export',
        'Local file save and load (.csa)',
        'Tablet and mobile support (PWA)',
      ],
      note: 'We ask for your name, company and work email address when you start using it.',
      cta: 'Start free',
      ctaLink: '/app',
    },
    paid: {
      title: 'For teams considering system integration',
      desc:
        'The integration API (CPM calculation and schedule file conversion) is available immediately\nwithin the monthly free tier, using the API code issued at sign-up.\nFor usage beyond the free tier, we offer individual agreements.',
      cta: 'Contact us',
      ctaLink: 'https://tatelog.biz/contact/',
    },
  },

  FOOTER: {
    links: [
      { label: 'Company', href: '/company' },
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'API Documentation', href: '/api-docs' },
      { label: 'User Manual', href: 'https://con-sche-docs.pages.dev' },
      { label: 'GitHub', href: 'https://github.com/tatelog/con-sche-app' },
    ],
  },
};
