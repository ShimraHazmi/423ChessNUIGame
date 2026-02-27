// Import speech module and register voice commands
import { onVoiceCommand } from "./speech.js";

// chess.js game instance (loaded from CDN as global)
var board = null
var game = new Chess()
var $status = $('#speechOutput')  // Using your existing speechOutput div
var $fen = $('#fen')
var $pgn = $('#pgn')

// --- timer state ---
let whiteSeconds = 0
let blackSeconds = 0
let activeColor = 'white'
let timerInterval = null
let isPaused = false

const timerContainer = document.getElementById('timerContainer')
const whiteTimerEl = document.getElementById('whiteTimer')
const blackTimerEl = document.getElementById('blackTimer')
const timerStatusEl = document.getElementById('timerStatus')

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function updateTimerDisplay() {
  whiteTimerEl.textContent = formatTime(whiteSeconds)
  blackTimerEl.textContent = formatTime(blackSeconds)
  whiteTimerEl.classList.toggle('active-timer', activeColor === 'white' && !isPaused)
  blackTimerEl.classList.toggle('active-timer', activeColor === 'black' && !isPaused)
}

function tickTimer() {
  if (activeColor === 'white') whiteSeconds++
  else blackSeconds++
  updateTimerDisplay()
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval)
  isPaused = false
  timerInterval = setInterval(tickTimer, 1000)
  timerStatusEl.textContent = 'Game in progress'
  timerStatusEl.classList.remove('paused')
  updateTimerDisplay()
}

function pauseTimer() {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  isPaused = true
  timerStatusEl.textContent = '⏸ Paused'
  timerStatusEl.classList.add('paused')
  updateTimerDisplay()
}

function resumeTimer() {
  if (isPaused) {
    isPaused = false
    timerInterval = setInterval(tickTimer, 1000)
    timerStatusEl.textContent = 'Game in progress'
    timerStatusEl.classList.remove('paused')
    updateTimerDisplay()
  }
}

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

function onDragStart (source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for the side to move
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }
}

function onDrop (source, target) {
  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
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
  }

  // draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position'
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
  // Optionally display FEN and PGN if you add those divs to your HTML
  // $fen.html(game.fen())
  // $pgn.html(game.pgn())
}

var config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  pieceTheme: './src/chessboardjs-1.0.0/img/chesspieces/wikipedia/{piece}.png'  // Your piece theme
}
board = Chessboard('board', config)  // 'board' matches your HTML div id

updateStatus()

// Wire up your Start and Clear buttons
$('.start-btn').on('click', function() {
  game.reset()
  board.start()
  resetTimer()
  timerContainer.classList.remove('hidden')
  startTimer()
  updateStatus()
})

$('.clear-btn').on('click', function() {
  game.clear()
  board.clear()
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  timerContainer.classList.add('hidden')
  $status.html('Board cleared')
})

// wire up voice commands
onVoiceCommand('start', function() {
  game.reset()
  board.start()
  resetTimer()
  timerContainer.classList.remove('hidden')
  startTimer()
  updateStatus()
})

onVoiceCommand('clear', function() {
  game.clear()
  board.clear()
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = null
  timerContainer.classList.add('hidden')
})

onVoiceCommand('pause', pauseTimer)
onVoiceCommand('resume', resumeTimer)

onVoiceCommand('reset', function() {
  game.reset()
  board.start()
  resetTimer()
  timerContainer.classList.remove('hidden')
  startTimer()
  updateStatus()
})

// Menu button functionality
const menuBtn = document.getElementById('menuBtn')
const menuPopup = document.getElementById('menuPopup')
const pauseMenuBtn = document.getElementById('pauseMenuBtn')
const resumeMenuBtn = document.getElementById('resumeMenuBtn')
const resetMenuBtn = document.getElementById('resetMenuBtn')

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

// Export for other modules if needed
export { game, board, updateStatus }