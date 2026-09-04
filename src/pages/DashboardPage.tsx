import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  FormControl,
  MenuItem,
  Paper,
  Select,
  TextField,
} from '@mui/material'
import { LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { FieldLabel } from '../components/FieldLabel'
import { HourlySummaryTable } from '../components/HourlySummaryTable'
import { Spinner } from '../components/Spinner'
import { TimelineChart } from '../components/TimelineChart'
import { ApiError, api, isAbortError } from '../lib/api'
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
  const [selectedLevelId, setSelectedLevelId] = useState('all')
  const [selectedMachineId, setSelectedMachineId] = useState('')
  const [selectedShiftKey, setSelectedShiftKey] = useState('')
  const [date, setDate] = useState(DEFAULT_DATE)
  const [showIndividual, setShowIndividual] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState('')
  const [intervals, setIntervals] = useState<MachineIntervals | null>(null)
  const [cycleTimes, setCycleTimes] = useState<CycleTimeBucket[]>([])
  const dataRequestId = useRef(0)
  const dataAbortController = useRef<AbortController | null>(null)

  const assetOptions = useMemo(() => flattenAssets(assets), [assets])
  const shiftOptions = useMemo(() => buildShiftOptions(shifts), [shifts])
  const levelOptions = useMemo(
    () => [...new Set(assetOptions.map((asset) => asset.node.assetlevel_id))].sort((a, b) => a - b),
    [assetOptions],
  )
  const filteredAssetOptions = useMemo(
    () => (selectedLevelId === 'all' ? assetOptions : assetOptions.filter((asset) => String(asset.node.assetlevel_id) === selectedLevelId)),
    [assetOptions, selectedLevelId],
  )
  const selectedAsset = useMemo(
    () => assetOptions.find((asset) => asset.node.id === selectedAssetId)?.node,
    [assetOptions, selectedAssetId],
  )
  // Best-effort machines: direct children of the selected asset.
  // The backend has no machine endpoint, so picking one queries that child node.
  const machineOptions = useMemo(() => selectedAsset?.children ?? [], [selectedAsset])
  const selectedMachine = useMemo(
    () => machineOptions.find((machine) => machine.id === selectedMachineId),
    [machineOptions, selectedMachineId],
  )
  const scopeAsset = selectedMachine ?? selectedAsset
  const selectedAssetLabel = useMemo(() => {
    const assetEntry = assetOptions.find((asset) => asset.node.id === selectedAssetId)
    if (!assetEntry) return ''
    return selectedMachine ? `${assetEntry.label} / ${selectedMachine.name}` : assetEntry.label
  }, [assetOptions, selectedAssetId, selectedMachine])
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
    if (!scopeAsset || !window) return
    const requestId = dataRequestId.current + 1
    dataRequestId.current = requestId
    dataAbortController.current?.abort()
    const abortController = new AbortController()
    dataAbortController.current = abortController
    setDataLoading(true)
    setError('')
    try {
      const scope = getEntityScope(scopeAsset)
      const [nextIntervals, nextCycleTimes] = await Promise.all([
        api.machineIntervals(scope, window.fromIso, window.toIso, showIndividual, abortController.signal),
        api.cycleTimes(scope, window.fromIso, window.toIso, abortController.signal),
      ])
      if (requestId !== dataRequestId.current) return
      setIntervals(nextIntervals)
      setCycleTimes(nextCycleTimes)
    } catch (err) {
      if (isAbortError(err)) return
      if (requestId !== dataRequestId.current) return
      setError(messageForError(err))
      setIntervals(null)
      setCycleTimes([])
    } finally {
      if (dataAbortController.current === abortController) dataAbortController.current = null
      if (requestId === dataRequestId.current) setDataLoading(false)
    }
  }, [scopeAsset, showIndividual, window])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    return () => dataAbortController.current?.abort()
  }, [])

  const segments = useMemo(() => (intervals && window ? normalizeSegments(intervals, window.from, window.to) : []), [intervals, window])
  const chartMarkers = useMemo(() => {
    if (!intervals) return []
    return showIndividual ? flattenProduces(intervals.produces) : markersFromCounts(intervals.produce_counts)
  }, [intervals, showIndividual])
  const tableBuckets = useMemo(() => {
    if (!intervals || !window) return []
    return buildHourBuckets(window.from, window.to, segments, intervals.produce_counts, cycleTimes)
  }, [cycleTimes, intervals, segments, window])
  const isEmpty = intervals ? !segments.length && !intervals.produce_counts.length && !intervals.produces?.length : false

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
              onClick={logout}
              startIcon={<LogOut size={16} />}
              variant="outlined"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-4 px-5 py-5">
        <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {initialLoading ? (
            <Spinner label="Loading filters" />
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <FieldLabel id="level-select-label">Asset level</FieldLabel>
                <FormControl className="min-w-36" size="small">
                  <Select
                    labelId="level-select-label"
                    onChange={(event) => {
                      const levelId = event.target.value
                      setSelectedLevelId(levelId)
                      setSelectedMachineId('')
                      const visible = levelId === 'all'
                        ? assetOptions
                        : assetOptions.filter((asset) => String(asset.node.assetlevel_id) === levelId)
                      if (!visible.some((asset) => asset.node.id === selectedAssetId)) {
                        setSelectedAssetId(visible[0]?.node.id ?? '')
                      }
                    }}
                    value={selectedLevelId}
                  >
                    <MenuItem value="all">All Levels</MenuItem>
                    {levelOptions.map((level) => (
                      <MenuItem key={level} value={String(level)}>
                        Level {level}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div>
                <FieldLabel id="asset-select-label">Asset</FieldLabel>
                <FormControl className="min-w-56" size="small">
                  <Select
                    labelId="asset-select-label"
                    onChange={(event) => {
                      setSelectedAssetId(event.target.value)
                      setSelectedMachineId('')
                    }}
                    value={selectedAssetId}
                  >
                    {filteredAssetOptions.map((asset) => (
                      <MenuItem key={asset.node.id} value={asset.node.id}>
                        {asset.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div>
                <FieldLabel id="machine-select-label">Machine (optional)</FieldLabel>
                <FormControl className="min-w-56" size="small">
                  <Select
                    labelId="machine-select-label"
                    onChange={(event) => setSelectedMachineId(event.target.value)}
                    value={selectedMachineId}
                  >
                    <MenuItem value="">–</MenuItem>
                    {machineOptions.map((machine) => (
                      <MenuItem key={machine.id} value={machine.id}>
                        {machine.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div>
                <FieldLabel htmlFor="filter-date">Date</FieldLabel>
                <TextField
                  id="filter-date"
                  inputProps={{ min: '2026-06-22', max: '2026-06-25' }}
                  onChange={(event) => setDate(event.target.value)}
                  size="small"
                  type="date"
                  value={date}
                />
              </div>

              <div>
                <FieldLabel id="shift-select-label">Shift</FieldLabel>
                <FormControl className="min-w-56" size="small">
                  <Select
                    labelId="shift-select-label"
                    onChange={(event) => setSelectedShiftKey(event.target.value)}
                    value={selectedShiftKey}
                  >
                    {shiftOptions.map((shift) => (
                      <MenuItem key={shift.key} value={shift.key}>
                        {shift.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <Button
                disabled={dataLoading || !scopeAsset || !selectedShift}
                startIcon={<RefreshCw className={dataLoading ? 'animate-spin' : ''} size={16} />}
                onClick={loadData}
                variant="contained"
              >
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
        </Paper>

        {error ? (
          <Alert
            action={
              <Button color="error" onClick={loadData} size="small">
                Retry
              </Button>
            }
            severity="error"
            variant="outlined"
          >
            <div className="font-semibold">Unable to load dashboard data</div>
            <p>{error}</p>
          </Alert>
        ) : null}

        {dataLoading && !intervals ? (
          <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <Spinner label="Loading dashboard data" />
          </Paper>
        ) : null}

        {isEmpty ? (
          <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No production history was returned for this asset and shift.
          </Paper>
        ) : null}

        {intervals && window ? (
          <>
            <TimelineChart
              from={window.from}
              markers={chartMarkers}
              onShowIndividualChange={setShowIndividual}
              segments={segments}
              showIndividual={showIndividual}
              to={window.to}
            />
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
