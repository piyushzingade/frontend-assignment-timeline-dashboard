export type Envelope<T> = {
  trace_id: string
  status_code: number
  message: string
  data: T
}

export type LoginResponse = {
  access_token: string
  token_type: string
}

export type CurrentUser = {
  id: string
  username: string
  name: string
  email: string
  roles: string[]
}

export type AssetNode = {
  id: string
  name: string
  codename: string | null
  assetlevel_id: number
  children?: AssetNode[]
}

export type ShiftDefinition = {
  id: string
  code: string
  name: string
  shift_timings: string[]
  is_active: boolean
}

export type ShiftOption = {
  key: string
  shiftId: string
  label: string
  startTime: string
  endTime: string
  shiftName: string
}

export type EntityScope = {
  type: 'asset'
  asset: {
    asset_id: string
    asset_level_id: number
  }
}

export type TimelineSegment = {
  start_at: string
  end_at: string
  type: string
  runtime_name?: string | null
  downtime_name?: string | null
  stoppage_name?: string | null
}

export type ProduceCount = {
  bucket_start: string
  part_model_id: string
  ok_count: number
  ng_count: number
}

export type ProduceRow = {
  produce_id: string
  first_seen_ts: string
  result: 'PASS' | 'FAIL' | string
  produce_type: string
  part_model_id: string
}

export type ProduceBucket = {
  bucket_start: string
  part_model_id: string
  produces: ProduceRow[]
}

export type MachineIntervals = {
  machine_ids: number[]
  runtimes: TimelineSegment[]
  downtimes: TimelineSegment[]
  stoppages: TimelineSegment[]
  produce_counts: ProduceCount[]
  produces?: ProduceBucket[]
}

export type CycleTimeBucket = {
  bucket_start: string
  ideal_cycle_time_seconds: number | null
  actual_cycle_time_seconds: number | null
}

export type HourBucket = {
  key: string
  start: Date
  end: Date
  label: string
  elapsed: boolean
  total: number | null
  pass: number | null
  fail: number | null
  runtimeMinutes: number | null
  unplannedProductionMinutes: number | null
  stoppageMinutes: number | null
  unknownDowntimeMinutes: number | null
  idealCycleSeconds: number | null
  actualCycleSeconds: number | null
}

export type ChartSegment = TimelineSegment & {
  kind: 'runtime' | 'unplanned-production' | 'unknown-downtime' | 'stoppage'
  startMs: number
  endMs: number
}

export type ChartMarker = {
  id: string
  timestamp: Date
  timeMs: number
  sequence: number
  result: string
  produceType: string
  partModelId: string
  count?: number
}
