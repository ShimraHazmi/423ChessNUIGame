// speech.js - handles voice commands via OpenAI Whisper API
import { OPENAI_API_KEY } from "./config.js";

// DOM elements
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const speechOutput = document.getElementById("speechOutput");

// stores command callbacks that main.js registers
const commandHandlers = {};

// lets other files register what happens when a command is spoken
export function onVoiceCommand(command, handler) {
  commandHandlers[command] = handler;
}

// --- Whisper API ---
const WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";

async function transcribeWithWhisper(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-1");

  try {
    const response = await fetch(WHISPER_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: formData
    });
    if (!response.ok) {
      throw new Error("Whisper API error: " + response.status);
    }
    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error(error);
    return null;
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
      if (transcript) {
        speechOutput.textContent = `You said: "${transcript}"`;
        speechOutput.style.color = "#28a745";

        const normalized = transcript.trim().toLowerCase();
        let matched = false;
        for (const cmd in commandHandlers) {
          if (normalized.includes(cmd)) {
            commandHandlers[cmd]();
            matched = true;
            break;
          }
        }
        if (!matched) {
          speechOutput.textContent = `"${transcript}" — command not recognized`;
          speechOutput.style.color = "#dc3545";
        }
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