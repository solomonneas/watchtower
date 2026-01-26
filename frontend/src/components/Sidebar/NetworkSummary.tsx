import { useState } from 'react'
import { useNocStore } from '../../store/nocStore'
import StatusDot from '../common/StatusDot'
import VMList from './VMList'

export default function NetworkSummary() {
  const topology = useNocStore((state) => state.topology)
  const [summaryExpanded, setSummaryExpanded] = useState(true)
  const [clustersExpanded, setClustersExpanded] = useState(true)
  const [byTypeExpanded, setByTypeExpanded] = useState(false)
  const [externalExpanded, setExternalExpanded] = useState(false)

  if (!topology) {
    return (
      <div className="p-4 text-text-muted text-center">
        Loading network summary...
      </div>
    )
  }

  const devicesByType = Object.values(topology.devices).reduce(
    (acc, device) => {
      const type = device.device_type
      if (!acc[type]) acc[type] = { up: 0, down: 0, total: 0 }
      acc[type].total++
      if (device.status === 'up') acc[type].up++
      else acc[type].down++
      return acc
    },
    {} as Record<string, { up: number; down: number; total: number }>
  )

  // Check if any devices are down
  const hasDownDevices = topology.devices_down > 0

  // Check if any clusters have down devices
  const clustersWithIssues = topology.clusters.filter((cluster) => {
    const clusterDevices = cluster.device_ids
      .map((id) => topology.devices[id])
      .filter(Boolean)
    return clusterDevices.some((d) => d.status !== 'up')
  }).length

  // Check if any types have down devices
  const typesWithIssues = Object.values(devicesByType).filter((t) => t.down > 0).length

  // Check if any external links are down
  const externalLinksDown = topology.external_links.filter((l) => l.status !== 'up').length

  return (
    <div className="p-4">
      {/* Network Summary - Collapsible */}
      <div className="mb-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setSummaryExpanded(!summaryExpanded)}
        >
          <h2 className="text-lg font-semibold text-text-primary">
            Network Summary
          </h2>
          <div className="flex items-center gap-2">
            {hasDownDevices && (
              <div className="w-2.5 h-2.5 rounded-full bg-status-red" />
            )}
            <ChevronIcon expanded={summaryExpanded} />
          </div>
        </div>

        {summaryExpanded && (
          <div className="bg-bg-tertiary rounded-lg p-4 mt-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-status-green">
                  {topology.devices_up}
                </div>
                <div className="text-xs text-text-muted uppercase">Up</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-status-red">
                  {topology.devices_down}
                </div>
                <div className="text-xs text-text-muted uppercase">Down</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">
                  {topology.total_devices}
                </div>
                <div className="text-xs text-text-muted uppercase">Total</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clusters - Collapsible */}
      <div className="mb-4">
        <div
          className="flex items-center justify-between cursor-pointer py-2"
          onClick={() => setClustersExpanded(!clustersExpanded)}
        >
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            Clusters ({topology.clusters.length})
          </h3>
          <div className="flex items-center gap-2">
            {clustersWithIssues > 0 && (
              <span className="text-xs text-status-red">{clustersWithIssues} issues</span>
            )}
            <ChevronIcon expanded={clustersExpanded} />
          </div>
        </div>

        {clustersExpanded && (
          <div className="space-y-2 mt-1">
            {topology.clusters.map((cluster) => {
              const clusterDevices = cluster.device_ids
                .map((id) => topology.devices[id])
                .filter(Boolean)
              const up = clusterDevices.filter((d) => d.status === 'up').length
              const total = clusterDevices.length

              return (
                <div
                  key={cluster.id}
                  className="flex items-center justify-between py-2 px-3 bg-bg-tertiary rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <ClusterIcon type={cluster.icon} />
                    <span className="text-sm font-medium">{cluster.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {up === total ? (
                      <span className="text-status-green">{total} up</span>
                    ) : (
                      <>
                        <span className="text-status-green">{up}</span>
                        <span className="text-text-muted">/</span>
                        <span className="text-text-secondary">{total}</span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* By Type - Collapsible */}
      <div className="mb-4">
        <div
          className="flex items-center justify-between cursor-pointer py-2"
          onClick={() => setByTypeExpanded(!byTypeExpanded)}
        >
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            By Type ({Object.keys(devicesByType).length})
          </h3>
          <div className="flex items-center gap-2">
            {typesWithIssues > 0 && (
              <span className="text-xs text-status-red">{typesWithIssues} issues</span>
            )}
            <ChevronIcon expanded={byTypeExpanded} />
          </div>
        </div>

        {byTypeExpanded && (
          <div className="space-y-2 mt-1">
            {Object.entries(devicesByType).map(([type, counts]) => (
              <div key={type} className="flex items-center justify-between text-sm py-1 px-3 bg-bg-tertiary rounded-lg">
                <span className="text-text-secondary capitalize">{type}s</span>
                <div className="flex items-center gap-2">
                  <StatusDot status={counts.down > 0 ? 'degraded' : 'up'} />
                  <span>
                    {counts.up} / {counts.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* External Links - Collapsible */}
      {topology.external_links.length > 0 && (
        <div className="mb-4">
          <div
            className="flex items-center justify-between cursor-pointer py-2"
            onClick={() => setExternalExpanded(!externalExpanded)}
          >
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              External Links ({topology.external_links.length})
            </h3>
            <div className="flex items-center gap-2">
              {externalLinksDown > 0 && (
                <span className="text-xs text-status-red">{externalLinksDown} down</span>
              )}
              <ChevronIcon expanded={externalExpanded} />
            </div>
          </div>

          {externalExpanded && (
            <div className="space-y-2 mt-1">
              {topology.external_links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between text-sm py-2 px-3 bg-bg-tertiary rounded-lg"
                >
                  <span className="text-text-secondary">{link.target.label}</span>
                  <div className="flex items-center gap-2">
                    <StatusDot status={link.status === 'up' ? 'up' : 'down'} />
                    <span className="text-text-muted">
                      {link.utilization.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Virtual Machines (Proxmox) */}
      <VMList />
    </div>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-text-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function ClusterIcon({ type }: { type: string }) {
  const iconClass = 'w-4 h-4 text-text-secondary'

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
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
  }
}
