import { Alert, Button, LinearProgress, Paper, Snackbar } from '@mui/material'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { FilterBar } from '../components/FilterBar'
import { HourlySummaryTable } from '../components/HourlySummaryTable'
import { ChartSkeleton, TableSkeleton } from '../components/Skeletons'
import { TimelineChart } from '../components/TimelineChart'
import { useDashboardData } from '../hooks/useDashboardData'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const {
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
    dataLoading,
    canRefresh,
    refreshData,
    selectedAssetLabel,
    windowLabel,
    showIndividual,
    setShowIndividual,
    error,
    setError,
    intervals,
    window,
    segments,
    chartMarkers,
    tableBuckets,
    isEmpty,
  } = useDashboardData()

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
        <FilterBar
          canRefresh={canRefresh}
          date={date}
          filteredAssetOptions={filteredAssetOptions}
          levelOptions={levelOptions}
          loading={initialLoading}
          machineOptions={machineOptions}
          onAssetChange={setSelectedAssetId}
          onDateChange={setDate}
          onLevelChange={handleLevelChange}
          onMachineChange={setSelectedMachineId}
          onRefresh={refreshData}
          onShiftChange={setSelectedShiftKey}
          refreshing={dataLoading}
          selectedAssetId={selectedAssetId}
          selectedAssetLabel={selectedAssetLabel}
          selectedLevelId={selectedLevelId}
          selectedMachineId={selectedMachineId}
          selectedShiftKey={selectedShiftKey}
          shiftOptions={shiftOptions}
          showIndividual={showIndividual}
          windowLabel={windowLabel}
        />

        {dataLoading && intervals ? (
          <LinearProgress aria-label="Refreshing dashboard data" className="rounded" />
        ) : null}

        {dataLoading && !intervals ? (
          <>
            <ChartSkeleton />
            <TableSkeleton />
          </>
        ) : null}

        {isEmpty ? (
          <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No production history was returned for this asset and shift.
          </Paper>
        ) : null}

        <Snackbar
          anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
          autoHideDuration={6000}
          onClose={() => setError('')}
          open={error !== ''}
        >
          <Alert
            action={
              <Button color="inherit" onClick={refreshData} size="small">
                Retry
              </Button>
            }
            onClose={() => setError('')}
            severity="error"
            variant="filled"
          >
            Unable to load dashboard data — {error}
          </Alert>
        </Snackbar>

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
