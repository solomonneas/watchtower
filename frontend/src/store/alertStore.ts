import { create } from 'zustand'
import type { Alert, Toast } from '../types/alert'

interface AlertState {
  // Data
  alerts: Alert[]
  toasts: Toast[]
  criticalOverlay: Alert | null

  // Actions
  setAlerts: (alerts: Alert[]) => void
  addAlert: (alert: Alert) => void
  removeAlert: (alertId: string) => void
  acknowledgeAlert: (alertId: string) => void

  // Toast actions
  addToast: (alert: Alert) => void
  dismissToast: (toastId: string) => void
  clearToasts: () => void

  // Critical overlay
  setCriticalOverlay: (alert: Alert | null) => void
  clearCriticalOverlay: () => void
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  toasts: [],
  criticalOverlay: null,

  setAlerts: (alerts) => set({ alerts }),

  addAlert: (alert) => {
    const { alerts, addToast, setCriticalOverlay } = get()

    // Add to alerts list
    set({ alerts: [alert, ...alerts] })

    // Show toast
    addToast(alert)

    // Show critical overlay if critical
    if (alert.severity === 'critical') {
      setCriticalOverlay(alert)
    }
  },

  removeAlert: (alertId) => {
    const { alerts } = get()
    set({ alerts: alerts.filter((a) => a.id !== alertId) })
  },

  acknowledgeAlert: (alertId) => {
    const { alerts, criticalOverlay } = get()
    set({
      alerts: alerts.map((a) =>
        a.id === alertId ? { ...a, status: 'acknowledged' as const } : a
      ),
    })

    // Clear critical overlay if this was the critical alert
    if (criticalOverlay?.id === alertId) {
      set({ criticalOverlay: null })
    }
  },

  addToast: (alert) => {
    const toast: Toast = {
      id: `toast-${alert.id}-${Date.now()}`,
      alert,
      dismissed: false,
    }
    const { toasts } = get()
    // Keep max 5 toasts
    const newToasts = [toast, ...toasts].slice(0, 5)
    set({ toasts: newToasts })
  },

  dismissToast: (toastId) => {
    const { toasts } = get()
    set({
      toasts: toasts.map((t) =>
        t.id === toastId ? { ...t, dismissed: true } : t
      ),
    })
    // Remove after animation
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== toastId) })
    }, 300)
  },

  clearToasts: () => set({ toasts: [] }),

  setCriticalOverlay: (alert) => set({ criticalOverlay: alert }),
  clearCriticalOverlay: () => set({ criticalOverlay: null }),
}))
