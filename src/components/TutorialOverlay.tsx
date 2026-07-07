/**
 * 初回起動時のチュートリアルオーバーレイ
 * 「3つの操作で工程表がつくれる」をエディタ内で最初に伝える1枚もの。
 * 既読は localStorage に記録し、ツールバーの「?」ボタンからいつでも再表示できる。
 */

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

const STORAGE_KEY = 'consche_tutorial_seen'
const DOCS_URL = 'https://con-sche-docs.pages.dev'

const STEPS = [
  {
    icon: '/mouse-left-click.svg',
    title: '描く',
    lines: ['クリック = 結合点を置く', '続けてクリック = 矢印がつながる'],
    note: '✏️ 描画モードで',
  },
  {
    icon: '/mouse-right-click.svg',
    title: '区切る',
    lines: ['右クリック = 連続描画を終了', 'Shift+右クリック = メニュー'],
    note: '迷ったら右クリック',
  },
  {
    icon: '/space-key.svg',
    title: '切り替える',
    lines: ['Space = 描画 ⇔ 進捗線', 'Ctrl+ホイール = ズーム'],
    note: 'Ctrl+Z でいつでも戻せます',
  },
]

export function TutorialOverlay() {
  const show = useUIStore((s) => s.showTutorial)
  const openTutorial = useUIStore((s) => s.openTutorial)
  const closeTutorial = useUIStore((s) => s.closeTutorial)

  // 初回のみ自動表示
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      openTutorial()
    }
  }, [openTutorial])

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    closeTutorial()
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="閉じる"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-black text-slate-800 text-center mb-1">
          3つの操作で工程表がつくれます
        </h2>
        <p className="text-sm text-slate-500 text-center mb-8">
          複雑なメニューはありません。この3つだけ覚えてください。
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-xl border border-slate-200 p-4 text-center">
              <div className="text-xs font-bold text-primary-600 mb-2">{i + 1}</div>
              <img src={step.icon} alt="" className="h-12 mx-auto mb-3" />
              <div className="font-bold text-slate-800 mb-2">{step.title}</div>
              <div className="text-xs text-slate-600 leading-relaxed space-y-1">
                {step.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 mt-2">{step.note}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto rounded-xl px-10 py-3 text-base font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            始める
          </button>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            詳しい操作説明を見る
          </a>
        </div>
        <p className="text-[11px] text-slate-400 text-center mt-4">
          ツールバーの「?」からいつでも再表示できます
        </p>
      </div>
    </div>
  )
}
