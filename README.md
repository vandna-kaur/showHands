# Showhands – real-time polls (MERN + Socket.io)

Create a poll, share the 5-letter code, and watch votes arrive live on every connected screen.

## Run locally
```bash
cd server && cp .env.example .env && npm install && npm run dev
cd client && npm install && npm run dev     # http://localhost:5173
```
Open the poll in two browser windows (one normal, one private) to see live updates.

## Engineering highlights
- Socket.io rooms per poll code; server broadcasts the sanitised poll after every vote/close
- Atomic one-vote-per-person enforced inside a single MongoDB `findOneAndUpdate` (no race conditions)
- Host-only "close voting" via a secret host key; voter lists and keys never sent to clients
- Results hidden until you vote, to avoid bias

## Resume bullet
Built a real-time polling platform with React, Express, MongoDB and Socket.io; enforced race-free single voting with atomic updates and live-broadcast results to all connected clients.

## Next upgrades
Deploy (Render + Vercel + Atlas) · QR code invite · poll expiry (TTL index) · Jest/Supertest tests
