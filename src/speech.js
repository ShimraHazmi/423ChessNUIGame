const recordBtn = document.getElementById("recordBtn");
const speechOutput = document.getElementById("speechOutput");

const commandHandlers = {};

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

  if (normalizedText.includes('castle king') || normalizedText.includes('castle short') || normalizedText.includes('kingside castle')) {
    return { special: 'O-O' };
  }
  if (normalizedText.includes('castle queen') || normalizedText.includes('castle long') || normalizedText.includes('queenside castle')) {
    return { special: 'O-O-O' };
  }

  const pieceMap = {
    'knight': 'n',
    'night': 'n',
    'bishop': 'b',
    'rook': 'r',
    'queen': 'q',
    'king': 'k'
  };

  let pieceType = null;
  for (const [name, code] of Object.entries(pieceMap)) {
    if (normalizedText.includes(name)) {
      pieceType = code;
      break;
    }
  }

  const compact = normalizedText.replace(/\b([a-h])\s*([1-8])\b/g, "$1$2");

  const explicitMove = compact.match(/\b([a-h][1-8])\s*(?:to|2|too)\s*([a-h][1-8])\b/);
  if (explicitMove) {
    return { from: explicitMove[1], to: explicitMove[2] };
  }

  const pawnCapture = compact.match(/\b([a-h])\s*(?:take|capture)s?\s*([a-h][1-8])\b/);
  if (pawnCapture) {
    return {
      piece: 'p',
      to: pawnCapture[2],
      capture: true,
      fromFile: pawnCapture[1]
    };
  }

  const squareMatch = compact.match(/\b([a-h][1-8])\b/);
  if (!squareMatch) {
    return null;
  }

  const targetSquare = squareMatch[1];
  const isCapture = normalizedText.includes('take') || normalizedText.includes('capture');

  return {
    piece: pieceType,
    to: targetSquare,
    capture: isCapture
  };
}

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
      throw new Error("Transcription failed");
    }
    const result = await response.json();
    return result.text;
  } catch (error) {
    return { error: "Could not transcribe audio. Make sure the Whisper server is running." };
  }
}

let mediaRecorder;
let audioChunks = [];
let recognition;
let isRecording = false;

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

      stream.getTracks().forEach(t => t.stop());
      recordBtn.disabled = false;

      if (autoListenEnabled) {
        setTimeout(() => startRecording(), 500);
      }
    };

    mediaRecorder.start();

    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        if (event.results[i].isFinal) {
          if (transcript.includes('confirm')) {
            stopRecording();
            return;
          }
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript.includes('confirm')) {
        stopRecording();
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
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

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
  }
}

// Credits:
// OpenAI Whisper - Speech recognition model used for transcription
//   https://github.com/openai/whisper
//   Licensed under MIT License
//
// Web Speech API (SpeechRecognition) - Browser-native speech recognition
//   https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
//   W3C Community Draft Report
//
// MediaRecorder API - Browser-native audio recording
//   https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder