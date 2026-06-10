<div align="center">
  <!-- Замініть посилання нижче на реальний скріншот вашого плеєра -->
  <img src="https://via.placeholder.com/800x350/111827/ffffff?text=Rpet+Music+Player+(Add+Screenshot+Here)" alt="Rpet Music Player Banner" width="100%" style="border-radius: 12px;"/>

  <h1>Rpet Music Player</h1>
  
  <p>
    <strong>A sleek, web-based music player seamlessly blending local audio playback with external API integration.</strong>
  </p>

  [![Live Demo](https://img.shields.io/badge/Live_Demo-Deploy_Here-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://rpet-music-player.vercel.app/)
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)]()
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)]()
  [![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)]()
  [![Zustand](https://img.shields.io/badge/Zustand-443E38?style=for-the-badge&logo=react&logoColor=white)]()
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

* **Local Library Management**
  Drag and drop support for MP3 files with robust, automatic ID3 tag extraction for metadata and album artwork.
* **Apple Music Integration**
  Instant track discovery and streaming via the iTunes Search API, allowing global hits to be added directly to your library.
* **Synchronized Lyrics**
  Real-time, smooth lyrics tracking synchronized with precise audio timestamps via LRCLIB integration.
* **Dynamic Color Theming**
  Intelligent, automated color scheme generation that extracts dominant colors from album art to tint the entire application interface.
* **Audio Visualization & Equalizer**
  Real-time frequency visualization powered by the Web Audio API, complete with a 3-band equalizer (Bass, Mid, Treble) for custom acoustic shaping.
* **Offline Storage**
  IndexedDB integration ensures your custom library, playlists, and favorites securely persist across browser sessions without requiring a backend.

---

## Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18, Vite |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4, Lucide React |
| **State Management** | Zustand |
| **Data Storage** | IndexedDB (`idb-keyval`) |
| **Audio Processing** | Web Audio API |
| **Metadata Parsing** | `jsmediatags` |
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
│   │   ├── Player/       # Audio engine, visualizer, equalizer, and controls
│   │   ├── Sidebar/      # Navigation and playlist management
│   │   └── TrackList/    # Library view and MP3 uploaders
│   ├── stores/           # Zustand state management (playerStore)
│   ├── utils/            # API clients, IDB wrappers, and Web Audio context
│   └── types/            # TypeScript interfaces
└── public/               # Static assets
```

---

## Contact & Support

For issues, feature requests, or contributions, please open an issue on the [GitHub repository](https://github.com/nickson4k-svg/rpet-music-player/issues).
