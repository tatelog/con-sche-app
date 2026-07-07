/**
 * jsPDF用日本語フォント登録ユーティリティ
 * NotoSansJP Regular (Google Fonts, SIL OFL 1.1)
 * public/fonts/NotoSansJP-Regular.ttf を fetch して base64 で登録
 */

import type { jsPDF } from 'jspdf'

let cachedFont: string | null = null

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export async function registerJapaneseFont(doc: jsPDF): Promise<void> {
  if (!cachedFont) {
    const response = await fetch('/fonts/NotoSansJP-Regular.ttf')
    if (!response.ok) {
      console.warn('日本語フォントの読み込みに失敗しました。デフォルトフォントを使用します。')
      return
    }
    const buffer = await response.arrayBuffer()
    cachedFont = arrayBufferToBase64(buffer)
  }
  doc.addFileToVFS('NotoSansJP-Regular.ttf', cachedFont)
  doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal')
  doc.setFont('NotoSansJP')
}
