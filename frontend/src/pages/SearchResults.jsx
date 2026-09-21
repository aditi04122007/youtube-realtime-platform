import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  AlertCircle,
  RefreshCw,
  Film,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Compass,
} from 'lucide-react';
import { searchVideos, getCategories } from '../services/videoService';
import SearchResultCard from '../components/SearchResultCard';
import SearchResultSkeleton from '../components/SearchResultSkeleton';
import SearchFilters from '../components/SearchFilters';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract query params
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || (query ? 'relevance' : 'newest');
  const date = searchParams.get('date') || 'any';
  const duration = searchParams.get('duration') || 'any';
  const page = parseInt(searchParams.get('page'), 10) || 1;

  // Local state
  const [videos, setVideos] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Active filter count
  const activeFiltersCount = [
    Boolean(category && category !== 'All'),
    Boolean(sort && sort !== (query ? 'relevance' : 'newest')),
    Boolean(date && date !== 'any'),
    Boolean(duration && duration !== 'any'),
  ].filter(Boolean).length;

  // Fetch available categories once on mount
  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((res) => {
        if (isMounted && res.categories) {
          setCategories(res.categories);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch search results whenever search params change
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchResults = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await searchVideos(
          {
            q: query,
            category,
            sort,
            date,
            duration,
            page,
            limit: 12,
          },
          controller.signal
        );

        if (isMounted) {
          if (data.success) {
            setVideos(data.videos || []);
            setPagination(
              data.pagination || {
                total: 0,
                page: 1,
                limit: 12,
                totalPages: 1,
              }
            );
          } else {
            setError(data.message || 'Failed to search videos.');
          }
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && isMounted) {
          console.error('Search error:', err);
          setError(
            err.response?.data?.message ||
              'Unable to fetch search results. Please check your connection.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [query, category, sort, date, duration, page]);

  // Handle filter changes by synchronizing URL search params
  const handleFilterChange = (key, value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value && value !== 'any' && value !== 'All') {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    nextParams.set('page', '1'); // Always reset to page 1 on filter alteration
    setSearchParams(nextParams);
  };

  const handleResetFilters = () => {
    const nextParams = new URLSearchParams();
    if (query) nextParams.set('q', query);
    setSearchParams(nextParams);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === page) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', newPage.toString());
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build appropriate header title
  const getHeaderTitle = () => {
    if (query && category) {
      return (
        <span>
          Results for <span className="text-indigo-600 dark:text-cyan-400">"{query}"</span> in{' '}
          <span className="text-indigo-600 dark:text-cyan-400">{category}</span>
        </span>
      );
    }
    if (query) {
      return (
        <span>
          Results for <span className="text-indigo-600 dark:text-cyan-400">"{query}"</span>
        </span>
      );
    }
    if (category) {
      return (
        <span>
          <span className="text-indigo-600 dark:text-cyan-400">{category}</span> Videos
        </span>
      );
    }
    return <span>Video Catalog</span>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Bar: Title & Filter Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Search className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            <span className="truncate">{getHeaderTitle()}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {loading ? (
              'Searching the video catalog...'
            ) : (
              `About ${pagination.total.toLocaleString()} ${
                pagination.total === 1 ? 'result' : 'results'
              }`
            )}
          </p>
        </div>

        {/* Filter Toggle Button */}
        <div className="flex items-center space-x-2.5">
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <FilterX className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isFiltersOpen || activeFiltersCount > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Component (Panel on Desktop, Drawer on Mobile) */}
      <SearchFilters
        filters={{ category, sort, date, duration }}
        categories={categories}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
      />

      {/* Main Content Area */}
      {loading ? (
        <SearchResultSkeleton count={6} />
      ) : error ? (
        <Card className="p-8 text-center space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Search Failed
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setSearchParams(new URLSearchParams(searchParams))}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry Search
          </Button>
        </Card>
      ) : videos.length === 0 ? (
        /* Empty Results State */
        <Card className="p-10 text-center space-y-5 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Film className="w-8 h-8 opacity-60" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              No results found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              {query
                ? `No videos matched your query "${query}". Try different keywords or adjust your filters.`
                : 'No videos found matching the selected filter criteria.'}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            {activeFiltersCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetFilters}
                icon={<FilterX className="w-3.5 h-3.5" />}
              >
                Clear All Filters
              </Button>
            )}
            <Link to="/explore">
              <Button
                variant="primary"
                size="sm"
                icon={<Compass className="w-3.5 h-3.5" />}
              >
                Explore Topics
              </Button>
            </Link>
          </div>

          <div className="text-[11px] text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800 text-left space-y-1">
            <p className="font-semibold text-slate-500 dark:text-slate-300">Suggestions:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-400">
              <li>Make sure all words are spelled correctly.</li>
              <li>Try more general search queries.</li>
              <li>Try different keywords or broader topic terms.</li>
            </ul>
          </div>
        </Card>
      ) : (
        /* Video Results List */
        <div className="space-y-4">
          {videos.map((video) => (
            <SearchResultCard key={video.id} video={video} />
          ))}

          {/* Pagination Bar */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>

              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  icon={<ChevronLeft className="w-4 h-4" />}
                >
                  Previous
                </Button>

                {/* Page Numbers */}
                <div className="hidden sm:flex items-center space-x-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === pagination.totalPages ||
                        (p >= page - 1 && p <= page + 1)
                    )
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <React.Fragment key={p}>
                          {prev && p - prev > 1 && (
                            <span className="px-1 text-slate-400">...</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePageChange(p)}
                            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                              p === page
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  <span className="flex items-center space-x-1">
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
