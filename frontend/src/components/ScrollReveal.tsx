import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

type ScrollRevealProps = {
  children: ReactNode
  className?: string
  /** Extra delay for stagger (ms) */
  delayMs?: number
}

export function ScrollReveal({
  children,
  className = '',
  delayMs = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [])

  const style: CSSProperties = visible
    ? { transitionDelay: `${delayMs}ms` }
    : { transitionDelay: `${delayMs}ms` }

  return (
    <div
      ref={ref}
      style={style}
      className={`reveal-base ${visible ? 'reveal-visible' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
