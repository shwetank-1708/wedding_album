"use client";

import React, { useState, useCallback } from "react";
import { Upload, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function UploadCard() {
    const [dragActive, setDragActive] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            // Mock preview
            const file = e.dataTransfer.files[0];
            setPreview(URL.createObjectURL(file));
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPreview(URL.createObjectURL(e.target.files[0]));
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            {!preview ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                        "relative border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer",
                        dragActive ? "border-gold-500 bg-gold-50" : "border-stone-300 hover:border-gold-400 hover:bg-stone-50"
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleChange}
                        accept="image/*"
                    />
                    <div className="flex flex-col items-center gap-4 text-stone-500">
                        <div className="bg-stone-100 p-4 rounded-full">
                            <Upload className="w-8 h-8 text-gold-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-stone-900">Upload a Selfie</p>
                            <p className="text-sm mt-1">or drag and drop here</p>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-6 rounded-2xl shadow-xl space-y-6"
                >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-stone-100">
                        <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                            onClick={() => setPreview(null)}
                            className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <button className="w-full py-3 bg-gold-500 hover:bg-gold-600 text-stone-900 font-bold tracking-widest uppercase rounded-lg transition-colors flex items-center justify-center gap-2">
                        <Search className="w-5 h-5" /> Search Photos
                    </button>
                </motion.div>
            )}
        </div>
    );
}
