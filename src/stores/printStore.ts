import { create } from 'zustand'
import type { PrintSettings, PrintLayoutDimensions, SealSlot } from '@/types/print'
import { createDefaultPrintSettings } from '@/types/print'

const PRINT_SETTINGS_KEY = 'con-sche-print-settings'

function loadSavedSettings(): PrintSettings {
  try {
    const saved = localStorage.getItem(PRINT_SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as PrintSettings
      // デフォルトとマージして欠損キーを補完
      const defaults = createDefaultPrintSettings()
      return {
        ...defaults,
        ...parsed,
        margin: { ...defaults.margin, ...parsed.margin },
        titleBlock: { ...defaults.titleBlock, ...parsed.titleBlock },
        sealBlock: { ...defaults.sealBlock, ...parsed.sealBlock },
        layout: { ...defaults.layout, ...parsed.layout },
      }
    }
  } catch { /* ignore */ }
  return createDefaultPrintSettings()
}

function saveSettings(settings: PrintSettings) {
  try {
    localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(settings))
  } catch { /* ignore */ }
}

export interface CaptureInfo {
  viewStartDate: string
  effectiveTotalDays: number
  totalRows: number
}

interface PrintState {
  settings: PrintSettings
  previewOpen: boolean
  canvasImageData: string | null
  captureInfo: CaptureInfo | null

  updateSettings: (updates: Partial<PrintSettings>) => void
  updateTitleBlock: (updates: Partial<PrintSettings['titleBlock']>) => void
  updateLayout: (updates: Partial<PrintLayoutDimensions>) => void
  updateSealSlot: (slotId: string, updates: Partial<SealSlot>) => void
  addSealSlot: (position: string) => void
  removeSealSlot: (slotId: string) => void
  resetSettings: () => void
  setPreviewOpen: (open: boolean) => void
  setCanvasImageData: (data: string | null) => void
  setCaptureInfo: (info: CaptureInfo | null) => void
}

export const usePrintStore = create<PrintState>((set) => ({
  settings: loadSavedSettings(),
  previewOpen: false,
  canvasImageData: null,
  captureInfo: null,

  updateSettings: (updates) => {
    set(state => {
      const newSettings = { ...state.settings, ...updates }
      saveSettings(newSettings)
      return { settings: newSettings }
    })
  },

  updateTitleBlock: (updates) => {
    set(state => {
      const newSettings = {
        ...state.settings,
        titleBlock: { ...state.settings.titleBlock, ...updates },
      }
      saveSettings(newSettings)
      return { settings: newSettings }
    })
  },

  updateLayout: (updates) => {
    set(state => {
      const merged = { ...state.settings.layout, ...updates }
      // フッター上限59mm
      if (merged.footerHeight > 59) merged.footerHeight = 59
      const newSettings = {
        ...state.settings,
        layout: merged,
      }
      saveSettings(newSettings)
      return { settings: newSettings }
    })
  },

  updateSealSlot: (slotId, updates) => {
    set(state => {
      const newSettings = {
        ...state.settings,
        sealBlock: {
          ...state.settings.sealBlock,
          slots: state.settings.sealBlock.slots.map(slot =>
            slot.id === slotId ? { ...slot, ...updates } : slot
          ),
        },
      }
      saveSettings(newSettings)
      return { settings: newSettings }
    })
  },

  addSealSlot: (position) => {
    set(state => {
      const newSettings = {
        ...state.settings,
        sealBlock: {
          ...state.settings.sealBlock,
          slots: [
            ...state.settings.sealBlock.slots,
            {
              id: String(Date.now()),
              position,
              name: '',
              sealed: false,
            },
          ],
        },
      }
      saveSettings(newSettings)
      return { settings: newSettings }
    })
  },

  removeSealSlot: (slotId) => {
    set(state => {
      const newSettings = {
        ...state.settings,
        sealBlock: {
          ...state.settings.sealBlock,
          slots: state.settings.sealBlock.slots.filter(s => s.id !== slotId),
        },
      }
      saveSettings(newSettings)
      return { settings: newSettings }
    })
  },

  resetSettings: () => {
    const defaults = createDefaultPrintSettings()
    saveSettings(defaults)
    set({ settings: defaults })
  },

  setPreviewOpen: (open) => {
    set({ previewOpen: open })
  },

  setCanvasImageData: (data) => {
    set({ canvasImageData: data })
  },

  setCaptureInfo: (info) => {
    set({ captureInfo: info })
  },
}))
