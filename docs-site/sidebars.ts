import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  manualSidebar: [
    'intro',
    {
      type: 'category',
      label: 'はじめに',
      items: [
        'getting-started/registration',
        'getting-started/first-project',
        'getting-started/basic-operations',
      ],
    },
    {
      type: 'category',
      label: 'ネットワーク工程表',
      items: [
        'network-schedule/create-schedule',
        'network-schedule/add-activities',
        'network-schedule/dependencies',
        'network-schedule/critical-path',
        'network-schedule/edit-schedule',
        'network-schedule/calendar',
        'network-schedule/export',
      ],
    },
    {
      type: 'category',
      label: '分析・表示',
      items: [
        'advanced/progress-curve',
      ],
    },
    'faq',
  ],
};

export default sidebars;
