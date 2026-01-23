import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

interface ExternalNodeData {
  label: string
  type: 'campus' | 'ix' | 'cloud'
  icon: string
}

interface ExternalNodeProps {
  data: ExternalNodeData
}

function ExternalNode({ data }: ExternalNodeProps) {
  const { label, type, icon } = data

  return (
    <>
      <Handle type="target" position={Position.Right} className="!bg-border-default" />
      <Handle type="source" position={Position.Right} className="!bg-border-default" />

      <div className="bg-bg-tertiary border border-border-muted rounded-xl px-4 py-3 min-w-[140px] relative">
        <div className="flex items-center gap-2">
          <ExternalIcon type={icon} />
          <div>
            <div className="text-sm font-medium text-text-secondary">{label}</div>
            <div className="text-xs text-text-muted capitalize">{type}</div>
          </div>
        </div>
        {/* Gray hollow dot indicating "not monitored" */}
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-text-muted bg-bg-tertiary" />
      </div>
    </>
  )
}

function ExternalIcon({ type }: { type: string }) {
  const iconClass = 'w-5 h-5 text-text-muted'

  switch (type) {
    case 'building':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    case 'globe':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'cloud':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      )
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
  }
}

export default memo(ExternalNode)
