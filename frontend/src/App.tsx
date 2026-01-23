import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import Layout from './components/Layout/Layout'
import ToastContainer from './components/Alerts/ToastContainer'
import CriticalOverlay from './components/Alerts/CriticalOverlay'
import { useNocStore } from './store/nocStore'
import { useWebSocket } from './hooks/useWebSocket'
import { fetchTopology } from './api/endpoints'

function App() {
  const setTopology = useNocStore((state) => state.setTopology)
  const setLoading = useNocStore((state) => state.setLoading)
  const setError = useNocStore((state) => state.setError)

  // Connect to WebSocket for real-time updates
  useWebSocket()

  useEffect(() => {
    async function loadTopology() {
      setLoading(true)
      try {
        const topology = await fetchTopology()
        setTopology(topology)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load topology')
      } finally {
        setLoading(false)
      }
    }

    loadTopology()

    // Refresh topology every 60 seconds
    const interval = setInterval(loadTopology, 60000)
    return () => clearInterval(interval)
  }, [setTopology, setLoading, setError])

  return (
    <ReactFlowProvider>
      <Layout />
      <ToastContainer />
      <CriticalOverlay />
    </ReactFlowProvider>
  )
}

export default App
