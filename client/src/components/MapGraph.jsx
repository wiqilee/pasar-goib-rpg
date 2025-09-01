import React, { useMemo, useState } from 'react'

/**
 * MapGraph
 * Props:
 *  - nodes: [{id, name}]
 *  - edges: [{source, target}]
 *  - size: number (svg width & height), default 420
 *  - layout: 'circle' | 'force' (default: 'circle')
 *  - forceIterations: number of physics steps when layout='force' (default: 220)
 *  - current: string | null  -> current location id (yellow blinking)
 *  - visited: string[]       -> visited location ids (green). Others become red.
 */
export default function MapGraph({
  nodes = [],
  edges = [],
  size = 420,
  layout = 'circle',
  forceIterations = 220,
  current = null,
  visited = []
}) {
  const padding = 32
  const cx = size / 2
  const cy = size / 2
  const radius = Math.max(40, (size - padding * 2) / 2)

  const visitedSet = useMemo(() => new Set(visited), [visited])

  const [draggingNode, setDraggingNode] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [hoveredEdge, setHoveredEdge] = useState(null)

  const circularPositions = useMemo(() => {
    const n = nodes.length || 1
    const byId = new Map()
    nodes.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      const x = cx + radius * Math.cos(angle)
      const y = cy + radius * Math.sin(angle)
      byId.set(node.id, { ...node, x, y, vx: 0, vy: 0 })
    })
    return byId
  }, [nodes, cx, cy, radius])

  const forcePositions = useMemo(() => {
    if (layout !== 'force' || nodes.length === 0) return circularPositions

    const pos = new Map()
    circularPositions.forEach((p, id) => pos.set(id, { ...p }))

    const kRepel = 2200
    const kSpring = 0.015
    const restLen = Math.max(60, size / 5)
    const damping = 0.86
    const dt = 1.0

    const N = nodes.length
    const idIndex = new Map(nodes.map((n, i) => [n.id, i]))

    for (let step = 0; step < forceIterations; step++) {
      const fx = new Array(N).fill(0)
      const fy = new Array(N).fill(0)

      const arr = nodes.map(n => pos.get(n.id))

      // repulsion
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = arr[j].x - arr[i].x
          const dy = arr[j].y - arr[i].y
          const dist2 = dx * dx + dy * dy || 0.0001
          const dist = Math.sqrt(dist2)
          const force = 2200 / dist2
          const ux = dx / dist
          const uy = dy / dist
          fx[i] -= force * ux
          fy[i] -= force * uy
          fx[j] += force * ux
          fy[j] += force * uy
        }
      }

      // springs (edges)
      for (const e of edges) {
        const i = idIndex.get(e.source)
        const j = idIndex.get(e.target)
        if (i == null || j == null) continue
        const dx = arr[j].x - arr[i].x
        const dy = arr[j].y - arr[i].y
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001
        const disp = dist - restLen
        const ux = dx / dist
        const uy = dy / dist
        const f = kSpring * disp
        fx[i] += f * ux
        fy[i] += f * uy
        fx[j] -= f * ux
        fy[j] -= f * uy
      }

      for (let i = 0; i < N; i++) {
        const p = arr[i]
        p.vx = (p.vx + fx[i] * dt) * damping
        p.vy = (p.vy + fy[i] * dt) * damping
        p.x += p.vx * dt
        p.y += p.vy * dt

        const margin = 20
        p.x = Math.max(margin, Math.min(size - margin, p.x))
        p.y = Math.max(margin, Math.min(size - margin, p.y))
      }
    }

    const out = new Map()
    nodes.forEach((n) => {
      const p = pos.get(n.id)
      out.set(n.id, p)
    })
    return out
  }, [layout, nodes, edges, circularPositions, size, forceIterations])

  const positions = layout === 'force' ? forcePositions : circularPositions

  const onMouseDown = (e, nodeId) => {
    const p = positions.get(nodeId)
    if (!p) return
    setDraggingNode(nodeId)
    setDragOffset({ x: e.clientX - p.x, y: e.clientY - p.y })
  }

  const onMouseMove = (e) => {
    if (!draggingNode) return
    const { x, y } = dragOffset
    const newX = e.clientX - x
    const newY = e.clientY - y
    const p = positions.get(draggingNode)
    if (!p) return
    p.x = newX
    p.y = newY
  }

  const onMouseUp = () => setDraggingNode(null)

  // color helpers
  const nodeColor = (id) => {
    if (id === current) return '#facc15' // yellow-400
    return visitedSet.has(id) ? '#059669' : '#ef4444' // emerald-600 : red-500
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="w-full h-auto"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* tiny CSS for pulse */}
      <style>{`
        @keyframes mg-pulse {
          0%   { r: 16; opacity: 0.35; }
          70%  { r: 28; opacity: 0; }
          100% { r: 28; opacity: 0; }
        }
        .mg-ring {
          fill: none;
          stroke: #facc15;
          stroke-width: 2;
          animation: mg-pulse 1.6s ease-out infinite;
        }
      `}</style>

      {/* edges */}
      <g stroke="currentColor" strokeOpacity="0.5">
        {edges.map((e, i) => {
          const a = positions.get(e.source)
          const b = positions.get(e.target)
          if (!a || !b) return null
          const isHovered = hoveredEdge === i
          return (
            <line
              key={i}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              strokeWidth="1.25"
              stroke={isHovered ? "red" : "currentColor"}
              onMouseEnter={() => setHoveredEdge(i)}
              onMouseLeave={() => setHoveredEdge(null)}
            />
          )
        })}
      </g>

      {/* nodes */}
      <g>
        {nodes.map((n) => {
          const p = positions.get(n.id)
          if (!p) return null
          const isCurrent = n.id === current
          const fill = nodeColor(n.id)
          return (
            <g
              key={n.id}
              transform={`translate(${p.x}, ${p.y})`}
              onMouseDown={(e) => onMouseDown(e, n.id)}
            >
              {/* pulsing ring for current */}
              {isCurrent && <circle r="16" className="mg-ring" />}
              <circle r="12" fill={fill} />
              <text
                x="0"
                y="-16"
                textAnchor="middle"
                className="fill-slate-200 text-[10px]"
              >
                {n.name}{isCurrent ? ' (You)' : ''}
              </text>
            </g>
          )
        })}
      </g>

      {/* footer label */}
      <text x={size / 2} y={size - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
        Pasar Goib — map overview ({layout} layout)
      </text>
    </svg>
  )
}
