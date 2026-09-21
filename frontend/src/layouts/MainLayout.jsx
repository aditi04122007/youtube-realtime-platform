import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/navigation/Navbar';
import Sidebar from '../components/navigation/Sidebar';
import MobileNav from '../components/MobileNav';

const MainLayout = () => {
  // Desktop defaults to open, mobile/tablet (< 1024px) defaults to closed
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // Close mobile drawer on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSidebarOpen && window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Adjust sidebar when resizing across desktop breakpoint
  React.useEffect(() => {
    let lastWidth = window.innerWidth;
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (lastWidth < 1024 && currentWidth >= 1024) {
        setIsSidebarOpen(true);
      } else if (lastWidth >= 1024 && currentWidth < 1024) {
        setIsSidebarOpen(false);
      }
      lastWidth = currentWidth;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0e17] text-slate-900 dark:text-slate-100 flex flex-col transition-colors overflow-x-hidden">
      <Navbar toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 relative">
        {/* Mobile Backdrop Overlay (Requirements 6, 7) */}
        {isSidebarOpen && (
          <div
            onClick={closeSidebar}
            className="fixed inset-0 top-16 bg-black/50 backdrop-blur-xs z-20 lg:hidden transition-opacity"
            aria-hidden="true"
          />
        )}
        <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-8 pb-24 lg:pb-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
};

export default MainLayout;
