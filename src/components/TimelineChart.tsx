import { useEffect, useMemo, useRef, useState } from 'react'
import { Paper } from '@mui/material'
import type { ChartMarker, ChartSegment } from '../types'
import { formatIst } from '../lib/time'
import { thinMarkers } from '../lib/transforms'

type TimelineChartProps = {
  from: Date
  to: Date
  segments: ChartSegment[]
  markers: ChartMarker[]
  showIndividual: boolean
  onShowIndividualChange?: (value: boolean) => void
}

type HoverState = {
  x: number
  y: number
  marker: ChartMarker
} | null

type PlotPoint = {
  marker: ChartMarker
  x: number
  y: number
}

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

export function TimelineChart({ from, to, segments, markers, showIndividual, onShowIndividualChange }: TimelineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 900, height: 360 })
  const [domain, setDomain] = useState({ start: from.getTime(), end: to.getTime() })
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragCurrent, setDragCurrent] = useState<number | null>(null)
  const [hover, setHover] = useState<HoverState>(null)
  const [showPointLabels, setShowPointLabels] = useState(true)
  const dragFrameRef = useRef<number | null>(null)

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

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current)
    }
  }, [])

  const plot = useMemo(() => getPlot(size.width, size.height), [size.height, size.width])

  const visibleMarkers = useMemo(() => {
    const filtered = markers.filter((marker) => marker.timeMs >= domain.start && marker.timeMs <= domain.end)
    return showIndividual ? thinMarkers(filtered, 4500) : filtered
  }, [domain.end, domain.start, markers, showIndividual])

  const rawMaxY = useMemo(() => {
    if (!visibleMarkers.length) return 1
    if (!showIndividual) return Math.max(...visibleMarkers.map((marker) => marker.count ?? 0), 1)
    return Math.max(markers.length, visibleMarkers.length, 1)
  }, [markers.length, showIndividual, visibleMarkers])

  const { yMax, yTicks } = useMemo(() => niceYAxis(rawMaxY), [rawMaxY])

  const plotPoints = useMemo(
    () => makePlotPoints(visibleMarkers, yMax, domain.start, domain.end, plot, showIndividual),
    [domain.end, domain.start, yMax, plot, showIndividual, visibleMarkers],
  )

  const partModels = useMemo(
    () => [...new Set(markers.map((marker) => marker.partModelId).filter(Boolean))],
    [markers],
  )

  const lastProduce = useMemo(
    () => (markers.length ? markers.reduce((latest, marker) => (marker.timeMs > latest.timeMs ? marker : latest)) : null),
    [markers],
  )

  const unknownSummary = useMemo(() => {
    const unknown = segments.filter((segment) => segment.kind === 'unknown-downtime')
    const minutes = unknown.reduce((sum, segment) => sum + (segment.endMs - segment.startMs) / 60000, 0)
    return { count: unknown.length, minutes }
  }, [segments])

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

    drawFrame(ctx, plot, size.width, size.height)
    drawSegments(ctx, plot, segments, domain.start, domain.end)
    drawMarkers(ctx, plot, plotPoints, showIndividual, showPointLabels)
    drawNowLine(ctx, plot, domain.start, domain.end)
    drawTicks(ctx, plot, domain.start, domain.end, yMax, yTicks)

    if (dragStart !== null && dragCurrent !== null) {
      ctx.fillStyle = 'rgba(37, 99, 235, 0.16)'
      const start = Math.min(pointerXToCanvas(dragStart, plot), pointerXToCanvas(dragCurrent, plot))
      const end = Math.max(pointerXToCanvas(dragStart, plot), pointerXToCanvas(dragCurrent, plot))
      ctx.fillRect(start, plot.top, end - start, plot.height)
    }
  }, [domain.end, domain.start, dragCurrent, dragStart, plot, plotPoints, segments, showIndividual, showPointLabels, size.height, size.width, yMax, yTicks])

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (event.buttons === 1 && dragStart !== null) {
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = requestAnimationFrame(() => {
        setDragCurrent(x)
        dragFrameRef.current = null
      })
      return
    }

    let closest: { point: PlotPoint; distance: number } | null = null
    const startIndex = lowerBoundByX(plotPoints, x - 12)
    for (let index = startIndex; index < plotPoints.length; index += 1) {
      const point = plotPoints[index]
      if (point.x > x + 12) break
      const dx = point.x - x
      const dy = point.y - y
      const distance = dx * dx + dy * dy
      if (distance < 144 && (!closest || distance < closest.distance)) {
        closest = { point, distance }
      }
    }
    setHover(closest ? { x: Math.min(Math.max(x, plot.left), plot.right - 160), y, marker: closest.point.marker } : null)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (dragStart === null) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dragEnd = event.clientX - rect.left
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
    <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Production History</h2>
          {partModels.length ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>Part Models:</span>
              {partModels.map((model) => (
                <span className="inline-flex items-center gap-1" key={model}>
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />
                  {model}
                </span>
              ))}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              {showIndividual ? `${markers.length.toLocaleString()} individual produces` : 'Hourly cumulative production'}
            </p>
          )}
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

      <div className="mb-3 flex flex-wrap items-center gap-5">
        <Toggle checked={showPointLabels} label="Point labels" onChange={setShowPointLabels} />
        <Toggle checked={showIndividual} label="Show Individual produces" onChange={(value) => onShowIndividualChange?.(value)} />
      </div>

      <div className="relative" ref={wrapperRef}>
        <canvas
          aria-label="Production timeline chart"
          className="h-[390px] w-full touch-none rounded-md border border-slate-200 bg-white"
          onDoubleClick={() => setDomain({ start: from.getTime(), end: to.getTime() })}
          onPointerDown={(event) => {
            if (!event.shiftKey) return
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
        <span className="rounded-full border border-slate-300 px-3 py-1">Shift + drag to zoom into a time range · double-click to reset</span>
        <span className="rounded-full border border-slate-300 px-3 py-1">Colored lines = cumulative production (OK + NG) per part model</span>
        {showIndividual ? (
          <span className="rounded-full border border-slate-300 px-3 py-1">FAIL markers are always preserved when thinning</span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-col items-start gap-2">
        {lastProduce ? (
          <span className="rounded-full border border-blue-900 bg-white px-3 py-1 text-xs font-semibold text-blue-950">
            Last observed produce at: {formatIst(lastProduce.timestamp)}
          </span>
        ) : null}
        {unknownSummary.count ? (
          <span className="rounded-full border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-600">
            ⚠ {unknownSummary.count} unknown segments · {unknownSummary.minutes.toFixed(1)} min
          </span>
        ) : null}
      </div>
    </Paper>
  )
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button
      aria-checked={checked}
      className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700"
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-indigo-900' : 'bg-slate-300'}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
      {label}
    </button>
  )
}

function getPlot(width: number, height: number) {
  const left = 44
  const rightPad = 12
  const top = 36
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

// Vertical inset for the data line so dots never touch the frame
// and always stay inside the colored status bands.
const LINE_PAD_TOP = 16
const LINE_PAD_BOTTOM = 14

function yToCanvas(value: number, yMax: number, plot: ReturnType<typeof getPlot>) {
  const usableHeight = plot.height - LINE_PAD_TOP - LINE_PAD_BOTTOM
  return plot.bottom - LINE_PAD_BOTTOM - (value / yMax) * usableHeight
}

// Nice axis with 3 ticks (0, step, 2 * step) so a max of 460
// renders as 0 - 250 - 500 like the reference design.
function niceYAxis(rawMax: number) {
  const safe = Math.max(rawMax, 1)
  const target = safe / 2
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const normalized = target / magnitude
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  const step = niceNormalized * magnitude
  return { yMax: step * 2, yTicks: [0, step, step * 2] }
}

function formatYTick(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
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
  ctx.font = '500 12px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Cumulative production', plot.left, plot.top - 12)
  ctx.textAlign = 'center'
  ctx.fillText('Shift time', plot.left + plot.width / 2, height - 14)
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
    // Fill the full plot height so the cumulative line always
    // stays inside the colored portion.
    ctx.fillRect(x, plot.top, width, plot.height)

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

function makePlotPoints(
  visibleMarkers: ChartMarker[],
  maxY: number,
  start: number,
  end: number,
  plot: ReturnType<typeof getPlot>,
  showIndividual: boolean,
) {
  return visibleMarkers.map((marker) => {
    const x = plot.left + ((marker.timeMs - start) / (end - start)) * plot.width
    const indexY = showIndividual ? marker.sequence : marker.count ?? 0
    return { marker, x, y: yToCanvas(indexY, maxY, plot) }
  })
}

function lowerBoundByX(points: PlotPoint[], x: number) {
  let low = 0
  let high = points.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (points[middle].x < x) low = middle + 1
    else high = middle
  }
  return low
}

function drawMarkers(
  ctx: CanvasRenderingContext2D,
  plot: ReturnType<typeof getPlot>,
  points: PlotPoint[],
  showIndividual: boolean,
  showPointLabels: boolean,
) {
  if (!points.length) return

  // Clip the line + dots to the plot frame so nothing paints
  // over the border or outside the colored bands.
  ctx.save()
  ctx.beginPath()
  ctx.rect(plot.left, plot.top, plot.width, plot.height)
  ctx.clip()

  if (!showIndividual && points.length > 1) {
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
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

  if (showPointLabels && !showIndividual) {
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const point of points) {
      const text = String(point.marker.count ?? point.marker.sequence)
      const textWidth = ctx.measureText(text).width
      const rightX = point.x + 8
      const textX = rightX + textWidth > plot.right ? point.x - 8 - textWidth : rightX
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.strokeText(text, textX, point.y)
      ctx.fillStyle = '#1d4ed8'
      ctx.fillText(text, textX, point.y)
    }
  }

  ctx.restore()
}

function drawNowLine(ctx: CanvasRenderingContext2D, plot: ReturnType<typeof getPlot>, start: number, end: number) {
  const nowMs = Date.now()
  if (nowMs < start || nowMs > end) return
  const x = plot.left + ((nowMs - start) / (end - start)) * plot.width

  ctx.save()
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, plot.top)
  ctx.lineTo(x, plot.bottom)
  ctx.stroke()

  const label = 'NOW'
  ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif'
  const badgeWidth = ctx.measureText(label).width + 14
  const badgeHeight = 16
  const badgeX = Math.min(Math.max(x - badgeWidth / 2, plot.left), plot.right - badgeWidth)
  const badgeY = plot.top - badgeHeight - 6
  ctx.fillStyle = '#2563eb'
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4)
    ctx.fill()
  } else {
    ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight)
  }
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 0.5)
  ctx.restore()
}

function xTickStep(spanMs: number) {
  const choices = [15, 30, 60, 120, 240]
  for (const minutes of choices) {
    if (spanMs / (minutes * 60000) <= 7) return minutes * 60000
  }
  return 240 * 60000
}

function drawTicks(
  ctx: CanvasRenderingContext2D,
  plot: ReturnType<typeof getPlot>,
  start: number,
  end: number,
  yMax: number,
  yTicks: number[],
) {
  ctx.fillStyle = '#64748b'
  ctx.strokeStyle = '#94a3b8'
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif'

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const tick of yTicks) {
    const y = yToCanvas(tick, yMax, plot)
    ctx.beginPath()
    ctx.moveTo(plot.left - 4, y)
    ctx.lineTo(plot.left, y)
    ctx.stroke()
    ctx.fillText(formatYTick(tick), plot.left - 8, y)
  }

  ctx.font = '12px ui-sans-serif, system-ui'
  ctx.textBaseline = 'alphabetic'
  const step = xTickStep(end - start)
  const times: number[] = [start]
  let cursor = start + step
  while (cursor < end) {
    times.push(cursor)
    cursor += step
  }
  if (times[times.length - 1] !== end) times.push(end)

  times.forEach((time, index) => {
    const x = plot.left + ((time - start) / (end - start)) * plot.width
    ctx.beginPath()
    ctx.moveTo(x, plot.bottom)
    ctx.lineTo(x, plot.bottom + 8)
    ctx.stroke()
    ctx.textAlign = index === 0 ? 'left' : index === times.length - 1 ? 'right' : 'center'
    ctx.fillText(formatIst(new Date(time), 'HH:mm'), x, plot.bottom + 28)
  })
}
