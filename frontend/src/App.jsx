import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';

// Page components
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Watch from './pages/Watch';
import Channel from './pages/Channel';
import Profile from './pages/Profile';
import MyProfile from './pages/MyProfile';
import EditProfile from './pages/EditProfile';
import CreateChannel from './pages/CreateChannel';
import UploadVideo from './pages/UploadVideo';
import MyVideos from './pages/MyVideos';
import SearchResults from './pages/SearchResults';
import Explore from './pages/Explore';
import WatchLater from './pages/WatchLater';
import Subscriptions from './pages/Subscriptions';
import SubscriptionDashboard from './pages/SubscriptionDashboard';
import WatchHistory from './pages/WatchHistory';
import DownloadHistory from './pages/DownloadHistory';
import Playlists from './pages/Playlists';
import PlaylistDetail from './pages/PlaylistDetail';
import Settings from './pages/Settings';
import Security from './pages/Security';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminChannels from './pages/AdminChannels';
import AdminVideos from './pages/AdminVideos';
import AdminComments from './pages/AdminComments';
import AdminReports from './pages/AdminReports';
import AdminModeration from './pages/AdminModeration';
import AdminSubscriptions from './pages/AdminSubscriptions';
import AdminPayments from './pages/AdminPayments';
import AdminDownloads from './pages/AdminDownloads';
import AdminCalls from './pages/AdminCalls';
import AdminActivity from './pages/AdminActivity';
import AdminSettings from './pages/AdminSettings';
import VideoCallRoom from './pages/VideoCallRoom';
import CallRoomPage from './pages/CallRoomPage';
import CallHistory from './pages/CallHistory';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';
import { CallProvider } from './context/CallContext';
import IncomingCallModal from './components/calls/IncomingCallModal';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <CallProvider>
              <IncomingCallModal />
              <Routes>
            <Route path="/" element={<MainLayout />}>
              {/* 1. Public Browsing Routes */}
              <Route index element={<Home />} />
              <Route path="explore" element={<Explore />} />
              <Route path="watch/:videoId" element={<Watch />} />
              <Route path="playlist/:playlistId" element={<PlaylistDetail />} />
              <Route path="channel/:channelId" element={<Channel />} />
              <Route path="profile/:userId" element={<Profile />} />
              <Route path="search" element={<SearchResults />} />

              {/* 2. Authentication Views (Phase 3 & Phase 5) */}
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="reset-password" element={<ResetPassword />} />

              {/* 3. Protected Profile & Channel Management (Phase 4) */}
              <Route
                path="profile"
                element={
                  <ProtectedRoute>
                    <MyProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings/profile"
                element={
                  <ProtectedRoute>
                    <EditProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="channel/create"
                element={
                  <ProtectedRoute>
                    <CreateChannel />
                  </ProtectedRoute>
                }
              />

              {/* 4. Protected Security & Device Management (Phase 5) */}
              <Route
                path="settings/security"
                element={
                  <ProtectedRoute>
                    <Security />
                  </ProtectedRoute>
                }
              />

              {/* 5. Protected Media & Library Routes */}
              <Route
                path="upload"
                element={
                  <ProtectedRoute>
                    <UploadVideo />
                  </ProtectedRoute>
                }
              />
              <Route
                path="my-videos"
                element={
                  <ProtectedRoute>
                    <MyVideos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="subscriptions"
                element={
                  <ProtectedRoute>
                    <Subscriptions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="subscription-dashboard"
                element={
                  <ProtectedRoute>
                    <SubscriptionDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="history"
                element={
                  <ProtectedRoute>
                    <WatchHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="download-history"
                element={
                  <ProtectedRoute>
                    <DownloadHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="downloads"
                element={
                  <ProtectedRoute>
                    <DownloadHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="playlists"
                element={
                  <ProtectedRoute>
                    <Playlists />
                  </ProtectedRoute>
                }
              />
              <Route
                path="watch-later"
                element={
                  <ProtectedRoute>
                    <WatchLater />
                  </ProtectedRoute>
                }
              />

              {/* 6. Protected System & Real-Time Rooms */}
              <Route
                path="notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="call-history"
                element={
                  <ProtectedRoute>
                    <CallHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="call/:callId"
                element={
                  <ProtectedRoute>
                    <VideoCallRoom />
                  </ProtectedRoute>
                }
              />
              <Route
                path="call-room/:roomCode"
                element={
                  <ProtectedRoute>
                    <CallRoomPage />
                  </ProtectedRoute>
                }
              />

              {/* 8. Wildcard 404 */}
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* 7. Protected Admin Console (Dedicated AdminLayout) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="channels" element={<AdminChannels />} />
              <Route path="videos" element={<AdminVideos />} />
              <Route path="comments" element={<AdminComments />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="moderation" element={<AdminReports />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="downloads" element={<AdminDownloads />} />
              <Route path="calls" element={<AdminCalls />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Routes>
          </CallProvider>
        </Router>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
