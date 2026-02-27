// speech.js - handles voice commands via local Whisper server

// DOM elements
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const speechOutput = document.getElementById("speechOutput");

// stores command callbacks that main.js registers
const commandHandlers = {};

// lets other files register what happens when a command is spoken
export function onVoiceCommand(command, handler) {
  commandHandlers[command.toLowerCase()] = handler;
}

function normalizeTranscript(text) {
  if (!text) return "";
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[^a-z0-9\s]/g, " ");
  normalized = normalized.replace(/\b(one)\b/g, "1");
  normalized = normalized.replace(/\b(two)\b/g, "2");
  normalized = normalized.replace(/\b(three)\b/g, "3");
  normalized = normalized.replace(/\b(four|for)\b/g, "4");
  normalized = normalized.replace(/\b(five)\b/g, "5");
  normalized = normalized.replace(/\b(six)\b/g, "6");
  normalized = normalized.replace(/\b(seven)\b/g, "7");
  normalized = normalized.replace(/\b(eight|ate)\b/g, "8");
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

function extractMove(normalizedText) {
  if (!normalizedText) return null;
  const compact = normalizedText.replace(/\b([a-h])\s*([1-8])\b/g, "$1$2");
  const moveMatch = compact.match(/\b([a-h][1-8])\s*(?:to|-)?\s*([a-h][1-8])\b/);
  if (!moveMatch) return null;
  return { from: moveMatch[1], to: moveMatch[2] };
}

// --- Local Whisper Server ---
const WHISPER_API_URL = "http://localhost:5000/transcribe";

async function transcribeWithWhisper(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");

  try {
    const response = await fetch(WHISPER_API_URL, {
      method: "POST",
      body: formData
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.message || response.statusText;
      throw new Error(`Whisper API error ${response.status}: ${msg}`);
    }
    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error("Transcription error:", error);
    return { error: error.message };
  }
}

// --- MediaRecorder setup ---
let mediaRecorder;
let audioChunks = [];

recordBtn.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      speechOutput.textContent = "Transcribing...";
      speechOutput.style.color = "#667eea";

      const transcript = await transcribeWithWhisper(audioBlob);
      if (transcript && typeof transcript === "string") {
        speechOutput.textContent = `You said: "${transcript}"`;
        speechOutput.style.color = "#28a745";

        const normalized = normalizeTranscript(transcript);
        const moveData = extractMove(normalized);
        let matched = false;

        if (moveData && commandHandlers.move) {
          commandHandlers.move(moveData, transcript);
          matched = true;
        } else {
          for (const cmd in commandHandlers) {
            if (normalized.includes(cmd)) {
              commandHandlers[cmd](null, transcript);
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          speechOutput.textContent = `"${transcript}" — command not recognized`;
          speechOutput.style.color = "#dc3545";
        }
      } else if (transcript && transcript.error) {
        speechOutput.textContent = `Transcription failed: ${transcript.error}`;
        speechOutput.style.color = "#dc3545";
      } else {
        speechOutput.textContent = "Transcription failed. Try again.";
        speechOutput.style.color = "#dc3545";
      }

      // Stop all mic tracks
      stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorder.start();
    speechOutput.textContent = "🎤 Recording...";
    speechOutput.style.color = "#667eea";
    recordBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    speechOutput.textContent = "Mic permission denied. Please allow microphone access.";
    speechOutput.style.color = "#dc3545";
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  }
};