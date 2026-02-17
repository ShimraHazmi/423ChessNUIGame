import { startListening } from "./speech.js";

document.getElementById("start").onclick = () => {
  startListening();
};

var board1 = Chessboard('board1', 'start');

var board1 = Chessboard('board1', {
  position: 'start',
  pieceTheme: './src/chessboardjs-1.0.0/img/chesspieces/wikipedia/{piece}.png'
});