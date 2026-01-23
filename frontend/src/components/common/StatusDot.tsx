import clsx from 'clsx'
import type { DeviceStatus } from '../../types/device'

interface StatusDotProps {
  status: DeviceStatus | 'unknown'
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
}

const statusColors: Record<string, string> = {
  up: 'bg-status-green',
  down: 'bg-status-red',
  degraded: 'bg-status-amber',
  unknown: 'bg-text-muted',
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
}

export default function StatusDot({ status, size = 'md', pulse = false }: StatusDotProps) {
  return (
    <span
      className={clsx(
        'rounded-full inline-block',
        statusColors[status] || statusColors.unknown,
        sizeClasses[size],
        pulse && status === 'down' && 'animate-pulse'
      )}
    />
  )
}
