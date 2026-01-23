import type { Connection, ExternalLink } from './connection'
import type { Device } from './device'

export interface Position {
  x: number
  y: number
}

export interface Cluster {
  id: string
  name: string
  cluster_type: string
  icon: string
  position: Position
  device_ids: string[]
  status: 'active' | 'planned'
}

export interface Topology {
  clusters: Cluster[]
  devices: Record<string, Device>
  connections: Connection[]
  external_links: ExternalLink[]
  total_devices: number
  devices_up: number
  devices_down: number
  active_alerts: number
}

export interface TopologySummary {
  total_devices: number
  devices_up: number
  devices_down: number
  devices_degraded: number
  active_alerts: number
  critical_alerts: number
  warning_alerts: number
}
