import { createBrowserRouter } from 'react-router-dom';
// チャンク取得失敗（旧SW×新デプロイの狭間）で白画面にせず自動リロードで自己回復させる
import { lazyWithReload as lazy } from '@/utils/lazyWithReload';

const PublicLayout = lazy(() => import('@/layouts/PublicLayout'));

const LPPage = lazy(() => import('@/pages/LPPage'));
const CompanyPage = lazy(() => import('@/pages/public/CompanyPage'));
const TermsPage = lazy(() => import('@/pages/public/TermsPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/public/PrivacyPolicyPage'));
const ApiDocsPage = lazy(() => import('@/pages/public/ApiDocsPage'));
const AppPage = lazy(() => import('@/pages/AppPage'));
const VerifyPage = lazy(() => import('@/pages/VerifyPage'));

function RouteError() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-8">
        <h2 className="text-4xl font-black text-slate-800 mb-2">404</h2>
        <p className="text-slate-600 mb-6">ページが見つかりませんでした</p>
        <a
          href="/"
          className="px-6 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors"
        >
          トップに戻る
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <LPPage /> },
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/company', element: <CompanyPage /> },
      { path: '/terms', element: <TermsPage /> },
      { path: '/privacy', element: <PrivacyPolicyPage /> },
      { path: '/api-docs', element: <ApiDocsPage /> },
    ],
  },
  // エディタ本体（データはローカル保存）
  { path: '/app', element: <AppPage /> },
  // メール確認リンクの着地ページ
  { path: '/verify', element: <VerifyPage /> },
  { path: '*', element: <RouteError /> },
]);
