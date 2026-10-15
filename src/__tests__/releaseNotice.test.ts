import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(code => code.includes('consche_release_notice_dismissed'))!
const revision = html.match(/id="release-notice" data-revision="([^"]+)"/)![1]

function open(saved: string | null, pathname = '/app', blocked = false) {
  let shown = false
  let submit = () => {}
  let stored = saved
  const checkbox = { checked: false }
  const notice = {
    dataset: { revision },
    querySelector: () => ({ addEventListener: (_: string, handler: () => void) => { submit = handler } }),
    showModal: () => { shown = true },
  }
  runInNewContext(script, {
    location: { pathname },
    document: { getElementById: (id: string) => id === 'release-notice' ? notice : checkbox },
    localStorage: {
      getItem: () => { if (blocked) throw Error('blocked'); return stored },
      setItem: (_: string, value: string) => { if (blocked) throw Error('blocked'); stored = value },
    },
  })
  return { shown, checkbox, confirm: () => submit(), stored: () => stored }
}

describe('更新案内', () => {
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
