import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Check, Globe } from 'lucide-react';
import { getSupportedLanguages } from '../services/translationService';

// Module-level cache so languages are fetched only once across all comment instances
let cachedLanguagesPromise = null;

export const fetchSupportedLanguagesCached = () => {
  if (!cachedLanguagesPromise) {
    cachedLanguagesPromise = getSupportedLanguages()
      .then((res) => (res && res.languages) || [])
      .catch((err) => {
        cachedLanguagesPromise = null; // reset on failure to allow retry
        throw err;
      });
  }
  return cachedLanguagesPromise;
};

const LanguageSelector = ({
  selectedLanguage,
  onSelectLanguage,
  isOpen,
  onClose,
  title = 'Translate to',
}) => {
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load languages when opened
  useEffect(() => {
    if (isOpen) {
      let isMounted = true;
      setLoading(true);
      setError(null);

      fetchSupportedLanguagesCached()
        .then((langs) => {
          if (isMounted) {
            setLanguages(langs);
            setLoading(false);
            // Focus search input on open
            setTimeout(() => {
              searchInputRef.current?.focus();
            }, 100);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError('Failed to load languages');
            setLoading(false);
          }
        });

      return () => {
        isMounted = false;
      };
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Filter languages based on search query
  const filteredLanguages = useMemo(() => {
    if (!searchTerm.trim()) return languages;
    const term = searchTerm.toLowerCase().trim();
    return languages.filter(
      (lang) =>
        lang.name.toLowerCase().includes(term) ||
        lang.nativeName?.toLowerCase().includes(term) ||
        lang.code.toLowerCase().includes(term)
    );
  }, [languages, searchTerm]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-full mt-1.5 z-40 w-64 sm:w-72 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-label="Select target translation language"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <Globe className="w-3.5 h-3.5 text-indigo-500 dark:text-cyan-400" />
          <span>{title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close language selector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search language..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-cyan-400"
          />
        </div>
      </div>

      {/* Language List */}
      <div className="max-h-56 overflow-y-auto py-1 divide-y divide-slate-50 dark:divide-slate-800/50">
        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading languages...</div>
        ) : error ? (
          <div className="py-4 px-3 text-center text-xs text-rose-500">{error}</div>
        ) : filteredLanguages.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">No matching languages</div>
        ) : (
          filteredLanguages.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onSelectLanguage(lang.code);
                  onClose();
                }}
                className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors ${
                  isSelected
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-cyan-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="text-sm select-none" role="img" aria-label={lang.name}>
                    {lang.flag || '🌐'}
                  </span>
                  <span className="truncate">{lang.name}</span>
                  {lang.nativeName && lang.nativeName !== lang.name && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      ({lang.nativeName})
                    </span>
                  )}
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0 text-indigo-600 dark:text-cyan-400" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LanguageSelector;
