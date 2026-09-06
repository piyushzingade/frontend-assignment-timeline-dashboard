import { create } from 'zustand'

type DashboardFilterState = {
  selectedAssetId: string
  selectedLevelId: string
  selectedMachineId: string
  selectedShiftKey: string
  date: string
  showIndividual: boolean
  setSelectedAssetId: (id: string) => void
  setSelectedLevelId: (id: string) => void
  setSelectedMachineId: (id: string) => void
  setSelectedShiftKey: (key: string) => void
  setDate: (date: string) => void
  setShowIndividual: (value: boolean) => void
  // Fills in defaults after the filter metadata arrives; never
  // overwrites an explicit user selection.
  ensureDefaults: (assetId: string, shiftKey: string) => void
}

// Client UI state only: which asset/shift/date the user picked.
// Server data (tree, shifts, intervals, cycle times) lives in TanStack Query.
export const useDashboardFilters = create<DashboardFilterState>()((set) => ({
  selectedAssetId: '',
  selectedLevelId: 'all',
  selectedMachineId: '',
  selectedShiftKey: '',
  date: '2026-06-23',
  showIndividual: false,
  setSelectedAssetId: (selectedAssetId) => set({ selectedAssetId, selectedMachineId: '' }),
  setSelectedLevelId: (selectedLevelId) => set({ selectedLevelId, selectedMachineId: '' }),
  setSelectedMachineId: (selectedMachineId) => set({ selectedMachineId }),
  setSelectedShiftKey: (selectedShiftKey) => set({ selectedShiftKey }),
  setDate: (date) => set({ date }),
  setShowIndividual: (showIndividual) => set({ showIndividual }),
  ensureDefaults: (assetId, shiftKey) =>
    set((state) => ({
      selectedAssetId: state.selectedAssetId || assetId,
      selectedShiftKey: state.selectedShiftKey || shiftKey,
    })),
}))
