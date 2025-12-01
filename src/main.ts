import "./style.css";

const appRoot = (document.querySelector("#app") as HTMLElement | null) ??
  document.body;

appRoot.innerHTML = "";

//Title

const title = document.createElement("h1");
title.textContent = "Quaint Paint Sketchpad";
appRoot.appendChild(title);

// Optional subtitle
const subtitle = document.createElement("p");
subtitle.textContent =
  "Click and drag on the canvas to draw. Use the Clear button to wipe it.";
appRoot.appendChild(subtitle);

//Canvas (256 x 256)

const canvas = document.createElement("canvas");
canvas.id = "sketchCanvas";
canvas.width = 256;
canvas.height = 256;
appRoot.appendChild(canvas);

const ctx = canvas.getContext("2d");

if (!ctx) {
  const errorMsg = document.createElement("p");
  errorMsg.textContent = "Error: unable to get 2D context for canvas.";
  errorMsg.style.color = "red";
  appRoot.appendChild(errorMsg);
} else {
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#000000";
}

//Clear button

const clearButton = document.createElement("button");
clearButton.textContent = "Clear";
appRoot.appendChild(clearButton);

//Wire up clear behavior
clearButton.addEventListener("click", () => {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

//Simple marker drawing

let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Helper to start drawing
function startDrawing(event: MouseEvent) {
  if (!ctx) return;

  if (event.button !== 0) return;

  isDrawing = true;
  lastX = event.offsetX;
  lastY = event.offsetY;
}

function draw(event: MouseEvent) {
  if (!ctx || !isDrawing) return;

  const x = event.offsetX;
  const y = event.offsetY;

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();

  lastX = x;
  lastY = y;
}

function stopDrawing() {
  isDrawing = false;
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);
