# Quiz Game Application Documentation

## 1. Project Overview

This is a real-time multiplayer Quiz Game application built with **Nuxt 3**. It features a WebSocket-based architecture using **Socket.IO** to enable instant communication between the Host and multiple Players.

### Tech Stack
- **Framework**: [Nuxt 3](https://nuxt.com) (Vue 3 + Nitro)
- **Real-time Engine**: [Socket.IO](https://socket.io) (`socket.io` server + `socket.io-client`)
- **Language**: TypeScript
- **Styling**: Inline CSS (Minimalist design)
- **Utilities**: `uuid` (Player IDs), `qrcode` (Host joining QR code)

## 2. Architecture

The application is a monolith containing both the frontend client and the backend server.

### Server-Side
- **Entry Point**: `server/plugins/socket.io.ts`. Handles Socket.IO connections, manages rooms (`game-{id}`), and routes events to the appropriate game instance.
- **State Management**: `server/utils/gameState.ts`.
  - **`GameManager`**: Singleton that creates and manages multiple active `GameState` instances.
  - **`GameState`**: Class representing a single game session (players, scores, game status).
- **Session Isolation**: Each game has a unique 4-character ID (uppercase alphanumeric). Messages are broadcast only to the specific room for that game ID.

### Client-Side
- **Pages**:
  - `pages/index.vue`: **Player Interface**.
    - **Join Flow**: User enters the 4-char code or uses a direct link (`?gameId=...`).
    - **Gameplay**: Connects to the specific game room.
  - `pages/host.vue`: **Host Dashboard**.
    - **Create Flow**: Host clicks "Create Game", receives a unique Game ID.
    - **Lobby**: Displays the QR code and Game ID for players to join.
- **Communication**: The client connects to the server via Socket.IO. Most logic is event-driven (listening for `game-state` updates).

## 3. Game Mechanics

### Roles
1. **Host**: Controls the flow of the game. Can kick players, start the game, and trigger the next question/round.
2. **Player**: Joins via a persistent ID (stored in cookies), answers questions, and votes on categories.

### Game Loop Flow
1. **Waiting (Lobby)**: Players join, Host waits until at least 2 players are present to start.
2. **Voting**: Players vote for the next category from available options.
3. **Round Intro**: Selected category is displayed.
4. **Question Phase**:
   - Question is displayed on Host and Player screens.
   - **Timer**: 10 seconds to answer.
   - **Scoring**: Points are awarded based on speed.
     - Formula: `Max(0, 15 - timeTakenInSeconds)`
     - Maximum points: 15 per question.
5. **Reveal**: Correct answer is shown.
6. **Ranking (End of Round/Game)**: Leaderboard is updated.
   - Cycle repeats for a defined number of rounds (Default: 3).

### Configuration (`server/utils/gameState.ts`)
- **Rounds**: 3
- **Questions per Round**: 5
- **Max Players**: 10

## 4. Setup & Running

### Prerequisites
- Node.js (Latest LTS recommended)
- npm, pnpm, or yarn

### Installation
```bash
npm install
```

### Development
Start the development server with local network access enabled (required for mobile testing):
```bash
npm run dev
# Nuxt runs on http://localhost:3000 by default
```

### Production Build
```bash
npm run build
node .output/server/index.mjs
```

## 5. API / Event Reference

### Important Socket Events

| Event Name | Direction | Description |
|DIR|DIR|DIR|
| `join-game` | Client -> Server | Player requests to join/reconnect. Payload: `{ playerId }`. |
| `game-state` | Server -> Client | Broadcasts the full public game state to all clients. |
| `submit-vote` | Client -> Server | Player votes for a category. |
| `submit-answer` | Client -> Server | Player submits an answer index. |
| `question-timeout` | Server -> Client | Triggers the reveal phase when time is up or all answered. |
| `host-join` | Client -> Server | Registers the socket as a host (logging purposes). |

## 6. Project Structure

- `pages/` - Vue frontend views (Host & Player).
- `server/plugins/` - Server-side plugins (Socket.IO initialization).
- `server/utils/` - Shared server logic (`GameState` class).
- `questions.json` - Database of questions categories and answers.
