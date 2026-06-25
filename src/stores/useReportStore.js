// frontend/src/stores/useReportStore.js
import { create } from 'zustand';
import api from '../lib/api';

export const useReportStore = create((set, get) => ({
  summary: null,
  demographic: null,
  trend: [],
  distribution: null,
  performance: [],
  heatmap: [],
  tableData: [],
  totalRows: 0,
  page: 1,
  limit: 50,
  loading: false,

  filters: {
    startDate: '',
    endDate: '',
    agentName: '',
    severity: ''
  },

  setFilters: (newFilters) => {
    // Reset to page 1 whenever filters change so we don't land on a non-existent page
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      page: 1,
    }));
    get().fetchAllData();
  },

  resetFilters: () => {
    set({
      filters: { startDate: '', endDate: '', agentName: '', severity: '' },
      page: 1,
    });
    get().fetchAllData();
  },

  fetchAllData: async () => {
    const { fetchSummary, fetchDemographic, fetchTrend, fetchDistribution, fetchPerformance, fetchHeatmap, fetchTable, page, limit } = get();
    await Promise.all([
      fetchSummary(),
      fetchDemographic(),
      fetchTrend(),
      fetchDistribution(),
      fetchPerformance(),
      fetchHeatmap(),
      fetchTable(page, limit)
    ]);
  },

  fetchSummary: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/reports/summary', { params: get().filters });
      set({ summary: res.data.data, loading: false });
    } catch (err) {
      console.error('Error fetching summary:', err);
      set({ loading: false });
    }
  },

  fetchDemographic: async () => {
    try {
      const res = await api.get('/reports/financial', { params: get().filters });
      set({ demographic: res.data.data });
    } catch (err) {
      console.error('Error fetching demographic:', err);
    }
  },

  fetchTrend: async () => {
    try {
      const res = await api.get('/reports/trend', { params: get().filters });
      set({ trend: res.data.data });
    } catch (err) {
      console.error('Error fetching trend:', err);
    }
  },

  fetchDistribution: async () => {
    try {
      const res = await api.get('/reports/distribution', { params: get().filters });
      set({ distribution: res.data.data });
    } catch (err) {
      console.error('Error fetching distribution:', err);
    }
  },

  fetchPerformance: async () => {
    try {
      const res = await api.get('/reports/performance', { params: get().filters });
      set({ performance: res.data.data });
    } catch (err) {
      console.error('Error fetching performance:', err);
    }
  },

  fetchHeatmap: async () => {
    try {
      const res = await api.get('/reports/heatmap', { params: get().filters });
      set({ heatmap: res.data.data });
    } catch (err) {
      console.error('Error fetching heatmap:', err);
    }
  },

  fetchTable: async (page = 1, limit = 50, search = '') => {
    set({ loading: true });
    try {
      const res = await api.get('/reports/table', { 
        params: { ...get().filters, page, limit, search } 
      });
      // API response shape: { data: { data: [...rows], total: N } }
      const payload = res.data?.data ?? {};
      set({ 
        tableData: Array.isArray(payload.data) ? payload.data : [], 
        totalRows: payload.total ?? 0, 
        page,
        limit,
        loading: false 
      });
    } catch (err) {
      console.error('Error fetching table:', err);
      set({ loading: false });
    }
  }
}));
