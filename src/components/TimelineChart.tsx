import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChartMarker, ChartSegment } from '../types'
import { formatIst } from '../lib/time'
import { thinMarkers } from '../lib/transforms'

type TimelineChartProps = {
  from: Date
  to: Date
  segments: ChartSegment[]
  markers: ChartMarker[]
  showIndividual: boolean
}

type HoverState = {
  x: number
  y: number
  marker: ChartMarker
} | null

const colors: Record<ChartSegment['kind'], string> = {
  runtime: '#2ea99a',
  'unplanned-production': '#c7dc3d',
  'unknown-downtime': '#ff7b61',
  stoppage: '#5b50b5',
}

const labels: Record<ChartSegment['kind'], string> = {
  runtime: 'Runtime',
  'unplanned-production': 'Unplanned Production',
  'unknown-downtime': 'Unknown Downtime',
  stoppage: 'Stoppage',
}

export function TimelineChart({ from, to, segments, markers, showIndividual }: TimelineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 900, height: 360 })
  const [domain, setDomain] = useState({ start: from.getTime(), end: to.getTime() })
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragCurrent, setDragCurrent] = useState<number | null>(null)
  const [hover, setHover] = useState<HoverState>(null)

  useEffect(() => {
    setDomain({ start: from.getTime(), end: to.getTime() })
  }, [from, to])

  useEffect(() => {
    if (!wrapperRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: 390 })
    })
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  const visibleMarkers = useMemo(() => {
    const filtered = markers.filter((marker) => marker.timeMs >= domain.start && marker.timeMs <= domain.end)
    return showIndividual ? thinMarkers(filtered, 4500) : filtered
  }, [domain.end, domain.start, markers, showIndividual])

  const maxY = useMemo(() => {
    if (!visibleMarkers.length) return 1
    if (!showIndividual) return Math.max(...visibleMarkers.map((marker) => marker.count ?? 0), 1)
    return Math.max(markers.findIndex((marker) => marker.id === visibleMarkers.at(-1)?.id) + 1, visibleMarkers.length, 1)
  }, [markers, showIndividual, visibleMarkers])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.width, size.height)

    const plot = getPlot(size.width, size.height)
    drawFrame(ctx, plot, size.width, size.height)
    drawSegments(ctx, plot, segments, domain.start, domain.end)
    drawMarkers(ctx, plot, visibleMarkers, maxY, domain.start, domain.end, showIndividual)
    drawTicks(ctx, plot, domain.start, domain.end)

    if (dragStart !== null && dragCurrent !== null) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.16)'
      const start = Math.min(pointerXToCanvas(dragStart, plot), pointerXToCanvas(dragCurrent, plot))
      const end = Math.max(pointerXToCanvas(dragStart, plot), pointerXToCanvas(dragCurrent, plot))
      ctx.fillRect(start, plot.top, end - start, plot.height)
    }
  }, [domain.end, domain.start, dragCurrent, dragStart, markers, maxY, segments, showIndividual, size.height, size.width, visibleMarkers])

  function xFor(ms: number) {
    const plot = getPlot(size.width, size.height)
    return plot.left + ((ms - domain.start) / (domain.end - domain.start)) * plot.width
  }

  function yFor(marker: ChartMarker) {
    const plot = getPlot(size.width, size.height)
    const raw = showIndividual ? marker.sequence : marker.count ?? 0
    return plot.bottom - (raw / maxY) * plot.height
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const plot = getPlot(size.width, size.height)

    if (event.buttons === 1 && dragStart !== null) {
      setDragCurrent(x)
      return
    }

    let closest: { marker: ChartMarker; distance: number } | null = null
    for (const marker of visibleMarkers) {
      const dx = xFor(marker.timeMs) - x
      const dy = yFor(marker) - y
      const distance = dx * dx + dy * dy
      if (distance < 144 && (!closest || distance < closest.distance)) {
        closest = { marker, distance }
      }
    }
    setHover(closest ? { x: Math.min(Math.max(x, plot.left), plot.right - 160), y, marker: closest.marker } : null)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (dragStart === null) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dragEnd = event.clientX - rect.left
    const plot = getPlot(size.width, size.height)
    const start = Math.min(dragStart, dragEnd)
    const end = Math.max(dragStart, dragEnd)
    setDragStart(null)
    setDragCurrent(null)
    if (end - start < 20) return

    const startMs = canvasXToTime(start, plot, domain.start, domain.end)
    const endMs = canvasXToTime(end, plot, domain.start, domain.end)
    if (endMs - startMs >= 60000) setDomain({ start: startMs, end: endMs })
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Production History</h2>
          <p className="text-sm text-slate-500">
            {showIndividual ? `${markers.length.toLocaleString()} individual produces` : 'Hourly cumulative production'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-700">
          {Object.entries(labels).map(([kind, label]) => (
            <span className="inline-flex items-center gap-1.5" key={kind}>
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: colors[kind as ChartSegment['kind']] }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative" ref={wrapperRef}>
        <canvas
          aria-label="Production timeline chart"
          className="h-[390px] w-full touch-none rounded-md border border-slate-200 bg-white"
          onDoubleClick={() => setDomain({ start: from.getTime(), end: to.getTime() })}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            setDragStart(event.clientX - rect.left)
            setDragCurrent(event.clientX - rect.left)
          }}
          onPointerLeave={() => {
            setHover(null)
            setDragStart(null)
            setDragCurrent(null)
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={canvasRef}
        />
        {hover ? (
          <div
            className="pointer-events-none absolute rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg"
            style={{ left: hover.x + 12, top: Math.max(12, hover.y - 48) }}
          >
            <div className="font-semibold text-slate-950">{hover.marker.result === 'COUNT' ? 'Hourly count' : hover.marker.result}</div>
            <div>{formatIst(hover.marker.timestamp)}</div>
            {hover.marker.count ? <div>Cumulative: {hover.marker.count.toLocaleString()}</div> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full border border-slate-300 px-3 py-1">Drag to zoom into a time range · double-click to reset</span>
        <span className="rounded-full border border-slate-300 px-3 py-1">FAIL markers are always preserved when thinning</span>
      </div>
    </section>
  )
}

function getPlot(width: number, height: number) {
  const left = 64
  const rightPad = 22
  const top = 34
  const bottomPad = 52
  return {
    left,
    top,
    right: width - rightPad,
    bottom: height - bottomPad,
    width: width - left - rightPad,
    height: height - top - bottomPad,
  }
}

function canvasXToTime(x: number, plot: ReturnType<typeof getPlot>, start: number, end: number) {
  const clamped = Math.min(Math.max(x, plot.left), plot.right)
  return start + ((clamped - plot.left) / plot.width) * (end - start)
}

function pointerXToCanvas(x: number, plot: ReturnType<typeof getPlot>) {
  return Math.min(Math.max(x, plot.left), plot.right)
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  plot: ReturnType<typeof getPlot>,
  width: number,
  height: number,
) {
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(plot.left, plot.top, plot.width, plot.height)
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  ctx.strokeRect(plot.left, plot.top, plot.width, plot.height)

  ctx.fillStyle = '#64748b'
  ctx.font = '12px ui-sans-serif, system-ui'
  ctx.fillText('Cumulative production', plot.left - 54, plot.top - 10)
  ctx.fillText('Shift time', plot.left + plot.width / 2 - 24, height - 14)
}

function drawSegments(
  ctx: CanvasRenderingContext2D,
  plot: ReturnType<typeof getPlot>,
  segments: ChartSegment[],
  start: number,
  end: number,
) {
  for (const segment of segments) {
    if (segment.endMs < start || segment.startMs > end) continue
    const x = plot.left + ((Math.max(segment.startMs, start) - start) / (end - start)) * plot.width
    const x2 = plot.left + ((Math.min(segment.endMs, end) - start) / (end - start)) * plot.width
    const width = Math.max(x2 - x, 1)
    ctx.fillStyle = colors[segment.kind]
    ctx.fillRect(x, plot.top + 18, width, plot.height - 36)

    if (width > 34) {
      ctx.save()
      ctx.translate(x + width / 2, plot.top + 34)
      ctx.rotate(Math.PI / 2)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 12px ui-sans-serif, system-ui'
      ctx.textAlign = 'left'
      ctx.fillText(labels[segment.kind].replace('Unknown Downtime', 'UNKNOWN').replace('Unplanned Production', 'UNPLANNED'), 0, 4)
      ctx.restore()
    }
  }
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  plot: ReturnType<typeof getPlot>,
  visibleMarkers: ChartMarker[],
  maxY: number,
  start: number,
  end: number,
  showIndividual: boolean,
) {
  if (!visibleMarkers.length) return

  const points = visibleMarkers.map((marker) => {
    const x = plot.left + ((marker.timeMs - start) / (end - start)) * plot.width
      const indexY = showIndividual ? marker.sequence : marker.count ?? 0
    const y = plot.bottom - (indexY / maxY) * plot.height
    return { marker, x, y }
  })

  if (!showIndividual && points.length > 1) {
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2
    ctx.beginPath()
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.stroke()
  }

  for (const point of points) {
    ctx.beginPath()
    ctx.fillStyle = point.marker.result === 'FAIL' ? '#dc2626' : '#2563eb'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.arc(point.x, point.y, showIndividual ? 2.6 : 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

function drawTicks(ctx: CanvasRenderingContext2D, plot: ReturnType<typeof getPlot>, start: number, end: number) {
  ctx.fillStyle = '#475569'
  ctx.strokeStyle = '#94a3b8'
  ctx.font = '12px ui-sans-serif, system-ui'
  ctx.textAlign = 'center'

  const tickCount = 6
  for (let index = 0; index <= tickCount; index += 1) {
    const ratio = index / tickCount
    const x = plot.left + ratio * plot.width
    const time = new Date(start + ratio * (end - start))
    ctx.beginPath()
    ctx.moveTo(x, plot.bottom)
    ctx.lineTo(x, plot.bottom + 8)
    ctx.stroke()
    ctx.fillText(formatIst(time, 'HH:mm'), x, plot.bottom + 28)
  }
}
