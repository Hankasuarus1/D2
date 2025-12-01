import "./style.css";

interface Point {
  x: number;
  y: number;
}

type Stroke = Point[];

//App setup

const appRoot = (document.querySelector("#app") as HTMLElement | null) ??
  document.body;

appRoot.innerHTML = "";

//Title
const title = document.createElement("h1");
title.textContent = "Quaint Paint Sketchpad";
appRoot.appendChild(title);

//Subtitle
const subtitle = document.createElement("p");
subtitle.textContent =
  "Draw with the mouse. Use Clear, Undo, Redo to manage your sketch.";
appRoot.appendChild(subtitle);

//Canvas
const canvas = document.createElement("canvas");
canvas.id = "sketchCanvas";
canvas.width = 256;
canvas.height = 256;
appRoot.appendChild(canvas);

const ctx = canvas.getContext("2d");
if (!ctx) {
  const e = document.createElement("p");
  e.textContent = "Could not create canvas context.";
  e.style.color = "red";
  appRoot.appendChild(e);
}

//Buttons

const buttonRow = document.createElement("div");
buttonRow.style.display = "flex";
buttonRow.style.gap = "8px";
buttonRow.style.marginTop = "8px";
appRoot.appendChild(buttonRow);

const clearButton = document.createElement("button");
clearButton.textContent = "Clear";
buttonRow.appendChild(clearButton);

const undoButton = document.createElement("button");
undoButton.textContent = "Undo";
buttonRow.appendChild(undoButton);

const redoButton = document.createElement("button");
redoButton.textContent = "Redo";
buttonRow.appendChild(redoButton);

//Display list and undo/redo stacks

const strokes: Stroke[] = [];
const redoStack: Stroke[] = [];
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
    if (stroke.length === 1) {
      const p = stroke[0];
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);

    for (let i = 1; i < stroke.length; i++) {
      const pt = stroke[i];
      ctx.lineTo(pt.x, pt.y);
    }

    ctx.stroke();
  }
}

canvas.addEventListener("drawing-changed", redrawCanvas);

function notifyDrawingChanged() {
  canvas.dispatchEvent(new Event("drawing-changed"));
}

//Mouse interaction

function getPoint(event: MouseEvent): Point {
  return { x: event.offsetX, y: event.offsetY };
}

function startDrawing(event: MouseEvent) {
  if (!ctx) return;
  if (event.button !== 0) return;

  isDrawing = true;

  const p = getPoint(event);

  currentStroke = [p];
  strokes.push(currentStroke);

  redoStack.length = 0;

  notifyDrawingChanged();
}

function continueDrawing(event: MouseEvent) {
  if (!isDrawing || !currentStroke) return;

  const p = getPoint(event);
  currentStroke.push(p);

  notifyDrawingChanged();
}

function stopDrawing() {
  isDrawing = false;
  currentStroke = null;
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", continueDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

//Clear button

clearButton.addEventListener("click", () => {
  strokes.length = 0;
  redoStack.length = 0;
  currentStroke = null;
  notifyDrawingChanged();
});

//Undo button

undoButton.addEventListener("click", () => {
  if (strokes.length === 0) return;

  const popped = strokes.pop();
  if (popped) {
    redoStack.push(popped);
    currentStroke = null;
    notifyDrawingChanged();
  }
});

//Redo button

redoButton.addEventListener("click", () => {
  if (redoStack.length === 0) return;

  const restored = redoStack.pop();
  if (restored) {
    strokes.push(restored);
    currentStroke = null;
    notifyDrawingChanged();
  }
});
