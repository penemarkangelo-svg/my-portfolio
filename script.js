
/* =========================================================
   MARK ANGELO PENE — DIGITAL PORTFOLIO
   High-Detail Binary ASCII Portrait
   Required image: assets/portrait.png
========================================================= */

const canvas = document.getElementById("binaryCanvas");

if (!canvas) {
  console.error('Canvas element #binaryCanvas was not found.');
} else {
  const ctx = canvas.getContext("2d", { alpha: true });


const CONFIG = {
  cursorLabel: "Hello, World",
  lensRadius: 105,

  // Higher-resolution binary characters

desktopCell: { x: 3, y: 6, font: 5.5 },
mobileCell: { x: 3, y: 6, font: 5.5 },


  // Close-up head portrait


crop: {
  x: 0.08,
  y: 0.00,
  width: 0.84,
  height: 0.70
},


  // Improved facial contrast
  gamma: 0.75,
  contrast: 1.40,
  sharpen: 1.45,
  minCoverage: 0.12,
  minOpacity: 0.28,

  // Subtle animation
  shimmerAmount: 0.025,
  shimmerSpeed: 0.0008,
  maxFPS: 30
};

  const MONO =
    'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace';

  const INK = "#111111";

  const portrait = new Image();
  portrait.src = "assets/portrait.png";

  let width = 0;
  let height = 0;
  let dpr = 1;
  let glyphs = [];
  let cell = { ...CONFIG.desktopCell };
  let animationFrame = 0;
  let lastRenderTime = 0;
  let resizeTimer = null;
  let portraitReady = false;

  const pointer = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    active: false,
    fade: 0
  };

  /* =======================================================
     PORTRAIT POSITIONING
  ======================================================= */

  function getPortraitCrop() {
    const imageWidth = portrait.naturalWidth;
    const imageHeight = portrait.naturalHeight;
    const crop = CONFIG.crop;

    return {
      sx: imageWidth * crop.x,
      sy: imageHeight * crop.y,
      sw: imageWidth * crop.width,
      sh: imageHeight * crop.height
    };
  }

  function fitPortrait() {
    const source = getPortraitCrop();

    const scale = Math.min(
      (width * 0.94) / source.sw,
      (height * 0.98) / source.sh
    );

    const drawWidth = source.sw * scale;
    const drawHeight = source.sh * scale;

    return {
      ...source,
      dx: (width - drawWidth) / 2,
      dy: (height - drawHeight) / 2,
      dw: drawWidth,
      dh: drawHeight
    };
  }

  /* =======================================================
     CANVAS RESIZING
  ======================================================= */

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (portraitReady) {
      buildPortrait();
    }
  }

  /* =======================================================
     IMAGE SAMPLING AND GRAYSCALE
  ======================================================= */

  function getLuminance(r, g, b) {
    return (
      r * 0.2126 +
      g * 0.7152 +
      b * 0.0722
    ) / 255;
  }

  function buildPortrait() {
    if (!width || !height || !portraitReady) return;

    cell = width < 650
      ? { ...CONFIG.mobileCell }
      : { ...CONFIG.desktopCell };

    const source = fitPortrait();

    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = width;
    sampleCanvas.height = height;

    const sampleCtx = sampleCanvas.getContext("2d", {
      willReadFrequently: true
    });

    sampleCtx.clearRect(0, 0, width, height);

    sampleCtx.drawImage(
      portrait,
      source.sx,
      source.sy,
      source.sw,
      source.sh,
      source.dx,
      source.dy,
      source.dw,
      source.dh
    );

    const imageData = sampleCtx.getImageData(
      0, 0, width, height
    ).data;

    const cols = Math.ceil(width / cell.x);
    const rows = Math.ceil(height / cell.y);
    const total = cols * rows;

    const darkness = new Float32Array(total);
    const coverage = new Float32Array(total);

    // Ignore transparent background pixels.
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {

        let visiblePixels = 0;
        let luminanceTotal = 0;

        for (let py = 0; py < cell.y; py++) {
          for (let px = 0; px < cell.x; px++) {

            const x = col * cell.x + px;
            const y = row * cell.y + py;

            if (x >= width || y >= height) continue;

            const index = (y * width + x) * 4;
            const alpha = imageData[index + 3] / 255;

            if (alpha < 0.18) continue;

            const lum = getLuminance(
              imageData[index],
              imageData[index + 1],
              imageData[index + 2]
            );

            visiblePixels += alpha;
            luminanceTotal += lum * alpha;
          }
        }

        const cellIndex = row * cols + col;
        const cellArea = cell.x * cell.y;

        coverage[cellIndex] = visiblePixels / cellArea;

        darkness[cellIndex] = visiblePixels > 0
          ? 1 - luminanceTotal / visiblePixels
          : 0;
      }
    }

    /* =====================================================
       SHARPEN FACIAL DETAILS
    ===================================================== */

    const sharpened = new Float32Array(total);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {

        const index = row * cols + col;

        if (coverage[index] < CONFIG.minCoverage) continue;

        const neighbors = [];

        if (col > 0) neighbors.push(index - 1);
        if (col < cols - 1) neighbors.push(index + 1);
        if (row > 0) neighbors.push(index - cols);
        if (row < rows - 1) neighbors.push(index + cols);

        let sum = 0;
        let count = 0;

        for (const neighbor of neighbors) {
          if (coverage[neighbor] < CONFIG.minCoverage) continue;

          sum += darkness[neighbor];
          count++;
        }

        const average = count
          ? sum / count
          : darkness[index];

        sharpened[index] =
          darkness[index] +
          CONFIG.sharpen * (darkness[index] - average);
      }
    }

    /* =====================================================
       NORMALIZE CONTRAST
    ===================================================== */

    const values = [];

    for (let i = 0; i < total; i++) {
      if (coverage[i] >= CONFIG.minCoverage) {
        values.push(sharpened[i]);
      }
    }

    if (!values.length) {
      glyphs = [];
      return;
    }

    values.sort((a, b) => a - b);

    const low = values[
      Math.floor((values.length - 1) * 0.025)
    ];

    const high = values[
      Math.floor((values.length - 1) * 0.975)
    ];

    const range = Math.max(0.08, high - low);

    glyphs = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {

        const index = row * cols + col;
        const cover = coverage[index];

        if (cover < CONFIG.minCoverage) continue;

        let value = (sharpened[index] - low) / range;

        value = Math.max(0, Math.min(1, value));

        value = (value - 0.5) * CONFIG.contrast + 0.5;

        value = Math.max(0, Math.min(1, value));

        value = Math.pow(value, CONFIG.gamma);

        const opacity =
          CONFIG.minOpacity +
          value * (1 - CONFIG.minOpacity);

        const level =
          value < 0.28 ? 0 :
          value < 0.52 ? 1 :
          value < 0.76 ? 2 : 3;

        glyphs.push({
          x: col * cell.x + cell.x / 2,
          y: row * cell.y + cell.y / 2,
          value,
          opacity,
          level,
          char: Math.random() < 0.5 ? "0" : "1",
          phase: Math.random() * Math.PI * 2,
          changeAt: Math.random() * 5000
        });
      }
    }

    // Group similar weights for efficient rendering.
    glyphs.sort((a, b) => a.level - b.level);
  }

  /* =======================================================
     CURSOR LABEL
  ======================================================= */

  function drawCursorLabel() {
    if (pointer.fade < 0.02) return;

    const label = CONFIG.cursorLabel;
    const boxHeight = 34;

    ctx.save();

    ctx.font = '500 12px "DM Sans", Arial, sans-serif';

    const boxWidth =
      ctx.measureText(label).width + 32;

    const x = Math.max(
      8,
      Math.min(
        pointer.x - boxWidth / 2,
        width - boxWidth - 8
      )
    );

    const y = Math.max(
      8,
      Math.min(
        pointer.y - boxHeight / 2,
        height - boxHeight - 8
      )
    );

    ctx.globalAlpha = pointer.fade;

    ctx.translate(
      x + boxWidth / 2,
      y + boxHeight / 2
    );

    ctx.scale(
      0.94 + pointer.fade * 0.06,
      0.94 + pointer.fade * 0.06
    );

    ctx.shadowColor = "rgba(0, 0, 0, 0.12)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;

    ctx.fillStyle = "#ffffff";

    ctx.beginPath();

    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(
        -boxWidth / 2,
        -boxHeight / 2,
        boxWidth,
        boxHeight,
        17
      );
    } else {
      ctx.rect(
        -boxWidth / 2,
        -boxHeight / 2,
        boxWidth,
        boxHeight
      );
    }

    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#171717";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(label, 0, 1);

    ctx.restore();
  }

  /* =======================================================
     MAIN RENDER LOOP
  ======================================================= */

  function render(timestamp = 0) {
    animationFrame = requestAnimationFrame(render);

    const frameInterval = 1000 / CONFIG.maxFPS;

    if (timestamp - lastRenderTime < frameInterval) return;

    lastRenderTime = timestamp;

    if (!width || !height) return;

    ctx.clearRect(0, 0, width, height);

    // Smooth cursor movement.
    pointer.x += (pointer.targetX - pointer.x) * 0.18;
    pointer.y += (pointer.targetY - pointer.y) * 0.18;

    pointer.fade += (
      (pointer.active ? 1 : 0) - pointer.fade
    ) * 0.14;

    let currentFont = "";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;

    for (const glyph of glyphs) {

      let proximity = 0;

      if (pointer.fade > 0.01) {

        const distance = Math.hypot(
          glyph.x - pointer.x,
          glyph.y - pointer.y
        );

        proximity =
          Math.max(
            0,
            1 - distance / CONFIG.lensRadius
          ) * pointer.fade;
      }

      // Subtle binary shimmer.
      const shimmer =
        CONFIG.shimmerAmount *
        Math.sin(
          timestamp * CONFIG.shimmerSpeed +
          glyph.phase
        );

      // Occasional character transition.
      if (
        timestamp > glyph.changeAt &&
        Math.random() < 0.0007
      ) {
        glyph.char = glyph.char === "0" ? "1" : "0";

        glyph.changeAt =
          timestamp + 1800 + Math.random() * 4200;
      }

      ctx.globalAlpha = Math.max(
        0.12,
        Math.min(
          1,
          glyph.opacity + shimmer + proximity * 0.18
        )
      );

      // Uniform character size.
      const weight = proximity > 0.12
        ? 700
        : [400, 500, 600, 700][glyph.level];

      const font = `${weight} ${cell.font}px ${MONO}`;

      if (font !== currentFont) {
        ctx.font = font;
        currentFont = font;
      }

      ctx.fillText(
        glyph.char,
        glyph.x,
        glyph.y
      );
    }

    ctx.globalAlpha = 1;

    drawCursorLabel();
  }

  /* =======================================================
     POINTER / TOUCH INTERACTION
  ======================================================= */

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

  canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch") {
      setPointer(event.clientX, event.clientY);
    }
  });

  canvas.addEventListener("pointerup", event => {
    if (event.pointerType === "touch") {
      pointer.active = false;
    }
  });

  canvas.addEventListener("pointercancel", () => {
    pointer.active = false;
  });

  /* =======================================================
     IMAGE INITIALIZATION
  ======================================================= */

  portrait.onload = () => {
    portraitReady = true;

    resizeCanvas();

    if (!animationFrame) {
      animationFrame = requestAnimationFrame(render);
    }
  };

  portrait.onerror = () => {
    console.error(
      "Portrait image not found. Check assets/portrait.png"
    );
  };

  if (portrait.complete && portrait.naturalWidth) {
    portraitReady = true;
    resizeCanvas();
    animationFrame = requestAnimationFrame(render);
  }

  /* =======================================================
     WINDOW RESIZE
  ======================================================= */

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
      resizeCanvas();
    }, 140);
  });

  /* =======================================================
     MOBILE NAVIGATION
  ======================================================= */

  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav");

  if (toggle && nav) {

    toggle.addEventListener("click", () => {

      const isOpen = nav.classList.toggle("open");

      toggle.setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    });
  }

  /* =======================================================
     NAVIGATION UNDERLINE
  ======================================================= */

  if (nav) {

    const navLinks = [
      ...nav.querySelectorAll("a:not(.nav-button)")
    ];

    const sectionIds = [
      ...navLinks
        .map(link => link.getAttribute("href"))
        .filter(href => href && href.startsWith("#"))
        .map(href => href.slice(1)),
      "contact"
    ];

    const sections = sectionIds
      .map(id => document.getElementById(id))
      .filter(Boolean);

    let navLocked = false;
    let navLockTimer = null;

    function setActive(id) {
      navLinks.forEach(link => {

        link.classList.toggle(
          "active",
          link.getAttribute("href") === `#${id}`
        );
      });
    }

    function updateActive() {

      const scrollPosition = window.scrollY + 140;

      let current = "home";

      for (const section of sections) {
        if (section.offsetTop <= scrollPosition) {
          current = section.id;
        }
      }

      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;

      if (atBottom) {
        current = "contact";
      }

      setActive(current);
    }

    nav.querySelectorAll("a").forEach(link => {

      link.addEventListener("click", () => {

        nav.classList.remove("open");

        if (toggle) {
          toggle.setAttribute("aria-expanded", "false");
        }

        const href = link.getAttribute("href");

        if (href && href.startsWith("#")) {
          setActive(href.slice(1));
        }

        navLocked = true;

        clearTimeout(navLockTimer);

        navLockTimer = setTimeout(() => {
          navLocked = false;
          updateActive();
        }, 900);
      });
    });

    window.addEventListener("scroll", () => {
      if (!navLocked) {
        updateActive();
      }
    }, { passive: true });

    updateActive();
  }

  /* =======================================================
     FOOTER YEAR
  ======================================================= */

  const yearElement = document.getElementById("year");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}
