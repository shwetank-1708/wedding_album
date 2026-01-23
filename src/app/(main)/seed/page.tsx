"use client";

import React, { useState } from "react";
import { addAllowedUser } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";

export default function SeedPage() {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("guest");
    const [message, setMessage] = useState("");
    const { user } = useAuth();

    // Optional: Protect this page too, or leave open for initial setup then delete/protect?
    // User asked "approval will be given by phone number with specail privilidge which we will add at start only"
    // So for now, let's just make it open but obscure, or maybe check a hardcoded secret?
    // For simplicity of use right now, I'll leave it open but maybe warn.

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone) return;

        const success = await addAllowedUser(name, phone, role);
        if (success) {
            setMessage(`Successfully added ${name} (${phone}) as ${role}`);
            setName("");
            setPhone("");
            setRole("guest");
        } else {
            setMessage("Failed to add user.");
        }
    };

    return (
        <div className="min-h-screen bg-royal-cream p-8 flex flex-col items-center">
            <h1 className="text-3xl font-serif text-royal-maroon mb-6">Seed Guest List</h1>
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
                <form onSubmit={handleAdd} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Guest Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border p-2 rounded"
                            placeholder="Guest Name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Phone Number</label>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full border p-2 rounded"
                            placeholder="Phone (exact match)"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full border p-2 rounded"
                        >
                            <option value="guest">Guest</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit" className="w-full bg-royal-maroon text-white py-2 rounded">
                        Add to Whitelist
                    </button>
                </form>
                {message && <div className="mt-4 text-center font-medium">{message}</div>}
            </div>

            <div className="mt-8 text-sm text-gray-500">
                <p>Use this page to add the initial admins/guests.</p>
                <p>After setup, you might want to delete or protect this route.</p>
            </div>
        </div>
    );
}
