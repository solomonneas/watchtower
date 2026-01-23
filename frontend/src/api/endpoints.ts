import { apiClient } from './client'
import type { Topology, TopologySummary } from '../types/topology'
import type { Device, DeviceSummary } from '../types/device'
import type { AlertSummary, Alert } from '../types/alert'

// Topology
export async function fetchTopology(): Promise<Topology> {
  const response = await apiClient.get<Topology>('/topology')
  return response.data
}

export async function fetchTopologySummary(): Promise<TopologySummary> {
  const response = await apiClient.get<TopologySummary>('/topology/summary')
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
