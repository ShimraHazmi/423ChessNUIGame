const recordBtn = document.getElementById("recordBtn");
const speechOutput = document.getElementById("speechOutput");

const commandHandlers = {};

export function onVoiceCommand(command, handler) { // Handler for commands given by the user
  commandHandlers[command.toLowerCase()] = handler;
}

function normalizeTranscript(text) {
  if (!text) return "";
  let normalized = text.toLowerCase(); // Convert to lowercase for easier matching
  normalized = normalized.replace(/[^a-z0-9\s]/g, " "); // use regex to replace non-alphanumeric characters with space
  normalized = normalized.replace(/\b(one)\b/g, "1");
  normalized = normalized.replace(/\b(two)\b/g, "2");
  normalized = normalized.replace(/\b(three)\b/g, "3");
  normalized = normalized.replace(/\b(four|for)\b/g, "4");
  normalized = normalized.replace(/\b(five)\b/g, "5");
  normalized = normalized.replace(/\b(six)\b/g, "6");
  normalized = normalized.replace(/\b(seven)\b/g, "7");
  normalized = normalized.replace(/\b(eight|ate)\b/g, "8");

  // Convert spoken language to chess notation when followed by a rank
  // Example: "night to see three" -> "knight to c3".
  const spokenFileVariants = {
    a: ['a', 'ay'],
    b: ['b', 'be', 'bee'],
    c: ['c', 'cee', 'see', 'sea'],
    d: ['d', 'dee'],
    e: ['e', 'ee'],
    f: ['f', 'ef'],
    g: ['g', 'gee'],
    h: ['h', 'aitch']
  };


  // Loop through each file and its variants, replacing them in the normalized text when followed by a rank number
  for (const [file, variants] of Object.entries(spokenFileVariants)) { 
    for (const variant of variants) {
      const pattern = new RegExp(`\\b${variant}\\s*([1-8])\\b`, "g");
      normalized = normalized.replace(pattern, `${file}$1`);
    }
  }

  // Remove extra spaces and trim the text
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

function extractMove(normalizedText) { // Returns an object with move details or null if no move found
  if (!normalizedText) return null;

  console.log('Parsing:', normalizedText);

  if (normalizedText.includes('castle king') || normalizedText.includes('castle short') || normalizedText.includes('kingside castle')) {
    return { special: 'O-O' };
  }
  if (normalizedText.includes('castle queen') || normalizedText.includes('castle long') || normalizedText.includes('queenside castle')) {
    return { special: 'O-O-O' };
  }

  const pieceMap = { // Map the spoken piece names to chess notation for easier parsing
    'knight': 'n',
    'night': 'n',
    'bishop': 'b',
    'rook': 'r',
    'queen': 'q',
    'king': 'k'
  };

  let pieceType = null; // Default to pawn if no piece type is mentioned
  for (const [name, code] of Object.entries(pieceMap)) { // Check if the normalized text includes the piece name
    if (normalizedText.includes(name)) {
      pieceType = code;
      break;
    }
  }

  const compact = normalizedText.replace(/\b([a-h])\s*([1-8])\b/g, "$1$2"); // Remove spaces in square names to help with regex matching

  const explicitMove = compact.match(/\b([a-h][1-8])\s*(?:to|2|too)\s*([a-h][1-8])\b/); // Match patterns like "e2 to e4" or "e2 2 e4"
  if (explicitMove) {
    return { from: explicitMove[1], to: explicitMove[2] };
  }

  const pawnCapture = compact.match(/\b([a-h])\s*(?:take|capture)s?\s*([a-h][1-8])\b/); // Match patterns like "e takes d5" or "e capture d5"
  if (pawnCapture) {
    return {
      piece: 'p',
      to: pawnCapture[2],
      capture: true,
      fromFile: pawnCapture[1]
    };
  }

  const squareMatch = compact.match(/\b([a-h][1-8])\b/); // Match patterns like "e4" or "a3"
  if (!squareMatch) {
    return null;
  }

  const targetSquare = squareMatch[1]; // The square mentioned in the command is likely the destination square
  const isCapture = normalizedText.includes('take') || normalizedText.includes('capture'); // If the command includes "take" or "capture", assume it's capture

  return { // If no explicit piece type is mentioned, default to pawn. Otherwise, use the identified piece type.
    piece: pieceType,
    to: targetSquare,
    capture: isCapture
  };
}

const WHISPER_API_URL = "http://localhost:5000/transcribe"; // URL of the local Whisper server for transcription

async function transcribeWithWhisper(audioBlob) { // Send the recorded audio to the Whisper server and return the transcribed text
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

// Check for browser support of SpeechRecognition API and initialize it if available
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // Request microphone access
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    isRecording = true;

    mediaRecorder.ondataavailable = (event) => { // Collect audio data chunks as they become available
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      speechOutput.textContent = "Transcribing...";
      speechOutput.style.color = "#667eea";

      const transcript = await transcribeWithWhisper(audioBlob);
      if (transcript && typeof transcript === "string") {
        const cleanedTranscript = transcript.replace(/\bconfirm\b/gi, "").trim(); // Remove "confirm" from the transcript as it's just a signal to stop recording

        speechOutput.textContent = `You said: "${cleanedTranscript}"`;
        speechOutput.style.color = "#28a745";

        const normalized = normalizeTranscript(cleanedTranscript); // Normalize the transcript for easier command matching
        const moveData = extractMove(normalized);
        let matched = false;

        if (moveData && commandHandlers.move) { // If a move is detected in the transcript and a move handler is registered, call it with the move data
          commandHandlers.move(moveData, cleanedTranscript);
          matched = true;
        } else {
          for (const cmd in commandHandlers) { // Check if any registered command is included in the normalized transcript and call its handler if found
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
      let duringTranscript = '';
      // Loop through the results starting from the index of the latest result
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase();
        if (event.results[i].isFinal) {
          if (transcript.includes('confirm')) { // If the user says "confirm", stop recording immediately
            stopRecording();
            return;
          }
        } else {
          duringTranscript += transcript;
        }
      }

      if (duringTranscript.includes('confirm')) {
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

    speechOutput.textContent = "Recording... Say 'confirm' when done.";
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

recordBtn.onclick = async () => { // Start recording when the button is clicked
  autoListenEnabled = true;
  startRecording();
};

// Stop recording when the user clicks the button again or says "confirm"
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