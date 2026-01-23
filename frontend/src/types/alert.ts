export type AlertSeverity = 'critical' | 'warning' | 'info' | 'recovery'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved'

export interface Alert {
  id: string
  device_id: string
  severity: AlertSeverity
  message: string
  details?: string
  status: AlertStatus
  timestamp: string
  acknowledged_at?: string
  acknowledged_by?: string
  resolved_at?: string
  downtime_seconds?: number
}

export interface AlertSummary {
  id: string
  device_id: string
  severity: AlertSeverity
  message: string
  timestamp: string
  status: AlertStatus
}

export interface Toast {
  id: string
  alert: Alert
  dismissed: boolean
}
