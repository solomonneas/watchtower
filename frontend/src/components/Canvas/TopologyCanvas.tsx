import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useNocStore } from '../../store/nocStore'
import ClusterNode from './nodes/ClusterNode'
import ExternalNode from './nodes/ExternalNode'
import TrafficEdge from './edges/TrafficEdge'
import type { Topology } from '../../types/topology'
import type { Device } from '../../types/device'

const nodeTypes = {
  cluster: ClusterNode,
  external: ExternalNode,
} as const

const edgeTypes = {
  traffic: TrafficEdge,
} as const

interface ClusterNodeData {
  cluster: { id: string; name: string; icon: string }
  devices: Device[]
}

function topologyToNodes(topology: Topology): Node[] {
  const nodes: Node[] = []

  // Create cluster nodes
  topology.clusters.forEach((cluster) => {
    const clusterDevices = cluster.device_ids
      .map((id) => topology.devices[id])
      .filter(Boolean)

    nodes.push({
      id: cluster.id,
      type: 'cluster',
      position: { x: cluster.position.x, y: cluster.position.y },
      data: {
        cluster,
        devices: clusterDevices,
      },
    })
  })

  // Create external endpoint nodes from external links
  const externalEndpoints = new Map<string, { label: string; type: string; icon: string; x: number; y: number }>()

  topology.external_links.forEach((link, index) => {
    if (!externalEndpoints.has(link.target.label)) {
      // Position external nodes to the left of the topology
      externalEndpoints.set(link.target.label, {
        label: link.target.label,
        type: link.target.type,
        icon: link.target.icon,
        x: 50,
        y: 100 + index * 120,
      })
    }

    // Also add source labels that aren't devices
    if (link.source.label && !externalEndpoints.has(link.source.label)) {
      externalEndpoints.set(link.source.label, {
        label: link.source.label,
        type: 'campus',
        icon: 'building',
        x: 50,
        y: 100 + (index + 1) * 120,
      })
    }
  })

  externalEndpoints.forEach((endpoint, label) => {
    nodes.push({
      id: `external-${label}`,
      type: 'external',
      position: { x: endpoint.x, y: endpoint.y },
      data: {
        label: endpoint.label,
        type: endpoint.type,
        icon: endpoint.icon,
      },
    })
  })

  return nodes
}

function topologyToEdges(topology: Topology): Edge[] {
  const edges: Edge[] = []

  // Create edges between clusters based on connections
  const clusterConnections = new Map<string, { utilization: number; status: string }>()

  topology.connections.forEach((conn) => {
    const sourceDevice = conn.source.device
    const targetDevice = conn.target.device

    if (sourceDevice && targetDevice) {
      const sourceCluster = topology.devices[sourceDevice]?.cluster_id
      const targetCluster = topology.devices[targetDevice]?.cluster_id

      if (sourceCluster && targetCluster && sourceCluster !== targetCluster) {
        const key = [sourceCluster, targetCluster].sort().join('-')
        const existing = clusterConnections.get(key)

        if (!existing || conn.utilization > existing.utilization) {
          clusterConnections.set(key, {
            utilization: conn.utilization,
            status: conn.status,
          })
        }
      }
    }
  })

  clusterConnections.forEach((data, key) => {
    const [source, target] = key.split('-')
    edges.push({
      id: `edge-${key}`,
      source,
      target,
      type: 'traffic',
      data: {
        utilization: data.utilization,
        status: data.status,
      },
    })
  })

  // Create edges for external links
  topology.external_links.forEach((link) => {
    const sourceId = link.source.device
      ? topology.devices[link.source.device]?.cluster_id
      : link.source.label
        ? `external-${link.source.label}`
        : null

    const targetId = `external-${link.target.label}`

    if (sourceId) {
      edges.push({
        id: `edge-${link.id}`,
        source: sourceId,
        target: targetId,
        type: 'traffic',
        data: {
          utilization: link.utilization,
          status: link.status,
        },
      })
    }
  })

  return edges
}

export default function TopologyCanvas() {
  const topology = useNocStore((state) => state.topology)
  const selectDevice = useNocStore((state) => state.selectDevice)

  const initialNodes = useMemo(
    () => (topology ? topologyToNodes(topology) : []),
    [topology]
  )

  const initialEdges = useMemo(
    () => (topology ? topologyToEdges(topology) : []),
    [topology]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes when topology changes
  useEffect(() => {
    if (topology) {
      setNodes(topologyToNodes(topology))
      setEdges(topologyToEdges(topology))
    }
  }, [topology, setNodes, setEdges])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'cluster') {
        const nodeData = node.data as unknown as ClusterNodeData
        if (nodeData.devices && nodeData.devices.length > 0) {
          selectDevice(nodeData.devices[0].id)
        }
      }
    },
    [selectDevice]
  )

  if (!topology) {
    return null
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
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
        <MiniMap
          className="!bg-bg-secondary !border-border-default"
          nodeColor={(node) => {
            if (node.type === 'external') return '#6e7681'
            return '#39d5ff'
          }}
          maskColor="rgba(13, 17, 23, 0.8)"
        />
      </ReactFlow>
    </div>
  )
}
