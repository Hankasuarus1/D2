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
      // Single click: draw a tiny line so it shows up
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

// Tool preview for markers: circle showing marker size at the mouse position.
class MarkerPreview implements DisplayCommand {
  private x: number;
  private y: number;

  constructor(private readonly getLineWidth: () => number) {
    this.x = 0;
    this.y = 0;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  display(ctx: CanvasRenderingContext2D): void {
    const radius = this.getLineWidth() * 2; // bigger so it's easy to see

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);

    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}

// Sticker preview command: shows where the sticker will be placed.
class StickerPreview implements DisplayCommand {
  private x: number;
  private y: number;

  constructor(
    private readonly getEmoji: () => string | null,
    private readonly size: number = 32,
  ) {
    this.x = 0;
    this.y = 0;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  display(ctx: CanvasRenderingContext2D): void {
    const emoji = this.getEmoji();
    if (!emoji) return;

    ctx.save();
    ctx.font = `${this.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.8;
    ctx.fillText(emoji, this.x, this.y);
    ctx.restore();
  }
}

// Sticker command: an actual placed sticker in the drawing.
class StickerStamp implements DisplayCommand {
  constructor(
    private emoji: string,
    private x: number,
    private y: number,
    private readonly size: number = 32,
  ) {}

  drag(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = `${this.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 1.0;
    ctx.fillText(this.emoji, this.x, this.y);
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
  "Draw with markers or place stickers. Use Clear / Undo / Redo.";
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

// Tool buttons (markers)
const thinButton = document.createElement("button");
thinButton.textContent = "Thin Marker";

const thickButton = document.createElement("button");
thickButton.textContent = "Thick Marker";

buttonRow.appendChild(thinButton);
buttonRow.appendChild(thickButton);

//Sticker buttons
const stickerEmojis = ["⭐", "🔥", "🐱"];
const stickerButtons: HTMLButtonElement[] = [];

for (const emoji of stickerEmojis) {
  const btn = document.createElement("button");
  btn.textContent = emoji;
  stickerButtons.push(btn);
  buttonRow.appendChild(btn);
}

//Action buttons
const clearButton = document.createElement("button");
clearButton.textContent = "Clear";
buttonRow.appendChild(clearButton);

const undoButton = document.createElement("button");
undoButton.textContent = "Undo";
buttonRow.appendChild(undoButton);

const redoButton = document.createElement("button");
redoButton.textContent = "Redo";
buttonRow.appendChild(redoButton);

//Tool state (markers vs stickers)

type ToolKind = "marker" | "sticker";

const THIN_WIDTH = 2;
const THICK_WIDTH = 6;

let currentLineWidth = THIN_WIDTH;
let activeTool: ToolKind = "marker";
let activeSticker: string | null = null;

let lastToolX = canvas.width / 2;
let lastToolY = canvas.height / 2;

function updateToolSelection() {
  thinButton.style.fontWeight = "normal";
  thickButton.style.fontWeight = "normal";
  thinButton.style.outline = "none";
  thickButton.style.outline = "none";
  for (const btn of stickerButtons) {
    btn.style.fontWeight = "normal";
    btn.style.outline = "none";
  }

  if (activeTool === "marker") {
    if (currentLineWidth === THIN_WIDTH) {
      thinButton.style.fontWeight = "bold";
      thinButton.style.outline = "2px solid black";
    } else if (currentLineWidth === THICK_WIDTH) {
      thickButton.style.fontWeight = "bold";
      thickButton.style.outline = "2px solid black";
    }
  } else if (activeTool === "sticker" && activeSticker) {
    for (const btn of stickerButtons) {
      if (btn.textContent === activeSticker) {
        btn.style.fontWeight = "bold";
        btn.style.outline = "2px solid black";
      }
    }
  }
}

updateToolSelection();

thinButton.addEventListener("click", () => {
  activeTool = "marker";
  activeSticker = null;
  currentLineWidth = THIN_WIDTH;
  updateToolSelection();
  notifyToolMoved(lastToolX, lastToolY);
});

thickButton.addEventListener("click", () => {
  activeTool = "marker";
  activeSticker = null;
  currentLineWidth = THICK_WIDTH;
  updateToolSelection();
  notifyToolMoved(lastToolX, lastToolY);
});

for (const btn of stickerButtons) {
  btn.addEventListener("click", () => {
    activeTool = "sticker";
    activeSticker = btn.textContent ?? null;
    updateToolSelection();

    // Step 8 requirement: fire "tool-moved" when a sticker button is clicked
    notifyToolMoved(lastToolX, lastToolY);
  });
}

//Display list, undo/redo, and preview

const displayList: DisplayCommand[] = [];
const redoStack: DisplayCommand[] = [];

let currentCommand: DisplayCommand | null = null;
let isDrawing = false;

// Preview command: can be MarkerPreview or StickerPreview
let previewCommand: DisplayCommand | null = null;

//Redraw logic

function redrawCanvas() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const command of displayList) {
    command.display(ctx);
  }

  if (!isDrawing && previewCommand) {
    previewCommand.display(ctx);
  }
}

canvas.addEventListener("drawing-changed", redrawCanvas);

function notifyDrawingChanged() {
  canvas.dispatchEvent(new Event("drawing-changed"));
}

//tool-moved event support

type ToolMovedDetail = { x: number; y: number };

function notifyToolMoved(x: number, y: number) {
  lastToolX = x;
  lastToolY = y;

  const event = new CustomEvent<ToolMovedDetail>("tool-moved", {
    detail: { x, y },
  });
  canvas.dispatchEvent(event);
}

canvas.addEventListener("tool-moved", (event) => {
  const customEvent = event as CustomEvent<ToolMovedDetail>;
  const { x, y } = customEvent.detail;

  if (!ctx) return;

  if (activeTool === "marker") {
    if (!(previewCommand instanceof MarkerPreview)) {
      previewCommand = new MarkerPreview(() => currentLineWidth);
    }
    (previewCommand as MarkerPreview).setPosition(x, y);
  } else if (activeTool === "sticker" && activeSticker) {
    if (!(previewCommand instanceof StickerPreview)) {
      previewCommand = new StickerPreview(() => activeSticker, 32);
    }
    (previewCommand as StickerPreview).setPosition(x, y);
  } else {
    previewCommand = null;
  }

  notifyDrawingChanged();
});

//Mouse interaction

function startDrawing(event: MouseEvent) {
  if (!ctx) return;
  if (event.button !== 0) return; // left mouse only

  isDrawing = true;

  const startX = event.offsetX;
  const startY = event.offsetY;

  let command: DisplayCommand | null = null;

  if (activeTool === "marker") {
    // Use currentLineWidth for the new stroke
    command = new MarkerStroke(
      startX,
      startY,
      currentLineWidth,
      "#000000",
      "round",
    );
  } else if (activeTool === "sticker" && activeSticker) {
    command = new StickerStamp(activeSticker, startX, startY, 32);
  }

  if (!command) return;

  currentCommand = command;
  displayList.push(command);

  redoStack.length = 0;

  notifyDrawingChanged();
}

function continueDrawing(event: MouseEvent) {
  if (!currentCommand) return;

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
  notifyDrawingChanged();
}

canvas.addEventListener("mousedown", (event) => {
  isDrawing = true;
  startDrawing(event);
});

canvas.addEventListener("mousemove", (event) => {
  if (isDrawing && currentCommand) {
    continueDrawing(event);
  }
  notifyToolMoved(event.offsetX, event.offsetY);
});

canvas.addEventListener("mouseup", () => {
  stopDrawing();
});

canvas.addEventListener("mouseleave", () => {
  isDrawing = false;
  currentCommand = null;
  previewCommand = null;
  notifyDrawingChanged();
});

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
