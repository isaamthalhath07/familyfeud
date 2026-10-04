# 🦚 Parivar Feud (Salt & Satire Edition)

An interactive, real-time Indian game show web application designed for live events. Built with React, TypeScript, Tailwind CSS, and MQTT WebSockets for instant cross-device synchronization.

Audience members join on their phones to rank options by popularity, while a stage contestant guesses the crowd consensus live on a big screen screen. The host controls the entire event via a password-protected admin dashboard with real-time percentage override ("God Mode").

---

## ✨ Features

- **📱 Mobile Audience View (`/`)**: Touch-friendly interface allowing audience members to re-order options from #1 to #5 using tap and drag controls. Automatically computes scores and assigns satirical rank badges.
- **📺 Stage TV Display (`/stage`)**: Broadcast-ready TV studio interface with animated flip cards, Web Audio API sound effects (dings, buzzers, suspense drumrolls), live crowd consensus progress bars, and victory confetti.
- **🛠️ Admin Control Panel (`/admin`)**: Protected by secret PIN (`isaam`). Allows host to start/pause voting timers, change phases (`VOTING`, `LOCKED`, `STAGE_GUESSING`, `REVEALED`), broadcast questions, and adjust answer option percentages live in real-time.
- **⚡ Instant Cross-Device Sync**: Multi-broker MQTT over WebSockets connection ensuring instant state synchronization across different devices and mobile networks (Wi-Fi, 4G, 5G).

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/isaamthalhath07/familyfeud.git

# Navigate to project directory
cd familyfeud

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open `http://localhost:5173` in your browser to view the app.

---

## 🛠️ Built With

- **React 19** & **TypeScript**
- **Vite**
- **Tailwind CSS**
- **MQTT.js** (WebSockets real-time transport)
- **Web Audio API** (Zero-dependency game show sound effects)
- **Lucide React** (Icons)
- **Canvas Confetti**

---

## 📄 License

MIT License. Designed and built by Isaam Thalhath.
