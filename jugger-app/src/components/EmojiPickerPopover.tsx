import { useEffect, useRef } from 'react'

const EMOJIS = [
  // Faces
  '😀', '😂', '🤣', '😅', '😎', '🤔', '😍', '🥳',
  '😤', '🤯', '😭', '😴', '🤦', '🙄', '😬', '😈',
  // Gestures
  '👍', '👎', '👏', '🙌', '💪', '🤝', '✌️', '🤜',
  // Golf & Sports
  '⛳', '🏌️', '🏆', '🥇', '🎯', '🏅', '🚩', '🎱',
  // Food & Drink
  '🍺', '🍻', '🥂', '🥃', '🍕', '🌭', '🍔', '☕',
  // Nature & Elements
  '☀️', '🌧️', '🔥', '❄️', '⚡', '🌈', '💨', '🌊',
  // Objects & Symbols
  '🎉', '🎊', '✨', '💯', '❤️', '💔', '🎶', '📸',
  // Animals
  '🐐', '🐒', '🦅', '🐛', '🦁', '🐻', '🦄', '🐺',
]

interface Props {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPickerPopover({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div ref={ref}
      className="absolute bottom-full mb-2 left-0 z-30 bg-white border border-gray-200 rounded-xl shadow-xl p-2"
      style={{ width: '17rem' }}
    >
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="text-xl p-1 rounded hover:bg-masters-light transition-colors leading-none"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
