/**
 * フッターに置く画像（キープラン・凡例など）の操作パネル。
 *
 * ファイルを選ぶ方法と、クリップボードから貼り付ける方法の両方に対応する。
 * 貼ったあとは大きさを変えられる（縦横比は保つ）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useADMStore } from '@/stores/admStore'
import {
  canAddImage,
  createScheduleImage,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  scaledSize,
  validateImageSource,
  type ScheduleImage,
} from '@/utils/scheduleImage'

interface Props {
  /** 貼り付け先（フッター）の大きさ(mm)。初期サイズを決めるのに使う */
  boxWidthMm: number
  boxHeightMm: number
}

/** File/Blob を読み込んで、データURLと元の画素数を得る */
function loadImage(file: Blob): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('画像を読み込めませんでした'))
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const img = new Image()
      img.onerror = () => reject(new Error('画像を読み込めませんでした'))
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight })
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}

export function ScheduleImagePanel({ boxWidthMm, boxHeightMm }: Props) {
  const images = useADMStore((s) => s.images)
  const addImage = useADMStore((s) => s.addImage)
  const updateImage = useADMStore((s) => s.updateImage)
  const removeImage = useADMStore((s) => s.removeImage)

  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const accept = useCallback(
    async (blob: Blob) => {
      const reason = validateImageSource(blob.type, blob.size) ?? canAddImage(images, blob.size)
      if (reason) {
        setError(reason)
        return
      }
      try {
        const { dataUrl, width, height } = await loadImage(blob)
        addImage(createScheduleImage(dataUrl, blob.type, width, height, boxWidthMm, boxHeightMm))
        setError(null)
      } catch {
        setError('画像を読み込めませんでした')
      }
    },
    [addImage, images, boxWidthMm, boxHeightMm],
  )

  // クリップボードからの貼り付け（このパネルにフォーカスがあるとき）
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            void accept(file)
            return
          }
        }
      }
    }
    const el = dropRef.current
    el?.addEventListener('paste', onPaste as EventListener)
    return () => el?.removeEventListener('paste', onPaste as EventListener)
  }, [accept])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) void accept(file)
  }

  return (
    <div className="border-t pt-3">
      <div className="text-sm font-medium text-gray-700 mb-2">画像（キープラン・凡例）</div>

      <div
        ref={dropRef}
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border border-dashed border-gray-300 rounded px-3 py-3 text-center text-xs text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-text"
        title="ここをクリックしてから Ctrl+V で貼り付けできます"
      >
        ここをクリックして Ctrl+V で貼り付け
        <br />
        ドラッグ＆ドロップもできます
        <div className="mt-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50"
          >
            画像を選ぶ
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void accept(file)
            e.target.value = ''
          }}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-1">
        PNG と JPEG（1枚 {Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB まで）・
        あと {Math.max(0, MAX_IMAGE_COUNT - images.length)} 枚
      </p>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {images.length > 0 && (
        <ul className="mt-3 space-y-3">
          {images.map((img) => (
            <ImageRow
              key={img.id}
              image={img}
              boxWidthMm={boxWidthMm}
              onChange={(updates) => updateImage(img.id, updates)}
              onRemove={() => removeImage(img.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ImageRow({
  image,
  boxWidthMm,
  onChange,
  onRemove,
}: {
  image: ScheduleImage
  boxWidthMm: number
  onChange: (updates: Partial<ScheduleImage>) => void
  onRemove: () => void
}) {
  // 元の画素数に対する現在の倍率（スライダーの値）
  const baseWidth = image.naturalWidth || 1
  const percent = Math.round((image.widthMm / baseWidth) * 1000) / 10

  const setPercent = (p: number) => {
    const next = scaledSize(image.naturalWidth, image.naturalHeight, p / 100)
    onChange({ widthMm: next.width, heightMm: next.height })
  }

  return (
    <li className="flex gap-2 items-start border rounded p-2">
      <img
        src={image.dataUrl}
        alt=""
        className="w-14 h-14 object-contain bg-gray-50 border rounded shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-gray-500">
          {Math.round(image.widthMm)} × {Math.round(image.heightMm)} mm
        </div>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={Math.min(100, Math.max(1, percent))}
          onChange={(e) => setPercent(Number(e.target.value))}
          className="w-full"
          aria-label="画像の大きさ"
        />
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => {
              const fit = scaledSize(image.naturalWidth, image.naturalHeight, boxWidthMm / baseWidth)
              onChange({ widthMm: fit.width, heightMm: fit.height })
            }}
            className="text-[11px] px-1.5 py-0.5 border rounded text-gray-600 hover:bg-gray-50"
          >
            幅に合わせる
          </button>
          <button onClick={onRemove} className="text-[11px] text-red-600 hover:underline ml-auto">
            削除
          </button>
        </div>
      </div>
    </li>
  )
}
