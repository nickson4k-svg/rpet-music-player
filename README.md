# Rpet Music Player

[Live Demo](https://rpet-music-player.vercel.app/)

A web-based music player supporting local audio files and external API integration. The project implements global state management, browser API utilization, and offline data storage.

## Core Features
* **Local Library:** Drag and drop support for MP3 files with automatic ID3 tag extraction.
* **Music Search:** Apple Music/iTunes API integration for track search and streaming.
* **Offline Storage:** IndexedDB integration for persistent user library storage across sessions.
* **Audio Visualization:** Real-time frequency visualization using Web Audio API and Canvas.
* **Dynamic UI:** Automated color scheme generation based on the current track's album art.
* **Lyrics Synchronization:** Real-time lyrics tracking synchronized with audio timestamps.

## Tech Stack
* **Frontend:** React, TypeScript, Vite
* **Styling:** Tailwind CSS
* **State Management:** Zustand
* **Storage:** IndexedDB
* **Audio Processing:** Web Audio API

---

## Development Setup

This project is bootstrapped with Vite and React. 

### Prerequisites
* Node.js (v18 or higher recommended)
* npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/nickson4k-svg/rpet-music-player.git](https://github.com/nickson4k-svg/rpet-music-player.git)
