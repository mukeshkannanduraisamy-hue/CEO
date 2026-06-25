import { useState } from 'react';
import { Filter, X, Calendar, User, ShieldAlert, RotateCcw, ChevronDown } from 'lucide-react';
import { useReportStore } from '../stores/useReportStore';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

const SEVERITY_LABELS = ['Any', 'Low', 'Neutral', 'Moderate', 'High', 'Critical'];

const ReportFilters = () => {
  const { filters, setFilters, resetFilters } = useReportStore();
  const [isOpen, setIsOpen] = useState(false);

  const agents = ['admin', 'pradeep'];

  const hasActiveFilters = filters.startDate || filters.endDate || filters.agentName || filters.severity;
  const activeFilterCount = [filters.startDate, filters.endDate, filters.agentName, filters.severity].filter(Boolean).length;

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all border shadow-sm",
            isOpen || hasActiveFilters
              ? "bg-accent-primary text-white border-accent-primary"
              : "bg-bg-surface border-border text-text-secondary hover:text-text-primary hover:border-accent-primary/30"
          )}
        >
          <Filter size={13} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 bg-white/25 rounded text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            size={12}
            className={clsx("transition-transform ml-0.5", isOpen ? "rotate-180" : "")}
          />
        </button>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-accent-danger hover:bg-accent-danger/5 rounded-lg border border-accent-danger/20 transition-all"
          >
            <RotateCcw size={11} />
            Clear
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 z-50 w-[520px] bg-bg-surface border border-border rounded-xl shadow-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[12px] font-bold text-text-primary">Filter Call Reports</p>
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-md bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
                  <Calendar size={11} className="text-accent-primary" />
                  Date Range
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="date"
                    className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-medium text-text-primary focus:outline-none focus:border-accent-primary/50 focus:ring-2 focus:ring-accent-primary/10 transition-all"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ startDate: e.target.value })}
                    placeholder="Start date"
                  />
                  <input
                    type="date"
                    className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-medium text-text-primary focus:outline-none focus:border-accent-primary/50 focus:ring-2 focus:ring-accent-primary/10 transition-all"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ endDate: e.target.value })}
                    placeholder="End date"
                  />
                </div>
              </div>

              {/* Agent */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
                  <User size={11} className="text-accent-primary" />
                  Agent
                </div>
                <select
                  className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-[12px] font-medium text-text-primary focus:outline-none focus:border-accent-primary/50 focus:ring-2 focus:ring-accent-primary/10 transition-all cursor-pointer"
                  value={filters.agentName}
                  onChange={(e) => setFilters({ agentName: e.target.value })}
                >
                  <option value="">All Agents</option>
                  {agents.map(a => (
                    <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert size={11} className="text-accent-primary" />
                    Severity
                  </span>
                  <span className="text-accent-primary font-bold text-[10px]">
                    {SEVERITY_LABELS[parseInt(filters.severity) || 0]}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-accent-primary bg-bg-elevated"
                  value={filters.severity || 0}
                  onChange={(e) => setFilters({ severity: e.target.value })}
                />
                <div className="flex justify-between text-[9px] font-medium text-text-muted/70">
                  <span>Any</span>
                  <span>Critical</span>
                </div>
              </div>
            </div>

            {/* Active filter pills */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                {filters.startDate && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-primary/8 border border-accent-primary/20 rounded-lg text-[10px] font-semibold text-accent-primary">
                    From: {filters.startDate}
                    <button onClick={() => setFilters({ startDate: '' })}><X size={9} /></button>
                  </span>
                )}
                {filters.endDate && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-primary/8 border border-accent-primary/20 rounded-lg text-[10px] font-semibold text-accent-primary">
                    To: {filters.endDate}
                    <button onClick={() => setFilters({ endDate: '' })}><X size={9} /></button>
                  </span>
                )}
                {filters.agentName && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-primary/8 border border-accent-primary/20 rounded-lg text-[10px] font-semibold text-accent-primary">
                    Agent: {filters.agentName}
                    <button onClick={() => setFilters({ agentName: '' })}><X size={9} /></button>
                  </span>
                )}
                {filters.severity && parseInt(filters.severity) > 0 && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-primary/8 border border-accent-primary/20 rounded-lg text-[10px] font-semibold text-accent-primary">
                    Severity: {SEVERITY_LABELS[parseInt(filters.severity)]}
                    <button onClick={() => setFilters({ severity: '' })}><X size={9} /></button>
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportFilters;
