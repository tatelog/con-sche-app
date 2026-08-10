// LP English content
//
// 日本語（lpContent.ts）との差分だけを持つ。ここに無いキーは日本語のまま表示される。
// 全訳を待たずに公開できるよう、優先度の高いセクションから順に追加していく方針。
import type { LPContent } from '../i18n';

export const EN: Partial<LPContent> = {
  NAV_LINKS: [
    { label: 'Features', href: '#features' },
    { label: 'AI integration', href: '#ai-integration' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: 'https://tatelog.biz/contact/' },
  ],

  HERO: {
    title: 'Construction schedules that work on site',
    subtitle:
      'Arrow diagram scheduling with automatic critical path calculation. Built by someone who managed the sites.',
    cta1: 'Start free',
    headlineTop: 'Arrow diagram scheduling',
    headlineMain: 'for construction',
    tagline: 'Con-Sche — short for Construction Schedule',
    leadLines: [
      'Give your schedule meaning, with site experience and real numbers.',
      'No more schedules that stay on the wall.',
    ],
    cta2: 'How to use',
  },

  META: {
    title: 'Con-Sche | Free arrow diagram scheduling for construction',
    description:
      'A web app for construction schedules in arrow diagram (ADM) form. Durations from quantities and productivity rates, automatic critical path, AI integration over MCP and REST API. Free to use.',
    ogTitle: 'Con-Sche | Arrow diagram scheduling AI can operate',
    ogDescription:
      'Automatic critical path, durations backed by quantities, and a schedule that AI agents can read and edit directly through WebMCP. Free to use.',
  },

  COMMON: {
    ctaPrimary: 'Start free',
    ctaDocs: 'How to use',
    ctaApiDocs: 'API docs',
    stickyNote: 'Con-Sche is free to use',
    comparisonHeadCategory: 'Aspect',
    comparisonHeadBefore: 'Conventional approach',
    solutionProblemLabel: 'Problem',
    solutionSolutionLabel: 'Solution',
    solutionPointsLabel: 'Key points',
    stickyNoteReturning: 'Welcome back. Pick up where you left off',
    ctaOpenApp: 'Open the app',
  },

  PROBLEMS: {
    title: 'Why construction schedules stop working',
    items: [
      {
        icon: 'ImageOff' as const,
        title: 'The schedule {never reaches the site}',
        desc:
          'A schedule that only opens on the office PC never makes it to the field. You want to check it on a tablet — honestly, on a phone too.',
        quote:
          'You call the office and ask them to email the schedule. The PDF arrives too small to read. Same thing, every week.',
      },
      {
        icon: 'Unlink' as const,
        title: 'How many days will {this zone take?}',
        desc:
          'Are you planning without knowing the quantities? A schedule should let you have a grounded conversation about durations.',
        quote:
          '"Why five days?" "The last zone took about that long." "We want to finish before the holidays." Nobody actually believes the number.',
      },
      {
        icon: 'GitBranchPlus' as const,
        title: 'The {critical path} is invisible',
        desc:
          'The exterior wall slipped two days. When can interior work start? Does the completion date move? A bar chart will not tell you.',
        quote:
          'Your manager asks what happens if steel erection runs three days late. You stare at the chart and have no answer.',
      },
      {
        icon: 'Bot' as const,
        title: 'AI {cannot read your schedule}',
        desc:
          'You use generative AI every day, yet the schedule sits inside a PDF or spreadsheet. There is no way to hand it over, so you end up pasting screenshots and explaining.',
        quote:
          '"Can we get AI to sort this schedule out?" All you can do is take a screenshot and paste it in.',
      },
    ],
  },

  PHILOSOPHY: {
    title: 'What Con-Sche stands for',
    subtitle: 'Three beliefs, shaped by years of running construction sites.',
    items: [
      {
        icon: 'Users' as const,
        title: 'What matters is {what was agreed on site}',
        desc:
          'Automatic calculation is only an aid. The right duration is the one you settle on after walking the site and talking with the crew. Con-Sche makes switching to manual entry effortless, so the tool supports the conversation rather than replacing it.',
        emphasis: 'Buildings are built through dialogue with the people doing the work.',
      },
      {
        icon: 'ClipboardList' as const,
        title: 'Plan with {productivity rates in mind}',
        desc:
          'Build the schedule from quantities, productivity rates and labour, and cost management follows naturally. Record the knowledge your team has accumulated as numbers, and the schedule becomes an asset rather than a document.',
        emphasis:
          'Note: published national standard rates cover only a small part of actual construction work.',
      },
      {
        icon: 'Network' as const,
        title: 'See what an {arrow diagram really does}',
        desc:
          'Until now, when one activity slipped, you moved every downstream bar by hand. Con-Sche recalculates dependencies and moves related activities together, and highlights the critical path so the activities that need attention are obvious.',
        emphasis: 'It makes visible the connections a bar chart hides.',
      },
    ],
  },

  AI_INTEGRATION: {
    title: 'AI can operate the schedule directly.',
    lead:
      'Rather than exporting data for AI to read, AI operates Con-Sche itself. ' +
      'Ask "what is scheduled for next week" or "what follows this activity", and the AI reads the schedule and answers.',
    items: [
      {
        icon: 'Bot' as const,
        title: 'Your browser AI operates it as-is',
        desc:
          'With Con-Sche open, an in-browser AI agent can read and edit the schedule. ' +
          'WebMCP (document.modelContext) is supported — no setup, no installation.',
        note: 'Tools: read schedule / query activities by date / search activities',
      },
      {
        icon: 'Plug' as const,
        title: 'Use it from ChatGPT and Claude',
        desc:
          'The API code issued at sign-up lets external AI and systems work with your schedule data. ' +
          'Critical path calculation and schedule file conversion are available as API calls.',
        note: 'OpenAPI 3.1 specification published',
      },
      {
        icon: 'ShieldCheck' as const,
        title: 'Schedule data stays with you',
        desc:
          'Operations completed in the browser never send schedule data to our servers, ' +
          'so confidential project information stays where it belongs.',
        note: 'Only the integration API transmits the data it needs',
      },
    ],
    apiSample: {
      label: 'Integration API',
      endpoints: [
        { method: 'POST', path: '/api/v1/cpm', desc: 'Calculate critical path and float' },
        { method: 'POST', path: '/api/v1/convert', desc: 'Convert between schedule JSON and .csa' },
        { method: 'GET', path: '/api/v1/usage', desc: 'Check this month’s usage' },
      ],
      note: 'Free tier: 90 points per month (about 45 read calls)',
    },
    cta: { label: 'Read the AI integration docs', href: '/api-docs' },
  },

  SOLUTION: {
    title: 'Before automating with AI, get the schedule right on the ground.',
    subtitle: 'Built by people who managed sites, so it stays out of your way.',
    tabs: [
      {
        id: 'simple',
        label: 'Simple controls',
        problem: 'Too complex to remember',
        solution: 'Three keys is all it takes',
        desc:
          'Left and right click, Ctrl and Space. Every operation in the schedule is covered by those alone.',
        points: [
          '{mouse} to select and draw',
          '{ctrl} + {mouse} for path selection and text entry',
          '{space} to switch progress lines and text orientation',
          'Then just draw with {leftmouse}.',
        ],
      },
      {
        id: 'network',
        label: 'Arrow diagram',
        problem: 'Dependencies are invisible',
        solution: 'Visualised automatically in ADM',
        desc:
          'Dependencies between activities are drawn as a network, and the critical path is calculated for you.',
        points: [
          'Intuitive node placement',
          'Automatic critical path calculation',
          'Float days made visible',
        ],
      },
      {
        id: 'bugakari',
        label: 'Rates × quantities',
        problem: 'Durations based on gut feel',
        solution: 'Calculated from quantities and rates',
        desc:
          'A productivity rate master is built in, so entering quantities gives you the duration required.*',
        note:
          '* Based on the Japanese Ministry of Land, Infrastructure, Transport and Tourism labour cost portal (as of February 2026).',
        points: [
          'National productivity rate database included',
          'Durations calculated from quantities',
          'Custom rates can be registered',
        ],
      },
    ],
  },

  FEATURES: {
    title: 'Everything the site actually asks for.',
    items: [
      {
        icon: 'Tablet' as const,
        title: 'Check from the site on a tablet',
        desc:
          'As a PWA, adding it to the home screen gives you an app-like experience. View and share the latest schedule from any tablet or phone on site.',
        note: 'Chrome / Edge / Safari supported, works offline',
      },
      {
        icon: 'Calculator' as const,
        title: 'Durations from rates × quantities',
        desc:
          'Enter quantities, productivity rates and labour, and the duration is calculated. You can still override it with the number you agreed with the crew.',
        note: 'Switch between automatic and manual mode per activity',
      },
      {
        icon: 'Network' as const,
        title: 'Arrow diagram schedule (ADM)',
        desc:
          'Activities connected by arrows and joined at nodes. Dependencies and the critical path are immediately clear.',
        note: 'Supports dummy activities, waypoints and float display',
      },
      {
        icon: 'Route' as const,
        title: 'Automatic critical path',
        desc:
          'The critical path is derived from dependencies and highlighted in red, so you can see which activities drive the completion date.',
        note: 'Float, earliest and latest start dates calculated automatically',
      },
      {
        icon: 'Database' as const,
        title: 'Built-in productivity rate master',
        desc:
          'Manage labour rates, material costs and equipment costs by trade, with correction factors per site.',
        note: 'Three-level categories, custom masters supported',
      },
      {
        icon: 'Blocks' as const,
        title: 'Let AI enter the quantities',
        desc:
          'Through MCP and the integration API, AI can write quantities and activities straight into the schedule. Have AI read your drawings or take-off sheets, then pass the result directly to Con-Sche.',
        note: 'WebMCP supported. Works with ChatGPT and Claude',
      },
      {
        icon: 'LayoutDashboard' as const,
        title: 'Cross-site dashboard*',
        desc:
          'Because schedules are structured data, you can see what work is planned across every site on a given day.',
        note: '* Additional development cost applies',
      },
      {
        icon: 'ClipboardCheck' as const,
        title: 'Daily report integration*',
        desc:
          'Connect external daily reports to track the gap between planned and actual crew numbers, and accumulate the results.',
        note: '* Additional development cost applies',
      },
    ],
  },

  COMPARISON: {
    title: 'How it differs from conventional scheduling',
    rows: [
      {
        category: 'Usability',
        before: 'Too many features to learn',
        after: 'Right click, Ctrl and Space',
        example: 'Build a schedule with three key operations',
      },
      {
        category: 'Duration',
        before: 'Experience and intuition',
        after: 'Calculated from rates × quantities',
        example: '"About three months" becomes "67 days, from the rates"',
      },
      {
        category: 'Dependencies',
        before: 'Invisible on a bar chart',
        after: 'Visualised as an arrow diagram',
        example: 'The knock-on effect of late rebar work is obvious',
      },
      {
        category: 'Critical path',
        before: 'Only in the veteran’s head',
        after: 'Calculated and highlighted in red',
        example: 'Even new staff can identify the critical path',
      },
      {
        category: 'Entering quantities',
        before: 'Retyped by hand',
        after: 'Written directly by AI over MCP',
        example: 'AI reads the drawing and writes the quantities into the schedule',
      },
      {
        category: 'On-site access',
        before: 'Back to the office to check',
        after: 'PWA on a tablet',
        example: 'Review the schedule on an iPad during a meeting',
      },
      {
        category: 'Basis of the data',
        before: '"On the last project..."',
        after: 'Based on a productivity rate database',
        example: 'Consistent quality regardless of who builds it',
      },
    ],
  },

  FAQ: {
    title: 'Frequently asked questions',
    items: [
      {
        q: 'What is an arrow diagram schedule?',
        a: 'The Arrow Diagram Method (ADM) expresses dependencies between activities as arrows. The critical path is calculated automatically, so you can see at a glance which activities drive the completion date. It is the method used on large public works projects in Japan.',
      },
      {
        q: 'Is it difficult to operate?',
        a: 'Right click, Ctrl and Space are all you need to build a schedule. There are no deep menus to learn.',
      },
      {
        q: 'Can I use it without productivity data?',
        a: 'Yes. You can enter durations directly without using the productivity rate master. Using rates gives you a better justified plan, but it is not required.',
      },
      {
        q: 'How do I enter quantities?',
        a: 'You can type them in, or have AI enter them for you through MCP or the integration API. Let AI read your drawings or take-off sheets and write the results straight into the schedule, so your durations keep their basis.',
      },
      {
        q: 'Does it work on tablets and phones?',
        a: 'Yes. It runs in the browser as a PWA, so you can add it to your home screen and use it like an app. Chrome, Edge and Safari are supported, and it works offline.',
      },
      {
        q: 'Where is my data stored?',
        a: 'Schedules are saved automatically in your browser (IndexedDB). You can also export a schedule as a file (.csa) and open it on another device. Schedule data is never sent to our servers.',
      },
      {
        q: 'Is it really free?',
        a: 'Yes. Every editor feature is free to use. We ask for your name, company and email address when you start. The integration API (CPM calculation and file conversion) is also free within the monthly quota. Usage beyond that quota is covered by an individual agreement.',
      },
      {
        q: 'Can I embed it in our own product (OEM)?',
        a: 'Yes. The source code is published on GitHub, and the Con-Sche License 1.0 permits embedding and redistribution with credit. Offering it as a managed service to third parties, or building an integration API platform on it, requires a separate agreement. See the LICENSE file in the repository for details.',
        link: { label: 'View the GitHub repository', href: 'https://github.com/tatelog/con-sche-app' },
      },
      {
        q: 'Was it built by people with site experience?',
        a: 'Yes. It is designed and built by people who have managed construction sites, with the aim of producing a schedule that actually works in the field and respects the judgement made there.',
      },
    ],
  },

  CTA_FINAL: {
    title: 'No more schedules that stay on the wall.',
    subtitle: 'See what an arrow diagram schedule can actually do.',
    cta: 'Start free',
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
