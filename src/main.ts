import "./style.css";

interface DisplayCommand {
  display(ctx: CanvasRenderingContext2D): void;
  drag?(x: number, y: number): void;
}

// A marker line command: holds its own geometry and knows how to draw itself.
class MarkerStroke implements DisplayCommand {
  private points: { x: number; y: number }[] = [];

  constructor(
    startX: number,
    startY: number,
    private readonly lineWidth: number = 2,
    private readonly strokeStyle: string = "#000000",
    private readonly lineCap: CanvasLineCap = "round",
  ) {
    this.points.push({ x: startX, y: startY });
  }

  drag(x: number, y: number): void {
    this.points.push({ x, y });
  }

  display(ctx: CanvasRenderingContext2D): void {
    if (this.points.length === 0) return;

    ctx.save();

    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = this.lineCap;
    ctx.strokeStyle = this.strokeStyle;

    ctx.beginPath();

    const first = this.points[0];
    ctx.moveTo(first.x, first.y);

    if (this.points.length === 1) {
      ctx.lineTo(first.x + 0.01, first.y + 0.01);
    } else {
      for (let i = 1; i < this.points.length; i++) {
        const p = this.points[i];
        ctx.lineTo(p.x, p.y);
      }
    }

    ctx.stroke();
    ctx.restore();
  }
}

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
  "Draw with the mouse. Choose Thin or Thick marker, then use Clear / Undo / Redo.";
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
buttonRow.style.flexWrap = "wrap";
buttonRow.style.gap = "8px";
buttonRow.style.marginTop = "8px";
appRoot.appendChild(buttonRow);

// Tool buttons (Step 6)
const thinButton = document.createElement("button");
thinButton.textContent = "Thin Marker";

const thickButton = document.createElement("button");
thickButton.textContent = "Thick Marker";

buttonRow.appendChild(thinButton);
buttonRow.appendChild(thickButton);

// Action buttons
const clearButton = document.createElement("button");
clearButton.textContent = "Clear";
buttonRow.appendChild(clearButton);

const undoButton = document.createElement("button");
undoButton.textContent = "Undo";
buttonRow.appendChild(undoButton);

const redoButton = document.createElement("button");
redoButton.textContent = "Redo";
buttonRow.appendChild(redoButton);

//Tool state (thin / thick)

const THIN_WIDTH = 2;
const THICK_WIDTH = 6;

let currentLineWidth = THIN_WIDTH;

// Small helper to update which tool looks selected (inline styling only)
function updateToolSelection() {
  // Reset both
  thinButton.style.fontWeight = "normal";
  thickButton.style.fontWeight = "normal";
  thinButton.style.outline = "none";
  thickButton.style.outline = "none";

  if (currentLineWidth === THIN_WIDTH) {
    thinButton.style.fontWeight = "bold";
    thinButton.style.outline = "2px solid black";
  } else if (currentLineWidth === THICK_WIDTH) {
    thickButton.style.fontWeight = "bold";
    thickButton.style.outline = "2px solid black";
  }
}

// Initial tool selection
updateToolSelection();

thinButton.addEventListener("click", () => {
  currentLineWidth = THIN_WIDTH;
  updateToolSelection();
});

thickButton.addEventListener("click", () => {
  currentLineWidth = THICK_WIDTH;
  updateToolSelection();
});

//Display list and undo/redo stacks (command objects)

const displayList: DisplayCommand[] = [];
const redoStack: DisplayCommand[] = [];

let currentCommand: DisplayCommand | null = null;
let isDrawing = false;

//Redraw logic (observer)

function redrawCanvas() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const command of displayList) {
    command.display(ctx);
  }
}

canvas.addEventListener("drawing-changed", redrawCanvas);

function notifyDrawingChanged() {
  canvas.dispatchEvent(new Event("drawing-changed"));
}

//Mouse interaction

function startDrawing(event: MouseEvent) {
  if (!ctx) return;
  if (event.button !== 0) return; // left mouse only

  isDrawing = true;

  const startX = event.offsetX;
  const startY = event.offsetY;

  const stroke = new MarkerStroke(
    startX,
    startY,
    currentLineWidth,
    "#000000",
    "round",
  );

  currentCommand = stroke;
  displayList.push(stroke);

  redoStack.length = 0;

  notifyDrawingChanged();
}

function continueDrawing(event: MouseEvent) {
  if (!isDrawing || !currentCommand) return;

  const x = event.offsetX;
  const y = event.offsetY;

  if (typeof currentCommand.drag === "function") {
    currentCommand.drag(x, y);
    notifyDrawingChanged();
  }
}

function stopDrawing() {
  isDrawing = false;
  currentCommand = null;
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", continueDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

//Button behaviors

clearButton.addEventListener("click", () => {
  displayList.length = 0;
  redoStack.length = 0;
  currentCommand = null;
  notifyDrawingChanged();
});

undoButton.addEventListener("click", () => {
  if (displayList.length === 0) return;

  const popped = displayList.pop();
  if (!popped) return;

  redoStack.push(popped);
  currentCommand = null;
  notifyDrawingChanged();
});

redoButton.addEventListener("click", () => {
  if (redoStack.length === 0) return;

  const restored = redoStack.pop();
  if (!restored) return;

  displayList.push(restored);
  currentCommand = null;
  notifyDrawingChanged();
});
