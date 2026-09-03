import type {
  AssetNode,
  ChartMarker,
  ChartSegment,
  CycleTimeBucket,
  HourBucket,
  MachineIntervals,
  ProduceBucket,
  ProduceCount,
} from '../types'
import { formatIst, hourKey, makeHourBoundaries } from './time'

type FlatAsset = {
  node: AssetNode
  label: string
}

const SEGMENT_KINDS = {
  runtime: 'runtime',
  unplannedProduction: 'unplanned-production',
  unknownDowntime: 'unknown-downtime',
  stoppage: 'stoppage',
} as const

export function flattenAssets(nodes: AssetNode[], parent = ''): FlatAsset[] {
  return nodes.flatMap((node) => {
    const label = parent ? `${parent} / ${node.name}` : node.name
    const children = flattenAssets(node.children ?? [], label)
    return [{ node, label }, ...children]
  })
}

export function getEntityScope(asset: AssetNode) {
  return {
    type: 'asset' as const,
    asset: { asset_id: asset.id, asset_level_id: asset.assetlevel_id },
  }
}

export function normalizeSegments(data: MachineIntervals, windowStart?: Date, windowEnd?: Date): ChartSegment[] {
  const windowStartMs = windowStart?.getTime() ?? Number.NEGATIVE_INFINITY
  const windowEndMs = windowEnd?.getTime() ?? Number.POSITIVE_INFINITY
  const runtimes = (data.runtimes ?? []).flatMap((segment) =>
    toChartSegment(
      segment,
      segment.type === 'unknown unplanned production' ? SEGMENT_KINDS.unplannedProduction : SEGMENT_KINDS.runtime,
      windowStartMs,
      windowEndMs,
    ),
  )

  const downtimes = (data.downtimes ?? []).flatMap((segment) =>
    toChartSegment(segment, SEGMENT_KINDS.unknownDowntime, windowStartMs, windowEndMs),
  )

  const stoppages = (data.stoppages ?? []).flatMap((segment) =>
    toChartSegment(segment, SEGMENT_KINDS.stoppage, windowStartMs, windowEndMs),
  )

  return [...runtimes, ...downtimes, ...stoppages].sort((a, b) => a.startMs - b.startMs)
}

function toChartSegment(
  segment: MachineIntervals['runtimes'][number],
  kind: ChartSegment['kind'],
  windowStartMs: number,
  windowEndMs: number,
): ChartSegment[] {
  const rawStartMs = Date.parse(segment.start_at)
  const rawEndMs = Date.parse(segment.end_at)
  if (!Number.isFinite(rawStartMs) || !Number.isFinite(rawEndMs) || rawEndMs <= rawStartMs) return []

  const startMs = Math.max(rawStartMs, windowStartMs)
  const endMs = Math.min(rawEndMs, windowEndMs)
  if (endMs <= startMs) return []

  return [{ ...segment, kind, startMs, endMs }]
}

export function flattenProduces(buckets: ProduceBucket[] = []): ChartMarker[] {
  return (buckets ?? [])
    .flatMap((bucket) =>
      (bucket.produces ?? []).map((produce) => ({
        id: produce.produce_id,
        timestamp: new Date(produce.first_seen_ts),
        timeMs: Date.parse(produce.first_seen_ts),
        sequence: 0,
        result: produce.result,
        produceType: produce.produce_type,
        partModelId: produce.part_model_id || bucket.part_model_id,
      })),
    )
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((marker, index) => ({ ...marker, sequence: index + 1 }))
}

export function markersFromCounts(counts: ProduceCount[]): ChartMarker[] {
  const byHour = new Map<string, { bucket: ProduceCount; total: number }>()
  for (const count of counts ?? []) {
    const key = count.bucket_start
    const existing = byHour.get(key)
    if (existing) {
      existing.total += count.ok_count + count.ng_count
    } else {
      byHour.set(key, { bucket: count, total: count.ok_count + count.ng_count })
    }
  }

  let cumulative = 0
  return [...byHour.values()]
    .sort((a, b) => Date.parse(a.bucket.bucket_start) - Date.parse(b.bucket.bucket_start))
    .map(({ bucket, total }) => {
      cumulative += total
      return {
        id: bucket.bucket_start,
        timestamp: new Date(bucket.bucket_start),
        timeMs: Date.parse(bucket.bucket_start),
        sequence: cumulative,
        result: 'COUNT',
        produceType: 'HOURLY',
        partModelId: bucket.part_model_id,
        count: cumulative,
      }
    })
}

export function thinMarkers(markers: ChartMarker[], maxPassMarkers: number) {
  const failures = markers.filter((marker) => marker.result === 'FAIL')
  const others = markers.filter((marker) => marker.result !== 'FAIL')
  if (others.length <= maxPassMarkers) return markers

  const step = Math.ceil(others.length / maxPassMarkers)
  const sampled = others.filter((_, index) => index % step === 0)
  return [...sampled, ...failures].sort((a, b) => a.timeMs - b.timeMs)
}

export function buildHourBuckets(
  windowStart: Date,
  windowEnd: Date,
  segments: ChartSegment[],
  produceCounts: ProduceCount[],
  cycleTimes: CycleTimeBucket[],
  now = new Date(),
): HourBucket[] {
  const boundaries = makeHourBoundaries(windowStart, windowEnd)
  const buckets: HourBucket[] = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]
    return {
      key: hourKey(start),
      start,
      end,
      label: `${formatIst(start, 'HH:mm')} - ${formatIst(end, 'HH:mm')}`,
      elapsed: start <= now,
      total: start <= now ? 0 : null,
      pass: start <= now ? 0 : null,
      fail: start <= now ? 0 : null,
      runtimeMinutes: start <= now ? 0 : null,
      unplannedProductionMinutes: start <= now ? 0 : null,
      stoppageMinutes: start <= now ? 0 : null,
      unknownDowntimeMinutes: start <= now ? 0 : null,
      idealCycleSeconds: null,
      actualCycleSeconds: null,
    }
  })

  addProduceCounts(buckets, produceCounts)
  addSegments(buckets, segments, now)
  addCycleTimes(buckets, cycleTimes)

  return buckets
}

function addProduceCounts(buckets: HourBucket[], counts: ProduceCount[]) {
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const count of counts) {
    const bucket = bucketByKey.get(hourKey(count.bucket_start))
    if (!bucket || !bucket.elapsed) continue
    bucket.pass = (bucket.pass ?? 0) + count.ok_count
    bucket.fail = (bucket.fail ?? 0) + count.ng_count
    bucket.total = (bucket.total ?? 0) + count.ok_count + count.ng_count
  }
}

function addSegments(buckets: HourBucket[], segments: ChartSegment[], now: Date) {
  for (const segment of segments) {
    const field = fieldForSegmentKind(segment.kind)

    for (const bucket of buckets) {
      if (!bucket.elapsed) continue
      const cappedBucketEnd = Math.min(bucket.end.getTime(), now.getTime())
      const overlapStart = Math.max(segment.startMs, bucket.start.getTime())
      const overlapEnd = Math.min(segment.endMs, cappedBucketEnd)
      if (overlapEnd <= overlapStart) continue
      bucket[field] = (bucket[field] ?? 0) + (overlapEnd - overlapStart) / 60000
    }
  }
}

function fieldForSegmentKind(kind: ChartSegment['kind']) {
  switch (kind) {
    case 'runtime':
      return 'runtimeMinutes'
    case 'unplanned-production':
      return 'unplannedProductionMinutes'
    case 'unknown-downtime':
      return 'unknownDowntimeMinutes'
    case 'stoppage':
      return 'stoppageMinutes'
  }
}

function addCycleTimes(buckets: HourBucket[], cycleTimes: CycleTimeBucket[]) {
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))
  for (const row of cycleTimes) {
    const bucket = bucketByKey.get(hourKey(row.bucket_start))
    if (!bucket || !bucket.elapsed) continue
    bucket.idealCycleSeconds = row.ideal_cycle_time_seconds
    bucket.actualCycleSeconds = row.actual_cycle_time_seconds
  }
}
