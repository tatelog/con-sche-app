import { describe, it, expect, beforeEach } from 'vitest'
import { useADMStore } from '@/stores/admStore'
import { createScheduleImage } from '@/utils/scheduleImage'

// 2026-10-18 社内検証で見つけた不具合:
// キープランを貼っただけで他を触らずに閉じると、画像が保存されずに消えていた。
// 自動保存は「未保存の変更あり」でしか走らないため、画像の増減・大きさの変更も
// 工程表の変更として扱う必要がある。
describe('画像の増減・変更は未保存の変更として扱う', () => {
  const sample = () => createScheduleImage('data:image/png;base64,AAAA', 'image/png', 400, 200, 180, 20)

  beforeEach(() => {
    useADMStore.getState().newProject()
  })

  it('画像を貼ると未保存になる', () => {
    expect(useADMStore.getState().isDirty).toBe(false)
    useADMStore.getState().addImage(sample())
    expect(useADMStore.getState().isDirty).toBe(true)
  })

  it('大きさを変えると未保存になる', () => {
    const img = sample()
    useADMStore.getState().addImage(img)
    useADMStore.setState({ isDirty: false })
    useADMStore.getState().updateImage(img.id, { widthMm: 90, heightMm: 45 })
    expect(useADMStore.getState().isDirty).toBe(true)
    const stored = useADMStore.getState().images.find((i) => i.id === img.id)
    expect(stored?.widthMm).toBe(90)
  })

  it('画像を消すと未保存になる', () => {
    const img = sample()
    useADMStore.getState().addImage(img)
    useADMStore.setState({ isDirty: false })
    useADMStore.getState().removeImage(img.id)
    expect(useADMStore.getState().isDirty).toBe(true)
    expect(useADMStore.getState().images).toHaveLength(0)
  })

  it('新しい工程表を作ると画像は引き継がない', () => {
    useADMStore.getState().addImage(sample())
    useADMStore.getState().newProject()
    expect(useADMStore.getState().images).toHaveLength(0)
  })
})
