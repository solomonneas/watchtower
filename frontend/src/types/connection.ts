export type ConnectionStatus = 'up' | 'down' | 'degraded'
export type ConnectionType = 'trunk' | 'access' | 'uplink' | 'stack' | 'wan'

export interface ConnectionEndpoint {
  device?: string
  port?: string
  label?: string
  external?: boolean
}

export interface ExternalTarget {
  label: string
  type: 'campus' | 'ix' | 'cloud'
  icon: 'building' | 'globe' | 'cloud'
  external: boolean
}

export interface Connection {
  id: string
  source: ConnectionEndpoint
  target: ConnectionEndpoint
  connection_type: ConnectionType
  speed: number // Mbps
  status: ConnectionStatus
  utilization: number
  in_bps: number
  out_bps: number
  errors: number
  discards: number
  provider?: string
  circuit_id?: string
  sla?: string
  description?: string
}

export interface ExternalLink {
  id: string
  source: ConnectionEndpoint
  target: ExternalTarget
  provider?: string
  circuit_id?: string
  speed: number
  sla?: string
  description?: string
  status: ConnectionStatus
  utilization: number
  in_bps: number
  out_bps: number
}
