# 💍 Premium Wedding Gallery & Album

A sophisticated, private wedding gallery management system designed for a premium experience. Capture, manage, and share your most cherished moments with elegance and ease.

## ✨ Features

- **Dynamic Event Management**: Create multiple wedding events (Haldi, Mehendi, Wedding, etc.) with custom titles and dates.
- **Integrated Photo Grid**: A seamless, modern gallery editor with a state-of-the-art "+" upload card and real-time feedback.
- **Smart Event Thumbnails**: Automatic cover image selection from your first upload, with manual "Set as Cover" control.
- **Private & Secure**: Built-in authentication ensures only the owners can manage their galleries.
- **Optimized Viewing**: A beautiful, responsive masonry grid layout with high-performance image delivery.
- **Interactive Lightbox**: Full-screen browsing with intuitive keyboard and touch navigation.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Database & Auth**: [Supabase](https://supabase.com/) (Postgres tables & Supabase Auth)
- **Media Storage**: Secure media upload APIs
- **Icons**: Lucide React

## 🚀 Getting Started

### 1. Prerequisites

You'll need a **Supabase** project and configured media storage.

### 2. Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in your credentials in `.env.local`:
   - **Supabase**: Add your Supabase project URL and anon key.
   - **Media storage**: Add the storage credentials used by your upload APIs.

### 3. Installation

```bash
npm install
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the gallery.

## 📦 Project Structure

- `src/app`: Next.js pages and routing.
- `src/components`: Reusable UI components.
- `src/context`: Auth and State management.
- `src/lib`: Supabase database and storage utilities.
- `src/app/actions`: Secure server-side Cloudinary operations.

## 📚 Architecture & Documentation

- [Video Upload & Transcoding Pipeline](file:///Users/sarthak/EveBash/VIDEO_UPLOAD_PIPELINE.md) — Comprehensive specification of the direct-to-storage chunked upload, QStash routing, Modal GPU/CPU HLS transcoding, and self-healing watchdog.
- [Architecture Migration Plan](file:///Users/sarthak/EveBash/ARCHITECTURE_MIGRATION.md) — Railway backend API migration status and route topologies.
- [Cost Analysis & Financial Model](file:///Users/sarthak/EveBash/COST_ANALYSIS.md) — Unit economics for Backblaze B2, Modal.com, Supabase, and Cloudflare.

---
Created with ❤️ by Lens & Frame.
