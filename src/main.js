// import { startListening } from "./speech.js";

import "./speech.js";

var board2 = Chessboard('board', {
  draggable: true,
  dropOffBoard: 'trash',
  sparePieces: true,
  pieceTheme: './src/chessboardjs-1.0.0/img/chesspieces/wikipedia/{piece}.png'
})

$('.start-btn').on('click', board2.start)
$('.clear-btn').on('click', board2.clear)