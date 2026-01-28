"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getPendingRequests, addAllowedUser, denyRequest } from "@/lib/firestore";
import { motion } from "framer-motion";

export default function AdminDashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [requests, setRequests] = useState<any[]>([]);
    const [loadingReqs, setLoadingReqs] = useState(true);

    useEffect(() => {
        if (!loading) {
            if (!user || user.role !== "admin") {
                router.push("/");
            } else {
                fetchRequests();
            }
        }
    }, [user, loading, router]);

    const fetchRequests = async () => {
        setLoadingReqs(true);
        const data = await getPendingRequests();
        setRequests(data);
        setLoadingReqs(false);
    };

    const handleApprove = async (req: any) => {
        const success = await addAllowedUser(req.name, req.phone, "guest");
        if (success) {
            await denyRequest(req.phone); // Remove from pending
            fetchRequests(); // Refresh
        }
    };

    const handleDeny = async (req: any) => {
        const success = await denyRequest(req.phone);
        if (success) {
            fetchRequests();
        }
    };

    if (loading || !user || user.role !== "admin") {
        return <div className="p-8 text-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-royal-cream p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-serif text-royal-maroon mb-2">Admin Dashboard</h1>
                <p className="text-gray-600 mb-8">Manage access requests</p>

                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-royal-gold/20">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-xl font-medium text-gray-800">Pending Requests</h2>
                        <button
                            onClick={fetchRequests}
                            className="text-sm text-royal-maroon hover:underline"
                        >
                            Refresh
                        </button>
                    </div>

                    {loadingReqs ? (
                        <div className="p-8 text-center text-gray-500">Loading requests...</div>
                    ) : requests.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No pending requests.</div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {requests.map((req) => (
                                <motion.li
                                    key={req.phone}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                                >
                                    <div>
                                        <p className="font-medium text-lg text-gray-900">{req.name}</p>
                                        <p className="text-gray-600 font-mono">{req.phone}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Requested: {new Date(req.requestedAt.seconds * 1000).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleDeny(req)}
                                            className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors"
                                        >
                                            Deny
                                        </button>
                                        <button
                                            onClick={() => handleApprove(req)}
                                            className="px-4 py-2 bg-royal-maroon text-white rounded-lg hover:bg-royal-maroon/90 text-sm font-medium transition-colors shadow-sm"
                                        >
                                            Approve
                                        </button>
                                    </div>
                                </motion.li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="mt-8 text-center">
                    <a href="/" className="text-royal-maroon hover:underline">← Back to Album</a>
                </div>
            </div>
        </div>
    );
}
