// main.ts
import "./style.css";

// ---- Interfaces / command types ----

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

  constructor(
    private readonly getLineWidth: () => number,
    private readonly getStrokeStyle: () => string,
  ) {
    this.x = 0;
    this.y = 0;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  display(ctx: CanvasRenderingContext2D): void {
    const radius = this.getLineWidth(); // tuned to feel closer to actual stroke
    const color = this.getStrokeStyle();

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);

    // Light neutral fill + colored outline
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
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
    private readonly size: number = 48, // tuned bigger
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
    private readonly size: number = 48, // tuned bigger
  ) {}

  drag(x: number, y: number): void {
    // For stickers, drag just repositions instead of leaving a trail.
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

// ---- App setup ----

const appRoot = (document.querySelector("#app") as HTMLElement | null) ??
  document.body;

appRoot.innerHTML = "";

// Center the whole app in the viewport
appRoot.style.minHeight = "100vh";
appRoot.style.display = "flex";
appRoot.style.flexDirection = "column";
appRoot.style.alignItems = "center";
appRoot.style.justifyContent = "center";
appRoot.style.gap = "12px";

// Title
const title = document.createElement("h1");
title.textContent = "Quaint Paint Sketchpad";
appRoot.appendChild(title);

// Subtitle (tuned text)
const subtitle = document.createElement("p");
subtitle.textContent =
  "Sketch, doodle, and decorate with markers and stickers. Use Clear / Undo / Redo / Export to control your masterpiece.";
appRoot.appendChild(subtitle);

// Canvas
const canvas = document.createElement("canvas");
canvas.id = "sketchCanvas";

// Make the canvas bigger & give it a clear border/visual
canvas.width = 512;
canvas.height = 512;
canvas.style.border = "2px solid black";
canvas.style.background = "white";
canvas.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
canvas.style.borderRadius = "8px";

appRoot.appendChild(canvas);

const ctx = canvas.getContext("2d");
if (!ctx) {
  const e = document.createElement("p");
  e.textContent = "Could not create canvas context.";
  e.style.color = "red";
  appRoot.appendChild(e);
}

// ---- Buttons ----

const buttonRow = document.createElement("div");
buttonRow.style.display = "flex";
buttonRow.style.flexWrap = "wrap";
buttonRow.style.gap = "8px";
buttonRow.style.marginTop = "12px";
buttonRow.style.justifyContent = "center"; // center buttons under canvas
appRoot.appendChild(buttonRow);

// Tool buttons (markers)
const thinButton = document.createElement("button");
thinButton.textContent = "Thin Marker";

const thickButton = document.createElement("button");
thickButton.textContent = "Thick Marker";

buttonRow.appendChild(thinButton);
buttonRow.appendChild(thickButton);

// Sticker buttons (data-driven + custom)
type StickerConfig = { emoji: string };

const stickerConfigs: StickerConfig[] = [
  { emoji: "⭐" },
  { emoji: "💖" },
  { emoji: "🍕" },
];

const stickerButtons: HTMLButtonElement[] = [];

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

// Export button (Step 10)
const exportButton = document.createElement("button");
exportButton.textContent = "Export PNG";
buttonRow.appendChild(exportButton);

// Custom sticker button
const customStickerButton = document.createElement("button");
customStickerButton.textContent = "Custom Sticker";
buttonRow.appendChild(customStickerButton);

// ---- Marker color controls (Step 12) ----

const colorRow = document.createElement("div");
colorRow.style.display = "flex";
colorRow.style.alignItems = "center";
colorRow.style.gap = "8px";
colorRow.style.marginTop = "8px";

const colorLabel = document.createElement("span");
colorLabel.textContent = "Marker Hue:";

const colorSlider = document.createElement("input");
colorSlider.type = "range";
colorSlider.min = "0";
colorSlider.max = "360";
colorSlider.value = "0";

const colorSwatch = document.createElement("div");
colorSwatch.style.width = "24px";
colorSwatch.style.height = "24px";
colorSwatch.style.borderRadius = "50%";
colorSwatch.style.border = "1px solid #333";

colorRow.appendChild(colorLabel);
colorRow.appendChild(colorSlider);
colorRow.appendChild(colorSwatch);
appRoot.appendChild(colorRow);

// ---- Tool state (markers vs stickers) ----

type ToolKind = "marker" | "sticker";

// tuned marker widths
const THIN_WIDTH = 4;
const THICK_WIDTH = 10;

let currentLineWidth = THIN_WIDTH;
let activeTool: ToolKind = "marker";
let activeSticker: string | null = null;

// marker hue state (0–360)
let currentHue = 0;

function hueToColor(h: number): string {
  return `hsl(${h}, 80%, 40%)`;
}

function updateColorSwatch() {
  colorSwatch.style.background = hueToColor(currentHue);
}

// initial swatch
updateColorSwatch();

colorSlider.addEventListener("input", () => {
  currentHue = Number(colorSlider.value) || 0;
  updateColorSwatch();
});

// For "fire tool-moved when sticker buttons clicked"
let lastToolX = canvas.width / 2;
let lastToolY = canvas.height / 2;

function updateToolSelection() {
  // reset styles
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

// ---- tool-moved event support ----

type ToolMovedDetail = { x: number; y: number };

function notifyToolMoved(x: number, y: number) {
  lastToolX = x;
  lastToolY = y;

  const event = new CustomEvent<ToolMovedDetail>("tool-moved", {
    detail: { x, y },
  });
  canvas.dispatchEvent(event);
}

// ---- Sticker button creation (data-driven) ----

function createStickerButton(config: StickerConfig) {
  const btn = document.createElement("button");
  btn.textContent = config.emoji;
  stickerButtons.push(btn);
  // Insert before Clear to keep stickers grouped near tools
  buttonRow.insertBefore(btn, clearButton);

  btn.addEventListener("click", () => {
    activeTool = "sticker";
    activeSticker = config.emoji;
    updateToolSelection();

    // Fire "tool-moved" when a sticker button is clicked
    notifyToolMoved(lastToolX, lastToolY);
  });
}

// Initialize sticker buttons from data array
for (const cfg of stickerConfigs) {
  createStickerButton(cfg);
}

// Marker tool button handlers
thinButton.addEventListener("click", () => {
  activeTool = "marker";
  activeSticker = null;
  currentLineWidth = THIN_WIDTH;
  updateToolSelection();
  notifyToolMoved(lastToolX, lastToolY); // refresh preview for marker
});

thickButton.addEventListener("click", () => {
  activeTool = "marker";
  activeSticker = null;
  currentLineWidth = THICK_WIDTH;
  updateToolSelection();
  notifyToolMoved(lastToolX, lastToolY);
});

// Custom sticker handler
customStickerButton.addEventListener("click", () => {
  const text = prompt("Custom sticker text", "🧽");
  if (text === null) return;

  const trimmed = text.trim();
  if (trimmed === "") return;

  const newConfig: StickerConfig = { emoji: trimmed };
  stickerConfigs.push(newConfig);
  createStickerButton(newConfig);

  // Automatically select the new sticker
  activeTool = "sticker";
  activeSticker = trimmed;
  updateToolSelection();

  // Fire tool-moved so preview appears for the new sticker
  notifyToolMoved(lastToolX, lastToolY);
});

// ---- Display list, undo/redo, and preview ----

const displayList: DisplayCommand[] = [];
const redoStack: DisplayCommand[] = [];

let currentCommand: DisplayCommand | null = null;
let isDrawing = false;

// Preview command: can be MarkerPreview or StickerPreview
let previewCommand: DisplayCommand | null = null;

// ---- Redraw logic ----

function redrawCanvas() {
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw permanent commands
  for (const command of displayList) {
    command.display(ctx);
  }

  // Draw preview only if not drawing and preview is active
  if (!isDrawing && previewCommand) {
    previewCommand.display(ctx);
  }
}

canvas.addEventListener("drawing-changed", redrawCanvas);

function notifyDrawingChanged() {
  canvas.dispatchEvent(new Event("drawing-changed"));
}

canvas.addEventListener("tool-moved", (event) => {
  const customEvent = event as CustomEvent<ToolMovedDetail>;
  const { x, y } = customEvent.detail;

  if (!ctx) return;

  if (activeTool === "marker") {
    if (!(previewCommand instanceof MarkerPreview)) {
      previewCommand = new MarkerPreview(
        () => currentLineWidth,
        () => hueToColor(currentHue),
      );
    }
    (previewCommand as MarkerPreview).setPosition(x, y);
  } else if (activeTool === "sticker" && activeSticker) {
    if (!(previewCommand instanceof StickerPreview)) {
      previewCommand = new StickerPreview(() => activeSticker, 48);
    }
    (previewCommand as StickerPreview).setPosition(x, y);
  } else {
    previewCommand = null;
  }

  notifyDrawingChanged();
});

// ---- Mouse interaction ----

function startDrawing(event: MouseEvent) {
  if (!ctx) return;
  if (event.button !== 0) return; // left mouse only

  isDrawing = true;

  const startX = event.offsetX;
  const startY = event.offsetY;

  let command: DisplayCommand | null = null;

  if (activeTool === "marker") {
    command = new MarkerStroke(
      startX,
      startY,
      currentLineWidth,
      hueToColor(currentHue),
      "round",
    );
  } else if (activeTool === "sticker" && activeSticker) {
    command = new StickerStamp(activeSticker, startX, startY, 48);
  }

  if (!command) return;

  currentCommand = command;
  displayList.push(command);

  // New drawing invalidates redo history
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
  // Always notify tool movement when the mouse moves over the canvas
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

// ---- Button behaviors ----

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

// ---- Export button behavior (high-res PNG) ----

exportButton.addEventListener("click", () => {
  // Create an offscreen canvas of size 1024x1024
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = 1024;
  exportCanvas.height = 1024;

  const exportCtx = exportCanvas.getContext("2d");
  if (!exportCtx) {
    console.error("Could not create export canvas context.");
    return;
  }

  // Fill with white background (instead of transparent)
  exportCtx.fillStyle = "white";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // Scale from 512x512 to 1024x1024 => 2x
  exportCtx.save();
  exportCtx.scale(2, 2);

  // Replay all commands onto this new context (no preview)
  for (const command of displayList) {
    command.display(exportCtx);
  }

  exportCtx.restore();

  // Trigger a PNG download
  const anchor = document.createElement("a");
  anchor.href = exportCanvas.toDataURL("image/png");
  anchor.download = "sketchpad.png";
  anchor.click();
});

// Initial tool UI state
updateToolSelection();
