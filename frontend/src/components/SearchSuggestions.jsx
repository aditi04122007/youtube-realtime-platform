import React from 'react';
import { Search, Clock, X, Trash2 } from 'lucide-react';

const SearchSuggestions = ({
  suggestions = [],
  history = [],
  query = '',
  isOpen = false,
  selectedIndex = -1,
  onSelect,
  onDeleteHistory,
  onClearHistory,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const cleanQ = query.trim();
  const showHistory = !cleanQ && history.length > 0;
  const showSuggestions = cleanQ && suggestions.length > 0;

  if (!showHistory && !showSuggestions && !isLoading) {
    return null;
  }

  return (
    <div
      role="listbox"
      className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-xs overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* 1. Recent Searches Mode */}
      {showHistory && (
        <div>
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Recent Searches</span>
            {onClearHistory && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onClearHistory();
                }}
                className="text-[10px] font-semibold text-rose-500 hover:underline flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3 mr-0.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          <div className="py-1 max-h-72 overflow-y-auto">
            {history.map((item, idx) => (
              <div
                key={item.id || item.query}
                role="option"
                aria-selected={selectedIndex === idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item.query);
                }}
                className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                  selectedIndex === idx
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium truncate">{item.query}</span>
                </div>

                {onDeleteHistory && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteHistory(item.id, e);
                    }}
                    title="Remove from search history"
                    className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Live Autocomplete Suggestions Mode */}
      {showSuggestions && (
        <div className="py-1 max-h-80 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              role="option"
              aria-selected={selectedIndex === idx}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(suggestion);
              }}
              className={`flex items-center space-x-3 px-4 py-2.5 cursor-pointer transition-colors ${
                selectedIndex === idx
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-cyan-400 font-bold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{suggestion}</span>
            </div>
          ))}
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="px-4 py-2 text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2">
          <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Searching suggestions...</span>
        </div>
      )}
    </div>
  );
};

export default SearchSuggestions;
