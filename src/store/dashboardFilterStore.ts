import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DashboardFilterState {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
}

export const useDashboardFilterStore = create<DashboardFilterState>()(
  persist(
    (set) => ({
      selectedYear: new Date().getFullYear(),
      setSelectedYear: (year) => set({ selectedYear: year }),
    }),
    { name: 'dashboard-filter' }
  )
);
