import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Video,
  Bell,
  Sun,
  Moon,
  User,
  PhoneCall,
  LogOut,
  Settings as SettingsIcon,
  Shield,
  ChevronDown,
  UserPlus,
  LogIn,
  Tv,
  Edit3,
  PlusCircle,
  X,
  Crown,
  Users,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  getCurrentUserChannel,
  getMediaUrl,
  getSearchSuggestions,
  getSearchHistory,
  addSearchHistory,
  deleteSearchHistoryItem,
  clearSearchHistory,
} from '../../services/api';
import Button from '../common/Button';
import SearchSuggestions from '../SearchSuggestions';
import NotificationBell from './NotificationBell';
import CreateRoomModal from '../callRooms/CreateRoomModal';

const Navbar = ({ toggleSidebar }) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userChannel, setUserChannel] = useState(null);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);

  // Search suggestions & history state (Phase 8)
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const userMenuRef = useRef(null);
  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const mobileSearchContainerRef = useRef(null);
  const navigate = useNavigate();

  // Load user channel if authenticated
  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      getCurrentUserChannel()
        .then((res) => {
          if (isMounted && res.data?.success && res.data?.data) {
            setUserChannel(res.data.data);
          } else if (isMounted) {
            setUserChannel(null);
          }
        })
        .catch(() => {
          if (isMounted) setUserChannel(null);
        });
    } else {
      setUserChannel(null);
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id]);

  // Load search history for authenticated users
  const loadSearchHistory = async () => {
    if (isAuthenticated) {
      try {
        const res = await getSearchHistory();
        if (res && res.success) {
          setHistory(res.history || []);
        }
      } catch (err) {
        // Silently ignore
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadSearchHistory();
    } else {
      setHistory([]);
    }
  }, [isAuthenticated]);

  // Debounced search suggestions
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    const abortController = new AbortController();
    setIsLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const res = await getSearchSuggestions(trimmed, abortController.signal);
        if (res && res.success) {
          setSuggestions(res.suggestions || []);
        }
      } catch (err) {
        if (err.name !== 'CanceledError') {
          setSuggestions([]);
        }
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [searchQuery]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target) &&
        mobileSearchContainerRef.current &&
        !mobileSearchContainerRef.current.contains(event.target)
      ) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Execute search and record history
  const executeSearch = (query) => {
    const cleanQ = (query !== undefined ? query : searchQuery).trim();
    setIsSuggestionsOpen(false);
    setIsMobileSearchOpen(false);
    setSelectedIndex(-1);

    if (cleanQ) {
      if (isAuthenticated) {
        addSearchHistory(cleanQ)
          .then(() => loadSearchHistory())
          .catch(() => {});
      }
      navigate(`/search?q=${encodeURIComponent(cleanQ)}`);
    } else {
      navigate('/search');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedIndex >= 0) {
      if (searchQuery.trim() && suggestions[selectedIndex]) {
        executeSearch(suggestions[selectedIndex]);
        return;
      } else if (!searchQuery.trim() && history[selectedIndex]) {
        executeSearch(history[selectedIndex].query);
        return;
      }
    }
    executeSearch();
  };

  const handleKeyDown = (e) => {
    const activeList = searchQuery.trim() ? suggestions : history.map((h) => h.query);
    if (!isSuggestionsOpen || activeList.length === 0) {
      if (e.key === 'ArrowDown' && activeList.length > 0) {
        setIsSuggestionsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % activeList.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + activeList.length) % activeList.length);
    } else if (e.key === 'Escape') {
      setIsSuggestionsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleDeleteHistory = async (id, e) => {
    e.stopPropagation();
    try {
      await deleteSearchHistoryItem(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearSearchHistory();
      setHistory([]);
    } catch (err) {
      console.error('Failed to clear search history:', err);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedIndex(-1);
    if (searchInputRef.current) searchInputRef.current.focus();
    if (mobileSearchInputRef.current) mobileSearchInputRef.current.focus();
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/');
  };

  // Compute avatar initials
  const userInitials = (user?.display_name || user?.username || 'U')
    .slice(0, 2)
    .toUpperCase();

  const userAvatarSrc = user?.avatar_url ? getMediaUrl(user.avatar_url) : null;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-3 sm:px-5 bg-white/95 dark:bg-[#0a0e17]/95 backdrop-blur border-b border-slate-200 dark:border-slate-800/80 transition-colors">
      {/* Mobile Search Overlay */}
      {isMobileSearchOpen ? (
        <div ref={mobileSearchContainerRef} className="flex-1 flex items-center space-x-2 w-full animate-in fade-in duration-150 relative">
          <form onSubmit={handleSearch} className="flex-1 relative flex items-center">
            <input
              ref={mobileSearchInputRef}
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSuggestionsOpen(true);
              }}
              onFocus={() => setIsSuggestionsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search videos..."
              className="w-full h-10 pl-9 pr-16 text-sm bg-slate-100 dark:bg-slate-900 border border-indigo-500 rounded-full text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search text"
                className="absolute right-12 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1 top-1 bottom-1 px-2.5 bg-indigo-600 text-white rounded-full text-xs font-semibold"
            >
              Go
            </button>
          </form>
          <button
            onClick={() => {
              setIsMobileSearchOpen(false);
              setIsSuggestionsOpen(false);
            }}
            aria-label="Close search"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Suggestions Dropdown for Mobile */}
          <SearchSuggestions
            suggestions={suggestions}
            history={history}
            query={searchQuery}
            isOpen={isSuggestionsOpen}
            selectedIndex={selectedIndex}
            onSelect={(term) => executeSearch(term)}
            onDeleteHistory={handleDeleteHistory}
            onClearHistory={handleClearHistory}
            isLoading={isLoadingSuggestions}
          />
        </div>
      ) : (
        <>
          {/* Left: Hamburger & Brand */}
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleSidebar}
              aria-label="Toggle Navigation"
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link to="/" className="flex items-center space-x-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <svg
                  className="w-5 h-5 text-white ml-0.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-600 dark:from-white dark:via-slate-100 dark:to-cyan-400 bg-clip-text text-transparent">
                Stream<span className="text-indigo-600 dark:text-cyan-400">Wave</span>
              </span>
            </Link>
          </div>

          {/* Center: Large Desktop & Tablet Search Bar with Suggestions */}
          <div ref={searchContainerRef} className="flex-1 max-w-lg mx-3 sm:mx-6 hidden sm:block relative">
            <form onSubmit={handleSearch} className="relative flex items-center">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSuggestionsOpen(true);
                }}
                onFocus={() => setIsSuggestionsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search videos, creators, or topics..."
                className="w-full h-10 pl-10 pr-24 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search input"
                  className="absolute right-16 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1 top-1 bottom-1 px-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-full text-xs font-semibold transition-colors"
              >
                Search
              </button>
            </form>

            {/* Suggestions Dropdown for Desktop */}
            <SearchSuggestions
              suggestions={suggestions}
              history={history}
              query={searchQuery}
              isOpen={isSuggestionsOpen}
              selectedIndex={selectedIndex}
              onSelect={(term) => executeSearch(term)}
              onDeleteHistory={handleDeleteHistory}
              onClearHistory={handleClearHistory}
              isLoading={isLoadingSuggestions}
            />
          </div>

          {/* Right: Actions & User Section */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5">
            {/* Mobile Search Open Button */}
            <button
              onClick={() => setIsMobileSearchOpen(true)}
              aria-label="Open search"
              className="sm:hidden p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
        {/* Upload Button */}
        <Link to="/upload" className="hidden md:block">
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Video className="w-4 h-4" />}
          >
            Upload
          </Button>
        </Link>

        {/* Video Call Quick Link */}
        <Link to="/call/demo-room" className="hidden xl:block">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<PhoneCall className="w-3.5 h-3.5 text-emerald-500" />}
          >
            1:1 Call
          </Button>
        </Link>

        {/* Phase 24 Video Room Quick Action */}
        {isAuthenticated && (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Users className="w-3.5 h-3.5 text-indigo-500" />}
            onClick={() => setIsCreateRoomOpen(true)}
            className="hidden lg:flex"
          >
            Video Room
          </Button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
        </button>

        {/* Real-Time Notifications (Phase 22) */}
        {isAuthenticated && <NotificationBell />}

        {/* Dynamic Auth Section */}
        {isAuthenticated && user ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors focus:outline-none"
              aria-label="User menu"
            >
              {userAvatarSrc ? (
                <img
                  src={userAvatarSrc}
                  alt={user.display_name || user.username}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-indigo-500/30 shadow-sm">
                  {userInitials}
                </div>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 max-w-[calc(100vw-1.5rem)] py-2 bg-white dark:bg-[#0f172a] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-xs z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User Header */}
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {user.display_name || user.username}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">@{user.username}</p>
                  {user.role === 'ADMIN' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 mt-1 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                      ADMIN
                    </span>
                  )}
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  {/* My Profile */}
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <User className="w-4 h-4 mr-2.5 text-slate-400" />
                    My Profile
                  </Link>

                  {/* Channel Link: View channel if exists, else prompt create channel */}
                  {userChannel ? (
                    <Link
                      to={`/channel/${userChannel.handle || userChannel.id}`}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <Tv className="w-4 h-4 mr-2.5 text-indigo-500" />
                      Your Channel
                    </Link>
                  ) : (
                    <Link
                      to="/channel/create"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-indigo-600 dark:text-cyan-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors font-medium"
                    >
                      <PlusCircle className="w-4 h-4 mr-2.5" />
                      Create a Channel
                    </Link>
                  )}

                  {/* My Videos */}
                  <Link
                    to="/my-videos"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <Video className="w-4 h-4 mr-2.5 text-indigo-500" />
                    My Videos
                  </Link>

                  {/* My Subscription Dashboard */}
                  <Link
                    to="/subscription-dashboard"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors font-medium"
                  >
                    <Crown className="w-4 h-4 mr-2.5 text-amber-500" />
                    My Subscription
                  </Link>

                  {/* Edit Profile */}
                  <Link
                    to="/settings/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 mr-2.5 text-slate-400" />
                    Edit Profile
                  </Link>

                  {/* Platform Settings */}
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4 mr-2.5 text-slate-400" />
                    Settings
                  </Link>

                  {/* Security & Devices */}
                  <Link
                    to="/settings/security"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <Shield className="w-4 h-4 mr-2.5 text-indigo-500" />
                    Security & Devices
                  </Link>

                  {/* Create Video Room */}
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setIsCreateRoomOpen(true);
                    }}
                    className="w-full flex items-center px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                  >
                    <Users className="w-4 h-4 mr-2.5 text-indigo-500" />
                    Create Video Room
                  </button>

                  {user.role === 'ADMIN' && (
                    <Link
                      to="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors font-medium"
                    >
                      <Shield className="w-4 h-4 mr-2.5 text-amber-500" />
                      Admin Dashboard
                    </Link>
                  )}
                </div>

                {/* Logout Button */}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium text-left"
                  >
                    <LogOut className="w-4 h-4 mr-2.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <Link to="/login">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<LogIn className="w-3.5 h-3.5" />}
              >
                Sign In
              </Button>
            </Link>

            <Link to="/register" className="hidden sm:block">
              <Button
                size="sm"
                variant="primary"
                leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              >
                Register
              </Button>
            </Link>
          </div>
        )}
      </div>
        </>
      )}

      {/* Phase 24 Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
      />
    </header>
  );
};

export default Navbar;
