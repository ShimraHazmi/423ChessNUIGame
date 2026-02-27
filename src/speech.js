// speech.js - handles voice commands

const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
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
  recognition.continuous = true;  // Keep listening
  recognition.interimResults = true;  // Get interim results

  let silenceTimer = null;
  let finalTranscript = "";
  let isListening = false;
  let awaitingConfirmation = false;
  let pendingCommand = null;

  // ask for mic permission then start listening
  recordBtn.onclick = async () => {
    try {
      // request mic permission explicitly
      await navigator.mediaDevices.getUserMedia({ audio: true });
      speechOutput.textContent = "🎤 Listening...";
      speechOutput.style.color = "#667eea";
      finalTranscript = "";
      isListening = true;
      recognition.start();
      recordBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (error) {
      speechOutput.textContent = "Mic permission denied. Please allow microphone access.";
      speechOutput.style.color = "#dc3545";
    }
  };

  // stop recording button
  stopBtn.onclick = () => {
    isListening = false;
    if (silenceTimer) clearTimeout(silenceTimer);
    recognition.stop();
    speechOutput.textContent = "Recording stopped.";
    speechOutput.style.color = "#333";
  };

  // figure out what the user said and run the matching command
  recognition.onresult = (event) => {
    let interimTranscript = "";
    
    // Accumulate all results
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + " ";
      } else {
        interimTranscript += transcript;
      }
    }

    // Show what we're hearing (interim or final)
    const displayText = (finalTranscript + interimTranscript).trim();
    if (displayText) {
      speechOutput.textContent = `🎤 ${displayText}`;
      speechOutput.style.color = "#667eea";
    }

    // Clear the previous silence timer
    if (silenceTimer) clearTimeout(silenceTimer);

    // Set a new 3-second silence timer
    silenceTimer = setTimeout(() => {
      if (!isListening) return;
      
      const transcript = finalTranscript.toLowerCase().trim();
      if (!transcript) return;

      // If awaiting confirmation, check for yes/no
      if (awaitingConfirmation) {
        if (transcript.includes("yes") || transcript.includes("correct") || 
            transcript.includes("confirm") || transcript.includes("yep") || 
            transcript.includes("yeah")) {
          // Execute the pending command
          executeCommand(pendingCommand);
          awaitingConfirmation = false;
          pendingCommand = null;
        } else if (transcript.includes("no") || transcript.includes("cancel") || 
                   transcript.includes("wrong") || transcript.includes("nope") ||
                   transcript.includes("incorrect")) {
          speechOutput.textContent = "❌ Command cancelled. Try again.";
          speechOutput.style.color = "#dc3545";
          awaitingConfirmation = false;
          pendingCommand = null;
          
          setTimeout(() => {
            speechOutput.style.color = "#333";
          }, 2000);
        } else {
          // Didn't understand yes/no
          speechOutput.textContent = `"${transcript}" — please say 'yes' or 'no'`;
          speechOutput.style.color = "#ffa500";
          
          setTimeout(() => {
            speechOutput.style.color = "#333";
          }, 2000);
        }
        
        // Stop listening so user can redo if needed
        isListening = false;
        recognition.stop();
        finalTranscript = "";
        return;
      }

      // Process the initial command
      let matched = false;
      let commandObj = null;

      // Check for game control commands first
      if (transcript.includes("start")) {
        commandObj = { type: "start", display: "Start the game" };
        matched = true;
      } else if (transcript.includes("clear")) {
        commandObj = { type: "clear", display: "Clear the board" };
        matched = true;
      } else if (transcript.includes("pause") || transcript.includes("stop")) {
        commandObj = { type: "pause", display: "Pause the timer" };
        matched = true;
      } else if (
        transcript.includes("resume") ||
        transcript.includes("continue")
      ) {
        commandObj = { type: "resume", display: "Resume the timer" };
        matched = true;
      } else if (transcript.includes("reset")) {
        commandObj = { type: "reset", display: "Reset the game" };
        matched = true;
      } else {
        // Try to parse as a chess move
        const moveData = parseChessMove(transcript);
        if (moveData) {
          const moveDisplay = formatMoveForDisplay(moveData);
          commandObj = { type: "move", data: moveData, display: moveDisplay };
          matched = true;
        }
      }

      if (!matched) {
        speechOutput.textContent = `"${transcript}" — command not recognized`;
        speechOutput.style.color = "#dc3545";
        
        setTimeout(() => {
          speechOutput.style.color = "#333";
        }, 3000);
      } else if (commandObj) {
        // Display what we understood and ask for confirmation
        pendingCommand = commandObj;
        awaitingConfirmation = true;
        speechOutput.textContent = `📋 Did you mean: "${commandObj.display}"? Say yes or no.`;
        speechOutput.style.color = "#667eea";
        
        // Continue listening for yes/no
        finalTranscript = "";
        return;
      }

      // Stop listening and reset
      isListening = false;
      recognition.stop();
      finalTranscript = "";
    }, 3000); // 3 second silence buffer
  };

  // Format move data into human-readable display
  function formatMoveForDisplay(moveData) {
    if (moveData.from && moveData.to) {
      return `Move from ${moveData.from} to ${moveData.to}`;
    } else if (moveData.piece && moveData.to) {
      const pieceNames = {
        'p': 'pawn', 'n': 'knight', 'b': 'bishop',
        'r': 'rook', 'q': 'queen', 'k': 'king'
      };
      return `Move ${pieceNames[moveData.piece]} to ${moveData.to}`;
    }
    return "Unknown move";
  }

  // Execute a confirmed command
  function executeCommand(commandObj) {
    if (commandObj.type === "start") {
      fireCommand("start", "▶️ Starting game...");
    } else if (commandObj.type === "clear") {
      fireCommand("clear", "🗑️ Clearing board...");
    } else if (commandObj.type === "pause") {
      fireCommand("pause", "⏸️ Timer paused");
    } else if (commandObj.type === "resume") {
      fireCommand("resume", "▶️ Timer resumed");
    } else if (commandObj.type === "reset") {
      fireCommand("reset", "🔄 Resetting game...");
    } else if (commandObj.type === "move") {
      if (commandHandlers['move']) {
        commandHandlers['move'](commandObj.data, commandObj.display);
      }
    }
  }

  // Parse chess moves from natural language
  function parseChessMove(transcript) {
    // Normalize common speech recognition errors - phonetic confusions
    let normalized = transcript
      // Numbers: phonetic confusions
      .replace(/\btwo\b/gi, '2')
      .replace(/\bto\b/gi, '2')  // to sounds like 2
      .replace(/\bfour\b/gi, '4')
      .replace(/\bfor\b/gi, '4')
      .replace(/\bfive\b/gi, '5')
      .replace(/\bsix\b/gi, '6')
      .replace(/\bseven\b/gi, '7')
      .replace(/\beight\b/gi, '8')
      .replace(/\bate\b/gi, '8')
      .replace(/\benine\b/gi, '9')
      .replace(/\bnine\b/gi, '9')
      .replace(/\bone\b/gi, '1')
      .replace(/\bwon\b/gi, '1')
      .replace(/\bfree\b/gi, '3')
      .replace(/\bthree\b/gi, '3')
      // Letters: phonetic confusions
      .replace(/\bb\b/gi, 'b')  // already correct
      .replace(/\bv\b/gi, 'b')  // v sounds like b
      .replace(/\bsee\b/gi, 'c')
      .replace(/\bsea\b/gi, 'c')
      .replace(/\bd\b/gi, 'd')
      .replace(/\bee\b/gi, 'e')
      .replace(/\bef\b/gi, 'f')
      .replace(/\bgee\b/gi, 'g')
      .replace(/\baitch\b/gi, 'h')
      .replace(/\bach\b/gi, 'h')
      .replace(/\bi\b/gi, 'i')
      .replace(/\bjay\b/gi, 'j')
      .replace(/\bk\b/gi, 'k')
      .replace(/\bkay\b/gi, 'k')
      .replace(/\bell\b/gi, 'l')
      .replace(/\bem\b/gi, 'm')
      .replace(/\ben\b/gi, 'n')
      .replace(/\bo\b/gi, 'o')
      .replace(/\bp\b/gi, 'p')
      .replace(/\bpee\b/gi, 'p')
      .replace(/\bcue\b/gi, 'q')
      .replace(/\bqueue\b/gi, 'q')
      .replace(/\bar\b/gi, 'r')
      .replace(/\bes\b/gi, 's')
      .replace(/\bt\b/gi, 't')
      .replace(/\btee\b/gi, 't')
      .replace(/\bu\b/gi, 'u')
      .replace(/\byou\b/gi, 'u')
      .replace(/\bw\b/gi, 'w')
      .replace(/\bdouble u\b/gi, 'w')
      .replace(/\bex\b/gi, 'x')
      .replace(/\bwhy\b/gi, 'y')
      .replace(/\bzee\b/gi, 'z')
      .replace(/\bzed\b/gi, 'z')
      // Piece names
      .replace(/\bnight\b/gi, 'knight')
      .replace(/\btoo\b/gi, 'to');

    // Clean up: remove extra spaces and special characters
    normalized = normalized.replace(/\s+/g, ' ').trim();

    // Try to extract chess coordinates more intelligently
    // Look for patterns like: letter+number combinations
    const coordPattern = /([a-h])\s*([1-8])/gi;
    const coords = [];
    let match;
    while ((match = coordPattern.exec(normalized)) !== null) {
      coords.push(match[1].toLowerCase() + match[2]);
    }

    // Pattern 1: Direct square-to-square move (e2 to e4)
    if (coords.length >= 2) {
      return { from: coords[0], to: coords[1] };
    }

    // Pattern 2: "knight at b1 to c3" or "knight from b1 to c3"
    const pattern2 = /(?:knight|bishop|rook|queen|king|pawn)\s+(?:at|from)?\s+([a-h])\s*([1-8])\s+(?:to)?\s+([a-h])\s*([1-8])/i;
    const match2 = normalized.match(pattern2);
    if (match2) {
      return { from: match2[1].toLowerCase() + match2[2], to: match2[3].toLowerCase() + match2[4] };
    }

    // Pattern 3: "knight to f3" or "pawn to e4"
    const pieces = {
      'pawn': 'p', 'knight': 'n', 'bishop': 'b',
      'rook': 'r', 'queen': 'q', 'king': 'k'
    };
    
    for (const [pieceName, pieceCode] of Object.entries(pieces)) {
      const pattern3 = new RegExp(`${pieceName}\\s+to\\s+([a-h])\\s*([1-8])`, 'i');
      const match3 = normalized.match(pattern3);
      if (match3) {
        return { piece: pieceCode, to: match3[1].toLowerCase() + match3[2] };
      }
    }

    return null;
  }

  function fireCommand(command, feedbackText) {
    speechOutput.textContent = feedbackText;
    speechOutput.style.color = "#28a745";
    if (commandHandlers[command]) {
      commandHandlers[command]();
    }
  }

  // something went wrong with the mic
  recognition.onerror = (event) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      speechOutput.textContent = "Sorry, I couldn't hear you. Try again!";
      speechOutput.style.color = "#dc3545";
    }
    if (silenceTimer) clearTimeout(silenceTimer);
  };

  recognition.onend = () => {
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    isListening = false;
    if (silenceTimer) clearTimeout(silenceTimer);
    console.log("Speech recognition ended");
  };
}