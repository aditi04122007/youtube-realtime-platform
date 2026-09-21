import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const FALLBACK_CATEGORIES = [
  'All',
  'Technology',
  'Education',
  'Gaming',
  'Music',
  'Entertainment',
  'News',
  'Sports',
  'Travel',
  'Science',
  'Comedy',
  'Lifestyle',
  'Programming',
  'Podcasts',
  'Live',
];

const CategoryChips = ({
  categories = [],
  activeCategory = 'All',
  onSelectCategory,
  className = '',
}) => {
  const scrollContainerRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Normalize category list: guarantee 'All' is first, then database categories or fallbacks
  const chipList = React.useMemo(() => {
    const list = ['All'];
    if (categories && categories.length > 0) {
      categories.forEach((cat) => {
        const name = typeof cat === 'string' ? cat : cat.name;
        if (name && !list.includes(name)) {
          list.push(name);
        }
      });
    } else {
      FALLBACK_CATEGORIES.forEach((name) => {
        if (!list.includes(name)) list.push(name);
      });
    }
    return list;
  }, [categories]);

  // Check scroll positions to show/hide navigation arrows
  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [chipList]);

  const handleScroll = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 240;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 300);
  };

  return (
    <div className={`relative flex items-center py-2 -mx-2 px-2 group ${className}`}>
      {/* Left Scroll Arrow */}
      {showLeftArrow && (
        <button
          onClick={() => handleScroll('left')}
          aria-label="Scroll categories left"
          className="absolute left-0 z-10 p-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 shadow-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Horizontal Pills Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex items-center space-x-2.5 overflow-x-auto scrollbar-none py-1 px-1 scroll-smooth"
        role="tablist"
        aria-label="Video categories"
      >
        {chipList.map((category) => {
          const isActive =
            activeCategory.toLowerCase() === category.toLowerCase() ||
            (activeCategory === '' && category === 'All');

          return (
            <button
              key={category}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectCategory && onSelectCategory(category)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-transparent hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Right Scroll Arrow */}
      {showRightArrow && (
        <button
          onClick={() => handleScroll('right')}
          aria-label="Scroll categories right"
          className="absolute right-0 z-10 p-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 shadow-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default CategoryChips;
