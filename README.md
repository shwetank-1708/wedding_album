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
- **Database & Auth**: [Firebase](https://firebase.google.com/) (Firestore & Authentication)
- **Media Storage**: [Cloudinary](https://cloudinary.com/) (Server-side secure uploads)
- **Icons**: Lucide React

## 🚀 Getting Started

### 1. Prerequisites

You'll need a **Firebase** project and a **Cloudinary** account.

### 2. Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in your credentials in `.env.local`:
   - **Firebase**: Go to Project Settings > General > Your apps (SDK Setup) for the keys.
   - **Cloudinary**: Get your Cloud Name, API Key, and Secret from the Cloudinary Dashboard.

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
- `src/lib`: Firestore and storage utilities.
- `src/app/actions`: Secure server-side Cloudinary operations.

---
Created with ❤️ by Lens & Frame.
