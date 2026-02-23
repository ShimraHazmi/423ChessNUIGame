//BLOCK 1
const recordBtn = document.getElementById("recordBtn");
const speechOutput = document.getElementById("speechOutput");

// DRIVER SOFTWARE: Web Speech API connects to the microphone
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  speechOutput.textContent = "Speech recognition not supported in this browser.";
} else {
  
  // BLOCK 2 -  RECOGNIZER ENGINE: Converts audio to text
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  
  // BLOCK 3 -  HARDWARE SENSOR: Start microphone when button clicked
  recordBtn.onclick = () => {
    speechOutput.textContent = "Listening...";
    try {
      recognition.start();  // Begin capturing audio
    } catch (error) {
      speechOutput.textContent = "Click again to start listening.";
    }
  };
  
  // BLOCK 4 - COMMAND INTERPRETER: Process the recognized speech
  recognition.onresult = (event) => {
    // Get the recognized text
    const transcript = event.results[0][0].transcript.toLowerCase();
    speechOutput.textContent = `You said: "${transcript}"`;
    
    // Check if user said "hi" or "hello"
    if (transcript.includes("hi") || transcript.includes("hello")) {
      speechOutput.textContent = "✅ Hey there!";
      speechOutput.style.color = "#28a745";
      
      // FEEDBACK LOOP: Reset after 2 seconds
      setTimeout(() => {
        speechOutput.textContent = 'Say "hi" or "hello"';
        speechOutput.style.color = "#333";
      }, 2000);
    }
  };
  
  // BLOCK 5 - Handle errors
  recognition.onerror = (event) => {
    speechOutput.textContent = "Sorry, I couldn't hear you. Try again!";
    speechOutput.style.color = "#dc3545";
  };
  
  recognition.onend = () => {
    console.log("Speech recognition ended");
  };
}

// FLOW: User speaks → Microphone → Web Speech API → Text → Check for "hi" → Output