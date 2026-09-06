import {
  Button,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  TextField,
} from '@mui/material'
import { RefreshCw } from 'lucide-react'
import { FieldLabel } from './FieldLabel'
import { FilterBarSkeleton } from './Skeletons'
import type { AssetNode, ShiftOption } from '../types'
import type { FlatAsset } from '../lib/transforms'

type FilterBarProps = {
  loading: boolean
  levelOptions: number[]
  selectedLevelId: string
  onLevelChange: (levelId: string) => void
  filteredAssetOptions: FlatAsset[]
  selectedAssetId: string
  onAssetChange: (id: string) => void
  machineOptions: AssetNode[]
  selectedMachineId: string
  onMachineChange: (id: string) => void
  date: string
  onDateChange: (date: string) => void
  shiftOptions: ShiftOption[]
  selectedShiftKey: string
  onShiftChange: (key: string) => void
  canRefresh: boolean
  refreshing: boolean
  onRefresh: () => void
  selectedAssetLabel: string
  windowLabel: string | null
  showIndividual: boolean
}

export function FilterBar({
  loading,
  levelOptions,
  selectedLevelId,
  onLevelChange,
  filteredAssetOptions,
  selectedAssetId,
  onAssetChange,
  machineOptions,
  selectedMachineId,
  onMachineChange,
  date,
  onDateChange,
  shiftOptions,
  selectedShiftKey,
  onShiftChange,
  canRefresh,
  refreshing,
  onRefresh,
  selectedAssetLabel,
  windowLabel,
  showIndividual,
}: FilterBarProps) {
  return (
    <Paper component="section" elevation={1} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {loading ? (
        <FilterBarSkeleton />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <FieldLabel id="level-select-label">Asset level</FieldLabel>
            <FormControl className="min-w-36" size="small">
              <Select
                labelId="level-select-label"
                onChange={(event) => onLevelChange(event.target.value)}
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
                onChange={(event) => onAssetChange(event.target.value)}
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

          <div className="w-fit">
            <FieldLabel id="machine-select-label">Machine (optional)</FieldLabel>
            <FormControl className="w-full" size="small">
              <Select
                displayEmpty
                labelId="machine-select-label"
                onChange={(event) => onMachineChange(event.target.value)}
                renderValue={(value) =>
                  value === '' ? (
                    <span className="text-slate-400">Select machine</span>
                  ) : (
                    machineOptions.find((machine) => machine.id === value)?.name ?? ''
                  )
                }
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
              onChange={(event) => onDateChange(event.target.value)}
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
                onChange={(event) => onShiftChange(event.target.value)}
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
            disabled={!canRefresh}
            startIcon={<RefreshCw className={refreshing ? 'animate-spin' : ''} size={16} />}
            onClick={onRefresh}
            variant="contained"
          >
            Refresh
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {loading ? (
          <>
            <Skeleton animation="wave" className="w-32" height={24} variant="rounded" />
            <Skeleton animation="wave" className="w-56" height={24} variant="rounded" />
          </>
        ) : (
          <>
            {selectedAssetLabel ? <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">{selectedAssetLabel}</span> : null}
            {windowLabel ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{windowLabel}</span>
            ) : null}
            {showIndividual ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Exact produces on</span> : null}
          </>
        )}
      </div>
    </Paper>
  )
}
