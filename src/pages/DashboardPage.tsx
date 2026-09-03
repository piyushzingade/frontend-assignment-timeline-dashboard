import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Switch } from '@base-ui/react'
import { CalendarDays, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { HourlySummaryTable } from '../components/HourlySummaryTable'
import { Spinner } from '../components/Spinner'
import { TimelineChart } from '../components/TimelineChart'
import { ApiError, api } from '../lib/api'
import { buildShiftOptions, formatIst, getShiftWindow } from '../lib/time'
import {
  buildHourBuckets,
  flattenAssets,
  flattenProduces,
  getEntityScope,
  markersFromCounts,
  normalizeSegments,
} from '../lib/transforms'
import type { AssetNode, CycleTimeBucket, MachineIntervals, ShiftDefinition } from '../types'

const DEFAULT_DATE = '2026-06-23'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const [assets, setAssets] = useState<AssetNode[]>([])
  const [shifts, setShifts] = useState<ShiftDefinition[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [selectedShiftKey, setSelectedShiftKey] = useState('')
  const [date, setDate] = useState(DEFAULT_DATE)
  const [showIndividual, setShowIndividual] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState('')
  const [intervals, setIntervals] = useState<MachineIntervals | null>(null)
  const [cycleTimes, setCycleTimes] = useState<CycleTimeBucket[]>([])

  const assetOptions = useMemo(() => flattenAssets(assets), [assets])
  const shiftOptions = useMemo(() => buildShiftOptions(shifts), [shifts])
  const selectedAsset = useMemo(
    () => assetOptions.find((asset) => asset.node.id === selectedAssetId)?.node,
    [assetOptions, selectedAssetId],
  )
  const selectedAssetLabel = useMemo(
    () => assetOptions.find((asset) => asset.node.id === selectedAssetId)?.label ?? '',
    [assetOptions, selectedAssetId],
  )
  const selectedShift = useMemo(
    () => shiftOptions.find((shift) => shift.key === selectedShiftKey),
    [selectedShiftKey, shiftOptions],
  )
  const window = useMemo(() => (selectedShift ? getShiftWindow(date, selectedShift) : null), [date, selectedShift])

  useEffect(() => {
    let cancelled = false

    async function loadFilters() {
      setInitialLoading(true)
      setError('')
      try {
        const [assetTree, shiftList] = await Promise.all([api.assets(), api.shifts()])
        if (cancelled) return
        setAssets(assetTree)
        setShifts(shiftList)
        const flatAssets = flattenAssets(assetTree)
        const options = buildShiftOptions(shiftList)
        setSelectedAssetId((current) => current || flatAssets.find((item) => item.node.assetlevel_id <= 20)?.node.id || flatAssets[0]?.node.id || '')
        setSelectedShiftKey((current) => current || options[0]?.key || '')
      } catch (err) {
        setError(messageForError(err))
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }

    loadFilters()
    return () => {
      cancelled = true
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!selectedAsset || !window) return
    setDataLoading(true)
    setError('')
    try {
      const scope = getEntityScope(selectedAsset)
      const [nextIntervals, nextCycleTimes] = await Promise.all([
        api.machineIntervals(scope, window.fromIso, window.toIso, showIndividual),
        api.cycleTimes(scope, window.fromIso, window.toIso),
      ])
      setIntervals(nextIntervals)
      setCycleTimes(nextCycleTimes)
    } catch (err) {
      setError(messageForError(err))
      setIntervals(null)
      setCycleTimes([])
    } finally {
      setDataLoading(false)
    }
  }, [selectedAsset, showIndividual, window])

  useEffect(() => {
    loadData()
  }, [loadData])

  const segments = useMemo(() => (intervals ? normalizeSegments(intervals) : []), [intervals])
  const chartMarkers = useMemo(() => {
    if (!intervals) return []
    return showIndividual ? flattenProduces(intervals.produces) : markersFromCounts(intervals.produce_counts)
  }, [intervals, showIndividual])
  const tableBuckets = useMemo(() => {
    if (!intervals || !window) return []
    return buildHourBuckets(window.from, window.to, intervals, cycleTimes)
  }, [cycleTimes, intervals, window])
  const isEmpty = intervals ? !segments.length && !intervals.produce_counts.length && !intervals.produces?.length : false
  const lastProduce = chartMarkers.length ? chartMarkers.reduce((latest, marker) => (marker.timeMs > latest.timeMs ? marker : latest)) : null

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Timeline Dashboard</h1>
            <p className="text-sm text-slate-500">Production history with shift-level downtime summary</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <Button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-700/20"
              onClick={logout}
            >
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-4 px-5 py-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {initialLoading ? (
            <Spinner label="Loading filters" />
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid min-w-56 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Asset
                <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-700/20" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}>
                  {assetOptions.map((asset) => (
                    <option key={asset.node.id} value={asset.node.id}>
                      {asset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date
                <span className="relative">
                  <input className="h-10 rounded-md border border-slate-300 bg-white px-3 pr-9 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-700/20" max="2026-06-25" min="2026-06-22" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
                  <CalendarDays className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
                </span>
              </label>

              <label className="grid min-w-56 gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Shift
                <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-700/20" value={selectedShiftKey} onChange={(event) => setSelectedShiftKey(event.target.value)}>
                  {shiftOptions.map((shift) => (
                    <option key={shift.key} value={shift.key}>
                      {shift.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex h-10 items-center gap-3 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
                <Switch.Root
                  checked={showIndividual}
                  className="relative h-5 w-9 rounded-full bg-slate-300 outline-none transition data-[checked]:bg-blue-700 focus:ring-4 focus:ring-blue-700/20"
                  onCheckedChange={setShowIndividual}
                >
                  <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition data-[checked]:translate-x-4" />
                </Switch.Root>
                Show individual produces
              </label>

              <Button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-700/25 disabled:bg-slate-400"
                disabled={dataLoading || !selectedAsset || !selectedShift}
                onClick={loadData}
              >
                <RefreshCw className={dataLoading ? 'animate-spin' : ''} size={16} />
                Refresh
              </Button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {selectedAssetLabel ? <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">{selectedAssetLabel}</span> : null}
            {window ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                {formatIst(window.from, 'dd MMM, HH:mm')} - {formatIst(window.to, 'dd MMM, HH:mm')}
              </span>
            ) : null}
            {showIndividual ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Exact produces on</span> : null}
          </div>
        </section>

        {error ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-semibold">Unable to load dashboard data</div>
            <p>{error}</p>
            <Button className="mt-3 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white" onClick={loadData}>
              Retry
            </Button>
          </section>
        ) : null}

        {dataLoading && !intervals ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <Spinner label="Loading dashboard data" />
          </section>
        ) : null}

        {isEmpty ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No production history was returned for this asset and shift.
          </section>
        ) : null}

        {intervals && window ? (
          <>
            <TimelineChart from={window.from} markers={chartMarkers} segments={segments} showIndividual={showIndividual} to={window.to} />
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              {lastProduce ? (
                <span className="rounded-full border border-blue-800 bg-white px-3 py-1 text-blue-900">
                  Last observed produce at: {formatIst(lastProduce.timestamp)}
                </span>
              ) : null}
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-amber-700">
                {segments.filter((segment) => segment.kind === 'unknown-downtime').length} unknown segments
              </span>
            </div>
            <HourlySummaryTable buckets={tableBuckets} />
          </>
        ) : null}
      </div>
    </main>
  )
}

function messageForError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Access denied.'
    if (error.status === 422) return error.message || 'The request has validation errors.'
    return error.message
  }
  return 'The backend request failed. Check the network connection and try again.'
}
