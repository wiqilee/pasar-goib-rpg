# Pasar Goib Night Market RPG

A text‑based, atmospheric horror RPG built with **React**, **TailwindCSS**, and **Node.js**.  
Explore a mysterious night market, gather Moon Essence, parley with strange NPCs, and survive encounters through **d20‑based combat**. Every choice shapes your reputation—**the market keeps a ledger of your debts**.

## 🔗 Live Demo
**Play on GitHub Pages:** https://wiqilee.github.io/pasar-goib-rpg/

> The demo runs as a client‑only build. Server features (socket rooms, server saves) are disabled on Pages, but you can play the full single‑player loop with quests, combat, and dialog.

---

## ✨ Features
- **Quest‑aware suggestions** and dynamic guidance that react to quests, location, and NPCs.
- **Branching dialog trees** that unlock quests, items, perks, and reputation changes.
- **Turn‑based combat** with d20 rolls, STR/DEX/INT scaling, crits, DOTs (poison/bleed/burn), and status cures.
- **NPC reputation system** that influences outcomes and flavor.
- **Saving**: localStorage (client) with optional server save/load.
- **Finish banner**: shows a “Run Complete” message when all quests are cleared, with a **Start New Run** button.

---

## 📦 Tech Stack
- **Client:** React 18, React Router, TailwindCSS, Vite
- **Server:** Node.js + Express + Socket.IO (optional for local play)
- **Deploy:** GitHub Pages (static client demo)

---

## 🚀 Quick Start (Local Full Game)
```bash
# 1) Install all deps
npm install

# 2) Run the server (Express + Socket.IO)
cd server && npm run dev

# 3) Run the client (Vite dev server)
cd client && npm run dev

# App opens at http://localhost:5173 (proxies API to http://localhost:1573 by default)
```
> Local mode enables the full experience: sockets, server save/load, and all API routes.

---

## 🌐 Deploying the Client to GitHub Pages
This repo is configured to publish the **client** to GitHub Pages at  
`https://wiqilee.github.io/pasar-goib-rpg/`.

**One‑time setup**
```bash
cd client
npm i -D gh-pages
```

**Build & deploy**
```bash
# package.json includes these scripts:
# "build:gh": "vite build --base=/pasar-goib-rpg/",
# "predeploy": "npm run build:gh && cp dist/index.html dist/404.html",
# "deploy": "gh-pages -d dist"

npm run deploy
```

**Why copy `index.html` to `404.html`?**  
GitHub Pages is static and does not understand client routes such as `/play` or `/lore`.  
Creating a `404.html` fallback makes Pages serve your SPA for any route.

---

## ⚙️ Configuration
- **Client base URL:** set in `client/vite.config.js` during GH Pages builds via `--base=/pasar-goib-rpg/`.
- **API base (local dev):** `client/src/lib/api.js` reads `VITE_API_URL` (default `http://127.0.0.1:1573`).  
  For Pages demo, the app uses the client‑only loop and ignores server‑only features.

Environment examples:
```
client/.env.development
VITE_API_URL=http://127.0.0.1:1573

client/.env.production
# Leave unset for GH Pages client‑only demo
```

---

## 🧭 Project Structure
```
client/            # React + Tailwind front‑end
  src/
    pages/         # Home, Play, Lore, Credits
    components/    # Panel, DialogPanel, etc.
    lib/api.js     # API helper (uses VITE_API_URL if present)
server/            # Express + Socket.IO (optional for local/full play)
  src/
    game/          # engine.js, world.js, quests.json, npcs.json, etc.
```

---

## 📝 License
MIT © Wiqi Lee ([@wiqi_lee](https://twitter.com/wiqi_lee))

```text
This game is a work of fiction. Any resemblance to real people or events is coincidental.
Play responsibly and beware: the market remembers what you owe.
```
