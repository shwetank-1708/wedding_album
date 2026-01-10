"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getGuestLogs, getEvents, savePhoto, Photo, getUsers } from "@/lib/firestore";
import { uploadEventImage } from "@/lib/storage";
import { Timestamp } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { LogOut, Upload, Users, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"guests" | "upload" | "users">("guests");

    // Data State
    const [guests, setGuests] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Upload State
    const [selectedEvent, setSelectedEvent] = useState("");
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState<FileList | null>(null);
    const [uploadStatus, setUploadStatus] = useState("");

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

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!files || files.length === 0 || !selectedEvent) {
            setUploadStatus("Please select an event and files.");
            return;
        }

        setUploading(true);
        setUploadStatus("Uploading...");

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                // 1. Upload to Cloudinary
                const uploadResult = await uploadEventImage(file, selectedEvent);

                // 2. Save Metadata to Firestore
                const photoId = uuidv4();
                const newPhoto: Photo = {
                    id: photoId,
                    eventId: selectedEvent,
                    cloudinaryPublicId: uploadResult.publicId,
                    url: uploadResult.url,
                    uploadedAt: Timestamp.now(),
                    width: uploadResult.width,
                    height: uploadResult.height
                };

                await savePhoto(newPhoto);
                successCount++;
            } catch (err) {
                console.error(err);
                failCount++;
            }
        }

        setUploading(false);
        setUploadStatus(`Upload completed. Success: ${successCount}, Failed: ${failCount}`);
        setFiles(null);
        // Reset file input manually if needed
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
                        Users
                    </button>
                    <button
                        onClick={() => setActiveTab("upload")}
                        className={cn(
                            "flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all",
                            activeTab === "upload"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Photos
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
                                                <th className="px-6 py-3 font-medium">Joined At</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {users.map((u) => (
                                                <tr key={u.id} className="hover:bg-slate-50/50">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                                                    <td className="px-6 py-4 text-slate-500">{u.email}</td>
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

                    {activeTab === "upload" && (
                        <div className="p-6 max-w-2xl mx-auto">
                            <div className="text-center mb-8">
                                <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ImageIcon className="w-6 h-6" />
                                </div>
                                <h2 className="text-lg font-serif font-bold text-slate-800">Upload to Gallery</h2>
                                <p className="text-slate-500 mt-1">Add new photos to an event album</p>
                            </div>

                            <form onSubmit={handleUpload} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Select Event</label>
                                    <select
                                        value={selectedEvent}
                                        onChange={(e) => setSelectedEvent(e.target.value)}
                                        className="w-full border-slate-200 rounded-lg focus:ring-sky-500 focus:border-sky-500"
                                        required
                                    >
                                        <option value="">-- Choose an Event --</option>
                                        {events.map(evt => (
                                            <option key={evt.id} value={evt.id}>{evt.title}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Photos</label>
                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={(e) => setFiles(e.target.files)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                        <p className="text-sm text-slate-600">
                                            {files && files.length > 0
                                                ? `${files.length} files selected`
                                                : "Drag & drop or click to select"}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className={cn(
                                        "w-full py-2.5 px-4 text-white font-medium rounded-lg shadow-sm transition-all flex items-center justify-center",
                                        uploading ? "bg-slate-400 cursor-not-allowed" : "bg-sky-600 hover:bg-sky-500"
                                    )}
                                >
                                    {uploading ? "Uploading..." : "Start Upload"}
                                </button>

                                {uploadStatus && (
                                    <div className={cn(
                                        "p-4 rounded-lg text-sm text-center",
                                        uploadStatus.includes("Success") ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"
                                    )}>
                                        {uploadStatus}
                                    </div>
                                )}
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
