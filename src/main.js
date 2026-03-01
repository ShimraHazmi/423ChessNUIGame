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
//I will fix it later surely, just overlay the analysis bar and stuffs. Yep. Do it surely.
function getHint() {
    console.log('getHint() called');
    
    if (game.game_over()) {
        $status.html('Game is over');
        return;
    }
    
    $status.html('Thinking...');
    $status.css('color', '#667eea');

    setTimeout(() => {
        const possibleMoves = game.moves({ verbose: true });
        
        if (possibleMoves.length === 0) {
            $status.html('No moves available');
            return;
        }
        

        let bestMove = null;
        

        for (let move of possibleMoves) {
            if (move.captured) {
                bestMove = move;
                break;
            }
        }
        

        if (!bestMove) {
            const centerSquares = ['e4', 'd4', 'e5', 'd5'];
            for (let move of possibleMoves) {
                if (centerSquares.includes(move.to)) {
                    bestMove = move;
                    break;
                }
            }
        }
        

        if (!bestMove) {
            bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        }
        
        displayHint(bestMove.from + bestMove.to);
    }, 500);
}

function displayHint(move) {
    const from = move.substring(0, 2);
    const to = move.substring(2, 4);
    
    const moveColor = game.turn() === 'w' ? 'White' : 'Black';
    const hint = `💡 Hint for ${moveColor}: Try moving from ${from} to ${to}`;
    
    $status.html(hint);
    $status.css('color', '#007bff');
    
    highlightHintSquares(from, to);
    
    setTimeout(() => {
        updateStatus();
        $('.square-55d63').removeClass('hint-from hint-to');
        $status.css('color', '#333');
    }, 5000);
}

function highlightHintSquares(from, to) {
    $('.square-55d63').removeClass('hint-from hint-to');
    $('.square-' + from).addClass('hint-from');
    $('.square-' + to).addClass('hint-to');
}
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

// Open main menu on voice command
onVoiceCommand('menu', function() {
  menuPopup.classList.remove('hidden')
})

onVoiceCommand('settings', function() {
  menuPopup.classList.remove('hidden')
})

onVoiceCommand('reset', function() {
  game.reset()
  board.start()
  resetTimer()
  timerContainer.classList.remove('hidden')
  startTimer()
  updateStatus()
})

// Handle chess moves from voice commands
onVoiceCommand('wow', function() {
  if (game.game_over()) {
    $status.html('No game in progress.')
    $status.css('color', '#dc3545')
    return
  }
  getHint()
})
onVoiceCommand('move', function(moveData, transcript) {
  // Check if game is over
  if (game.game_over()) {
    $status.html('Game over! Cannot make moves.')
    $status.css('color', '#dc3545')
    setTimeout(() => $status.css('color', '#333'), 3000)
    return
  }

  let move = null

  // Try to make the move based on what was parsed
  if (moveData.from && moveData.to) {
    // Direct move: e2 to e4
    move = game.move({
      from: moveData.from,
      to: moveData.to,
      promotion: 'q' // auto-promote to queen
    })
  } else if (moveData.piece && moveData.to) {
    // Piece-based move: knight to f3
    // Get all legal moves for the current player
    const moves = game.moves({ verbose: true })
    const targetSquare = moveData.to
    
    // Find matching move for the specified piece type
    const matchingMoves = moves.filter(m => 
      m.piece === moveData.piece && m.to === targetSquare
    )
    
    if (matchingMoves.length === 1) {
      // Unambiguous move
      move = game.move({
        from: matchingMoves[0].from,
        to: matchingMoves[0].to,
        promotion: 'q'
      })
    } else if (matchingMoves.length > 1) {
      $status.html(`Ambiguous move! Multiple ${moveData.piece} pieces can move to ${targetSquare}. Please specify the starting square.`)
      $status.css('color', '#ffa500')
      setTimeout(() => $status.css('color', '#333'), 4000)
      return
    }
  }

  if (move) {
    // Valid move executed
    board.position(game.fen())
    switchClock()
    updateStatus()
    $status.css('color', '#28a745')
    setTimeout(() => $status.css('color', '#333'), 2000)
  } else {
    // Invalid move
    $status.html(`Illegal move: "${transcript}" - Try again!`)
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