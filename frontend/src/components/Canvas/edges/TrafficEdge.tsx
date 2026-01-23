import { memo } from 'react'
import { BaseEdge, getBezierPath, type Position } from '@xyflow/react'

interface TrafficEdgeData {
  utilization: number
  status: string
}

interface TrafficEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  data?: TrafficEdgeData
  selected?: boolean
}

function getEdgeColor(utilization: number, status: string): string {
  if (status === 'down') return '#f85149'
  if (status === 'degraded') return '#d29922'

  if (utilization >= 85) return '#f85149'
  if (utilization >= 60) return '#d29922'
  if (utilization >= 30) return '#58a6ff'
  return '#30363d'
}

function getEdgeWidth(utilization: number): number {
  if (utilization >= 85) return 4
  if (utilization >= 60) return 3
  if (utilization >= 30) return 2.5
  return 2
}

function TrafficEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: TrafficEdgeProps) {
  const utilization = data?.utilization ?? 0
  const status = data?.status ?? 'up'

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const strokeColor = getEdgeColor(utilization, status)
  const strokeWidth = getEdgeWidth(utilization)

  return (
    <>
      {/* Background path for selection */}
      <BaseEdge
        id={`${id}-bg`}
        path={edgePath}
        style={{
          stroke: 'transparent',
          strokeWidth: 20,
        }}
      />

      {/* Main edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={selected ? '#39d5ff' : strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={status === 'down' ? '5,5' : undefined}
        className={status === 'up' && utilization >= 30 ? 'animate-flow' : ''}
        style={{
          strokeDasharray: status === 'up' && utilization >= 30 ? '8,4' : status === 'down' ? '5,5' : undefined,
        }}
      />

      {/* Utilization label on hover/select */}
      {(selected || utilization >= 60) && (
        <text
          x={(sourceX + targetX) / 2}
          y={(sourceY + targetY) / 2 - 10}
          textAnchor="middle"
          className="text-xs fill-text-secondary"
          style={{ fontSize: '10px' }}
        >
          {utilization.toFixed(0)}%
        </text>
      )}
    </>
  )
}

export default memo(TrafficEdge)
