CS 423 Group 4 Project
NUI Voice Controlled Chess Game
Abrar Makki, Brian Daza, Hau Tran, Shimra Hazmi

imports and documentation:
- frontend chessboard and pieces found here:
https://chessboardjs.com/#start

AI was utilized to help set up Whisper API in this project.

---

## Setup & Running

### Prerequisites
- Python 3.x
- Node.js
- ffmpeg — install with `winget install ffmpeg`, then add it to your PATH:
  `C:\Users\<you>\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin`

### 1. Clone the repo
```bash
git clone https://github.com/ShimraHazmi/423ChessNUIGame.git
cd 423ChessNUIGame
```

### 2. Create config.js (required, not in repo)
Create `src/config.js` with:
```js
export const OPENAI_API_KEY = "";
```
(Leave the key empty. It's no longer used. The file just needs to exist.)

### 3. Set up Python environment
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Start the Whisper server (Terminal 1)
```bash
.venv\Scripts\activate
python whisper_server.py
```
First run will download the Whisper `base` model (~145 MB). Wait for:
`Whisper model ready.`

### 5. Start the frontend (Terminal 2)
```bash
npx serve .
```

### 6. Open the app
Go to `http://localhost:3000` in Chrome or Edge.

### Voice Commands
- "Start game" — start the game & timer
- "Clear board" — clear all pieces
- "Pause" — pause the timer
- "Resume" — resume the timer
- "Reset" — reset the game & timer
