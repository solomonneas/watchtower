import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useNocStore } from '../../store/nocStore'
import ClusterNode from './nodes/ClusterNode'
import DeviceNode from './nodes/DeviceNode'
import ExternalNode from './nodes/ExternalNode'
import TrafficEdge from './edges/TrafficEdge'
import PhysicalLinkEdge from './edges/PhysicalLinkEdge'
import type { Topology, Cluster } from '../../types/topology'

const nodeTypes = {
  cluster: ClusterNode,
  device: DeviceNode,
  external: ExternalNode,
} as const

const edgeTypes = {
  traffic: TrafficEdge,
  physical: PhysicalLinkEdge,
} as const

const STORAGE_KEY = 'watchtower-node-positions'

// Node size constants for collision detection
const NODE_SIZES: Record<string, { width: number; height: number }> = {
  cluster: { width: 180, height: 120 },
  device: { width: 160, height: 80 },
  external: { width: 140, height: 100 },
}

const PADDING = 40 // Padding between nodes

// Load saved positions from localStorage
function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

// Save positions to localStorage
function savePositions(positions: Record<string, { x: number; y: number }>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
  } catch {
    // localStorage might be full or disabled
  }
}

// Clear saved positions
function clearSavedPositions() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// Bounding box type
interface BoundingBox {
  id: string
  clusterId?: string // For device nodes, track which cluster they belong to
  x: number
  y: number
  width: number
  height: number
  right: number
  bottom: number
}

// Calculate bounding box for a node
function getNodeBoundingBox(node: Node): BoundingBox {
  const size = NODE_SIZES[node.type || 'cluster'] || NODE_SIZES.cluster
  return {
    id: node.id,
    clusterId: (node.data as { clusterId?: string })?.clusterId,
    x: node.position.x - PADDING,
    y: node.position.y - PADDING,
    width: size.width + PADDING * 2,
    height: size.height + PADDING * 2,
    right: node.position.x + size.width + PADDING,
    bottom: node.position.y + size.height + PADDING,
  }
}

// Check if two bounding boxes overlap
function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.right < b.x || b.right < a.x || a.bottom < b.y || b.bottom < a.y)
}

// Calculate how much to push box B away from box A
function calculatePushVector(
  a: BoundingBox,
  b: BoundingBox
): { x: number; y: number } {
  // Calculate overlap on each axis
  const overlapX =
    Math.min(a.right, b.right) - Math.max(a.x, b.x)
  const overlapY =
    Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)

  // Calculate centers
  const aCenterX = a.x + a.width / 2
  const aCenterY = a.y + a.height / 2
  const bCenterX = b.x + b.width / 2
  const bCenterY = b.y + b.height / 2

  // Push in the direction of least overlap, away from A's center
  if (overlapX < overlapY) {
    // Push horizontally
    const direction = bCenterX > aCenterX ? 1 : -1
    return { x: overlapX * direction + PADDING * direction, y: 0 }
  } else {
    // Push vertically
    const direction = bCenterY > aCenterY ? 1 : -1
    return { x: 0, y: overlapY * direction + PADDING * direction }
  }
}

// Resolve all overlaps between nodes
function resolveOverlaps(
  nodes: Node[],
  expandedClusterIds: Set<string>
): Node[] {
  const result = nodes.map((n) => ({ ...n, position: { ...n.position } }))
  const maxIterations = 50 // Prevent infinite loops
  let iteration = 0
  let hasOverlap = true

  while (hasOverlap && iteration < maxIterations) {
    hasOverlap = false
    iteration++

    // Build bounding boxes
    const boxes = result.map(getNodeBoundingBox)

    // Group device nodes by their cluster
    const clusterDeviceBoxes = new Map<string, BoundingBox[]>()
    boxes.forEach((box) => {
      if (box.clusterId) {
        const existing = clusterDeviceBoxes.get(box.clusterId) || []
        existing.push(box)
        clusterDeviceBoxes.set(box.clusterId, existing)
      }
    })

    // Calculate expanded cluster bounding boxes (encompasses all device nodes)
    const expandedClusterBounds = new Map<string, BoundingBox>()
    clusterDeviceBoxes.forEach((deviceBoxes, clusterId) => {
      if (deviceBoxes.length > 0) {
        const minX = Math.min(...deviceBoxes.map((b) => b.x))
        const minY = Math.min(...deviceBoxes.map((b) => b.y))
        const maxRight = Math.max(...deviceBoxes.map((b) => b.right))
        const maxBottom = Math.max(...deviceBoxes.map((b) => b.bottom))
        expandedClusterBounds.set(clusterId, {
          id: clusterId,
          x: minX,
          y: minY,
          width: maxRight - minX,
          height: maxBottom - minY,
          right: maxRight,
          bottom: maxBottom,
        })
      }
    })

    // Check each pair of "groups" (collapsed clusters, expanded cluster bounds, externals)
    for (let i = 0; i < result.length; i++) {
      const nodeA = result[i]
      const boxA = boxes[i]

      // Skip device nodes - they move with their cluster
      if (nodeA.type === 'device') continue

      // Get the effective bounding box for this node
      let effectiveBoxA = boxA
      if (nodeA.type === 'cluster' && expandedClusterIds.has(nodeA.id)) {
        // This shouldn't happen since expanded clusters become device nodes
        continue
      }

      for (let j = i + 1; j < result.length; j++) {
        const nodeB = result[j]
        const boxB = boxes[j]

        // Skip device nodes in same cluster
        if (nodeB.type === 'device') continue

        let effectiveBoxB = boxB

        // Check for overlap
        if (boxesOverlap(effectiveBoxA, effectiveBoxB)) {
          hasOverlap = true
          const push = calculatePushVector(effectiveBoxA, effectiveBoxB)

          // Push node B
          result[j].position.x += push.x
          result[j].position.y += push.y
        }
      }
    }

    // Now check expanded clusters against other nodes
    expandedClusterBounds.forEach((clusterBound, clusterId) => {
      for (let i = 0; i < result.length; i++) {
        const node = result[i]
        const box = boxes[i]

        // Skip nodes that belong to this cluster
        if (node.type === 'device' && (node.data as { clusterId?: string })?.clusterId === clusterId) {
          continue
        }

        // Skip other device nodes (they'll move with their cluster)
        if (node.type === 'device') continue

        // Check if this node overlaps with the expanded cluster
        if (boxesOverlap(clusterBound, box)) {
          hasOverlap = true
          const push = calculatePushVector(clusterBound, box)

          // Push the node
          result[i].position.x += push.x
          result[i].position.y += push.y
        }
      }
    })

    // Check expanded clusters against each other
    const clusterIds = Array.from(expandedClusterBounds.keys())
    for (let i = 0; i < clusterIds.length; i++) {
      for (let j = i + 1; j < clusterIds.length; j++) {
        const boundA = expandedClusterBounds.get(clusterIds[i])!
        const boundB = expandedClusterBounds.get(clusterIds[j])!

        if (boxesOverlap(boundA, boundB)) {
          hasOverlap = true
          const push = calculatePushVector(boundA, boundB)

          // Push all devices in cluster B
          result.forEach((node) => {
            if (
              node.type === 'device' &&
              (node.data as { clusterId?: string })?.clusterId === clusterIds[j]
            ) {
              node.position.x += push.x
              node.position.y += push.y
            }
          })
        }
      }
    }
  }

  return result
}

// Calculate positions for expanded device nodes in a grid layout
function getExpandedDevicePositions(
  cluster: Cluster,
  deviceCount: number,
  savedPositions: Record<string, { x: number; y: number }>,
  deviceIds: string[]
): { x: number; y: number }[] {
  // Use 3 columns for better spacing
  const cols = Math.min(3, deviceCount)
  const rows = Math.ceil(deviceCount / cols)
  const spacingX = 200
  const spacingY = 120

  // Center the grid on the cluster position
  const gridWidth = (cols - 1) * spacingX
  const gridHeight = (rows - 1) * spacingY
  const startX = cluster.position.x - gridWidth / 2
  const startY = cluster.position.y - gridHeight / 2

  return Array.from({ length: deviceCount }, (_, i) => {
    const deviceId = deviceIds[i]
    // Use saved position if available
    if (savedPositions[deviceId]) {
      return savedPositions[deviceId]
    }
    // Otherwise calculate grid position
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      x: startX + col * spacingX,
      y: startY + row * spacingY,
    }
  })
}

// Generate automatic layout positions for clusters if not defined well
function getClusterDefaultPosition(
  index: number,
  totalClusters: number,
  cluster: Cluster
): { x: number; y: number } {
  // If cluster has a reasonable position from config, use it
  if (cluster.position.x > 0 || cluster.position.y > 0) {
    return { x: cluster.position.x, y: cluster.position.y }
  }

  // Otherwise generate a grid layout
  const cols = Math.ceil(Math.sqrt(totalClusters))
  const spacingX = 400
  const spacingY = 300
  const col = index % cols
  const row = Math.floor(index / cols)

  return {
    x: 300 + col * spacingX,
    y: 150 + row * spacingY,
  }
}

function topologyToNodes(
  topology: Topology,
  expandedClusters: Set<string>,
  savedPositions: Record<string, { x: number; y: number }>
): Node[] {
  const nodes: Node[] = []

  // Create cluster or device nodes based on expansion state
  topology.clusters.forEach((cluster, index) => {
    const clusterDevices = cluster.device_ids
      .map((id) => topology.devices[id])
      .filter(Boolean)
    const deviceIds = clusterDevices.map((d) => d.id)

    // Get default position for this cluster
    const defaultPos = getClusterDefaultPosition(index, topology.clusters.length, cluster)

    if (expandedClusters.has(cluster.id)) {
      // Use saved cluster position or default for calculating device grid
      const clusterPos = savedPositions[cluster.id] || defaultPos
      const clusterWithPos = { ...cluster, position: clusterPos }

      // Render individual device nodes in a grid layout
      const positions = getExpandedDevicePositions(
        clusterWithPos,
        clusterDevices.length,
        savedPositions,
        deviceIds
      )

      clusterDevices.forEach((device, deviceIndex) => {
        nodes.push({
          id: device.id,
          type: 'device',
          position: positions[deviceIndex],
          data: {
            device,
            clusterId: cluster.id,
            clusterColor: '#39d5ff',
          },
        })
      })
    } else {
      // Render collapsed cluster node - use saved position or default
      const position = savedPositions[cluster.id] || defaultPos
      nodes.push({
        id: cluster.id,
        type: 'cluster',
        position,
        data: {
          cluster,
          devices: clusterDevices,
        },
      })
    }
  })

  // Create external endpoint nodes from external links
  const externalEndpoints = new Map<string, { label: string; type: string; icon: string; x: number; y: number }>()

  topology.external_links.forEach((link, index) => {
    if (!externalEndpoints.has(link.target.label)) {
      externalEndpoints.set(link.target.label, {
        label: link.target.label,
        type: link.target.type,
        icon: link.target.icon,
        x: 50,
        y: 150 + index * 150,
      })
    }

    if (link.source.label && !externalEndpoints.has(link.source.label)) {
      externalEndpoints.set(link.source.label, {
        label: link.source.label,
        type: 'campus',
        icon: 'building',
        x: 50,
        y: 150 + (index + 1) * 150,
      })
    }
  })

  externalEndpoints.forEach((endpoint, label) => {
    const nodeId = `external-${label}`
    const position = savedPositions[nodeId] || { x: endpoint.x, y: endpoint.y }
    nodes.push({
      id: nodeId,
      type: 'external',
      position,
      data: {
        label: endpoint.label,
        type: endpoint.type,
        icon: endpoint.icon,
      },
    })
  })

  return nodes
}

function topologyToEdges(
  topology: Topology,
  expandedClusters: Set<string>
): Edge[] {
  const edges: Edge[] = []
  const addedEdges = new Set<string>()

  // Helper to determine edge status based on device states
  const getEdgeStatus = (sourceDeviceId: string, targetDeviceId: string, connStatus: string): string => {
    const sourceDevice = topology.devices[sourceDeviceId]
    const targetDevice = topology.devices[targetDeviceId]

    // If either device is down, the edge is down
    if (sourceDevice?.status === 'down' || targetDevice?.status === 'down') {
      return 'down'
    }
    // If either device is degraded, show degraded
    if (sourceDevice?.status === 'degraded' || targetDevice?.status === 'degraded') {
      return 'degraded'
    }
    // Otherwise use the connection's own status
    return connStatus ?? 'up'
  }

  // Process all device-to-device connections
  topology.connections.forEach((conn) => {
    const sourceDevice = conn.source.device
    const targetDevice = conn.target.device

    if (sourceDevice && targetDevice) {
      const sourceCluster = topology.devices[sourceDevice]?.cluster_id
      const targetCluster = topology.devices[targetDevice]?.cluster_id

      if (!sourceCluster || !targetCluster) return

      const sourceExpanded = expandedClusters.has(sourceCluster)
      const targetExpanded = expandedClusters.has(targetCluster)

      // Determine actual source/target node IDs based on expansion state
      let actualSource: string
      let actualTarget: string

      if (sourceExpanded && targetExpanded) {
        actualSource = sourceDevice
        actualTarget = targetDevice
      } else if (sourceExpanded) {
        actualSource = sourceDevice
        actualTarget = targetCluster
      } else if (targetExpanded) {
        actualSource = sourceCluster
        actualTarget = targetDevice
      } else {
        actualSource = sourceCluster
        actualTarget = targetCluster
      }

      if (actualSource === actualTarget) return

      const edgeKey = [actualSource, actualTarget].sort().join('--')

      if (!addedEdges.has(edgeKey)) {
        addedEdges.add(edgeKey)

        // Determine status based on device states
        const edgeStatus = getEdgeStatus(sourceDevice, targetDevice, conn.status)

        edges.push({
          id: `edge-${edgeKey}`,
          source: actualSource,
          target: actualTarget,
          type: 'physical',
          data: {
            sourcePort: conn.source?.port,
            targetPort: conn.target?.port,
            speed: conn.speed ?? 1000,
            utilization: conn.utilization ?? 0,
            status: edgeStatus,
            connectionType: conn.connection_type,
            description: conn.description,
          },
        })
      }
    }
  })

  // Create edges for external links
  topology.external_links.forEach((link) => {
    const sourceDeviceId = link.source.device
    const sourceCluster = sourceDeviceId
      ? topology.devices[sourceDeviceId]?.cluster_id
      : null

    let sourceId: string | null

    if (sourceDeviceId && sourceCluster) {
      sourceId = expandedClusters.has(sourceCluster) ? sourceDeviceId : sourceCluster
    } else if (link.source.label) {
      sourceId = `external-${link.source.label}`
    } else {
      sourceId = null
    }

    const targetId = `external-${link.target.label}`

    if (sourceId) {
      // Check if source device is down
      let externalLinkStatus = link.status ?? 'up'
      if (sourceDeviceId) {
        const sourceDevice = topology.devices[sourceDeviceId]
        if (sourceDevice?.status === 'down') {
          externalLinkStatus = 'down'
        } else if (sourceDevice?.status === 'degraded') {
          externalLinkStatus = 'degraded'
        }
      }

      edges.push({
        id: `edge-${link.id}`,
        source: sourceId,
        target: targetId,
        type: 'physical',
        data: {
          sourcePort: link.source?.port,
          speed: link.speed ?? 1000,
          utilization: link.utilization ?? 0,
          status: externalLinkStatus,
          connectionType: 'wan',
          description: link.description,
        },
      })
    }
  })

  return edges
}

function TopologyCanvasInner() {
  const topology = useNocStore((state) => state.topology)
  const expandedClusters = useNocStore((state) => state.expandedClusters)
  const selectDevice = useNocStore((state) => state.selectDevice)
  const toggleClusterExpanded = useNocStore((state) => state.toggleClusterExpanded)
  const { fitView } = useReactFlow()

  const [resetCounter, setResetCounter] = useState(0)
  const savedPositionsRef = useRef<Record<string, { x: number; y: number }>>(
    loadSavedPositions()
  )
  const prevExpandedRef = useRef<Set<string>>(new Set())

  // Generate nodes and resolve overlaps
  const processedNodes = useMemo(() => {
    if (!topology) return []

    let nodes = topologyToNodes(topology, expandedClusters, savedPositionsRef.current)

    // Only resolve overlaps if clusters changed (not on initial load with saved positions)
    const expandedChanged =
      expandedClusters.size !== prevExpandedRef.current.size ||
      [...expandedClusters].some((id) => !prevExpandedRef.current.has(id))

    if (expandedChanged || resetCounter > 0) {
      nodes = resolveOverlaps(nodes, expandedClusters)
    }

    return nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topology, expandedClusters, resetCounter])

  const initialEdges = useMemo(
    () => (topology ? topologyToEdges(topology, expandedClusters) : []),
    [topology, expandedClusters]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(processedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Handle node position changes (dragging)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)

      changes.forEach((change) => {
        if (change.type === 'position' && change.dragging === false && change.position) {
          savedPositionsRef.current[change.id] = {
            x: change.position.x,
            y: change.position.y,
          }
          savePositions(savedPositionsRef.current)
        }
      })
    },
    [onNodesChange]
  )

  // Reset layout to defaults
  const handleResetLayout = useCallback(() => {
    clearSavedPositions()
    savedPositionsRef.current = {}
    prevExpandedRef.current = new Set()
    setResetCounter((c) => c + 1)
  }, [])

  // Update nodes when topology or expanded state changes
  useEffect(() => {
    if (topology) {
      let newNodes = topologyToNodes(topology, expandedClusters, savedPositionsRef.current)

      // Check if expansion state changed
      const expandedChanged =
        expandedClusters.size !== prevExpandedRef.current.size ||
        [...expandedClusters].some((id) => !prevExpandedRef.current.has(id))

      if (expandedChanged) {
        // Resolve overlaps when clusters expand/collapse
        newNodes = resolveOverlaps(newNodes, expandedClusters)

        // Save the new positions after collision resolution
        newNodes.forEach((node) => {
          if (node.type === 'cluster' || node.type === 'external') {
            savedPositionsRef.current[node.id] = { ...node.position }
          }
        })
        savePositions(savedPositionsRef.current)

        // Fit view after a short delay to show new layout
        setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50)
      }

      prevExpandedRef.current = new Set(expandedClusters)
      setNodes(newNodes)
      setEdges(topologyToEdges(topology, expandedClusters))
    }
  }, [topology, expandedClusters, setNodes, setEdges, resetCounter, fitView])

  // Single click: select device for sidebar details
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'device') {
        selectDevice(node.id)
      }
    },
    [selectDevice]
  )

  // Double click: toggle expand/collapse
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'cluster') {
        toggleClusterExpanded(node.id)
      } else if (node.type === 'device') {
        const clusterId = (node.data as { clusterId?: string }).clusterId
        if (clusterId) {
          toggleClusterExpanded(clusterId)
        }
      }
    },
    [toggleClusterExpanded]
  )

  if (!topology) {
    return null
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      defaultEdgeOptions={{
        type: 'traffic',
        animated: true,
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#30363d" gap={20} size={1} />
      <Controls
        className="!bg-bg-secondary !border-border-default !rounded-lg"
        showInteractive={false}
      />
      <Panel position="top-right" className="flex gap-2">
        <button
          onClick={handleResetLayout}
          className="px-3 py-1.5 text-xs bg-bg-secondary border border-border-default rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          title="Reset all nodes to default positions"
        >
          Reset Layout
        </button>
      </Panel>
      <MiniMap
        className="!bg-bg-secondary !border-border-default"
        nodeColor={(node) => {
          if (node.type === 'external') return '#6e7681'
          if (node.type === 'device') return '#58a6ff'
          return '#39d5ff'
        }}
        maskColor="rgba(13, 17, 23, 0.8)"
        pannable
        zoomable
      />
    </ReactFlow>
  )
}

export default function TopologyCanvas() {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <TopologyCanvasInner />
      </ReactFlowProvider>
    </div>
  )
}
