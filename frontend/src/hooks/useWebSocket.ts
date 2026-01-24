import { useCallback, useEffect, useRef, useState } from 'react'
import { useNocStore } from '../store/nocStore'
import { useAlertStore } from '../store/alertStore'
import type { Alert, AlertSeverity } from '../types/alert'
import type { Device } from '../types/device'

interface WebSocketMessage {
  type: string
  timestamp?: string
  [key: string]: unknown
}

interface DeviceStatusChange {
  device_id: string
  hostname: string
  old_status: string
  new_status: string
}

interface LibreNMSAlert {
  id: number
  device_id: number
  hostname: string
  severity: string
  title: string
  timestamp: string
}

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/updates`

/**
 * Maps a LibreNMS hostname/IP to a topology device ID.
 * Uses the same matching logic as the backend aggregator:
 * 1. IP address match
 * 2. Hostname contains device_id (fuzzy match)
 */
function findTopologyDeviceId(
  hostname: string,
  devices: Record<string, Device>
): string | null {
  const lowerHostname = hostname.toLowerCase()

  for (const [deviceId, device] of Object.entries(devices)) {
    // IP match (if hostname is an IP)
    if (device.ip && device.ip === hostname) {
      return deviceId
    }

    // Fuzzy hostname match: device_id appears in LibreNMS hostname
    // e.g., "cat-1" matches "cat-1.domain.com"
    if (lowerHostname.includes(deviceId.toLowerCase())) {
      return deviceId
    }
  }

  return null
}

/**
 * Converts LibreNMS severity to our AlertSeverity type.
 */
function mapSeverity(severity: string): AlertSeverity {
  const lower = severity.toLowerCase()
  if (lower === 'critical' || lower === 'alert') return 'critical'
  if (lower === 'warning' || lower === 'warn') return 'warning'
  if (lower === 'ok' || lower === 'recovery') return 'recovery'
  return 'info'
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const pingIntervalRef = useRef<number | null>(null)

  const setConnected = useNocStore((state) => state.setConnected)
  const updateDeviceStatus = useNocStore((state) => state.updateDeviceStatus)
  const updateAlertCount = useNocStore((state) => state.updateAlertCount)
  const addAlert = useAlertStore((state) => state.addAlert)
  const removeAlert = useAlertStore((state) => state.removeAlert)

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      // Read topology from store directly to avoid stale closure issues
      const topology = useNocStore.getState().topology

      switch (message.type) {
        case 'connected':
          console.log('WebSocket connected:', message.message)
          break

        // Backend sends device_status_change with array of changes
        case 'device_status_change': {
          const changes = message.changes as DeviceStatusChange[]
          if (!changes || !topology?.devices) break

          for (const change of changes) {
            // Map LibreNMS hostname to topology device ID
            const deviceId = findTopologyDeviceId(change.hostname, topology.devices)
            if (deviceId) {
              console.log(
                `Device status change: ${change.hostname} (${deviceId}) ${change.old_status} → ${change.new_status}`
              )
              updateDeviceStatus(deviceId, change.new_status)
            } else {
              console.warn(
                `Could not match LibreNMS device "${change.hostname}" to topology`
              )
            }
          }
          break
        }

        // Backend sends new_alerts with array of alerts
        case 'new_alerts': {
          const alerts = message.alerts as LibreNMSAlert[]
          if (!alerts || !topology?.devices) break

          for (const alert of alerts) {
            const deviceId = findTopologyDeviceId(alert.hostname, topology.devices)
            const mappedAlert: Alert = {
              id: String(alert.id),
              device_id: deviceId || String(alert.device_id),
              severity: mapSeverity(alert.severity),
              message: alert.title,
              status: 'active',
              timestamp: alert.timestamp || new Date().toISOString(),
            }
            console.log(`New alert: ${alert.title} on ${alert.hostname}`)
            addAlert(mappedAlert)
          }
          // Update alert count in topology
          updateAlertCount(alerts.length)
          break
        }

        // Backend sends alerts_resolved with array of alert IDs
        case 'alerts_resolved': {
          const alertIds = message.alert_ids as number[]
          if (!alertIds) break

          for (const id of alertIds) {
            console.log(`Alert resolved: ${id}`)
            removeAlert(String(id))
          }
          // Update alert count in topology
          updateAlertCount(-alertIds.length)
          break
        }

        case 'pong':
          // Keepalive response
          break

        case 'speedtest_result': {
          // Dispatch custom event for SpeedtestWidget
          const speedtestEvent = new CustomEvent('speedtest-update', {
            detail: message.result,
          })
          window.dispatchEvent(speedtestEvent)
          break
        }

        default:
          console.log('Unknown message type:', message.type, message)
      }
    },
    [updateDeviceStatus, updateAlertCount, addAlert, removeAlert]
  )

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        setIsConnected(true)
        setConnected(true)
        reconnectAttempts.current = 0
        console.log('WebSocket connected')

        // Start ping interval for keepalive
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage
          handleMessage(message)
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        setConnected(false)

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
        console.log(`WebSocket closed. Reconnecting in ${delay}ms...`)

        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectAttempts.current++
          connect()
        }, delay)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      wsRef.current = ws
    } catch (err) {
      console.error('Failed to create WebSocket:', err)
    }
  }, [handleMessage, setConnected])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setIsConnected(false)
    setConnected(false)
  }, [setConnected])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { isConnected, connect, disconnect }
}
