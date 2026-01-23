import type { Connection } from '../../types/connection'
import StatusDot from '../common/StatusDot'
import UtilizationBar from '../common/UtilizationBar'
import { useNocStore } from '../../store/nocStore'

interface ConnectionCardProps {
  connection: Connection
}

function formatBytes(bps: number): string {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(1)} Gbps`
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} Kbps`
  return `${bps} bps`
}

function formatSpeed(mbps: number): string {
  if (mbps >= 1000) return `${mbps / 1000} Gbps`
  return `${mbps} Mbps`
}

export default function ConnectionCard({ connection }: ConnectionCardProps) {
  const clearSelection = useNocStore((state) => state.clearSelection)

  const sourceLabel = connection.source.device
    ? `${connection.source.device} ${connection.source.port || ''}`
    : connection.source.label || 'Unknown'

  const targetLabel = connection.target.device
    ? `${connection.target.device} ${connection.target.port || ''}`
    : connection.target.label || 'Unknown'

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-1">Connection</h2>
          <div className="text-sm text-text-secondary font-mono">
            {sourceLabel}
          </div>
          <div className="text-text-muted text-center py-1">↕</div>
          <div className="text-sm text-text-secondary font-mono">
            {targetLabel}
          </div>
        </div>
        <button
          onClick={clearSelection}
          className="p-1 hover:bg-bg-tertiary rounded transition-colors"
        >
          <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status */}
      <div className="space-y-3 mb-4 pb-4 border-b border-border-default">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Status</span>
          <span className="flex items-center gap-2">
            <StatusDot status={connection.status === 'up' ? 'up' : connection.status === 'down' ? 'down' : 'degraded'} />
            <span className="capitalize">{connection.status}</span>
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Type</span>
          <span className="capitalize">{connection.connection_type}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Speed</span>
          <span>{formatSpeed(connection.speed)}</span>
        </div>
      </div>

      {/* Utilization */}
      <div className="space-y-3 mb-4 pb-4 border-b border-border-default">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          Utilization
        </h3>
        <UtilizationBar value={connection.utilization} />
      </div>

      {/* Traffic stats */}
      <div className="space-y-3 mb-4 pb-4 border-b border-border-default">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          Traffic
        </h3>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">In</span>
          <span className="text-status-green">{formatBytes(connection.in_bps)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Out</span>
          <span className="text-status-blue">{formatBytes(connection.out_bps)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Errors</span>
          <span className={connection.errors > 0 ? 'text-status-red' : 'text-text-muted'}>
            {connection.errors}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Discards</span>
          <span className={connection.discards > 0 ? 'text-status-amber' : 'text-text-muted'}>
            {connection.discards}
          </span>
        </div>
      </div>

      {/* Additional info */}
      {(connection.provider || connection.circuit_id || connection.description) && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            Details
          </h3>
          {connection.provider && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Provider</span>
              <span>{connection.provider}</span>
            </div>
          )}
          {connection.circuit_id && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Circuit ID</span>
              <span className="font-mono text-xs">{connection.circuit_id}</span>
            </div>
          )}
          {connection.description && (
            <div className="text-sm text-text-muted mt-2">
              {connection.description}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
