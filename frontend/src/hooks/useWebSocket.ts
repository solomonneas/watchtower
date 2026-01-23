import { useCallback, useEffect, useRef, useState } from 'react'
import { useNocStore } from '../store/nocStore'
import { useAlertStore } from '../store/alertStore'
import type { Alert } from '../types/alert'

interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/updates`

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const pingIntervalRef = useRef<number | null>(null)

  const setConnected = useNocStore((state) => state.setConnected)
  const updateDeviceStatus = useNocStore((state) => state.updateDeviceStatus)
  const addAlert = useAlertStore((state) => state.addAlert)

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case 'connected':
          console.log('WebSocket connected:', message.message)
          break

        case 'device_status':
          updateDeviceStatus(
            message.device_id as string,
            message.status as string
          )
          break

        case 'alert':
          addAlert(message as unknown as Alert)
          break

        case 'alert_recovered':
          // Handle recovery - could update alert status
          console.log('Alert recovered:', message.id)
          break

        case 'device_stats':
          // Handle device stats update
          // This would update the device in the store
          break

        case 'utilization_batch':
          // Handle batched utilization updates
          break

        case 'pong':
          // Keepalive response
          break

        default:
          console.log('Unknown message type:', message.type)
      }
    },
    [updateDeviceStatus, addAlert]
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
