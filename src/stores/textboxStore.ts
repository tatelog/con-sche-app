import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { TextBox, Position } from '@/types'
import { createTextBox } from '@/types'
import { useADMStore } from './admStore'

interface TextBoxState {
  textboxes: Map<string, TextBox>

  addTextBox: (position: Position, text?: string, options?: Partial<TextBox>) => string
  updateTextBox: (id: string, updates: Partial<TextBox>) => void
  deleteTextBox: (id: string) => void

  selectedTextBoxId: string | null
  selectTextBox: (id: string | null) => void

  getTextBox: (id: string) => TextBox | undefined
  getTextBoxesArray: () => TextBox[]
}

// updateTextBox のヒストリ保存デバウンス（連続入力を1つのundo単位にまとめる）
let _lastUpdateSaveTime = 0

export const useTextBoxStore = create<TextBoxState>((set, get) => ({
  textboxes: new Map(),
  selectedTextBoxId: null,

  addTextBox: (position, text, options) => {
    useADMStore.getState().saveHistory()
    const id = uuidv4()
    const textbox = createTextBox({ id, position, text: text ?? '', ...options })

    set(state => {
      const newTextboxes = new Map(state.textboxes)
      newTextboxes.set(id, textbox)
      return { textboxes: newTextboxes }
    })

    return id
  },

  updateTextBox: (id, updates) => {
    const now = Date.now()
    if (now - _lastUpdateSaveTime > 500) {
      useADMStore.getState().saveHistory()
      _lastUpdateSaveTime = now
    }
    set(state => {
      const textbox = state.textboxes.get(id)
      if (!textbox) return state

      const newTextboxes = new Map(state.textboxes)
      newTextboxes.set(id, { ...textbox, ...updates })
      return { textboxes: newTextboxes }
    })
  },

  deleteTextBox: (id) => {
    useADMStore.getState().saveHistory()
    set(state => {
      const newTextboxes = new Map(state.textboxes)
      newTextboxes.delete(id)
      return {
        textboxes: newTextboxes,
        selectedTextBoxId: state.selectedTextBoxId === id ? null : state.selectedTextBoxId,
      }
    })
  },

  selectTextBox: (id) => {
    set({ selectedTextBoxId: id })
  },

  getTextBox: (id) => get().textboxes.get(id),
  getTextBoxesArray: () => Array.from(get().textboxes.values()),
}))
