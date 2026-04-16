// Import speech module and register voice commands
import { onVoiceCommand } from "./speech.js";

// chess.js game instance (loaded from CDN as global)
var board = null
var game = new Chess()
var $status = $('#speechOutput')

// --- timer state ---
let whiteSeconds = 0
let blackSeconds = 0
let activeColor = 'white'
let timerInterval = null
let isPaused = false

// --- hint state ---
let lastHint = null // Stores {from, to} squares for the last hint move
let hintCleanupTimeout = null

const timerContainer = document.getElementById('timerContainer') // Timer display elements
const whiteTimerEl = document.getElementById('whiteTimer')
const blackTimerEl = document.getElementById('blackTimer')
const timerStatusEl = document.getElementById('timerStatus')


// Format time correctly on the gui
function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}


// Update the timer display and highlight the active player
function updateTimerDisplay() {
  whiteTimerEl.textContent = formatTime(whiteSeconds)
  blackTimerEl.textContent = formatTime(blackSeconds)
  whiteTimerEl.classList.toggle('active-timer', activeColor === 'white' && !isPaused)
  blackTimerEl.classList.toggle('active-timer', activeColor === 'black' && !isPaused)
}


// Increment the active player's timer every second
function tickTimer() {
  if (activeColor === 'white') whiteSeconds++
  else blackSeconds++
  updateTimerDisplay()
}


// Start the timer when a new game begins
function startTimer() {
  if (timerInterval) clearInterval(timerInterval)
  isPaused = false
  timerInterval = setInterval(tickTimer, 1000)
  timerStatusEl.textContent = 'Game in progress'
  timerStatusEl.classList.remove('paused')
  updateTimerDisplay()
}


// Pause the timer whenever user requests or opens menu, etc...
function pauseTimer() {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  isPaused = true
  timerStatusEl.textContent = '⏸ Paused'
  timerStatusEl.classList.add('paused')
  updateTimerDisplay()
}


// Resume the timer when user requests or closes menu, etc...
function resumeTimer() {
  if (isPaused) {
    isPaused = false
    timerInterval = setInterval(tickTimer, 1000)
    timerStatusEl.textContent = 'Game in progress'
    timerStatusEl.classList.remove('paused')
    updateTimerDisplay()
  }
}


// Reset the timer to initial state when starting a new game
function resetTimer() {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  isPaused = false
  whiteSeconds = 0
  blackSeconds = 0
  activeColor = 'white'
  timerStatusEl.textContent = 'Game in progress'
  timerStatusEl.classList.remove('paused')
  updateTimerDisplay()
}



// switch the clock after each move
function switchClock() {
  activeColor = activeColor === 'white' ? 'black' : 'white'
  updateTimerDisplay()
}


// Chess pick up mechanism: only allow picking up pieces if it's the player's turn and the game is not over
function onDragStart (source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for the side to move
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
}


// 
function onDrop (source, target) {
  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // always promote to a queen for simplicity
  })

  // illegal move
  if (move === null) return 'snapback'

  // switch whose clock is ticking after a valid move
  switchClock()
  updateStatus()
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
  board.position(game.fen())
}

function updateStatus () {
  var status = ''

  var moveColor = 'White'
  if (game.turn() === 'b') {
    moveColor = 'Black'
  }

  // checkmate?
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.'
    // Show winning screen
    const winner = moveColor === 'White' ? 'Black' : 'White'
    showWinningPopup(winner, 'checkmate')
    pauseTimer()
  }

  // draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position'
    showWinningPopup(null, 'draw')
    pauseTimer()
  }

  // game still on
  else {
    status = moveColor + ' to move'

    // check?
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check'
    }
  }

  $status.html(status)
}

// Chessboard.js configuration
var config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  pieceTheme: './src/chessboardjs-1.0.0/img/chesspieces/wikipedia/{piece}.png'
}
board = Chessboard('board', config)

updateStatus()


async function getHint() {
    // Check if game is over
    if (game.game_over()) {
        $status.html('Game is already over');
        return;
    }
    
    
    try {
        // Get current board position
        const fen = game.fen();
        
        // Send to Stockfish server
        const response = await fetch('http://localhost:5001/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: fen, depth: 18 })
        });
        
        const data = await response.json();
        
        // Get the move
        const move = data.move;
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        lastHint = { from, to }

        if (hintCleanupTimeout) {
          clearTimeout(hintCleanupTimeout)
        }
        
        
        $status.html(`Best move: ${from} to ${to}`);
        
        // Highlight squares
        $('.square-55d63').removeClass('hint-from hint-to');
        $('.square-' + from).addClass('hint-from');
        $('.square-' + to).addClass('hint-to');

        hintCleanupTimeout = setTimeout(() => {
          $('.square-55d63').removeClass('hint-from hint-to')
          hintCleanupTimeout = null
        }, 5000)
        
    } catch (error) {
        $status.html('Analysis failed');
    }
}



// Handle Start and Clear buttons
$('.start-btn').on('click', function() {
  game.reset()
  board.start()
  resetTimer()
  lastHint = null
  if (hintCleanupTimeout) {
    clearTimeout(hintCleanupTimeout)
    hintCleanupTimeout = null
  }
  $('.square-55d63').removeClass('hint-from hint-to')
  timerContainer.classList.remove('hidden')
  startTimer()
  updateStatus()
})



$('.clear-btn').on('click', function() {
  game.clear()
  board.clear()
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  lastHint = null
  if (hintCleanupTimeout) {
    clearTimeout(hintCleanupTimeout)
    hintCleanupTimeout = null
  }
  $('.square-55d63').removeClass('hint-from hint-to')
  timerContainer.classList.add('hidden')
  $status.html('Board cleared')
})



// Handle voice commands
onVoiceCommand('start', function() {
  game.reset()
  board.start()
  resetTimer()
  lastHint = null
  if (hintCleanupTimeout) {
    clearTimeout(hintCleanupTimeout)
    hintCleanupTimeout = null
  }
  $('.square-55d63').removeClass('hint-from hint-to')
  timerContainer.classList.remove('hidden')
  startTimer()
  updateStatus()
})


// Clear the board and stop the timer, but don't reset the timer values so that if user starts again they can see how long they were playing before
onVoiceCommand('quit', function(_, transcript = '') {
  const transcriptLower = transcript.toLowerCase()
  if (!transcriptLower.includes('game')) {
    return
  }

  game.clear()
  board.clear()
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  lastHint = null
  if (hintCleanupTimeout) {
    clearTimeout(hintCleanupTimeout)
    hintCleanupTimeout = null
  }
  $('.square-55d63').removeClass('hint-from hint-to')
  timerContainer.classList.add('hidden')
})


onVoiceCommand('pause', pauseTimer)
onVoiceCommand('resume', resumeTimer)


// Open main menu on voice command
onVoiceCommand('menu', function() {
  menuPopup.classList.remove('hidden')
})


onVoiceCommand('settings', function() {
  menuPopup.classList.remove('hidden')
})


// Close menu on voice command
onVoiceCommand('close menu', function(_, transcript) {
  const transcriptLower = transcript.toLowerCase()
  if (transcriptLower.includes('close') && transcriptLower.includes('menu')) {
    menuPopup.classList.add('hidden')
  }
})


onVoiceCommand('reset', function() {
  game.reset()
  board.start()
  resetTimer()
  lastHint = null
  if (hintCleanupTimeout) {
    clearTimeout(hintCleanupTimeout)
    hintCleanupTimeout = null
  }
  $('.square-55d63').removeClass('hint-from hint-to')
  timerContainer.classList.remove('hidden')
  startTimer()
  updateStatus()
})



function handleHintVoiceCommand(_, transcript = '') {
  const transcriptLower = transcript.toLowerCase()
  
  // Handle "take hint" command, execute the last hint move
  // Only match "take hint", not just "hint" by itself (so that it doesn't trigger asking for a new hint)
  if (transcriptLower.includes('take') && transcriptLower.includes('hint')) {
    if (!lastHint) {
      $status.html('No hint available. Say "hint" first.')
      $status.css('color', '#dc3545')
      setTimeout(() => $status.css('color', '#333'), 3000)
      return
    }
    
    if (game.game_over()) {
      $status.html('Game over! Cannot make moves.')
      $status.css('color', '#dc3545')
      return
    }
    
    // Execute the hint move
    const move = game.move({
      from: lastHint.from,
      to: lastHint.to,
      promotion: 'q'
    })
    
    if (move) {
      board.position(game.fen())
      switchClock()
      lastHint = null // Clear hint after executing
      if (hintCleanupTimeout) {
        clearTimeout(hintCleanupTimeout)
        hintCleanupTimeout = null
      }
      // Clear any remaining hint highlights
      $('.square-55d63').removeClass('hint-from hint-to')
      updateStatus()
    } else {
      $status.html('Hint move is no longer legal.')
      $status.css('color', '#dc3545')
      lastHint = null
    }
    return
  }
  
  // Handle "hint" command, get a new hint (only if "take" is NOT in the transcript)
  if (transcriptLower.includes('take')) {
    return
  }

  if (game.game_over()) {
    $status.html('No game in progress.')
    $status.css('color', '#dc3545')
    return
  }
  getHint()
}


onVoiceCommand('hint', handleHintVoiceCommand)
onVoiceCommand('help', handleHintVoiceCommand)
onVoiceCommand('help me', handleHintVoiceCommand)
onVoiceCommand('i don t know', handleHintVoiceCommand)
onVoiceCommand('i dont know', handleHintVoiceCommand)



onVoiceCommand('resign', function(_, transcript = '') {
    if (game.game_over()) {
        $status.html('Game is already over');
        return;
    }
    
    // Allow explicit resign commands like "white resign" / "black resign".
    // If not explicit, default to side-to-move resigning.
    const normalizedTranscript = transcript.toLowerCase()
    let loser
    if (normalizedTranscript.includes('white')) { // If the user says "white resign"
      loser = 'White'
    } else if (normalizedTranscript.includes('black')) { // If the user says "black resign"
      loser = 'Black'
    } else {
      loser = game.turn() === 'w' ? 'White' : 'Black' // If the transcript doesn't specify, assume the player whose turn it is wants to resign.
    }

    const winner = loser === 'White' ? 'Black' : 'White'
    
    $status.html(`${loser} resigns. ${winner} wins!`);
    showWinningPopup(winner, 'resign', loser) // Show winning popup with the winner and loser information
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
})



// Handle chess moves from voice commands
onVoiceCommand('move', function(moveData, transcript) {
  if (game.game_over()) {
    $status.html('Game over! Cannot make moves.')
    $status.css('color', '#dc3545')
    setTimeout(() => $status.css('color', '#333'), 3000)
    return
  }

  let move = null

  // Handle special moves (castling)
  if (moveData.special) {
    if (moveData.special === 'O-O') {
      move = game.move({ from: 'e1', to: 'g1' }) || game.move({ from: 'e8', to: 'g8' })
    } else if (moveData.special === 'O-O-O') {
      move = game.move({ from: 'e1', to: 'c1' }) || game.move({ from: 'e8', to: 'c8' })
    }
  }
  // Relative directional move: "move pawn at e2 up 1" or "rook from a8 down 2"
  else if (moveData.from && moveData.relativeDirection && moveData.steps) {
    const sourcePiece = game.get(moveData.from)

    if (sourcePiece) {
      if (!moveData.piece || moveData.piece === sourcePiece.type) {
        const file = moveData.from[0]
        const rank = Number(moveData.from[1])
        const step = Number(moveData.steps)
        const signedDelta = moveData.relativeDirection === 'up'
          ? (sourcePiece.color === 'w' ? step : -step)
          : (sourcePiece.color === 'w' ? -step : step)
        const toRank = rank + signedDelta

        if (toRank >= 1 && toRank <= 8) {
          const toSquare = `${file}${toRank}`
          move = game.move({
            from: moveData.from,
            to: toSquare,
            promotion: 'q'
          })
        }
      }
    }
  }
  // Direct move: "a2 to a3" or "e2 to e4"
  else if (moveData.from && moveData.to) {
    move = game.move({
      from: moveData.from,
      to: moveData.to,
      promotion: 'q'
    })
  }
  // Handle moves to a square
  else if (moveData.to) {
    const moves = game.moves({ verbose: true }) // Get all legal moves in verbose format to filter through
    const targetSquare = moveData.to
    
    let matchingMoves = moves.filter(m => m.to === targetSquare)
    
    // Filter by piece type if specified
    if (moveData.piece) {
      matchingMoves = matchingMoves.filter(m => m.piece === moveData.piece)
    } else {
      // No piece specified so assume pawn (like "e4" or "a3")
      matchingMoves = matchingMoves.filter(m => m.piece === 'p')
    }
    
    // For pawn captures such as: "a takes b5"
    if (moveData.fromFile && moveData.piece === 'p') {
      matchingMoves = matchingMoves.filter(m => m.from[0] === moveData.fromFile)
    }
    
    // Filter by capture if specified
    if (moveData.capture) {
      matchingMoves = matchingMoves.filter(m => m.captured)
    }
    
    if (matchingMoves.length === 1) { // Only one legal move matches the criteria, so execute it
      move = game.move({
        from: matchingMoves[0].from,
        to: matchingMoves[0].to,
        promotion: 'q' // if the move is a promotion, always promote to a queen for simplicity
      })
    } else if (matchingMoves.length > 1) {
      $status.html(`Ambiguous! Multiple pieces can move to ${targetSquare}. Be more specific.`) // Feedback loop
      $status.css('color', '#ffa500')
      setTimeout(() => $status.css('color', '#333'), 4000)
      return
    } else if (matchingMoves.length === 0) {
      $status.html(`No valid move to ${targetSquare}`)
      $status.css('color', '#dc3545')
      setTimeout(() => $status.css('color', '#333'), 3000)
      return
    }
  }

  if (move) { // Valid move was made
    board.position(game.fen())
    switchClock()
    updateStatus()
    $status.css('color', '#28a745')
    setTimeout(() => $status.css('color', '#333'), 2000)
  } else {
    $status.html(`Illegal move: "${transcript}"`)
    $status.css('color', '#dc3545')
    setTimeout(() => {
      updateStatus()
      $status.css('color', '#333')
    }, 3000)
  }
})

// Menu button functionality
const menuBtn = document.getElementById('menuBtn')
const menuPopup = document.getElementById('menuPopup')
const pauseMenuBtn = document.getElementById('pauseMenuBtn')
const resumeMenuBtn = document.getElementById('resumeMenuBtn')
const resetMenuBtn = document.getElementById('resetMenuBtn')
const tipsBtn = document.getElementById('tipsBtn')
const tipsPopup = document.getElementById('tipsPopup')
const closeTipsBtn = document.getElementById('closeTipsBtn')

// Toggle menu popup on button click
menuBtn.addEventListener('click', function(e) {
  e.stopPropagation()
  menuPopup.classList.toggle('hidden')
})

// Close menu when clicking outside
document.addEventListener('click', function(e) {
  if (!menuBtn.contains(e.target) && !menuPopup.contains(e.target)) {
    menuPopup.classList.add('hidden')
  }
})

// Pause button in menu
pauseMenuBtn.addEventListener('click', function() {
  pauseTimer()
  menuPopup.classList.add('hidden')
})

// Resume button in menu
resumeMenuBtn.addEventListener('click', function() {
  resumeTimer()
  menuPopup.classList.add('hidden')
})

// Reset button in menu
resetMenuBtn.addEventListener('click', function() {
  game.reset()
  board.start()
  resetTimer()
  timerContainer.classList.remove('hidden')
  startTimer()
  updateStatus()
  menuPopup.classList.add('hidden')
})

// Tips popup functionality
tipsBtn.addEventListener('click', function(e) {
  e.stopPropagation()
  tipsPopup.classList.remove('hidden')
})

closeTipsBtn.addEventListener('click', function() {
  tipsPopup.classList.add('hidden')
})

tipsPopup.addEventListener('click', function(e) {
  if (e.target === tipsPopup) {
    tipsPopup.classList.add('hidden')
  }
})

// Winning screen functionality
const winningModal = document.getElementById('winningPopup')
// const winningIcon = document.getElementById('winningIcon')
const winningTitle = document.getElementById('winningTitle')
const winningMessage = document.getElementById('winningMessage')
const playAgainBtn = document.getElementById('playAgainBtn')
const closePopupBtn = document.getElementById('closePopupBtn')


function stopTimerAndClearBoard() { // Helper function to stop the timer and clear the board when the game ends
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  isPaused = true
  timerStatusEl.textContent = 'Game over'
  timerStatusEl.classList.add('paused')
  game.clear()
  board.clear()
  updateTimerDisplay()
}



function showWinningPopup(winner, type, loser = null) { // type can be 'checkmate', 'draw', or 'resign'. loser is only relevant for resignation to show who resigned
  stopTimerAndClearBoard()

  if (type === 'checkmate') {
    winningTitle.textContent = 'Checkmate!'
    winningMessage.textContent = `${winner} wins!`
  } else if (type === 'draw') {
    winningTitle.textContent = 'Draw!'
    winningMessage.textContent = 'The game is a draw'
  } else if (type === 'resign') {
    winningTitle.textContent = 'Resignation'
    winningMessage.textContent = loser ? `${loser} resigns. ${winner} wins!` : `${winner} wins by resignation!`
  }
  
  winningModal.classList.remove('hidden')
}

function hideWinningPopup() {
  winningModal.classList.add('hidden')
}

// Play Again button: resets the game
playAgainBtn.addEventListener('click', function() {
  hideWinningPopup()
  game.reset()
  board.start()
  resetTimer()
  timerContainer.classList.remove('hidden')
  startTimer()
  updateStatus()
})

// Close button: just closes the pop up
closePopupBtn.addEventListener('click', function() {
  hideWinningPopup()
})

// Export for other modules if needed
export { game, board, updateStatus }