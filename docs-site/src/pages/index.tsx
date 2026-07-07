import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

function HomepageHeader() {
  return (
    <header
      style={{
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        padding: '4rem 0',
        textAlign: 'center',
        color: '#fff',
      }}>
      <div className="container">
        <Heading
          as="h1"
          style={{
            fontSize: '3rem',
            fontWeight: 900,
            letterSpacing: '-0.025em',
            marginBottom: '0.5rem',
          }}>
          Con-Sche マニュアル
        </Heading>
        <p style={{fontSize: '1.25rem', opacity: 0.9, marginBottom: '2rem'}}>
          建設業向けネットワーク工程表アプリの使い方ガイド
        </p>
        <Link
          className="button button--secondary button--lg"
          to="/docs/intro">
          マニュアルを読む
        </Link>
      </div>
    </header>
  );
}

const sections = [
  {
    title: 'はじめに',
    description: '利用者登録から最初の工程表作成、基本操作まで。',
    link: '/docs/getting-started/registration',
  },
  {
    title: 'ネットワーク工程表',
    description: 'アクティビティの追加、依存関係、クリティカルパス、カレンダー管理。',
    link: '/docs/network-schedule/create-schedule',
  },
  {
    title: '分析・表示',
    description: '進捗線（雷線）、進捗曲線（Sカーブ）による進捗管理。',
    link: '/docs/advanced/progress-curve',
  },
  {
    title: 'よくある質問',
    description: '登録、工程表データ、エクスポート、連携APIに関するFAQ。',
    link: '/docs/faq',
  },
];

export default function Home(): ReactNode {
  return (
    <Layout title="マニュアル" description="Con-Sche 建設業向けネットワーク工程表アプリのマニュアル">
      <HomepageHeader />
      <main>
        <section style={{padding: '4rem 0'}}>
          <div className="container">
            <div className="row">
              {sections.map((section, idx) => (
                <div key={idx} className="col col--4" style={{marginBottom: '2rem'}}>
                  <Link to={section.link} style={{textDecoration: 'none', color: 'inherit'}}>
                    <div style={{
                      padding: '1.5rem',
                      borderRadius: '8px',
                      border: '1px solid var(--ifm-color-emphasis-200)',
                      height: '100%',
                      transition: 'box-shadow 0.2s',
                    }}>
                      <Heading as="h3" style={{marginBottom: '0.5rem'}}>{section.title}</Heading>
                      <p style={{margin: 0, color: 'var(--ifm-color-emphasis-700)'}}>{section.description}</p>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
