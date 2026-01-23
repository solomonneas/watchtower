import { create } from 'zustand'
import type { Topology } from '../types/topology'
import type { Device } from '../types/device'
import type { Connection } from '../types/connection'

interface NocState {
  // Data
  topology: Topology | null
  selectedDevice: Device | null
  selectedConnection: Connection | null

  // UI state
  isLoading: boolean
  error: string | null
  isConnected: boolean
  sidebarOpen: boolean

  // Actions
  setTopology: (topology: Topology) => void
  selectDevice: (deviceId: string | null) => void
  selectConnection: (connectionId: string | null) => void
  updateDeviceStatus: (deviceId: string, status: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setConnected: (connected: boolean) => void
  setSidebarOpen: (open: boolean) => void
  clearSelection: () => void
}

export const useNocStore = create<NocState>((set, get) => ({
  // Initial state
  topology: null,
  selectedDevice: null,
  selectedConnection: null,
  isLoading: true,
  error: null,
  isConnected: false,
  sidebarOpen: true,

  // Actions
  setTopology: (topology) => set({ topology, error: null }),

  selectDevice: (deviceId) => {
    const { topology } = get()
    if (!topology || !deviceId) {
      set({ selectedDevice: null, selectedConnection: null })
      return
    }
    const device = topology.devices[deviceId]
    if (device) {
      set({ selectedDevice: device, selectedConnection: null })
    }
  },

  selectConnection: (connectionId) => {
    const { topology } = get()
    if (!topology || !connectionId) {
      set({ selectedConnection: null, selectedDevice: null })
      return
    }
    const connection = topology.connections.find((c) => c.id === connectionId)
    if (connection) {
      set({ selectedConnection: connection, selectedDevice: null })
    }
  },

  updateDeviceStatus: (deviceId, status) => {
    const { topology } = get()
    if (!topology) return

    const device = topology.devices[deviceId]
    if (device) {
      set({
        topology: {
          ...topology,
          devices: {
            ...topology.devices,
            [deviceId]: { ...device, status: status as Device['status'] },
          },
        },
      })
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setConnected: (isConnected) => set({ isConnected }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  clearSelection: () => set({ selectedDevice: null, selectedConnection: null }),
}))
