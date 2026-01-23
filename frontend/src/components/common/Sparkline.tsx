import { useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  showArea?: boolean
}

export default function Sparkline({
  data,
  width = 60,
  height = 20,
  color = '#39d5ff',
  showArea = true,
}: SparklineProps) {
  const points = useMemo(() => {
    if (data.length === 0) return ''

    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1

    const stepX = width / (data.length - 1 || 1)

    return data
      .map((value, index) => {
        const x = index * stepX
        const y = height - ((value - min) / range) * height
        return `${x},${y}`
      })
      .join(' ')
  }, [data, width, height])

  const areaPath = useMemo(() => {
    if (!showArea || data.length === 0) return ''

    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const stepX = width / (data.length - 1 || 1)

    const linePoints = data.map((value, index) => {
      const x = index * stepX
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    })

    return `M0,${height} L${linePoints.join(' L')} L${width},${height} Z`
  }, [data, width, height, showArea])

  if (data.length === 0) {
    return (
      <svg width={width} height={height} className="text-text-muted">
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={8}>
          No data
        </text>
      </svg>
    )
  }

  return (
    <svg width={width} height={height}>
      {showArea && (
        <path d={areaPath} fill={color} fillOpacity={0.1} />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
