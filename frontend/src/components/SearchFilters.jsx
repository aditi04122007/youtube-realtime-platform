import React from 'react';
import { X, RotateCcw, Calendar, Clock, ArrowUpDown, Tag } from 'lucide-react';

const DATE_OPTIONS = [
  { label: 'Any time', value: 'any' },
  { label: 'Last 24 hours', value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'This year', value: 'year' },
];

const DURATION_OPTIONS = [
  { label: 'Any duration', value: 'any' },
  { label: 'Under 4 minutes', value: 'short' },
  { label: '4–20 minutes', value: 'medium' },
  { label: 'Over 20 minutes', value: 'long' },
];

const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Upload date (Newest)', value: 'newest' },
  { label: 'View count (Most Popular)', value: 'views' },
  { label: 'Oldest first', value: 'oldest' },
];

const SearchFilters = ({
  filters = {},
  categories = [],
  onFilterChange,
  onReset,
  isOpen = false,
  onClose,
}) => {
  const {
    category = '',
    sort = 'relevance',
    date = 'any',
    duration = 'any',
  } = filters;

  const hasActiveFilters =
    (category && category !== 'All') ||
    sort !== 'relevance' ||
    date !== 'any' ||
    duration !== 'any';

  const filterContent = (
    <div className="space-y-6">
      {/* Header with Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Search Filters
        </h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center space-x-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Grid of Filter Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
        {/* 1. Upload Date */}
        <div className="space-y-2">
          <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 uppercase tracking-wide text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>Upload Date</span>
          </label>
          <div className="space-y-1">
            {DATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFilterChange('date', opt.value)}
                className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  date === opt.value
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Duration */}
        <div className="space-y-2">
          <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 uppercase tracking-wide text-[11px]">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>Duration</span>
          </label>
          <div className="space-y-1">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFilterChange('duration', opt.value)}
                className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  duration === opt.value
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Sort By */}
        <div className="space-y-2">
          <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 uppercase tracking-wide text-[11px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
            <span>Sort By</span>
          </label>
          <div className="space-y-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFilterChange('sort', opt.value)}
                className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  sort === opt.value
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Category */}
        <div className="space-y-2">
          <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 uppercase tracking-wide text-[11px]">
            <Tag className="w-3.5 h-3.5 text-indigo-500" />
            <span>Category</span>
          </label>
          <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => onFilterChange('category', '')}
              className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors font-medium ${
                !category || category === 'All'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onFilterChange('category', cat.name)}
                className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors font-medium truncate ${
                  category === cat.name
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Collapsible Panel */}
      {isOpen && (
        <div className="hidden sm:block p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          {filterContent}
        </div>
      )}

      {/* Mobile Slide-Over Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 sm:hidden flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="text-base font-bold text-slate-900 dark:text-white">Filters</span>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {filterContent}
            <div className="pt-6">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-sm hover:bg-indigo-500 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SearchFilters;
