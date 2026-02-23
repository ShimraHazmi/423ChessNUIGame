import { startListening } from "./speech.js";

document.getElementById("start").onclick = () => {
  startListening();
};

var board2 = Chessboard('board2', {
  draggable: true,
  dropOffBoard: 'trash',
  sparePieces: true,
  pieceTheme: './src/chessboardjs-1.0.0/img/chesspieces/wikipedia/{piece}.png'
})

$('#startBtn').on('click', board2.start)
$('#clearBtn').on('click', board2.clear)