// Google Analytics (gtag.js) のグローバル宣言。タグ本体は index.html で読み込み済み
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export {}
