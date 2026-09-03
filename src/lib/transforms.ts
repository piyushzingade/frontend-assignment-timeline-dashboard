import type {
  AssetNode,
  ChartMarker,
  ChartSegment,
  CycleTimeBucket,
  HourBucket,
  MachineIntervals,
  ProduceBucket,
  ProduceCount,
  TimelineSegment,
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

export function normalizeSegments(data: MachineIntervals): ChartSegment[] {
  const runtimes = data.runtimes.map((segment) => ({
    ...segment,
    kind: segment.type === 'unknown unplanned production' ? SEGMENT_KINDS.unplannedProduction : SEGMENT_KINDS.runtime,
    startMs: Date.parse(segment.start_at),
    endMs: Date.parse(segment.end_at),
  }))

  const downtimes = data.downtimes.map((segment) => ({
    ...segment,
    kind: SEGMENT_KINDS.unknownDowntime,
    startMs: Date.parse(segment.start_at),
    endMs: Date.parse(segment.end_at),
  }))

  const stoppages = data.stoppages.map((segment) => ({
    ...segment,
    kind: SEGMENT_KINDS.stoppage,
    startMs: Date.parse(segment.start_at),
    endMs: Date.parse(segment.end_at),
  }))

  return [...runtimes, ...downtimes, ...stoppages].sort((a, b) => a.startMs - b.startMs)
}

export function flattenProduces(buckets: ProduceBucket[] = []): ChartMarker[] {
  return buckets
    .flatMap((bucket) =>
      bucket.produces.map((produce) => ({
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
  for (const count of counts) {
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
  intervals: MachineIntervals,
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

  addProduceCounts(buckets, intervals.produce_counts)
  addSegments(buckets, intervals.runtimes, 'runtimeMinutes', 'unplannedProductionMinutes', now)
  addSegments(buckets, intervals.downtimes, 'unknownDowntimeMinutes', 'unknownDowntimeMinutes', now)
  addSegments(buckets, intervals.stoppages, 'stoppageMinutes', 'stoppageMinutes', now)
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

function addSegments(
  buckets: HourBucket[],
  segments: TimelineSegment[],
  normalField: 'runtimeMinutes' | 'unknownDowntimeMinutes' | 'stoppageMinutes',
  unplannedField: 'unplannedProductionMinutes' | 'unknownDowntimeMinutes' | 'stoppageMinutes',
  now: Date,
) {
  for (const segment of segments) {
    const start = new Date(segment.start_at).getTime()
    const end = new Date(segment.end_at).getTime()
    const field = segment.type === 'unknown unplanned production' ? unplannedField : normalField

    for (const bucket of buckets) {
      if (!bucket.elapsed) continue
      const cappedBucketEnd = Math.min(bucket.end.getTime(), now.getTime())
      const overlapStart = Math.max(start, bucket.start.getTime())
      const overlapEnd = Math.min(end, cappedBucketEnd)
      if (overlapEnd <= overlapStart) continue
      bucket[field] = (bucket[field] ?? 0) + (overlapEnd - overlapStart) / 60000
    }
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
