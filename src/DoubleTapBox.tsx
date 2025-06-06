import React, { useRef } from 'react'

interface DoubleTapBoxProps {
  onDoubleTap: () => void
  children: React.ReactNode
}

export function DoubleTapBox({ onDoubleTap, children }: DoubleTapBoxProps) {
  const lastTapRef = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleTouchEnd = () => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapRef.current

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      onDoubleTap()
    } else {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
      }, 300)
    }

    lastTapRef.current = now
  }

  return (
    <div onTouchEnd={handleTouchEnd}>
      {children}
    </div>
  )
}
