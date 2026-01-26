/**
 * VLAN types for L3 topology visualization
 */

export interface Vlan {
  vlan_id: number
  vlan_name: string | null
  device_count: number
}

export interface VlanMembership {
  device_id: string
  librenms_device_id: number | null
  port_name: string | null
  vlan_id: number
  vlan_name: string | null
  is_untagged: boolean
}

export interface L3TopologyNode {
  device_id: string
  display_name: string
  status: string
  is_gateway: boolean
  vlan_ids: number[]
}

export interface L3TopologyVlanGroup {
  vlan_id: number
  vlan_name: string | null
  devices: L3TopologyNode[]
  gateway_devices: string[]
}

export interface L3Topology {
  vlans: Vlan[]
  memberships: VlanMembership[]
  vlan_groups: L3TopologyVlanGroup[]
  gateway_devices: string[]
}

export type ViewMode = 'l2' | 'l3'
