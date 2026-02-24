// speech.js - handles voice commands

const recordBtn = document.getElementById("recordBtn");
const speechOutput = document.getElementById("speechOutput");

// stores command callbacks that main.js registers
const commandHandlers = {};

// lets other files register what happens when a command is spoken
export function onVoiceCommand(command, handler) {
  commandHandlers[command] = handler;
}

// set up speech recognition
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

  // mic button click
  recordBtn.onclick = () => {
    speechOutput.textContent = "🎤 Listening...";
    speechOutput.style.color = "#667eea";
    try {
      recognition.start();
    } catch (error) {
      speechOutput.textContent = "Click again to start listening.";
    }
  };

  // figure out what the user said and run the matching command
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

    // reset text color after a bit
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

  // something went wrong with the mic
  recognition.onerror = (event) => {
    speechOutput.textContent = "Sorry, I couldn't hear you. Try again!";
    speechOutput.style.color = "#dc3545";
  };

  recognition.onend = () => {
    console.log("Speech recognition ended");
  };
}