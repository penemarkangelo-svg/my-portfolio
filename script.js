const canvas = document.getElementById("binaryCanvas");
const ctx = canvas.getContext("2d");

const CONFIG = {
  cursorLabel: "Hello, World",
  cellX: 6,
  cellY: 8,
  fontSize: 9,
  lensRadius: 95
};

const MONO = 'ui-monospace, SFMono-Regular, Consolas, monospace';

const RAMP = [
  { min: 0.78, chars: "@@0O" },
  { min: 0.58, chars: "0O@o" },
  { min: 0.38, chars: "o0.0" },
  { min: 0.18, chars: ".o.0" },
  { min: 0.00, chars: "..." }
];

const portrait = new Image();
portrait.src = "assets/portrait.png";

let width = 0;
let height = 0;
let frame = null;
let photoCanvas;
let glyphs = [];

const pointer = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  active: false,
  fade: 0
};


/* =========================================
   PORTRAIT POSITIONING
========================================= */

function fitPortrait() {

  const scale = Math.min(
    width * 0.88 / portrait.naturalWidth,
    height * 0.96 / portrait.naturalHeight
  );

  const drawWidth = portrait.naturalWidth * scale;
  const drawHeight = portrait.naturalHeight * scale;

  return {
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    w: drawWidth,
    h: drawHeight
  };
}


/* =========================================
   CANVAS RESIZING
========================================= */

function resizeCanvas() {

  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  width = Math.max(1, Math.floor(rect.width));
  height = Math.max(1, Math.floor(rect.height));

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (portrait.complete && portrait.naturalWidth) {
    buildPortrait();
  }
}


/* =========================================
   CHARACTER GENERATOR
========================================= */

function pickChar(d) {

  const step = RAMP.find(r => d >= r.min);

  const chars = step.chars;

  return chars[Math.floor(Math.random() * chars.length)];
}


/* =========================================
   CONVERT PHOTO INTO ASCII PORTRAIT
========================================= */

function buildPortrait() {

  const p = fitPortrait();

  photoCanvas = document.createElement("canvas");

  photoCanvas.width = width;
  photoCanvas.height = height;

  const photoCtx = photoCanvas.getContext("2d", {
    willReadFrequently: true
  });

  photoCtx.drawImage(
    portrait,
    p.x,
    p.y,
    p.w,
    p.h
  );

  const pixels = photoCtx.getImageData(
    0,
    0,
    width,
    height
  ).data;

  const samples = [];

  for (let y = 3; y < height; y += CONFIG.cellY) {

    for (let x = 3; x < width; x += CONFIG.cellX) {

      const i = (y * width + x) * 4;

      const alpha = pixels[i + 3] / 255;

      if (alpha < 0.22) continue;

      const brightness = (
        pixels[i] * 0.299 +
        pixels[i + 1] * 0.587 +
        pixels[i + 2] * 0.114
      ) / 255;

      samples.push({
        x,
        y,
        raw: 1 - brightness
      });

    }
  }

  glyphs = [];

  if (!samples.length) return;

  const sorted = samples
    .map(s => s.raw)
    .sort((a, b) => a - b);

  const lo = sorted[Math.floor(sorted.length * 0.04)];
  const hi = sorted[Math.floor(sorted.length * 0.96)];

  const span = Math.max(0.05, hi - lo);

  for (const s of samples) {

    const d = Math.min(
      1,
      Math.max(0, (s.raw - lo) / span)
    );

    if (d < 0.08 && Math.random() > 0.15) {
      continue;
    }

    glyphs.push({
      x: s.x,
      y: s.y,
      d,
      char: pickChar(d),
      phase: Math.random() * Math.PI * 2
    });

  }
}


/* =========================================
   INTERACTIVE CURSOR PILL
========================================= */

function drawCursorPill() {

  if (pointer.fade < 0.02) return;

  const label = CONFIG.cursorLabel;
  const h = 36;

  ctx.save();

  ctx.font = '500 13px "DM Sans", Arial, sans-serif';

  const w = ctx.measureText(label).width + 36;

  const x = Math.min(
    Math.max(pointer.x - w / 2, 8),
    width - w - 8
  );

  const y = Math.min(
    Math.max(pointer.y - h / 2, 8),
    height - h - 8
  );

  const scale = 0.85 + 0.15 * pointer.fade;

  ctx.globalAlpha = pointer.fade;

  ctx.translate(
    x + w / 2,
    y + h / 2
  );

  ctx.scale(scale, scale);

  ctx.shadowColor = "rgba(0, 0, 0, 0.16)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;

  ctx.fillStyle = "#fff";

  ctx.beginPath();

  if (ctx.roundRect) {
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
  } else {
    ctx.rect(-w / 2, -h / 2, w, h);
  }

  ctx.fill();

  ctx.shadowColor = "transparent";

  ctx.fillStyle = "#171717";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(label, 0, 1);

  ctx.restore();
}


/* =========================================
   MAIN ANIMATION
========================================= */

function render(time = 0) {

  ctx.clearRect(0, 0, width, height);

  if (pointer.active) {

    pointer.x += (
      pointer.targetX - pointer.x
    ) * 0.2;

    pointer.y += (
      pointer.targetY - pointer.y
    ) * 0.2;

  }

  pointer.fade += (
    (pointer.active ? 1 : 0) - pointer.fade
  ) * 0.18;

  const baseFont = `${CONFIG.fontSize}px ${MONO}`;

  let currentFont = baseFont;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#121212";
  ctx.font = baseFont;

  for (const g of glyphs) {

    let near = 0;

    if (pointer.fade > 0.01) {

      const dist = Math.hypot(
        g.x - pointer.x,
        g.y - pointer.y
      );

      near = Math.max(
        0,
        1 - dist / CONFIG.lensRadius
      ) * pointer.fade;

    }

    const shimmer = 0.06 * Math.sin(
      time * 0.0015 + g.phase
    );

    ctx.globalAlpha = Math.min(
      1,
      0.22 + g.d * 0.62 + near * 0.3 + shimmer
    );

    const font = near > 0.04
      ? `${(CONFIG.fontSize + near * 5).toFixed(1)}px ${MONO}`
      : baseFont;

    if (font !== currentFont) {
      ctx.font = font;
      currentFont = font;
    }

    ctx.fillText(g.char, g.x, g.y);

  }

  ctx.globalAlpha = 1;

  drawCursorPill();

  frame = requestAnimationFrame(render);
}


/* =========================================
   POINTER INTERACTION
========================================= */

function setPointer(clientX, clientY) {

  const rect = canvas.getBoundingClientRect();

  pointer.targetX = clientX - rect.left;
  pointer.targetY = clientY - rect.top;

  if (!pointer.active) {

    pointer.x = pointer.targetX;
    pointer.y = pointer.targetY;

  }

  pointer.active = true;
}

canvas.addEventListener("pointermove", event => {

  setPointer(event.clientX, event.clientY);

});

canvas.addEventListener("pointerleave", () => {

  pointer.active = false;

});

canvas.addEventListener("touchstart", event => {

  if (event.touches[0]) {

    setPointer(
      event.touches[0].clientX,
      event.touches[0].clientY
    );

  }

}, { passive: true });

canvas.addEventListener("touchmove", event => {

  if (event.touches[0]) {

    setPointer(
      event.touches[0].clientX,
      event.touches[0].clientY
    );

  }

}, { passive: true });

canvas.addEventListener("touchend", () => {

  pointer.active = false;

}, { passive: true });


/* =========================================
   IMAGE INITIALIZATION
========================================= */

portrait.onload = () => {

  resizeCanvas();

  if (!frame) {
    render();
  }

};

portrait.onerror = () => {

  console.error(
    "Portrait image not found. Check assets/portrait.png"
  );

};


/* =========================================
   WINDOW RESIZE
========================================= */

let resizeTimer;

window.addEventListener("resize", () => {

  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    resizeCanvas();
  }, 120);

});


/* =========================================
   MOBILE NAVIGATION
========================================= */

const toggle = document.getElementById("menuToggle");
const nav = document.getElementById("nav");

toggle.addEventListener("click", () => {

  nav.classList.toggle("open");

});

nav.querySelectorAll("a").forEach(link => {

  link.addEventListener("click", () => {

    nav.classList.remove("open");

  });

});


/* =========================================
   FOOTER YEAR
========================================= */

document.getElementById("year").textContent =
  new Date().getFullYear();