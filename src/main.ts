import "./style.css";

interface Point {
  x: number;
  y: number;
}

type Stroke = Point[];

//App setup

const appRoot = (document.querySelector("#app") as HTMLElement | null) ??
  document.body;

// Clear any previous content
appRoot.innerHTML = "";

// Title
const title = document.createElement("h1");
title.textContent = "Quaint Paint Sketchpad";
appRoot.appendChild(title);

// Subtitle
const subtitle = document.createElement("p");
subtitle.textContent =
  "Click and drag on the canvas to draw. Use Clear to wipe everything.";
appRoot.appendChild(subtitle);

// Canvas (256 x 256)
const canvas = document.createElement("canvas");
canvas.id = "sketchCanvas";
canvas.width = 256;
canvas.height = 256;
appRoot.appendChild(canvas);

// 2D context
const ctx = canvas.getContext("2d");

if (!ctx) {
  const errorMsg = document.createElement("p");
  errorMsg.textContent = "Error: unable to get 2D context for canvas.";
  errorMsg.style.color = "red";
  appRoot.appendChild(errorMsg);
}

// Clear button
const clearButton = document.createElement("button");
clearButton.textContent = "Clear";
appRoot.appendChild(clearButton);

const strokes: Stroke[] = [];

let currentStroke: Stroke | null = null;

let isDrawing = false;

//Redraw logic

function redrawCanvas() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#000000";

  for (const stroke of strokes) {
    if (stroke.length < 2) {
      const single = stroke[0];
      ctx.beginPath();
      ctx.moveTo(single.x, single.y);
      ctx.lineTo(single.x + 0.01, single.y + 0.01); // tiny line as a dot
      ctx.stroke();
      continue;
    }

    ctx.beginPath();
    const first = stroke[0];
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < stroke.length; i++) {
      const pt = stroke[i];
      ctx.lineTo(pt.x, pt.y);
    }

    ctx.stroke();
  }
}

canvas.addEventListener("drawing-changed", () => {
  redrawCanvas();
});

function notifyDrawingChanged() {
  const event = new Event("drawing-changed");
  canvas.dispatchEvent(event);
}

function getMousePoint(event: MouseEvent): Point {
  return {
    x: event.offsetX,
    y: event.offsetY,
  };
}

function startDrawing(event: MouseEvent) {
  if (!ctx) return;
  if (event.button !== 0) return;

  isDrawing = true;

  const startPoint = getMousePoint(event);

  currentStroke = [startPoint];
  strokes.push(currentStroke);

  notifyDrawingChanged();
}

function continueDrawing(event: MouseEvent) {
  if (!ctx) return;
  if (!isDrawing || !currentStroke) return;

  const newPoint = getMousePoint(event);
  currentStroke.push(newPoint);

  notifyDrawingChanged();
}

function stopDrawing() {
  isDrawing = false;
  currentStroke = null;
}

clearButton.addEventListener("click", () => {
  // Empty the display list
  strokes.length = 0;
  currentStroke = null;
  notifyDrawingChanged();
});

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", continueDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);
