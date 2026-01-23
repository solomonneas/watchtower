import { useNocStore } from '../../store/nocStore'
import DeviceCard from '../Sidebar/DeviceCard'
import ConnectionCard from '../Sidebar/ConnectionCard'
import NetworkSummary from '../Sidebar/NetworkSummary'

export default function Sidebar() {
  const selectedDevice = useNocStore((state) => state.selectedDevice)
  const selectedConnection = useNocStore((state) => state.selectedConnection)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        {selectedDevice ? (
          <DeviceCard device={selectedDevice} />
        ) : selectedConnection ? (
          <ConnectionCard connection={selectedConnection} />
        ) : (
          <NetworkSummary />
        )}
      </div>

      {/* Footer with quick actions */}
      <div className="p-3 border-t border-border-default">
        <div className="text-xs text-text-muted text-center">
          Click a device or connection for details
        </div>
      </div>
    </div>
  )
}
