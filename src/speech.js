// ============================================================
// speech.js — Voice command engine for the chess game
// ============================================================
// Supported commands:
//   "start game" / "start"   → starts the game & timer
//   "clear board" / "clear"  → clears the board
//   "pause"                  → pauses the timer
//   "resume" / "continue"    → resumes the timer
//   "reset"                  → resets the game & timer
// ============================================================

const recordBtn = document.getElementById("recordBtn");
const speechOutput = document.getElementById("speechOutput");

// --- Command callback registry (main.js will register handlers) ---
const commandHandlers = {};

/**
 * Register a callback for a voice command.
 * @param {string} command  - one of: "start", "clear", "pause", "resume", "reset"
 * @param {Function} handler - function to call when the command is spoken
 */
export function onVoiceCommand(command, handler) {
  commandHandlers[command] = handler;
}

// --- Web Speech API setup ---
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  speechOutput.textContent =
    "Speech recognition not supported in this browser.";
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  // --- Start listening on button click ---
  recordBtn.onclick = () => {
    speechOutput.textContent = "🎤 Listening...";
    speechOutput.style.color = "#667eea";
    try {
      recognition.start();
    } catch (error) {
      speechOutput.textContent = "Click again to start listening.";
    }
  };

  // --- Parse and dispatch voice commands ---
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    speechOutput.textContent = `You said: "${transcript}"`;
    speechOutput.style.color = "#333";

    let matched = false;

    if (transcript.includes("start")) {
      fireCommand("start", "▶️ Starting game...");
      matched = true;
    } else if (transcript.includes("clear")) {
      fireCommand("clear", "🗑️ Clearing board...");
      matched = true;
    } else if (transcript.includes("pause") || transcript.includes("stop")) {
      fireCommand("pause", "⏸️ Timer paused");
      matched = true;
    } else if (
      transcript.includes("resume") ||
      transcript.includes("continue")
    ) {
      fireCommand("resume", "▶️ Timer resumed");
      matched = true;
    } else if (transcript.includes("reset")) {
      fireCommand("reset", "🔄 Resetting game...");
      matched = true;
    }

    if (!matched) {
      speechOutput.textContent = `"${transcript}" — command not recognized`;
      speechOutput.style.color = "#dc3545";
    }

    // Reset display after a short delay
    setTimeout(() => {
      speechOutput.style.color = "#333";
    }, 3000);
  };

  function fireCommand(command, feedbackText) {
    speechOutput.textContent = feedbackText;
    speechOutput.style.color = "#28a745";
    if (commandHandlers[command]) {
      commandHandlers[command]();
    }
  }

  // --- Error handling ---
  recognition.onerror = (event) => {
    speechOutput.textContent = "Sorry, I couldn't hear you. Try again!";
    speechOutput.style.color = "#dc3545";
  };

  recognition.onend = () => {
    console.log("Speech recognition ended");
  };
}

// FLOW: User speaks → Mic → Web Speech API → Text → Command parser → Callback → Game action