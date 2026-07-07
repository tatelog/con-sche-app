import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/ui/Toaster'
import './index.css'

// react-konva@19.2.2 + React@19.2.4 の既知の互換性警告を抑制
// "Expected static flag was missing" は react-konva の内部レンダラー問題で動作に影響なし
const origConsoleError = console.error
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Expected static flag was missing')) return
  origConsoleError.apply(console, args)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center h-screen">読み込み中...</div>}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster />
    </ErrorBoundary>
  </React.StrictMode>,
)
