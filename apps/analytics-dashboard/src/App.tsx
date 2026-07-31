import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import {
  fetchUsers,
  fetchEvents,
  fetchGuests,
  fetchPhotos,
  fetchContactMessages,
  updateContactMessageStatus,
  computeDashboardStats,
  type DashboardStats,
  type UserProfile,
  type Event as EventType,
  type GuestLog,
  type Photo,
  type ContactMessage,
  type ContactMessageStatus
} from './lib/analytics';
import { AnalyticsOverview } from './components/AnalyticsOverview';
import { UserGrid } from './components/UserGrid';
import { EventGrid } from './components/EventGrid';
import { PlanDetailsGrid } from './components/PlanDetailsGrid';
import { ManagePricingGrid } from './components/ManagePricingGrid';
import { InfraCostGrid } from './components/InfraCostGrid';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { ContactMessagesGrid } from './components/ContactMessagesGrid';
import { runAdminAction, type AdminAction } from './lib/adminApi';
import { BarChart3, Users, Folder, LogOut, Key, Mail, AlertTriangle, ShieldCheck, Layers, DollarSign, Settings2, CheckCircle2, ArrowLeft } from 'lucide-react';

const isPasswordRecoveryUrl = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname.endsWith('/reset-password') ||
    window.location.hash.includes('type=recovery') ||
    window.location.search.includes('type=recovery')
  );
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset'>('login');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Dashboard Data State
  const [loadingData, setLoadingData] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [guests, setGuests] = useState<GuestLog[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'events' | 'plans' | 'pricing' | 'infra' | 'messages' | 'superadmin'>('overview');

  useEffect(() => {
    const isRecoveryLink = isPasswordRecoveryUrl();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (isRecoveryLink) {
        setAuthView('reset');
        setAuthError('');
        setAuthMessage('Enter a new password for your Analytics Dashboard account.');
        setCheckingAuth(false);
        return;
      }
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
        setCheckingAuth(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY' || (session && isPasswordRecoveryUrl())) {
        setAuthView('reset');
        setAuthError('');
        setAuthMessage('Enter a new password for your Analytics Dashboard account.');
        setCheckingAuth(false);
        return;
      }
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setCheckingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    setCheckingAuth(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data && data.role === 'admin' && !data.delegated_by) {
        setProfile({
          id: data.id,
          name: data.name || 'Admin',
          email: data.email || '',
          role: data.role,
          roleType: data.role_type || '',
          delegatedBy: data.delegated_by || '',
          createdAt: data.created_at,
          lastLogin: data.last_login
        });
        setIsAdmin(true);
        loadDashboardData();
      } else {
        setIsAdmin(false);
      }
    } catch (err) {
      console.error("Error checking admin status:", err);
      setIsAdmin(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleAuthLoading(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setGoogleAuthLoading(false);
      setAuthError(err.message || 'Google login failed. Please try again.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        throw new Error('Please enter your admin email address.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;
      setAuthMessage('Password reset link sent. Please check your email inbox.');
    } catch (err: any) {
      setAuthError(err.message || 'Unable to send password reset email.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');
    try {
      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('New password and confirmation do not match.');
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setAuthView('login');
      setAuthMessage('Password updated. Please sign in with your new password.');
      window.history.replaceState({}, document.title, '/');
      await supabase.auth.signOut();
    } catch (err: any) {
      setAuthError(err.message || 'Unable to update password.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const loadDashboardData = async () => {
    setLoadingData(true);
    try {
      const [u, e, g, p, m] = await Promise.all([
        fetchUsers(),
        fetchEvents(),
        fetchGuests(),
        fetchPhotos(),
        fetchContactMessages()
      ]);
      setUsers(u);
      setEvents(e);
      setGuests(g);
      setPhotos(p);
      setContactMessages(m);
      const computed = computeDashboardStats(u, e, g, p);
      setStats(computed);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleAdminAction = async (
    action: AdminAction,
    payload: Record<string, unknown> = {},
    successMessage = 'Admin action completed.'
  ) => {
    setLoadingData(true);
    try {
      const result = await runAdminAction(action, payload);
      if (!result.success) {
        alert(result.error || 'Admin action failed.');
        return;
      }

      await loadDashboardData();

      if (action === 'syncUsers') {
        alert(`Sync completed. ${result.synced || 0} missing profiles added from ${result.count || 0} auth users.`);
      } else if (successMessage) {
        alert(successMessage);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Admin action failed.';
      alert(message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleContactMessageStatusChange = async (id: string, status: ContactMessageStatus) => {
    await updateContactMessageStatus(id, status);
    setContactMessages(prev =>
      prev.map(message =>
        message.id === id
          ? { ...message, status, readAt: status === 'new' ? '' : new Date().toISOString() }
          : message
      )
    );
  };

  // While checking initial session status
  if (checkingAuth && !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0f19]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If session doesn't exist, show Login Gate
  if (!session || authView === 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] px-4">
        <div className="w-full max-w-md bg-[#111827]/80 backdrop-blur-lg border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center mb-8 relative z-10">
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-400 mb-4">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {authView === 'forgot' ? 'Reset Password' : authView === 'reset' ? 'Set New Password' : 'Admin Console'}
            </h2>
            <p className="text-slate-400 text-sm mt-1.5">
              {authView === 'forgot'
                ? 'Enter your admin email to receive a reset link'
                : authView === 'reset'
                  ? 'Create a new password for this admin account'
                  : 'Sign in to view simple analytics & monitoring'}
            </p>
          </div>

          <form
            onSubmit={authView === 'forgot' ? handleForgotPassword : authView === 'reset' ? handleUpdatePassword : handleLogin}
            className="space-y-6 relative z-10"
          >
            {authError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            {authMessage && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm rounded-xl flex items-start space-x-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{authMessage}</span>
              </div>
            )}

            {authView === 'login' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="admin@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {authView === 'forgot' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="admin@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-colors"
                  />
                </div>
              </div>
            )}

            {authView === 'reset' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/20 active:scale-[0.98] cursor-pointer"
            >
              {authLoading
                ? authView === 'forgot' ? 'Sending Link...' : authView === 'reset' ? 'Updating Password...' : 'Signing In...'
                : authView === 'forgot' ? 'Send Reset Link' : authView === 'reset' ? 'Update Password' : 'Sign In'}
            </button>

            {authView === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setAuthView('forgot');
                  setAuthError('');
                  setAuthMessage('');
                }}
                className="w-full text-center text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                Forgot password?
              </button>
            )}

            {authView === 'login' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-800" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">or</span>
                  <div className="h-px flex-1 bg-slate-800" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={authLoading || googleAuthLoading}
                  className="w-full py-3 bg-white hover:bg-slate-100 disabled:bg-slate-300 text-slate-900 font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-slate-950/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-black text-blue-600">G</span>
                  {googleAuthLoading ? 'Opening Google...' : 'Continue with Google'}
                </button>
              </>
            )}

            {authView === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setAuthView('login');
                  setAuthError('');
                  setAuthMessage('');
                }}
                className="w-full flex items-center justify-center text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Back to sign in
              </button>
            )}

          </form>
        </div>
      </div>
    );
  }

  // If logged in but NOT admin in profiles table
  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] px-4">
        <div className="w-full max-w-md bg-[#111827]/80 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-400 mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Access Unauthorized</h2>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            Your account ({session.user?.email}) is not registered as a global super administrator in the database profiles.
          </p>
          
          <button
            onClick={handleLogout}
            className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-colors inline-flex items-center space-x-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // Admin Dashboard Workspace
  return (
    <div className="h-screen overflow-hidden flex bg-[#0b0f19] text-slate-200 font-sans">
      {/* Sidebar Navigation */}
      <aside className="h-screen w-64 border-r border-slate-800 bg-[#0f1422] flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Brand */}
          <div className="h-16 border-b border-slate-800 flex items-center px-6">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                A
              </div>
              <span className="font-bold text-white tracking-wide">Analytics Hub</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-3" />
              Overview Stats
            </button>
            
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 mr-3" />
              User Accounts
            </button>
            
            <button
              onClick={() => setActiveTab('events')}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'events'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <Folder className="w-4 h-4 mr-3" />
              Galleries
            </button>

            <button
              onClick={() => setActiveTab('plans')}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'plans'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4 mr-3" />
              Plans Info
            </button>

            <button
              onClick={() => setActiveTab('pricing')}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'pricing'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <Settings2 className="w-4 h-4 mr-3" />
              Manage Pricing
            </button>

            <button
              onClick={() => setActiveTab('infra')}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'infra'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4 mr-3" />
              Infra Cost
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'messages'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <Mail className="w-4 h-4 mr-3" />
              Contact Messages
            </button>

            <button
              onClick={() => setActiveTab('superadmin')}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'superadmin'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4 mr-3" />
              Super Admin
            </button>
          </nav>
        </div>

        {/* User Block and Sign Out */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/20">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400 uppercase">
              {profile?.name ? profile.name[0] : 'A'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white leading-tight">{profile?.name}</p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 hover:border-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Area */}
      <div className="h-screen flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Block */}
        <header className="h-16 border-b border-slate-800 bg-[#0f1422] flex items-center justify-between px-8">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            {activeTab === 'overview' ? 'Overview Analytics' :
             activeTab === 'users' ? 'Registered User Accounts' :
             activeTab === 'events' ? 'Galleries Catalog' :
             activeTab === 'plans' ? 'Subscription Plans Details' :
             activeTab === 'pricing' ? 'Manage Pricing' :
             activeTab === 'infra' ? 'Infrastructure Cost Hub' :
             activeTab === 'messages' ? 'Contact Messages' :
             'Super Admin Control'}
          </h2>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-500">
              Database: <span className="text-emerald-400 font-bold">Online</span>
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </header>

        {/* Dynamic Inner Dashboard Page */}
        <main className="p-8 max-w-7xl w-full mx-auto flex-1">
          {loadingData || !stats ? (
            <div className="h-96 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm font-medium">Fetching statistics and active metrics...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <AnalyticsOverview stats={stats} />}
              {activeTab === 'users' && (
                <UserGrid
                  users={users}
                  events={events}
                  photos={photos}
                  currentAdminId={profile?.id}
                  onPlanChange={(userId, role) =>
                    handleAdminAction(
                      'updateUserRole',
                      { uid: userId, role },
                      'User plan updated.'
                    )
                  }
                  onDurationChange={(userId, duration) =>
                    handleAdminAction(
                      'updateUserDuration',
                      { uid: userId, duration },
                      'User duration updated.'
                    )
                  }
                  onPlanDatesChange={(userId, planStartDate, planEndDate) =>
                    handleAdminAction(
                      'updateUserPlanDates',
                      { uid: userId, planStartDate, planEndDate },
                      ''
                    )
                  }
                  onPromoteSuperAdmin={userId =>
                    handleAdminAction(
                      'promoteSuperAdmin',
                      { uid: userId },
                      'User promoted to Super Admin.'
                    )
                  }
                  onRevokeSuperAdmin={userId =>
                    handleAdminAction(
                      'revokeSuperAdmin',
                      { uid: userId },
                      'Super Admin access revoked.'
                    )
                  }
                  onResetUserData={userId =>
                    handleAdminAction(
                      'resetUserData',
                      { uid: userId },
                      'User uploaded data cleared.'
                    )
                  }
                  onDeleteUser={userId =>
                    handleAdminAction('deleteUser', { uid: userId }, 'User deleted.')
                  }
                  onDeleteEvent={eventId =>
                    handleAdminAction('deleteEvent', { eventId }, 'Event deleted.')
                  }
                  onToggleSampleGallery={(eventId, isSampleGallery) =>
                    handleAdminAction(
                      'toggleSampleGallery',
                      { eventId, isSampleGallery },
                      isSampleGallery ? 'Event added to Sample Galleries.' : 'Event removed from Sample Galleries.'
                    )
                  }
                />
              )}
              {activeTab === 'events' && <EventGrid events={events} users={users} guests={guests} photos={photos} />}
              {activeTab === 'plans' && <PlanDetailsGrid users={users} />}
              {activeTab === 'pricing' && <ManagePricingGrid />}
              {activeTab === 'infra' && <InfraCostGrid stats={stats} users={users} events={events} guests={guests} photos={photos} />}
              {activeTab === 'messages' && (
                <ContactMessagesGrid
                  messages={contactMessages}
                  onStatusChange={handleContactMessageStatusChange}
                />
              )}
              {activeTab === 'superadmin' && (
                <SuperAdminPanel
                  users={users}
                  events={events}
                  guests={guests}
                  loading={loadingData}
                  onRefresh={loadDashboardData}
                  onSyncUsers={() => handleAdminAction('syncUsers')}
                  onUpdateUserRole={(userId, role, delegatedBy, roleType) =>
                    handleAdminAction(
                      'updateUserRole',
                      { uid: userId, role, delegatedBy, roleType },
                      'User role updated.'
                    )
                  }
                  onDeleteUser={userId =>
                    handleAdminAction('deleteUser', { uid: userId }, 'User deleted.')
                  }
                  onDeleteEvent={eventId =>
                    handleAdminAction('deleteEvent', { eventId }, 'Event deleted.')
                  }
                  onDeleteGuest={guestId =>
                    handleAdminAction('deleteGuest', { guestId }, 'Guest deleted.')
                  }
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
