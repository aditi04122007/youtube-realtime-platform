import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Flame,
  Sparkles,
  Trophy,
  Music2,
  Gamepad2,
  Film,
  Code,
  Newspaper,
  Radio,
  Clock,
} from 'lucide-react';
import { getHomeFeed } from '../services/api';
import { getCategories } from '../services/videoService';
import VideoSection from '../components/VideoSection';
import Card from '../components/common/Card';

const CATEGORY_ICONS = {
  Trending: { icon: Flame, color: 'from-orange-500 to-rose-500' },
  Music: { icon: Music2, color: 'from-indigo-500 to-purple-500' },
  Gaming: { icon: Gamepad2, color: 'from-emerald-500 to-teal-500' },
  'Movies & TV': { icon: Film, color: 'from-amber-500 to-orange-500' },
  Entertainment: { icon: Film, color: 'from-amber-500 to-orange-500' },
  Sports: { icon: Trophy, color: 'from-blue-500 to-cyan-500' },
  Learning: { icon: Sparkles, color: 'from-fuchsia-500 to-pink-500' },
  Education: { icon: Sparkles, color: 'from-fuchsia-500 to-pink-500' },
  Technology: { icon: Code, color: 'from-cyan-500 to-blue-600' },
  News: { icon: Newspaper, color: 'from-rose-500 to-red-600' },
  Live: { icon: Radio, color: 'from-red-500 to-pink-600' },
};

const Explore = () => {
  const navigate = useNavigate();
  const [trendingVideos, setTrendingVideos] = useState([]);
  const [latestVideos, setLatestVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getHomeFeed().catch(() => ({ data: {} })),
      getCategories().catch(() => ({ categories: [] })),
    ])
      .then(([feedRes, catRes]) => {
        if (!isMounted) return;

        if (feedRes.data?.trending) {
          setTrendingVideos(feedRes.data.trending);
        }
        if (feedRes.data?.latest) {
          setLatestVideos(feedRes.data.latest);
        }

        const rawCats = catRes.categories || catRes.data || [];
        if (rawCats.length > 0) {
          setCategories(rawCats);
        } else {
          // Default fallbacks
          setCategories([
            { id: '1', name: 'Music' },
            { id: '2', name: 'Gaming' },
            { id: '3', name: 'Technology' },
            { id: '4', name: 'Education' },
            { id: '5', name: 'Sports' },
            { id: '6', name: 'Entertainment' },
          ]);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCategoryClick = (catName) => {
    navigate(`/search?category=${encodeURIComponent(catName)}`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
          <Compass className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Explore
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Discover popular topics, emerging creators, and trending videos across StreamWave
          </p>
        </div>
      </div>

      {/* Explore Topic Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Browse by Category
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((cat) => {
            const style = CATEGORY_ICONS[cat.name] || {
              icon: Sparkles,
              color: 'from-indigo-500 to-cyan-500',
            };
            const Icon = style.icon;

            return (
              <Card
                key={cat.id || cat.name}
                hoverEffect
                onClick={() => handleCategoryClick(cat.name)}
                className="p-4 flex flex-col items-center justify-center text-center space-y-2.5 cursor-pointer group"
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${style.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate w-full">
                  {cat.name}
                </span>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Trending Section */}
      <VideoSection
        title="Trending on StreamWave"
        icon={Flame}
        videos={trendingVideos}
        loading={loading}
        skeletonCount={4}
      />

      {/* Recently Published Section */}
      {latestVideos.length > 0 && (
        <VideoSection
          title="Recently Published"
          icon={Clock}
          videos={latestVideos}
          loading={loading}
          skeletonCount={4}
        />
      )}
    </div>
  );
};

export default Explore;
