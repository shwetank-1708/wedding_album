"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPendingRequestsAction, approveRequestAction, denyRequestAction } from "@/app/actions/tenant-auth";
import { motion } from "framer-motion";

export default function TenantAdminDashboard() {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string;

    // State
    const [isAdmin, setIsAdmin] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);
    const [loadingReqs, setLoadingReqs] = useState(true);
    const [verifying, setVerifying] = useState(true);

    useEffect(() => {
        // Verify Admin Access via LocalStorage Session
        const sessionKey = `guest_session_${slug}`;
        const stored = localStorage.getItem(sessionKey);

        if (stored) {
            try {
                const session = JSON.parse(stored);
                if (session && session.role === "admin") {
                    setIsAdmin(true);
                    fetchRequests();
                } else {
                    router.push(`/tenant/${slug}`); // Not an admin
                }
            } catch (e) {
                router.push(`/tenant/${slug}`);
            }
        } else {
            router.push(`/tenant/${slug}/login`);
        }
        setVerifying(false);
    }, [slug, router]);

    const fetchRequests = async () => {
        setLoadingReqs(true);
        const result = await getPendingRequestsAction();
        if (result.success) {
            setRequests(result.data);
        } else {
            console.error("Failed to fetch requests:", result.error);
        }
        setLoadingReqs(false);
    };

    const handleApprove = async (req: any) => {
        const result = await approveRequestAction(req.name, req.phone);
        if (result.success) {
            fetchRequests();
        }
    };

    const handleDeny = async (req: any) => {
        const result = await denyRequestAction(req.phone);
        if (result.success) {
            fetchRequests();
        }
    };

    if (verifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-800">
                <div className="text-xl font-serif animate-pulse">Verifying Admin Access...</div>
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <div className="min-h-screen bg-[#FDFBF7] p-8 pt-32">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-serif text-[#800000]">Admin Dashboard</h1>
                    <div className="px-4 py-2 bg-[#800000]/10 text-[#800000] rounded-full text-sm font-medium border border-[#800000]/20">
                        {slug}
                    </div>
                </div>

                <p className="text-stone-600 mb-8 font-light text-lg">Manage access requests for your wedding album.</p>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-stone-100">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h2 className="text-xl font-medium text-stone-800">Pending Requests</h2>
                        <button
                            onClick={fetchRequests}
                            className="text-sm text-[#800000] hover:text-[#D4AF37] transition-colors font-medium flex items-center gap-2"
                        >
                            Refresh List
                        </button>
                    </div>

                    {loadingReqs ? (
                        <div className="p-12 text-center text-stone-400 font-light">Loading requests...</div>
                    ) : requests.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 text-green-600">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </div>
                            <p className="text-stone-600 font-medium">All caught up!</p>
                            <p className="text-stone-400 text-sm mt-1">No pending requests at the moment.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {requests.map((req) => (
                                <motion.li
                                    key={req.phone}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-gray-50 transition-colors"
                                >
                                    <div>
                                        <p className="font-serif text-xl text-[#800000] mb-1">{req.name}</p>
                                        <p className="text-stone-600 font-mono text-sm tracking-wide bg-stone-100 inline-block px-2 py-1 rounded">{req.phone}</p>
                                        <p className="text-xs text-stone-400 mt-2 flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                                            </svg>
                                            {req.requestedAt ? new Date(req.requestedAt).toLocaleString() : 'Just now'}
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleDeny(req)}
                                            className="px-5 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-sm font-medium transition-colors"
                                        >
                                            Deny
                                        </button>
                                        <button
                                            onClick={() => handleApprove(req)}
                                            className="px-5 py-2.5 bg-[#800000] text-white rounded-xl hover:bg-[#600000] text-sm font-medium transition-colors shadow-md shadow-[#800000]/20"
                                        >
                                            Approve Access
                                        </button>
                                    </div>
                                </motion.li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
