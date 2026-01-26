import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { L3TopologyVlanGroup } from '../../../types/vlan'
import StatusDot from '../../common/StatusDot'

interface VlanGroupNodeData {
  vlanGroup: L3TopologyVlanGroup
}

interface VlanGroupNodeProps {
  data: VlanGroupNodeData
  selected?: boolean
}

function VlanGroupNode({ data, selected }: VlanGroupNodeProps) {
  const { vlanGroup } = data

  const upCount = vlanGroup.devices.filter((d) => d.status === 'up').length
  const downCount = vlanGroup.devices.filter((d) => d.status === 'down').length
  const allUp = downCount === 0 && upCount > 0
  const hasGateway = vlanGroup.gateway_devices.length > 0

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-border-default" />
      <Handle type="source" position={Position.Bottom} className="!bg-border-default" />
      <Handle type="target" position={Position.Left} className="!bg-border-default" />
      <Handle type="source" position={Position.Right} className="!bg-border-default" />

      <div
        className={`
          group relative bg-bg-secondary border-2 rounded-lg p-4 min-w-[200px]
          transition-all duration-200
          ${selected ? 'border-accent-purple shadow-lg shadow-accent-purple/20' : 'border-accent-purple/40'}
          ${downCount > 0 ? 'border-status-red' : ''}
          hover:border-accent-purple/70
        `}
      >
        {/* VLAN Header */}
        <div className="flex items-center gap-2 mb-3">
          <VlanIcon hasGateway={hasGateway} />
          <div className="flex flex-col">
            <span className="font-medium text-sm text-accent-purple">
              VLAN {vlanGroup.vlan_id}
            </span>
            {vlanGroup.vlan_name && (
              <span className="text-xs text-text-muted truncate max-w-[150px]">
                {vlanGroup.vlan_name}
              </span>
            )}
          </div>
          {hasGateway && (
            <span className="ml-auto text-xs bg-accent-purple/20 text-accent-purple px-1.5 py-0.5 rounded">
              GW
            </span>
          )}
        </div>

        {/* Device grid */}
        <div className="flex flex-wrap gap-1.5">
          {vlanGroup.devices.map((device) => (
            <div
              key={device.device_id}
              className={`
                w-6 h-6 rounded flex items-center justify-center
                transition-colors
                ${device.status === 'up' ? 'bg-status-green/20' : 'bg-status-red/20'}
                ${device.is_gateway ? 'ring-1 ring-accent-purple' : ''}
              `}
              title={`${device.display_name}${device.is_gateway ? ' (Gateway)' : ''} - ${device.status}`}
            >
              <StatusDot
                status={device.status as 'up' | 'down' | 'unknown'}
                size="sm"
                pulse={device.status === 'down'}
              />
            </div>
          ))}
        </div>

        {/* Status summary */}
        <div className="mt-3 pt-2 border-t border-border-muted flex items-center justify-between text-xs">
          <span className="text-text-muted">
            {vlanGroup.devices.length} device{vlanGroup.devices.length !== 1 ? 's' : ''}
          </span>
          <span className={allUp ? 'text-status-green' : 'text-status-amber'}>
            {allUp ? 'All healthy' : `${downCount} down`}
          </span>
        </div>
      </div>
    </>
  )
}

function VlanIcon({ hasGateway }: { hasGateway: boolean }) {
  const iconClass = hasGateway ? 'w-5 h-5 text-accent-purple' : 'w-5 h-5 text-accent-purple/70'

  // Network/VLAN icon
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
      />
    </svg>
  )
}

export default memo(VlanGroupNode)
