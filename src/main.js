// ============================================================
// main.js — Game setup, timer, and voice command wiring
// ============================================================

import { onVoiceCommand } from "./speech.js";

// --- Chessboard setup ---
var board = Chessboard("board", {
  draggable: true,
  dropOffBoard: "trash",
  sparePieces: true,
  pieceTheme: "./src/chessboardjs-1.0.0/img/chesspieces/wikipedia/{piece}.png",
});

// --- Timer state ---
let whiteSeconds = 0;
let blackSeconds = 0;
let activeColor = "white"; // whose clock is ticking
let timerInterval = null;
let isPaused = false;

// DOM references
const timerContainer = document.getElementById("timerContainer");
const whiteTimerEl = document.getElementById("whiteTimer");
const blackTimerEl = document.getElementById("blackTimer");
const timerStatus = document.getElementById("timerStatus");

// --- Timer helpers ---
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  whiteTimerEl.textContent = formatTime(whiteSeconds);
  blackTimerEl.textContent = formatTime(blackSeconds);

  // Highlight the active player's clock
  whiteTimerEl.classList.toggle("active-timer", activeColor === "white" && !isPaused);
  blackTimerEl.classList.toggle("active-timer", activeColor === "black" && !isPaused);
}

function tickTimer() {
  if (activeColor === "white") {
    whiteSeconds++;
  } else {
    blackSeconds++;
  }
  updateTimerDisplay();
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  isPaused = false;
  timerInterval = setInterval(tickTimer, 1000);
  timerStatus.textContent = "Game in progress";
  timerStatus.classList.remove("paused");
  updateTimerDisplay();
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isPaused = true;
  timerStatus.textContent = "⏸ Paused";
  timerStatus.classList.add("paused");
  updateTimerDisplay();
}

function resumeTimer() {
  if (!timerInterval && !isPaused) return; // nothing to resume
  isPaused = false;
  timerInterval = setInterval(tickTimer, 1000);
  timerStatus.textContent = "Game in progress";
  timerStatus.classList.remove("paused");
  updateTimerDisplay();
}

function resetTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  isPaused = false;
  whiteSeconds = 0;
  blackSeconds = 0;
  activeColor = "white";
  timerStatus.textContent = "Game in progress";
  timerStatus.classList.remove("paused");
  updateTimerDisplay();
}

/** Switch the active clock (call after each move) */
export function switchClock() {
  activeColor = activeColor === "white" ? "black" : "white";
  updateTimerDisplay();
}

// --- Game actions ---
function startGame() {
  board.start();
  resetTimer();
  timerContainer.classList.remove("hidden");
  startTimer();
}

function clearBoard() {
  board.clear();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerContainer.classList.add("hidden");
}

function resetGame() {
  board.start();
  resetTimer();
  timerContainer.classList.remove("hidden");
  startTimer();
}

// --- Button click handlers ---
$(".start-btn").on("click", startGame);
$(".clear-btn").on("click", clearBoard);

// --- Register voice commands ---
onVoiceCommand("start", startGame);
onVoiceCommand("clear", clearBoard);
onVoiceCommand("pause", pauseTimer);
onVoiceCommand("resume", resumeTimer);
onVoiceCommand("reset", resetGame);