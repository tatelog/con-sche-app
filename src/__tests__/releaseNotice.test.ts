import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(code => code.includes('consche_release_notice_dismissed'))!
const revision = html.match(/id="release-notice" data-revision="([^"]+)"/)![1]

function open(saved: string | null, pathname = '/app', blocked = false, session = new Map<string, string>(), registered = true) {
  let shown = false
  let submit = () => {}
  let stored = saved
  let click: (event: unknown) => void = () => {}
  let ready: (event?: unknown) => void = () => {}
  let navigated = ''
  let prevented = false
  class LinkElement {
    href = 'https://example.test/app'
    target = ''
    closest() { return this }
    hasAttribute() { return false }
  }
  const checkbox = { checked: false }
  const notice = {
    dataset: { revision },
    querySelector: () => ({ addEventListener: (_: string, handler: () => void) => { submit = handler } }),
    showModal: () => { shown = true },
    addEventListener: () => {},
  }
  runInNewContext(script, {
    Element: LinkElement,
    URL,
    location: { pathname, href: `https://example.test${pathname}`, origin: 'https://example.test', assign: (url: string) => { navigated = url } },
    document: {
      getElementById: (id: string) => id === 'release-notice' ? notice : checkbox,
      addEventListener: (name: string, handler: typeof click) => {
        if (name === 'click') click = handler
        else if (name === 'consche:registration-ready') ready = handler
      },
    },
    sessionStorage: {
      getItem: (key: string) => session.get(key),
      setItem: (key: string, value: string) => session.set(key, value),
      removeItem: (key: string) => session.delete(key),
    },
    localStorage: {
      getItem: (key: string) => {
        if (key === 'consche_registration') return registered ? '{"registeredAt":"2026-10-15"}' : null
        if (blocked) throw Error('blocked'); return stored
      },
      setItem: (_: string, value: string) => { if (blocked) throw Error('blocked'); stored = value },
    },
  })
  return { get shown() { return shown }, checkbox, confirm: () => submit(), stored: () => stored,
    clickApp: (ctrlKey = false) => click({ button: 0, ctrlKey, target: new LinkElement(), preventDefault: () => { prevented = true }, stopImmediatePropagation: () => {} }),
    navigated: () => navigated, prevented: () => prevented,
    completeRegistration: () => { registered = true; ready() },
  }
}

describe('更新案内', () => {
  it('未登録の開始操作では案内もアプリも出さず、登録ページへ進む', () => {
    const page = open(null, '/', false, new Map(), false)
    page.clickApp()
    expect(page.shown).toBe(false)
    expect(page.navigated()).toBe('/start')
    expect(open(null, '/app', false, new Map(), false).shown).toBe(false)
  })
  it('登録完了後に案内を出し、確認するまでアプリへ遷移しない', () => {
    const page = open(null, '/start', false, new Map(), false)
    expect(page.shown).toBe(false)
    page.completeRegistration()
    expect(page.shown).toBe(true)
    expect(page.navigated()).toBe('')
    page.confirm()
    expect(page.navigated()).toBe('https://example.test/app')
  })
  it('LPでは遷移を止め、確認後に工程表へ進み、同じ遷移で二重表示しない', () => {
    const session = new Map<string, string>()
    const page = open(null, '/', false, session)
    page.clickApp()
    expect(page.prevented()).toBe(true)
    expect(page.shown).toBe(true)
    expect(page.navigated()).toBe('')
    page.confirm()
    expect(page.navigated()).toBe('https://example.test/app')
    expect(open(null, '/app', false, session).shown).toBe(false)
    expect(open(null, '/app', false, session).shown).toBe(true)
  })
  it('非表示設定と修飾キー付きのリンク操作を妨げない', () => {
    const hidden = open(revision, '/')
    hidden.clickApp()
    expect(hidden.shown).toBe(false)
    expect(hidden.navigated()).toBe('/app')
    const modified = open(null, '/')
    modified.clickApp(true)
    expect(modified.prevented()).toBe(false)
  })
  it('工程表の再訪時に表示し、公開LPでは表示しない', () => {
    expect(open(null).shown).toBe(true)
    expect(open(null, '/app/').shown).toBe(true)
    expect(open(null, '/').shown).toBe(false)
  })
  it('チェックして確認した案内だけを、同じブラウザーで抑止する', () => {
    const page = open(null)
    page.confirm()
    expect(page.stored()).toBeNull()
    page.checkbox.checked = true
    page.confirm()
    expect(open(page.stored()).shown).toBe(false)
  })
  it('新しい案内更新番号では再表示する', () => {
    expect(open(`previous-${revision}`).shown).toBe(true)
  })
  it('保存を禁止したブラウザーでも案内と確認操作を使える', () => {
    const page = open(null, '/app', true)
    expect(page.shown).toBe(true)
    page.checkbox.checked = true
    expect(() => page.confirm()).not.toThrow()
  })
})
