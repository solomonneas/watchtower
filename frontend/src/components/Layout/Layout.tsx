import Header from './Header'
import Sidebar from './Sidebar'
import TopologyCanvas from '../Canvas/TopologyCanvas'
import { useNocStore } from '../../store/nocStore'

export default function Layout() {
  const isLoading = useNocStore((state) => state.isLoading)
  const error = useNocStore((state) => state.error)
  const sidebarOpen = useNocStore((state) => state.sidebarOpen)

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="text-status-red text-xl mb-2">Connection Error</div>
          <div className="text-text-secondary">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-bg-secondary border border-border-default rounded hover:bg-bg-tertiary transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        {/* Main canvas area */}
        <main className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
                <span className="text-text-secondary">Loading topology...</span>
              </div>
            </div>
          ) : (
            <TopologyCanvas />
          )}
          {/* GitHub attribution */}
          <a
            href="https://github.com/solomonneas/watchtower"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            solomonneas
          </a>
        </main>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 border-l border-border-default bg-bg-secondary flex-shrink-0 overflow-hidden">
            <Sidebar />
          </aside>
        )}
      </div>
    </div>
  )
}
