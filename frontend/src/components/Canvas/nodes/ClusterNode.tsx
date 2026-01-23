import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Cluster } from '../../../types/topology'
import type { Device } from '../../../types/device'
import StatusDot from '../../common/StatusDot'

interface ClusterNodeData {
  cluster: Cluster
  devices: Device[]
}

interface ClusterNodeProps {
  data: ClusterNodeData
  selected?: boolean
}

function ClusterNode({ data, selected }: ClusterNodeProps) {
  const { cluster, devices } = data

  const upCount = devices.filter((d) => d.status === 'up').length
  const downCount = devices.filter((d) => d.status === 'down').length
  const allUp = downCount === 0 && upCount > 0

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-border-default" />
      <Handle type="source" position={Position.Bottom} className="!bg-border-default" />
      <Handle type="target" position={Position.Left} className="!bg-border-default" />
      <Handle type="source" position={Position.Right} className="!bg-border-default" />

      <div
        className={`
          bg-bg-secondary border-2 rounded-lg p-4 min-w-[180px]
          transition-all duration-200 cursor-pointer
          ${selected ? 'border-accent-cyan shadow-lg shadow-accent-cyan/20' : 'border-border-default'}
          ${downCount > 0 ? 'border-status-red' : ''}
          hover:border-accent-cyan/50
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <ClusterIcon type={cluster.icon} />
          <span className="font-medium text-sm">{cluster.name}</span>
        </div>

        {/* Device grid */}
        <div className="flex flex-wrap gap-1.5">
          {devices.map((device) => (
            <div
              key={device.id}
              className={`
                w-6 h-6 rounded flex items-center justify-center
                transition-colors
                ${device.status === 'up' ? 'bg-status-green/20' : 'bg-status-red/20'}
              `}
              title={`${device.display_name} - ${device.status}`}
            >
              <StatusDot
                status={device.status}
                size="sm"
                pulse={device.status === 'down'}
              />
            </div>
          ))}
        </div>

        {/* Status summary */}
        <div className="mt-3 pt-2 border-t border-border-muted flex items-center justify-between text-xs">
          <span className="text-text-muted">
            {devices.length} device{devices.length !== 1 ? 's' : ''}
          </span>
          <span className={allUp ? 'text-status-green' : 'text-status-amber'}>
            {allUp ? 'All healthy' : `${downCount} down`}
          </span>
        </div>
      </div>
    </>
  )
}

function ClusterIcon({ type }: { type: string }) {
  const iconClass = 'w-5 h-5 text-accent-cyan'

  switch (type) {
    case 'shield':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    case 'switch':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    case 'server':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      )
    case 'wifi':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      )
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
  }
}

export default memo(ClusterNode)
