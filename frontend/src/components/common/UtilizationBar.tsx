import clsx from 'clsx'

interface UtilizationBarProps {
  value: number // 0-100
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md'
}

function getColorClass(value: number): string {
  if (value >= 90) return 'bg-status-red'
  if (value >= 70) return 'bg-status-amber'
  return 'bg-status-green'
}

export default function UtilizationBar({
  value,
  label,
  showPercent = true,
  size = 'md',
}: UtilizationBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-text-secondary text-sm w-16 flex-shrink-0">{label}</span>
      )}
      <div
        className={clsx(
          'flex-1 bg-bg-tertiary rounded-full overflow-hidden',
          size === 'sm' ? 'h-1.5' : 'h-2'
        )}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-500', getColorClass(value))}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showPercent && (
        <span className="text-text-secondary text-sm w-10 text-right">
          {Math.round(value)}%
        </span>
      )}
    </div>
  )
}
