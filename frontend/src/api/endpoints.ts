import { apiClient } from './client'
import type { Topology, TopologySummary } from '../types/topology'
import type { Device, DeviceSummary } from '../types/device'
import type { AlertSummary, Alert } from '../types/alert'
import type { L3Topology } from '../types/vlan'

// Topology
export async function fetchTopology(): Promise<Topology> {
  const response = await apiClient.get<Topology>('/topology')
  return response.data
}

export async function fetchTopologySummary(): Promise<TopologySummary> {
  const response = await apiClient.get<TopologySummary>('/topology/summary')
  return response.data
}

export async function fetchL3Topology(): Promise<L3Topology> {
  const response = await apiClient.get<L3Topology>('/topology/l3')
  return response.data
}

// Devices
export async function fetchDevices(): Promise<DeviceSummary[]> {
  const response = await apiClient.get<DeviceSummary[]>('/devices')
  return response.data
}

export async function fetchDevice(deviceId: string): Promise<Device> {
  const response = await apiClient.get<Device>(`/device/${deviceId}`)
  return response.data
}

// Alerts
export async function fetchAlerts(status?: string): Promise<AlertSummary[]> {
  const params = status ? { status } : {}
  const response = await apiClient.get<AlertSummary[]>('/alerts', { params })
  return response.data
}

export async function fetchAlert(alertId: string): Promise<Alert> {
  const response = await apiClient.get<Alert>(`/alert/${alertId}`)
  return response.data
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await apiClient.post(`/alert/${alertId}/acknowledge`)
}

export async function resolveAlert(alertId: string): Promise<void> {
  await apiClient.post(`/alert/${alertId}/resolve`)
}

// Proxmox VMs
export interface ProxmoxVM {
  vmid: number
  name: string
  node: string
  instance: string
  type: 'qemu' | 'lxc'
  status: string
  cpu: number
  memory: number
  cpus: number | null
  maxmem: number | null
  uptime: number | null
  netin: number | null
  netout: number | null
}

export interface VMSummary {
  total_running: number
  total_qemu: number
  total_lxc: number
  total_cpus: number
  total_memory_gb: number
}

export interface VMListResponse {
  vms: ProxmoxVM[]
  summary: VMSummary
}

export async function fetchVMs(): Promise<VMListResponse> {
  const response = await apiClient.get<VMListResponse>('/vms')
  return response.data
}
