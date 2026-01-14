"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getGuestLogs, getEvents, getUsers, updateUserRole } from "@/lib/firestore";
import { LogOut, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"guests" | "users" | "admins">("guests");

    // Data State
    const [guests, setGuests] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user || user.role !== "admin") {
                router.push("/login");
            } else {
                fetchInitialData();
            }
        }
    }, [user, loading, router]);

    const fetchInitialData = async () => {
        setLoadingData(true);
        const [guestData, eventData, userData] = await Promise.all([
            getGuestLogs(),
            getEvents(),
            getUsers()
        ]);
        setGuests(guestData);
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

    if (loading || !user || user.role !== "admin") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-slate-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

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
                        onClick={() => setActiveTab("guests")}
                        className={cn(
                            "flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all",
                            activeTab === "guests"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <Users className="w-4 h-4 mr-2" />
                        Guest Logs
                    </button>
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
                    {activeTab === "guests" && (
                        <div className="p-6">
                            <h2 className="text-lg font-serif font-bold text-slate-800 mb-6">Recent Logins</h2>
                            {loadingData ? (
                                <p>Loading logs...</p>
                            ) : guests.length === 0 ? (
                                <p className="text-slate-400 italic">No guest logins yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Name</th>
                                                <th className="px-6 py-3 font-medium">Phone</th>
                                                <th className="px-6 py-3 font-medium">Last Login</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {guests.map((guest) => (
                                                <tr key={guest.phone} className="hover:bg-slate-50/50">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{guest.name}</td>
                                                    <td className="px-6 py-4 font-mono text-slate-500">{guest.phone || "N/A"}</td>
                                                    <td className="px-6 py-4 text-slate-500">
                                                        {guest.loginAt ? new Date(guest.loginAt.seconds * 1000).toLocaleString() : "N/A"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "users" && (
                        <div className="p-6">
                            <h2 className="text-lg font-serif font-bold text-slate-800 mb-6">Registered Users</h2>
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
                                                <th className="px-6 py-3 font-medium">Joined At</th>
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
                                                    <td className="px-6 py-4 text-slate-500">
                                                        {u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleString() : "N/A"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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
                                                <th className="px-6 py-3 font-medium">Joined At</th>
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
                                                    <td className="px-6 py-4 text-slate-500">
                                                        {u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleString() : "N/A"}
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
            </main>
        </div>
    );
}
