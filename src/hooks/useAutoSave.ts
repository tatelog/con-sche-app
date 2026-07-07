import { useEffect, useRef, useState, useCallback } from 'react'
import { useADMStore } from '@/stores/admStore'

const AUTO_SAVE_INTERVAL = 30_000 // 30秒

export function useAutoSave() {
  const isDirty = useADMStore((s) => s.isDirty)
  const currentProjectId = useADMStore((s) => s.currentProjectId)
  const saveProject = useADMStore((s) => s.saveProject)

  const [isSaving, setIsSaving] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const savingRef = useRef(false)

  const doSave = useCallback(async () => {
    if (!isDirty || !currentProjectId || savingRef.current) return
    savingRef.current = true
    setIsSaving(true)
    try {
      await saveProject()
      setLastSaveTime(new Date())
    } catch {
      // 自動保存の失敗はサイレント（手動保存で対応）
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [isDirty, currentProjectId, saveProject])

  useEffect(() => {
    if (!currentProjectId) return

    const timer = setInterval(() => {
      doSave()
    }, AUTO_SAVE_INTERVAL)

    return () => clearInterval(timer)
  }, [currentProjectId, doSave])

  return { isSaving, lastSaveTime }
}
