<div align="center">

  <h1>🎵 50 Faces Music Player</h1>
  
  <p>
    <strong>A sleek, modern, web-based music player blending local audio playback, multi-provider API streaming, and P2P social listening.</strong>
  </p>

  [![Live Demo](https://img.shields.io/badge/Live_Demo-Deploy_Here-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://rpet-music-player.vercel.app/)
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)]()
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)]()
  [![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)]()
  [![Zustand](https://img.shields.io/badge/Zustand-443E38?style=for-the-badge&logo=react&logoColor=white)]()
  [![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)]()
</div>

<br />

## Table of Contents
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Contact & Support](#contact--support)

---

## Core Features

* **Multi-Provider Music Discovery**
  Search and stream tracks from a variety of sources including **SoundCloud** and **JioSaavn**. Automatically retrieves high-quality streaming links and metadata.
* **Progressive Web App (PWA) & Offline Mode**
  Install the app directly to your desktop or home screen. Uses **Workbox** Service Workers for caching, allowing the app to load and play downloaded tracks even without an internet connection.
* **Listen Together (P2P Sync)**
  Create a room and share the link with friends to listen to music completely synchronized. Powered by **PeerJS (WebRTC)** for low-latency peer-to-peer playback control and chat.
* **YouTube Music-Style Full-Screen Player**
  Immersive full-screen playback mode featuring a large responsive cover art, track queue ("Up Next"), and synchronized lyrics.
* **Smart Recommendations & Moods**
  Dynamic recommendation engine that analyzes your listening habits to suggest similar tracks. Includes categorized "Mood" playlists (Sleep, Workout, Relax, etc.).
* **Synchronized Lyrics**
  Real-time, smooth lyrics tracking synchronized with precise audio timestamps via LRCLIB integration.
* **Audio Visualization & Equalizer**
  Real-time frequency visualization powered by the Web Audio API, complete with a 3-band equalizer (Bass, Mid, Treble) for custom acoustic shaping.
* **Local Library Management**
  Drag and drop support for MP3 files with robust, automatic ID3 tag extraction. IndexedDB securely persists your library, playlists, and favorites across sessions.
* **Dynamic Color Theming**
  Intelligent, automated color scheme generation that extracts dominant colors from album art to tint the entire application interface.

---

## Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18, Vite |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4, Lucide React |
| **State Management** | Zustand |
| **Data Storage** | IndexedDB (`idb-keyval`) |
| **PWA & Caching** | Vite PWA Plugin, Workbox |
| **P2P Networking** | PeerJS (WebRTC) |
| **Audio Processing** | Web Audio API |
| **Color Extraction** | `fast-average-color` |

---

## Getting Started

This project is bootstrapped with **Vite**. Follow these instructions to set up the project locally.

### Prerequisites

* **Node.js**: v18.0.0 or higher
* **Package Manager**: npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nickson4k-svg/rpet-music-player.git
   cd rpet-music-player
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## Project Structure

```text
rpet-music-player/
├── src/
│   ├── components/
│   │   ├── Layout/       # Main application layout wrappers
│   │   ├── Player/       # Audio engine, full-screen UI, visualizer, equalizer
│   │   ├── Sidebar/      # Navigation and playlist management
│   │   ├── TrackList/    # Search results, recommendations, track lists
│   │   └── P2P/          # "Listen Together" room UI and connection handling
│   ├── stores/           # Zustand state management (playerStore, p2pStore)
│   ├── utils/            # API clients, IDB wrappers, Recommendation engine
│   ├── hooks/            # Custom React hooks (useMediaSession, usePWA, etc.)
│   └── types/            # TypeScript interfaces
├── api/                  # Vercel Serverless Functions for API proxies
└── public/               # Static assets, manifest.json, sw.js
```

---
