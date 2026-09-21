import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Flame,
  Clock,
  Film,
  Upload,
  LogIn,
  AlertCircle,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { getHomeFeed } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CategoryChips from '../components/CategoryChips';
import VideoSection from '../components/VideoSection';
import VideoCard from '../components/VideoCard';
import VideoCardSkeleton from '../components/VideoCardSkeleton';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';

const Home = () => {
  const { isAuthenticated } = useAuth();

  // State management
  const [activeCategory, setActiveCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  const [feedData, setFeedData] = useState({
    recommended: [],
    trending: [],
    latest: [],
  });
  const [categoryVideos, setCategoryVideos] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    hasMore: false,
  });

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Fetch Homepage Feed
  const fetchFeed = useCallback(
    async (category = 'All', pageNum = 1, isLoadMore = false) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const isAll = category.toLowerCase() === 'all';
        const params = {
          category: isAll ? undefined : category,
          page: pageNum,
          limit: 12,
        };

        const response = await getHomeFeed(params);

        if (response?.success && response?.data) {
          if (response.data.categories) {
            setCategories(response.data.categories);
          }

          if (isAll) {
            // "All" view: Recommended, Trending, Latest
            setFeedData({
              recommended: response.data.recommended || [],
              trending: response.data.trending || [],
              latest: response.data.latest || [],
            });
            setCategoryVideos([]);
            setPagination(
              response.pagination || {
                page: 1,
                limit: 12,
                total: 0,
                hasMore: false,
              }
            );
          } else {
            // Filtered Category view
            const newVideos = response.data.videos || [];
            if (isLoadMore) {
              setCategoryVideos((prev) => [...prev, ...newVideos]);
            } else {
              setCategoryVideos(newVideos);
            }
            setPagination(
              response.pagination || {
                page: pageNum,
                limit: 12,
                total: 0,
                hasMore: false,
              }
            );
          }
        }
      } catch (err) {
        console.error('Failed to load homepage feed:', err);
        setError(
          err.message || 'Unable to load videos. Please check your connection and try again.'
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Initial load or category change
  useEffect(() => {
    fetchFeed(activeCategory, 1, false);
  }, [activeCategory, fetchFeed]);

  const handleCategorySelect = (category) => {
    if (category === activeCategory) return;
    setActiveCategory(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoadMore = () => {
    if (!pagination.hasMore || loadingMore) return;
    const nextPage = pagination.page + 1;
    fetchFeed(activeCategory, nextPage, true);
  };

  // Check if database currently has zero videos across all sections
  const isAllEmpty =
    activeCategory.toLowerCase() === 'all'
      ? feedData.recommended.length === 0 &&
        feedData.trending.length === 0 &&
        feedData.latest.length === 0
      : categoryVideos.length === 0;

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* 1. Category Pills Bar */}
      <div className="sticky top-16 z-20 bg-slate-50/95 dark:bg-[#0a0e17]/95 backdrop-blur pt-1 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <CategoryChips
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={handleCategorySelect}
        />
      </div>

      {/* 2. Error State */}
      {error && !loading && (
        <div className="rounded-2xl p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Unable to load videos
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md">
              {error}
            </p>
          </div>
          <Button
            onClick={() => fetchFeed(activeCategory, 1, false)}
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* 3. Loading Initial State (Skeletons) */}
      {loading && !error && (
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-48 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <VideoCardSkeleton key={`init-skel-${i}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Empty State (Zero Videos in Database or Category) */}
      {!loading && !error && isAllEmpty && (
        <div className="py-12">
          <EmptyState
            icon={Film}
            title={
              activeCategory.toLowerCase() === 'all'
                ? 'No videos available yet'
                : `No videos found in "${activeCategory}"`
            }
            description={
              activeCategory.toLowerCase() === 'all'
                ? 'Videos from creators will appear here once they are published. Be among the first to upload and share content!'
                : `There are currently no published videos categorized under "${activeCategory}". Try exploring other categories.`
            }
            action={
              isAuthenticated ? (
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
                  <Link to="/upload">
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Upload className="w-4 h-4" />}
                    >
                      Upload Your First Video
                    </Button>
                  </Link>
                  {activeCategory.toLowerCase() !== 'all' && (
                    <Button
                      onClick={() => handleCategorySelect('All')}
                      variant="outline"
                      size="sm"
                    >
                      View All Categories
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
                  <Link to="/register">
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Sparkles className="w-4 h-4" />}
                    >
                      Join StreamWave
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<LogIn className="w-4 h-4" />}
                    >
                      Sign In
                    </Button>
                  </Link>
                </div>
              )
            }
          />
        </div>
      )}

      {/* 5. Main Feed Content */}
      {!loading && !error && !isAllEmpty && (
        <>
          {activeCategory.toLowerCase() === 'all' ? (
            /* Structured Homepage Sections (All View) */
            <div className="space-y-10">
              {/* Recommended Section */}
              {feedData.recommended.length > 0 && (
                <VideoSection
                  title="Recommended for you"
                  icon={Sparkles}
                  videos={feedData.recommended}
                  loading={false}
                />
              )}

              {/* Trending Section */}
              {feedData.trending.length > 0 && (
                <VideoSection
                  title="Trending now"
                  icon={Flame}
                  videos={feedData.trending}
                  loading={false}
                />
              )}

              {/* Latest Uploads Section */}
              {feedData.latest.length > 0 && (
                <VideoSection
                  title="Latest uploads"
                  icon={Clock}
                  videos={feedData.latest}
                  loading={false}
                />
              )}
            </div>
          ) : (
            /* Filtered Category Grid */
            <div className="space-y-6">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
                  <Layers className="w-4 h-4" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {activeCategory} Videos
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({pagination.total} {pagination.total === 1 ? 'video' : 'videos'})
                </span>
              </div>

              {/* Videos Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-5">
                {categoryVideos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}

                {/* Loading More Skeletons */}
                {loadingMore &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <VideoCardSkeleton key={`more-skel-${i}`} />
                  ))}
              </div>

              {/* Load More Button */}
              {pagination.hasMore && (
                <div className="pt-6 pb-4 flex justify-center">
                  <Button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    variant="outline"
                    size="md"
                    className="px-8"
                  >
                    {loadingMore ? 'Loading More...' : 'Load More Videos'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
