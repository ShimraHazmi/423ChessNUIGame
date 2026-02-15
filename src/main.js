import { startListening } from "./speech.js";

document.getElementById("start").onclick = () => {
  startListening();
};