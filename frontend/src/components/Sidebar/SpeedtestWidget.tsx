import { useCallback, useEffect, useState } from 'react'

interface SpeedtestResult {
  timestamp: string
  download_mbps: number
  upload_mbps: number
  ping_ms: number
  jitter_ms: number
  packet_loss_pct: number
  server_id: number
  server_name: string
  server_location: string
  result_url: string
  status: string
  indicator?: 'normal' | 'degraded' | 'down'
}

type WidgetState = 'loading' | 'no_data' | 'ready' | 'testing'

export default function SpeedtestWidget() {
  const [result, setResult] = useState<SpeedtestResult | null>(null)
  const [state, setState] = useState<WidgetState>('loading')
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Fetch latest result on mount
  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await fetch('/api/speedtest')
        const data = await response.json()

        if (data.status === 'no_data') {
          setState('no_data')
        } else {
          setResult(data)
          setState('ready')
        }
      } catch (err) {
        console.error('Failed to fetch speedtest result:', err)
        setState('no_data')
      }
    }

    fetchResult()
  }, [])

  // Listen for WebSocket speedtest updates via custom event
  useEffect(() => {
    const handleSpeedtestUpdate = (event: CustomEvent<SpeedtestResult>) => {
      setResult(event.detail)
      setState('ready')
    }

    window.addEventListener('speedtest-update', handleSpeedtestUpdate as EventListener)

    return () => {
      window.removeEventListener('speedtest-update', handleSpeedtestUpdate as EventListener)
    }
  }, [])

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return

    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldown])

  const triggerTest = useCallback(async () => {
    if (state === 'testing' || cooldown > 0) return

    setState('testing')
    setError(null)

    try {
      const response = await fetch('/api/speedtest/trigger', { method: 'POST' })

      if (response.status === 429) {
        const data = await response.json()
        setError(data.detail)
        setState('ready')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to trigger test')
      }

      // Start cooldown
      setCooldown(60)

      // The result will come via WebSocket, but also poll after a delay
      setTimeout(async () => {
        try {
          const pollResponse = await fetch('/api/speedtest')
          const data = await pollResponse.json()
          if (data.status !== 'no_data') {
            setResult(data)
            setState('ready')
          }
        } catch {
          // Ignore: WebSocket should have updated us
        }
      }, 30000) // Poll after 30s as backup
    } catch (err) {
      console.error('Failed to trigger speedtest:', err)
      setError('Failed to start test')
      setState('ready')
    }
  }, [state, cooldown])

  // Format time ago
  const timeAgo = (timestamp: string): string => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  // Status indicator color
  const indicatorColor = {
    normal: 'bg-status-green',
    degraded: 'bg-status-yellow',
    down: 'bg-status-red',
  }

  if (state === 'loading') {
    return (
      <div className="p-4 border-b border-border-primary">
        <div className="animate-pulse">
          <div className="h-4 bg-bg-tertiary rounded w-24 mb-2" />
          <div className="h-8 bg-bg-tertiary rounded w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border-b border-border-primary">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GlobeIcon />
          <h3 className="text-sm font-semibold text-text-primary">Internet Speed</h3>
        </div>
        {result?.indicator && (
          <div className={`w-2.5 h-2.5 rounded-full ${indicatorColor[result.indicator]}`} />
        )}
      </div>

      {state === 'no_data' ? (
        <div className="text-center py-4">
          <p className="text-sm text-text-muted mb-3">No speedtest data</p>
          <button
            onClick={triggerTest}
            className="px-4 py-2 text-sm bg-accent-primary hover:bg-accent-primary/80 text-white rounded-lg transition-colors"
          >
            Run Test
          </button>
        </div>
      ) : state === 'testing' ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-accent-primary border-t-transparent mb-2" />
          <p className="text-sm text-text-muted">Running speedtest...</p>
        </div>
      ) : result ? (
        <>
          {/* Speed display */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-text-primary">
                <DownArrow />
                {result.download_mbps.toFixed(1)}
              </div>
              <div className="text-xs text-text-muted">Mbps Down</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-text-primary">
                <UpArrow />
                {result.upload_mbps.toFixed(1)}
              </div>
              <div className="text-xs text-text-muted">Mbps Up</div>
            </div>
          </div>

          {/* Ping & Jitter */}
          <div className="flex items-center justify-center gap-4 text-sm text-text-secondary mb-3">
            <span>{result.ping_ms.toFixed(1)}ms ping</span>
            <span className="text-text-muted">|</span>
            <span>{result.jitter_ms.toFixed(1)}ms jitter</span>
          </div>

          {/* Server info */}
          {result.server_name && (
            <div className="text-xs text-text-muted text-center mb-2">
              {result.server_name}
              {result.server_location && ` (${result.server_location})`}
            </div>
          )}

          {/* Last test time */}
          <div className="text-xs text-text-tertiary text-center mb-3">
            Last test: {timeAgo(result.timestamp)}
          </div>

          {/* Run test button */}
          <button
            onClick={triggerTest}
            disabled={cooldown > 0}
            className={`w-full py-2 text-sm rounded-lg transition-colors ${
              cooldown > 0
                ? 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                : 'bg-bg-tertiary hover:bg-bg-secondary text-text-primary'
            }`}
          >
            {cooldown > 0 ? `Wait ${cooldown}s` : 'Run Test'}
          </button>

          {/* Error display */}
          {error && (
            <div className="mt-2 text-xs text-status-red text-center">{error}</div>
          )}

          {/* Result link */}
          {result.result_url && (
            <a
              href={result.result_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-xs text-accent-primary hover:underline text-center"
            >
              View detailed result
            </a>
          )}
        </>
      ) : null}
    </div>
  )
}

function GlobeIcon() {
  return (
    <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  )
}

function DownArrow() {
  return (
    <svg className="w-4 h-4 text-status-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  )
}

function UpArrow() {
  return (
    <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  )
}
