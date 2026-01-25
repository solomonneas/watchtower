/**
 * PortSquare Component
 *
 * Individual port styled to look like a physical RJ45 or SFP port.
 * Shows status via LED color, details on hover.
 */

import { useState } from 'react'
import type { Interface } from '../../../types/device'
import { formatSpeed } from './portUtils'

interface PortSquareProps {
  interface: Interface
  onClick: () => void
  variant?: 'rj45' | 'sfp'
  position?: 'left' | 'center' | 'right'  // Horizontal tooltip positioning
  tooltipBelow?: boolean  // Show tooltip below port (for top-row ports)
}

export default function PortSquare({ interface: iface, onClick, variant = 'rj45', position = 'center', tooltipBelow = false }: PortSquareProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const hasPoE = iface.poe_enabled
  const isTrunk = iface.is_trunk

  // Determine LED color based on status
  const getLedColor = () => {
    if (iface.admin_status === 'down') return '#333' // Off/disabled
    if (iface.status === 'down') return '#ef4444' // Red - down
    if (iface.utilization >= 80) return '#f59e0b' // Amber - high util
    return '#22c55e' // Green - up
  }

  const getLedGlow = () => {
    if (iface.admin_status === 'down') return 'none'
    if (iface.status === 'down') return '0 0 4px #ef4444'
    if (iface.utilization >= 80) return '0 0 4px #f59e0b'
    return '0 0 4px #22c55e'
  }

  const ledColor = getLedColor()
  const ledGlow = getLedGlow()

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={`Port ${iface.name}: ${iface.status}`}
        style={{
          // RJ45 port styling
          width: variant === 'sfp' ? 24 : 18,
          height: variant === 'sfp' ? 20 : 14,
          background: variant === 'sfp'
            ? 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)'
            : 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
          border: `1px solid ${isTrunk ? '#3b82f6' : '#333'}`,
          borderRadius: variant === 'sfp' ? 2 : 1,
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 0,
          transition: 'transform 0.1s, box-shadow 0.1s',
          boxShadow: isTrunk ? '0 0 4px rgba(59, 130, 246, 0.5)' : 'inset 0 1px 2px rgba(0,0,0,0.5)',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.15)'
          e.currentTarget.style.zIndex = '10'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.zIndex = '0'
        }}
      >
        {/* RJ45 inner socket appearance */}
        {variant === 'rj45' && (
          <div
            style={{
              width: 12,
              height: 8,
              marginTop: 2,
              background: '#000',
              borderRadius: 1,
              border: '1px solid #222',
            }}
          />
        )}

        {/* SFP inner slot appearance */}
        {variant === 'sfp' && (
          <div
            style={{
              width: 18,
              height: 10,
              marginTop: 3,
              background: '#000',
              borderRadius: 1,
              border: '1px solid #222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{
              width: 14,
              height: 4,
              background: '#111',
              borderRadius: 1,
            }} />
          </div>
        )}

        {/* Status LED - positioned at top-left of port */}
        <div
          style={{
            position: 'absolute',
            top: -2,
            left: variant === 'sfp' ? 2 : 1,
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: ledColor,
            boxShadow: ledGlow,
          }}
        />

        {/* PoE indicator - small dot at top-right */}
        {hasPoE && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              right: 1,
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: '#facc15',
              boxShadow: '0 0 3px #facc15',
            }}
          />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            // Vertical positioning
            bottom: tooltipBelow ? 'auto' : '100%',
            top: tooltipBelow ? '100%' : 'auto',
            marginBottom: tooltipBelow ? 0 : 8,
            marginTop: tooltipBelow ? 8 : 0,
            // Horizontal positioning based on port location to prevent cutoff
            left: position === 'left' ? 0 : position === 'right' ? 'auto' : '50%',
            right: position === 'right' ? 0 : 'auto',
            transform: position === 'center' ? 'translateX(-50%)' : 'none',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: '#1e1e1e',
              border: '1px solid #333',
              borderRadius: 6,
              padding: '8px 10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
              minWidth: 120,
            }}
          >
            {/* Port name */}
            <div style={{
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              marginBottom: 4,
            }}>
              {iface.name}
            </div>

            {/* Description/Alias */}
            {iface.alias && (
              <div style={{
                fontSize: 11,
                color: '#888',
                marginBottom: 4,
                maxWidth: 150,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {iface.alias}
              </div>
            )}

            {/* Status row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#aaa',
            }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: ledColor,
                  boxShadow: ledGlow,
                }}
              />
              <span style={{ textTransform: 'capitalize' }}>
                {iface.admin_status === 'down' ? 'disabled' : iface.status}
              </span>
              <span style={{ color: '#555' }}>|</span>
              <span>{formatSpeed(iface.speed)}</span>
            </div>

            {/* Utilization */}
            {iface.utilization > 0 && (
              <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                Util: {iface.utilization.toFixed(0)}%
              </div>
            )}

            {/* Badges */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {isTrunk && (
                <span style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: 3,
                  color: '#60a5fa',
                }}>
                  TRUNK
                </span>
              )}
              {hasPoE && (
                <span style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  background: 'rgba(250, 204, 21, 0.2)',
                  border: '1px solid rgba(250, 204, 21, 0.4)',
                  borderRadius: 3,
                  color: '#facc15',
                }}>
                  PoE
                </span>
              )}
            </div>

            {/* Tooltip arrow */}
            <div
              style={{
                position: 'absolute',
                // Arrow position depends on tooltip direction
                top: tooltipBelow ? 'auto' : '100%',
                bottom: tooltipBelow ? '100%' : 'auto',
                left: position === 'left' ? 12 : position === 'right' ? 'auto' : '50%',
                right: position === 'right' ? 12 : 'auto',
                transform: position === 'center' ? 'translateX(-50%)' : 'none',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                // Arrow points up or down
                borderTop: tooltipBelow ? 'none' : '6px solid #333',
                borderBottom: tooltipBelow ? '6px solid #333' : 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
