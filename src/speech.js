// speech.js
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

    const options = { mimeType: "audio/webm;codecs=opus" };
    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      speechOutput.textContent = "Transcribing...";
      speechOutput.style.color = "#667eea";

      try {
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");

        const response = await fetch("http://localhost:3000/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(err);
        }

        const data = await response.json();
        speechOutput.textContent = `You said: "${data.text}"`;
        speechOutput.style.color = "#28a745";
      } catch (err) {
        console.error("Transcription error:", err);
        speechOutput.textContent = "Transcription failed.";
        speechOutput.style.color = "#dc3545";
      }

      stream.getTracks().forEach((t) => t.stop());
      recordBtn.disabled = false;
      stopBtn.disabled = true;
    };

    mediaRecorder.start();
    speechOutput.textContent = "🎤 Recording...";
    speechOutput.style.color = "#667eea";
    recordBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (err) {
    console.error("getUserMedia error:", err);
    speechOutput.textContent = "Mic access denied.";
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