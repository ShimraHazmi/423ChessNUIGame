// speech.js - handles voice commands via local Whisper server

// DOM elements
const recordBtn = document.getElementById("recordBtn");
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
  
  console.log('Parsing:', normalizedText);
  
  //common special moves
  if (normalizedText.includes('castle king') || normalizedText.includes('castle short') || normalizedText.includes('kingside castle')) {
    return { special: 'O-O' };
  }
  if (normalizedText.includes('castle queen') || normalizedText.includes('castle long') || normalizedText.includes('queenside castle')) {
    return { special: 'O-O-O' };
  }
  
  const pieceMap = {
    'pawn': 'p',
    'knight': 'n',
    'bishop': 'b',
    'rook': 'r',
    'queen': 'q',
    'king': 'k'
  };
  
  // Extract piece type from text
  let pieceType = null;
  for (const [name, code] of Object.entries(pieceMap)) {
    if (normalizedText.includes(name)) {
      pieceType = code;
      break;
    }
  }
  
  //exact source to dest
  const compact = normalizedText.replace(/\b([a-h])\s*([1-8])\b/g, "$1$2");
  const squareMatch = compact.match(/\b([a-h][1-8])\b/);
  
  if (!squareMatch) {

    const oldFormat = compact.match(/\b([a-h][1-8])\s*(?:to|-)?\s*([a-h][1-8])\b/);
    if (oldFormat) {
      return { from: oldFormat[1], to: oldFormat[2] };
    }
    return null;
  }
  
  const targetSquare = squareMatch[1];
  

  const isCapture = normalizedText.includes('take') || normalizedText.includes('capture');
  
  // Return in format the handler can process
  return {
    piece: pieceType,
    to: targetSquare,
    capture: isCapture
  };
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
let recognition; // Web Speech API for real-time "confirm" detection
let isRecording = false;

// Initialize Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
}

let autoListenEnabled = false;

async function startRecording() {
  if (isRecording) return;
  
  if (!SpeechRecognition) {
    speechOutput.textContent = "Speech recognition not supported in this browser.";
    speechOutput.style.color = "#dc3545";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    isRecording = true;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      speechOutput.textContent = "Transcribing...";
      speechOutput.style.color = "#667eea";

      const transcript = await transcribeWithWhisper(audioBlob);
      if (transcript && typeof transcript === "string") {
        // Remove "confirm" from the transcript
        const cleanedTranscript = transcript.replace(/\bconfirm\b/gi, "").trim();
        
        speechOutput.textContent = `You said: "${cleanedTranscript}"`;
        speechOutput.style.color = "#28a745";

        const normalized = normalizeTranscript(cleanedTranscript);
        const moveData = extractMove(normalized);
        let matched = false;

        if (moveData && commandHandlers.move) {
          commandHandlers.move(moveData, cleanedTranscript);
          matched = true;
        } else {
          for (const cmd in commandHandlers) {
            if (normalized.includes(cmd)) {
              commandHandlers[cmd](null, cleanedTranscript);
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          speechOutput.textContent = `"${cleanedTranscript}" — command not recognized`;
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
      recordBtn.disabled = false;

      // Auto-restart recording after processing
      if (autoListenEnabled) {
        setTimeout(() => startRecording(), 500);
      }
    };

    // Start recording with MediaRecorder
    mediaRecorder.start();
    
    // Start Web Speech API for real-time "confirm" detection
    recognition.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        if (event.results[i].isFinal) {
          // Check for "confirm" in final results
          if (transcript.includes('confirm')) {
            stopRecording();
            return;
          }
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Check interim results for "confirm" too
      if (interimTranscript.includes('confirm')) {
        stopRecording();
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      // Don't stop recording on recognition errors, just log them
    };

    recognition.onend = () => {
      // Auto-restart recognition if still recording (unless we stopped intentionally)
      if (isRecording && mediaRecorder && mediaRecorder.state === "recording") {
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
        }
      }
    };

    recognition.start();

    speechOutput.textContent = "🎤 Recording... Say 'confirm' when done.";
    speechOutput.style.color = "#667eea";
    recordBtn.disabled = true;

  } catch (error) {
    isRecording = false;
    autoListenEnabled = false;
    speechOutput.textContent = "Mic permission denied. Please allow microphone access.";
    speechOutput.style.color = "#dc3545";
    recordBtn.disabled = false;
  }
}

recordBtn.onclick = async () => {
  autoListenEnabled = true;
  startRecording();
};

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    isRecording = false;
    mediaRecorder.stop();
    
    // Stop speech recognition
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
  }
}