# 🚀 Parivar Feud - Comprehensive Deployment & Live Event Guide

This guide provides detailed instructions for deploying **Parivar Feud** (Salt & Satire Edition) for live audience events, stage TV presentations, and remote web hosting.

---

## 🛠️ 1. Project Tech Stack & Architecture

- **Frontend Framework**: React 19 + TypeScript + Vite.
- **Styling**: Tailwind CSS + Custom Web Studio Glassmorphism Design System.
- **Audio Engine**: Zero-dependency Web Audio API Synthesizer (`playDing`, `playBuzzer`, `playDrumroll`, `playVictory`).
- **Live Sync Engine**: Dual-layer synchronization via `BroadcastChannel API` + `LocalStorage` events.
- **Iconography**: Lucide React.
- **Confetti Engine**: `canvas-confetti`.

---

## 🌐 2. One-Click Deployment Options

### Option A: Deploying on Vercel (Recommended)

1. **Install Vercel CLI (optional)** or push to GitHub/GitLab:
   ```bash
   npm i -g vercel
   vercel
   ```
2. **Build Settings**:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Click **Deploy**. Your site will be live instantly with SSL HTTPS enabled.

### Option B: Deploying on Netlify

1. Log in to Netlify and select **Add new site** > **Import an existing project**.
2. Connect your Git repository.
3. Set Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Click **Deploy Site**.

---

## 📡 3. Running Live Events (Network & Multi-Device Setup)

### Scenario 1: Local Wi-Fi LAN Setup (Stage Laptop + Audience Phones on Same Wi-Fi)

For live events in an auditorium, party hall, or classroom without internet dependency:

1. Connect the Host Laptop to the venue Wi-Fi or Mobile Hotspot.
2. Start the Vite dev server with host exposure:
   ```bash
   npx vite --host
   ```
3. Terminal will output a local network URL, e.g.:
   `http://192.168.1.45:5173`
4. Generate a QR code using any free QR generator pointing to `http://192.168.1.45:5173` and display it on the main stage projector screen.
5. **Audience**: Scans QR code on mobile devices to open the **Audience View**.
6. **Stage Projector**: Opens `http://192.168.1.45:5173` on the main screen and switches tab to **Stage TV**.
7. **Host / Admin**: Opens `http://192.168.1.45:5173` on a tablet/laptop and switches tab to **Admin**.

---

## 🔥 4. Scaling Up: Upgrading to Firebase Realtime Database (Optional)

If your event has hundreds of remote players across different 4G/5G mobile networks:

1. Create a free project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Realtime Database**.
3. Replace the `BroadcastChannel` calls in `src/services/liveSync.ts` with Firebase Realtime Database SDK:
   ```typescript
   import { initializeApp } from "firebase/app";
   import { getDatabase, ref, set, onValue } from "firebase/database";

   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     databaseURL: "https://your-project.firebaseio.com",
     projectId: "your-project",
   };

   const app = initializeApp(firebaseConfig);
   const db = getDatabase(app);

   export function pushGameState(state) {
     set(ref(db, 'gameState'), state);
   }
   ```

---

## 🔒 5. Admin Security & Best Practices

1. **God Mode Overrides**: Test percentage sliders in Admin Panel prior to live reveals to ensure smooth storytelling.
2. **Audio Unlocking**: Click anywhere on the Stage TV screen once after loading to allow browser Web Audio autoplay permission.
3. **Timer Control**: Use 60 seconds for audience voting, then switch stage phase to `STAGE_GUESSING` for maximum suspense!
