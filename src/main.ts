import "./style.css";

const appRoot = (document.querySelector("#app") as HTMLElement | null) ??
  document.body;

appRoot.innerHTML = "";

const title = document.createElement("h1");
title.textContent = "Sketchpad";
appRoot.appendChild(title);

const subtitle = document.createElement("p");
subtitle.textContent = "Use the canvas below as your sketchpad";
appRoot.appendChild(subtitle);

const canvas = document.createElement("canvas");
canvas.id = "sketchCanvas";
canvas.width = 256;
canvas.height = 256;
appRoot.appendChild(canvas);
