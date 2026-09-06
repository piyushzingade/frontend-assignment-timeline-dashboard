import { useEffect, useMemo, useState } from 'react'
import { skipToken, useQuery } from '@tanstack/react-query'
import { ApiError, api } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import { buildShiftOptions, formatIst, getShiftWindow } from '../lib/time'
import {
  buildHourBuckets,
  flattenAssets,
  flattenProduces,
  getEntityScope,
  markersFromCounts,
  normalizeSegments,
  visibleAssetsForLevel,
} from '../lib/transforms'
import { useDashboardFilters } from '../store/dashboardStore'

// All dashboard server state (TanStack Query) plus the derived view models.
// Split by responsibility so each hook stays small: filter model first,
// data queries second, composed below.
export function useDashboardData() {
  const filter = useFilterModel()
  const data = useDashboardQueries(filter)
  return { ...filter, ...data }
}

function useFilterModel() {
  const selectedAssetId = useDashboardFilters((state) => state.selectedAssetId)
  const selectedLevelId = useDashboardFilters((state) => state.selectedLevelId)
  const selectedMachineId = useDashboardFilters((state) => state.selectedMachineId)
  const selectedShiftKey = useDashboardFilters((state) => state.selectedShiftKey)
  const date = useDashboardFilters((state) => state.date)
  const showIndividual = useDashboardFilters((state) => state.showIndividual)
  const setSelectedAssetId = useDashboardFilters((state) => state.setSelectedAssetId)
  const setSelectedLevelId = useDashboardFilters((state) => state.setSelectedLevelId)
  const setSelectedMachineId = useDashboardFilters((state) => state.setSelectedMachineId)
  const setSelectedShiftKey = useDashboardFilters((state) => state.setSelectedShiftKey)
  const setDate = useDashboardFilters((state) => state.setDate)
  const setShowIndividual = useDashboardFilters((state) => state.setShowIndividual)

  // Filter metadata is near-static: cached for 10 minutes so returning
  // to the page (or remounting) never refetches it.
  const filtersQuery = useQuery({
    queryKey: ['filters'],
    queryFn: async () => {
      const [assetTree, shiftList] = await Promise.all([api.assets(), api.shifts()])
      return { assetTree, shiftList }
    },
    staleTime: 10 * 60 * 1000,
  })

  const assets = useMemo(() => filtersQuery.data?.assetTree ?? [], [filtersQuery.data])
  const shifts = useMemo(() => filtersQuery.data?.shiftList ?? [], [filtersQuery.data])
  const initialLoading = filtersQuery.isPending

  // Default to the first machine/line-level node and shift once metadata arrives.
  useEffect(() => {
    if (!filtersQuery.data) return
    const flatAssets = flattenAssets(filtersQuery.data.assetTree)
    const options = buildShiftOptions(filtersQuery.data.shiftList)
    useDashboardFilters.getState().ensureDefaults(
      flatAssets.find((item) => item.node.assetlevel_id <= 20)?.node.id || flatAssets[0]?.node.id || '',
      options[0]?.key || '',
    )
  }, [filtersQuery.data])

  const assetOptions = useMemo(() => flattenAssets(assets), [assets])
  const shiftOptions = useMemo(() => buildShiftOptions(shifts), [shifts])
  const levelOptions = useMemo(
    () => [...new Set(assetOptions.map((asset) => asset.node.assetlevel_id))].sort((a, b) => a - b),
    [assetOptions],
  )
  const filteredAssetOptions = useMemo(
    () => visibleAssetsForLevel(assetOptions, selectedLevelId),
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
  const windowLabel = window ? `${formatIst(window.from, 'dd MMM, HH:mm')} - ${formatIst(window.to, 'dd MMM, HH:mm')}` : null

  function handleLevelChange(levelId: string) {
    setSelectedLevelId(levelId)
    const visible = visibleAssetsForLevel(assetOptions, levelId)
    if (!visible.some((asset) => asset.node.id === selectedAssetId)) {
      setSelectedAssetId(visible[0]?.node.id ?? '')
    }
  }

  const scope = scopeAsset ? getEntityScope(scopeAsset) : null
  const scopeKey = scope && window
    ? `${scope.asset.asset_id}:${scope.asset.asset_level_id}:${window.fromIso}:${window.toIso}:${showIndividual}`
    : 'none'

  return {
    levelOptions,
    selectedLevelId,
    filteredAssetOptions,
    selectedAssetId,
    machineOptions,
    selectedMachineId,
    date,
    shiftOptions,
    selectedShiftKey,
    handleLevelChange,
    setSelectedAssetId,
    setSelectedMachineId,
    setDate,
    setSelectedShiftKey,
    initialLoading,
    selectedAssetLabel,
    windowLabel,
    showIndividual,
    setShowIndividual,
    scope,
    scopeKey,
    scopeAsset,
    selectedShift,
    window,
    filtersError: filtersQuery.error,
  }
}

type FilterModel = ReturnType<typeof useFilterModel>

function useDashboardQueries(filter: FilterModel) {
  const { scope, scopeKey, window, showIndividual } = filter
  const [error, setError] = useState('')

  // Dashboard data is keyed by the full filter combination, so revisiting
  // a recent selection renders instantly from cache instead of refetching.
  // Historical shift data barely changes: fresh for 5 minutes, kept for 30.
  const intervalsQuery = useQuery({
    queryKey: ['dashboard', scopeKey, 'intervals'],
    queryFn: scope && window
      ? ({ signal }) => api.machineIntervals(scope, window.fromIso, window.toIso, showIndividual, signal)
      : skipToken,
    staleTime: 5 * 60 * 1000,
  })
  const cycleTimesQuery = useQuery({
    queryKey: ['dashboard', scopeKey, 'cycle-times'],
    queryFn: scope && window
      ? ({ signal }) => api.cycleTimes(scope, window.fromIso, window.toIso, signal)
      : skipToken,
    staleTime: 5 * 60 * 1000,
  })

  const intervals = intervalsQuery.data ?? null
  const cycleTimes = useMemo(() => cycleTimesQuery.data ?? [], [cycleTimesQuery.data])
  const dataLoading = intervalsQuery.isFetching || cycleTimesQuery.isFetching

  useEffect(() => {
    const failure = filter.filtersError ?? intervalsQuery.error ?? cycleTimesQuery.error
    setError(failure ? messageForError(failure) : '')
  }, [filter.filtersError, intervalsQuery.error, cycleTimesQuery.error])

  function refreshData() {
    void queryClient.invalidateQueries({ queryKey: ['dashboard', scopeKey] })
  }

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

  return {
    dataLoading,
    canRefresh: !dataLoading && !!filter.scopeAsset && !!filter.selectedShift,
    refreshData,
    error,
    setError,
    intervals,
    segments,
    chartMarkers,
    tableBuckets,
    isEmpty,
  }
}

function messageForError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Access denied.'
    if (error.status === 422) return error.message || 'The request has validation errors.'
    return error.message
  }
  return 'The backend request failed. Check the network connection and try again.'
}
