"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getGuestLogs, getEvents, getUsers, updateUserRole, deleteUser, deleteEvent } from "@/lib/firestore";
import { deleteUserCompletely, syncAllAuthUsers } from "@/app/actions/userActions";
import { LogOut, Users, ShieldCheck, Calendar, Trash2, ChevronRight, ChevronDown, Folder, User, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"users" | "admins" | "events">("users");

    // Data State
    const [users, setUsers] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Accordion State
    const [expandedCreators, setExpandedCreators] = useState<Set<string>>(new Set());
    const [expandedMainEvents, setExpandedMainEvents] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!loading) {
            // Only allow true global admins (not delegated ones)
            if (!user || user.role !== "admin" || user.delegatedBy) {
                router.push("/login");
            } else {
                fetchInitialData();
            }
        }
    }, [user, loading, router]);

    const fetchInitialData = async () => {
        setLoadingData(true);
        const [eventData, userData] = await Promise.all([
            getEvents(),
            getUsers()
        ]);
        setEvents(eventData);
        setUsers(userData);
        setLoadingData(false);
    };

    const handleUpdateRole = async (uid: string, newRole: string) => {
        const success = await updateUserRole(uid, newRole);
        if (success) {
            setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u));
        }
    };

    const handleSyncUsers = async () => {
        if (!confirm("This will find all users in Firebase Auth and ensure they have a profile in the database. Continue?")) return;

        setLoadingData(true);
        try {
            const result = await syncAllAuthUsers(user?.email || "");
            if (result.success) {
                alert(`Successfully checked ${result.count} users. Created ${result.synced} missing profiles.`);
                fetchInitialData(); // Refresh the list
            } else {
                alert(`Sync failed: ${result.error}`);
            }
        } catch (err) {
            console.error("Sync error:", err);
            alert("A sync error occurred.");
        } finally {
            setLoadingData(false);
        }
    };

    const handleDeleteUser = async (uid: string, email: string) => {
        if (!confirm(`Are you sure you want to delete user ${email}? This will delete their login account AND their profile data. This action cannot be undone.`)) return;

        setLoadingData(true);
        try {
            // We use the Server Action for full deletion
            const result = await deleteUserCompletely(uid, user?.email || "");

            if (result.success) {
                setUsers(prev => prev.filter(u => u.id !== uid));
            } else {
                // If Server Action fails (e.g. env variables missing), fallback to Firestore only delete
                console.warn("Server side deletion failed, falling back to database-only delete:", result.error);
                const dbSuccess = await deleteUser(uid);
                if (dbSuccess) {
                    setUsers(prev => prev.filter(u => u.id !== uid));
                    alert("User's profile deleted from database, but their login account (Auth) could not be removed automatically. You may need to delete it manually in the Firebase Console.");
                } else {
                    alert(`Failed to delete user: ${result.error}`);
                }
            }
        } catch (err) {
            console.error("Error in delete flow:", err);
            alert("An error occurred during deletion.");
        } finally {
            setLoadingData(false);
        }
    };

    const handleDeleteEvent = async (eventId: string, title: string) => {
        if (!confirm(`Are you sure you want to delete the event "${title}"? This will also delete all photos in this event. This action cannot be undone.`)) return;

        const success = await deleteEvent(eventId);
        if (success) {
            setEvents(prev => prev.filter(e => e.id !== eventId));
        } else {
            alert("Failed to delete event. Please try again.");
        }
    };

    const toggleCreator = (email: string) => {
        setExpandedCreators(prev => {
            const next = new Set(prev);
            if (next.has(email)) next.delete(email);
            else next.add(email);
            return next;
        });
    };

    const toggleMainEvent = (eventId: string) => {
        setExpandedMainEvents(prev => {
            const next = new Set(prev);
            if (next.has(eventId)) next.delete(eventId);
            else next.add(eventId);
            return next;
        });
    };

    if (loading || !user || user.role !== "admin" || user.delegatedBy) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-slate-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    // Group events for hierarchical view
    const mainEvents = events.filter(e => e.type === "main" || (!e.parentId && e.type !== "sub"));
    const subEvents = events.filter(e => e.type === "sub" || e.parentId);

    // Get list of creators from events
    const eventCreators = Array.from(new Set(events.map(e => e.createdBy || "unassigned"))).sort((a, b) => {
        if (a === "unassigned") return 1;
        if (b === "unassigned") return -1;
        const emailA = users.find(u => u.id === a)?.email || a;
        const emailB = users.find(u => u.id === b)?.email || b;
        return emailA.localeCompare(emailB);
    });

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-600">
            {/* Top Bar */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <h1 className="font-serif text-xl font-bold text-slate-800">
                        Admin Dashboard
                    </h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm hidden sm:inline">{user.email}</span>
                        <button
                            onClick={logout}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Tabs */}
                <div className="flex space-x-1 bg-slate-200 p-1 rounded-xl mb-8 max-w-md">
                    <button
                        onClick={() => setActiveTab("users")}
                        className={cn(
                            "flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all",
                            activeTab === "users"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <Users className="w-4 h-4 mr-2" />
                        All Users
                    </button>
                    <button
                        onClick={() => setActiveTab("events")}
                        className={cn(
                            "flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all",
                            activeTab === "events"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <Calendar className="w-4 h-4 mr-2" />
                        Events
                    </button>
                    <button
                        onClick={() => setActiveTab("admins")}
                        className={cn(
                            "flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all",
                            activeTab === "admins"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Admins
                    </button>
                </div>

                {/* Content */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">


                    {activeTab === "users" && (
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-serif font-bold text-slate-800">Registered Users</h2>
                                <button
                                    onClick={handleSyncUsers}
                                    className="flex items-center px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                                    title="Fetch all users from Firebase Authentication"
                                >
                                    <RefreshCw className={cn("w-3.5 h-3.5 mr-2", loadingData && "animate-spin")} />
                                    Sync All Users
                                </button>
                            </div>
                            {loadingData ? (
                                <p>Loading users...</p>
                            ) : users.length === 0 ? (
                                <p className="text-slate-400 italic">No registered users yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Name</th>
                                                <th className="px-6 py-3 font-medium">Email</th>
                                                <th className="px-6 py-3 font-medium">Role</th>
                                                <th className="px-6 py-3 font-medium text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {users.map((u) => (
                                                <tr key={u.id} className="hover:bg-slate-50/50">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                                                    <td className="px-6 py-4 text-slate-500">{u.email}</td>
                                                    <td className="px-6 py-4">
                                                        <select
                                                            value={u.role || "user"}
                                                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                                            className={cn(
                                                                "bg-transparent border-none text-[10px] font-bold uppercase tracking-wider focus:ring-0 cursor-pointer transition-colors outline-none",
                                                                u.role === "admin" ? "text-amber-600" : "text-sky-600"
                                                            )}
                                                            title="Change user role"
                                                            disabled={u.email === user?.email}
                                                        >
                                                            <option value="user">User</option>
                                                            <option value="editor">Editor</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {u.email !== user?.email && (
                                                            <button
                                                                onClick={() => handleDeleteUser(u.id, u.email)}
                                                                className="text-slate-300 hover:text-rose-500 transition-colors"
                                                                title="Delete User"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "events" && (
                        <div className="p-6">
                            <h2 className="text-lg font-serif font-bold text-slate-800 mb-6">Hierarchy View (Creator &gt; Main &gt; Sub)</h2>
                            {loadingData ? (
                                <p>Loading hierarchy...</p>
                            ) : events.length === 0 ? (
                                <p className="text-slate-400 italic">No events found.</p>
                            ) : (
                                <div className="space-y-4">
                                    {eventCreators.map(creatorId => {
                                        const creatorUser = users.find(u => u.id === creatorId);
                                        const creatorEmail = creatorUser?.email || (creatorId === "unassigned" ? "system@internal" : creatorId);
                                        const creatorDisplayName = creatorUser?.name || (creatorId === "unassigned" ? "System / Seeded Content" : "Registered User");

                                        const creatorMainEvents = mainEvents.filter(e => (e.createdBy || "unassigned") === creatorId);
                                        const creatorSubEvents = subEvents.filter(e => (e.createdBy || "unassigned") === creatorId);
                                        const isExpanded = expandedCreators.has(creatorId);

                                        // Skip if no events for this creator
                                        if (creatorMainEvents.length === 0 && creatorSubEvents.length === 0) return null;

                                        return (
                                            <div key={creatorEmail} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md mb-4 group">
                                                {/* User Identity Card (Creator Header) */}
                                                <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                                                            <User className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-serif font-bold text-slate-800 text-lg leading-tight">
                                                                {creatorDisplayName}
                                                            </h3>
                                                            <p className="text-sm text-slate-500 font-medium">{creatorEmail}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center shadow-sm">
                                                            <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                                {creatorMainEvents.length} Main Events
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => toggleCreator(creatorId)}
                                                            className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-100"
                                                        >
                                                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Expanded Hierarchy View */}
                                                {isExpanded && (
                                                    <div className="p-4 sm:p-6 bg-white space-y-4">
                                                        <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">
                                                            <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                                                            <span>Galleries Hierarchy</span>
                                                        </div>

                                                        <div className="space-y-3">
                                                            {creatorMainEvents.map(main => {
                                                                const mainSubs = subEvents.filter(sub => sub.parentId === main.id);
                                                                const isMainExpanded = expandedMainEvents.has(main.id);

                                                                return (
                                                                    <div key={main.id} className="relative">
                                                                        {/* Hierarchy Connector Lines */}
                                                                        {isMainExpanded && mainSubs.length > 0 && (
                                                                            <div className="absolute left-7 top-14 bottom-6 w-px bg-slate-100"></div>
                                                                        )}

                                                                        <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl transition-all border border-slate-100/50 hover:border-indigo-100 group/event">
                                                                            <div className="flex items-center flex-1">
                                                                                <button
                                                                                    disabled={mainSubs.length === 0}
                                                                                    onClick={() => toggleMainEvent(main.id)}
                                                                                    className={cn(
                                                                                        "mr-3 w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                                                                                        isMainExpanded ? "bg-indigo-100 text-indigo-600" : "bg-white text-slate-400 hover:text-indigo-500 border border-slate-100",
                                                                                        mainSubs.length === 0 && "opacity-20 cursor-default"
                                                                                    )}
                                                                                >
                                                                                    {isMainExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                                </button>
                                                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center mr-3 shadow-xs">
                                                                                    <Calendar className="w-5 h-5 text-amber-500" />
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-sm font-bold text-slate-800 tracking-tight">{main.title}</span>
                                                                                    <div className="flex items-center space-x-2 mt-0.5">
                                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Main Collection</span>
                                                                                        {mainSubs.length > 0 && (
                                                                                            <span className="text-[10px] text-indigo-500 font-bold">• {mainSubs.length} Sub-Galleries</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleDeleteEvent(main.id, main.title)}
                                                                                className="opacity-0 group-hover/event:opacity-100 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                                title="Delete Main Event"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </div>

                                                                        {/* Expanded Sub Events */}
                                                                        {isMainExpanded && mainSubs.length > 0 && (
                                                                            <div className="pl-12 pr-4 py-2 space-y-2">
                                                                                {mainSubs.map(sub => (
                                                                                    <div key={sub.id} className="flex items-center justify-between p-3 bg-slate-50/30 hover:bg-indigo-50/20 rounded-xl border border-transparent hover:border-indigo-100 group/sub transition-all">
                                                                                        <div className="flex items-center italic">
                                                                                            <div className="w-1.5 h-1.5 rounded-full bg-sky-200 mr-3"></div>
                                                                                            <Folder className="w-4 h-4 mr-2 text-sky-400" />
                                                                                            <span className="text-xs font-semibold text-slate-600">{sub.title}</span>
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => handleDeleteEvent(sub.id, sub.title)}
                                                                                            className="opacity-0 group-hover/sub:opacity-100 w-7 h-7 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                                            title="Delete Sub Event"
                                                                                        >
                                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Orphaned subevents for this creator */}
                                                        {creatorSubEvents.filter(sub => !mainEvents.find(m => m.id === sub.parentId)).map(sub => (
                                                            <div key={sub.id} className="flex items-center justify-between p-3 ml-2 border-l-2 border-slate-100 text-slate-400 italic bg-slate-50/20 rounded-r-xl">
                                                                <div className="flex items-center">
                                                                    <Folder className="w-4 h-4 mr-3" />
                                                                    <div>
                                                                        <span className="text-xs font-bold uppercase tracking-tighter opacity-70">Orphaned Sub-Gallery</span>
                                                                        <p className="text-xs">{sub.title}</p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteEvent(sub.id, sub.title)}
                                                                    className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "admins" && (
                        <div className="p-6">
                            <h2 className="text-lg font-serif font-bold text-slate-800 mb-6">Administrator List</h2>
                            {loadingData ? (
                                <p>Loading admins...</p>
                            ) : users.filter(u => u.role === "admin").length === 0 ? (
                                <p className="text-slate-400 italic">No administrators found.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Name</th>
                                                <th className="px-6 py-3 font-medium">Email</th>
                                                <th className="px-6 py-3 font-medium">Status</th>
                                                <th className="px-6 py-3 font-medium text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {users.filter(u => u.role === "admin").map((u) => (
                                                <tr key={u.id} className="hover:bg-amber-50/30">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                                                    <td className="px-6 py-4 text-slate-500">{u.email}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="flex items-center text-[10px] font-bold uppercase tracking-wider text-amber-600">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 animate-pulse"></div>
                                                            Full Access
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {u.email !== user?.email && (
                                                            <button
                                                                onClick={() => handleDeleteUser(u.id, u.email)}
                                                                className="text-slate-300 hover:text-rose-500 transition-colors"
                                                                title="Delete Admin"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main >
        </div >
    );
}
