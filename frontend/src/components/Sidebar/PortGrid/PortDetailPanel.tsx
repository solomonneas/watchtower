/**
 * PortDetailPanel Component
 *
 * Expanded view showing detailed information about a selected port.
 */

import type { Interface } from '../../../types/device'
import StatusDot from '../../common/StatusDot'
import UtilizationBar from '../../common/UtilizationBar'
import { formatSpeed, formatTrafficRate, getPortColor } from './portUtils'
import clsx from 'clsx'

interface PortDetailPanelProps {
  interface: Interface
  onBack: () => void
}

export default function PortDetailPanel({ interface: iface, onBack }: PortDetailPanelProps) {
  const hasErrors = (iface.errors_in ?? 0) > 0 || (iface.errors_out ?? 0) > 0
  const colorClass = getPortColor(iface)

  // Determine status text
  let statusText: string = iface.status
  if (iface.admin_status === 'down') {
    statusText = 'admin down'
  }

  return (
    <div className="space-y-3">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="p-1 hover:bg-bg-tertiary rounded transition-colors"
          aria-label="Back to port grid"
        >
          <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className={clsx('w-3 h-3 rounded-sm', colorClass)} />
          <span className="font-mono font-semibold text-text-primary">{iface.name}</span>
        </div>
      </div>

      {/* Description/Alias */}
      {iface.alias && (
        <div className="text-sm text-text-secondary bg-bg-tertiary rounded px-2 py-1">
          {iface.alias}
        </div>
      )}

      {/* Status and Speed */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-text-muted">Status</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StatusDot
              status={iface.admin_status === 'down' ? 'unknown' : iface.status}
              size="sm"
            />
            <span className="capitalize">{statusText}</span>
          </div>
        </div>
        <div>
          <span className="text-text-muted">Speed</span>
          <div className="mt-0.5 font-medium">{formatSpeed(iface.speed)}</div>
        </div>
      </div>

      {/* Utilization */}
      <div className="space-y-1">
        <span className="text-sm text-text-muted">Utilization</span>
        <UtilizationBar value={iface.utilization} size="sm" />
      </div>

      {/* Traffic */}
      <div className="space-y-2">
        <span className="text-sm text-text-muted">Traffic</span>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-bg-tertiary rounded px-2 py-1.5">
            <div className="text-text-muted text-xs">In</div>
            <div className="font-mono">{formatTrafficRate(iface.in_bps)}</div>
          </div>
          <div className="bg-bg-tertiary rounded px-2 py-1.5">
            <div className="text-text-muted text-xs">Out</div>
            <div className="font-mono">{formatTrafficRate(iface.out_bps)}</div>
          </div>
        </div>
      </div>

      {/* Errors (only if present) */}
      {hasErrors && (
        <div className="space-y-2">
          <span className="text-sm text-status-red">Errors</span>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-red-900/20 border border-red-800/30 rounded px-2 py-1.5">
              <div className="text-text-muted text-xs">In Errors</div>
              <div className="font-mono text-status-red">{iface.errors_in ?? 0}</div>
            </div>
            <div className="bg-red-900/20 border border-red-800/30 rounded px-2 py-1.5">
              <div className="text-text-muted text-xs">Out Errors</div>
              <div className="font-mono text-status-red">{iface.errors_out ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* PoE Info (if enabled) */}
      {iface.poe_enabled && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-text-muted">
            <span className="text-yellow-400">⚡</span>
            <span>PoE</span>
          </div>
          <div className="text-sm">
            {iface.poe_power !== undefined && iface.poe_power !== null ? (
              <span className="font-mono">{iface.poe_power.toFixed(1)}W</span>
            ) : (
              <span className="text-text-muted">Enabled</span>
            )}
          </div>
        </div>
      )}

      {/* Port Type Badges */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {iface.is_trunk && (
          <span className="px-2 py-0.5 text-xs bg-blue-900/30 border border-blue-700/50 rounded text-blue-300">
            Trunk
          </span>
        )}
        {iface.speed >= 10000 && (
          <span className="px-2 py-0.5 text-xs bg-purple-900/30 border border-purple-700/50 rounded text-purple-300">
            Uplink
          </span>
        )}
      </div>
    </div>
  )
}
