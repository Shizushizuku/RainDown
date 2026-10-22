(() => {
  'use strict';
  const water = document.querySelector('#home-water');
  const rain = document.querySelector('#home-rain');
  const base = water.getContext('2d');
  const ink = rain.getContext('2d');
  const button = document.querySelector('#home-motion');
  const root = document.documentElement;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const drops = [], ripples = [];
  let width, height, dpr, lastTime = 0, spawnTime = 0, frame = 0;
  let playing = !motionPreference.matches;
  const random = (a, b) => a + Math.random() * (b - a);
  const clamp = x => Math.max(0, Math.min(1, x));
  const mist = document.createElement('canvas');
  const mistContext = mist.getContext('2d');
  const noiseField = Float32Array.from({ length: 128 * 128 }, () => Math.random());
  let mistPixels, flowTime = 0, mistElapsed = 0;
  let dark = root.dataset.theme === 'dark';
  let pigmentColor = dark ? '181,196,183' : '45,54,48';
  const paperImage = new Image();
  paperImage.addEventListener('load', () => drawWater());
  paperImage.src = new URL('../images/paper-reference.png', document.currentScript.src).href;

  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const sx = x - ix, sy = y - iy;
    const u = sx * sx * sx * (sx * (sx * 6 - 15) + 10);
    const v = sy * sy * sy * (sy * (sy * 6 - 15) + 10);
    const a = noiseField[(iy & 127) * 128 + (ix & 127)];
    const b = noiseField[(iy & 127) * 128 + ((ix + 1) & 127)];
    const c = noiseField[((iy + 1) & 127) * 128 + (ix & 127)];
    const d = noiseField[((iy + 1) & 127) * 128 + ((ix + 1) & 127)];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  function drawMist() {
    const pixels = mistPixels.data;
    const t = flowTime * .12;
    const light = dark ? [139, 157, 146] : [255, 252, 242];
    const shade = dark ? [9, 16, 13] : [57, 64, 55];
    // A slowly changing flow field bends the cloud texture instead of sliding one image.
    for (let y = 0; y < mist.height; y++) {
      const fy = y / mist.height * height / 240;
      for (let x = 0; x < mist.width; x++) {
        const fx = x / mist.width * width / 340;
        const qx = fx + (noise(fx * .65 + t * .08, fy * .65 + t * .05) - .5) * 2.2;
        const qy = fy + (noise(fx * .65 + 31 - t * .06, fy * .65 + 17 + t * .07) - .5) * 1.6;
        const field = noise(qx - t * .18, qy + t * .06) * .7
          + noise(qx * 2.15 + 53 + t * .09, qy * 2.15 + 11) * .3;
        const density = (field - .5) * 2;
        const colour = density > 0 ? shade : light;
        const i = (y * mist.width + x) * 4;
        pixels[i] = colour[0]; pixels[i + 1] = colour[1]; pixels[i + 2] = colour[2];
        pixels[i + 3] = Math.min(13, Math.abs(density) * 27);
      }
    }
    mistContext.putImageData(mistPixels, 0, 0);
  }

  function drawPaper() {
    base.fillStyle = dark ? '#1c211f' : '#f8f3e6';
    base.fillRect(0, 0, width, height);
    if (!paperImage.complete || !paperImage.naturalWidth) return;
    // Keep the reference's soft bands, but replace its hue with neutral paper colour.
    base.save();
    base.globalAlpha = dark ? .035 : .86;
    if (dark) base.filter = 'grayscale(1)';
    base.drawImage(paperImage, 0, 0, paperImage.naturalWidth,
      paperImage.naturalHeight * .9, 0, 0, width, height);
    base.globalAlpha = 1;
    base.filter = 'none';
    base.globalCompositeOperation = 'color';
    base.fillStyle = dark ? '#1c211f' : '#f8f3e6';
    base.fillRect(0, 0, width, height);
    base.restore();
  }

  function resize() {
    width = innerWidth; height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    for (const canvas of [water, rain]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    base.setTransform(dpr, 0, 0, dpr, 0, 0);
    ink.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Clouds use a small cached raster, independent of screen density and rain's frame rate.
    const mistScale = Math.min(.24, 176 / Math.max(width, height));
    mist.width = Math.max(1, Math.round(width * mistScale));
    mist.height = Math.max(1, Math.round(height * mistScale));
    mistPixels = mistContext.createImageData(mist.width, mist.height);
    drawMist();
    drawWater();
    ink.clearRect(0, 0, width, height);
    drops.length = 0; ripples.length = 0;
    if (!playing) {
      for (const [x, y, age] of [[.28, .68, .34], [.73, .79, .58], [.57, .43, .2]]) {
        ripples.push({ x: width * x, y: height * y, age, life: 2.2, depth: y });
      }
      drawEffects();
    }
  }
  function drawWater() {
    base.clearRect(0, 0, width, height);
    drawPaper();
    let seed = 81;
    const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    const wash = base.createLinearGradient(0, height * .25, 0, height);
    wash.addColorStop(0, `rgba(${pigmentColor},0)`);
    wash.addColorStop(.45, `rgba(${pigmentColor},.026)`);
    wash.addColorStop(1, `rgba(${pigmentColor},.025)`);
    base.fillStyle = wash; base.fillRect(0, height * .25, width, height * .75);
    for (let i = 0; i < 11; i++) {
      const x = next() * width, y = height * (.32 + next() * .7);
      const radius = width * (.12 + next() * .27);
      const pigment = base.createRadialGradient(x, y, 0, x, y, radius);
      pigment.addColorStop(0, `rgba(${pigmentColor},.028)`);
      pigment.addColorStop(.65, `rgba(${pigmentColor},.011)`);
      pigment.addColorStop(1, `rgba(${pigmentColor},0)`);
      base.save(); base.translate(x, y); base.scale(1, .16 + y / height * .2);
      base.translate(-x, -y); base.fillStyle = pigment;
      base.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      base.restore();
    }
    // Sparse ink marks suggest a quiet water surface.
    for (let i = 0; i < 42; i++) {
      const depth = .3 + next() * .7;
      const x = next() * width, y = height * depth;
      const length = (8 + next() * 56) * (.4 + depth * .85);
      const alpha = (.015 + next() * .05) * (.45 + depth * .8);
      base.lineCap = 'round';
      for (let segment = 0; segment < 2; segment++) {
        const left = x + segment * length * .55;
        const extent = length * (.22 + next() * .22);
        base.beginPath(); base.moveTo(left, y + (next() - .5) * 2);
        base.quadraticCurveTo(left + extent * .48, y - .8 - next() * 2,
          left + extent, y + (next() - .5) * 2);
        base.strokeStyle = `rgba(${pigmentColor},${alpha * (segment ? .54 : 1)})`;
        base.lineWidth = .45 + next() * 1.1; base.stroke();
      }
    }
  }
  function addDrop() {
    const depth = random(.3, .94);
    const impactY = height * depth;
    const speed = random(135, 195) * (.65 + depth * .65);
    drops.push({ x: random(15, width - 15), y: impactY - random(26, 68), impactY,
      speed, length: random(7, 13) * (.6 + depth * .75), depth });
  }
  function drawEffects() {
    ink.clearRect(0, 0, width, height);
    ink.drawImage(mist, 0, 0, width, height);
    for (const drop of drops) {
      const fade = clamp((drop.impactY - drop.y) / 35);
      ink.beginPath(); ink.moveTo(drop.x - 1.9, drop.y - drop.length);
      ink.lineTo(drop.x, drop.y);
      ink.strokeStyle = `rgba(${pigmentColor},${(.06 + drop.depth * .045) * fade})`;
      ink.lineWidth = .5 + drop.depth * .25; ink.lineCap = 'round'; ink.stroke();
    }
    for (const ripple of ripples) {
      const progress = clamp(ripple.age / ripple.life);
      const depth = ripple.depth;
      const radius = (4 + progress * 36) * (.55 + depth * .7);
      // Circular ripples project to flattened ellipses on the slanted surface.
      const flatten = .26 + depth * .3;
      const fade = (1 - progress) ** 1.6;
      for (let ring = 0; ring < 2; ring++) {
        const r = radius * (1 - ring * .32);
        const opacity = fade * (ring ? .075 : .145) * (.65 + depth * .35);
        const phase = ripple.x * .03 + ripple.y * .02 + ring;
        // Broken arcs with slight wavering resemble thin ink dragged across paper.
        for (let arc = 0; arc < 2; arc++) {
          const start = arc ? Math.PI * 1.07 : .12;
          const end = arc ? Math.PI * 1.88 : Math.PI * .88;
          ink.beginPath();
          for (let step = 0; step <= 28; step++) {
            const angle = start + (end - start) * step / 28;
            const wobble = 1 + Math.sin(angle * 5 + phase) * .022
              + Math.sin(angle * 13 - phase) * .006;
            const x = ripple.x + Math.cos(angle) * r * wobble;
            const y = ripple.y + Math.sin(angle) * r * flatten * wobble;
            if (step === 0) ink.moveTo(x, y); else ink.lineTo(x, y);
          }
          ink.strokeStyle = `rgba(${pigmentColor},${opacity * (arc ? .62 : 1)})`;
          ink.lineWidth = ring ? .58 : .76;
          ink.lineCap = 'round'; ink.stroke();
        }
      }
      if (progress < .12) {
        const alpha = (1 - progress / .12) * .12;
        ink.fillStyle = `rgba(${pigmentColor},${alpha})`;
        ink.beginPath(); ink.ellipse(ripple.x, ripple.y, 1.3, .8, 0, 0, Math.PI * 2); ink.fill();
      }
    }
  }
  function tick(time) {
    const delta = Math.min((time - (lastTime || time)) / 1000, .05);
    lastTime = time;
    if (!playing) { frame = 0; return; }
    flowTime += delta;
    mistElapsed += delta;
    if (mistElapsed >= 1 / 12) { drawMist(); mistElapsed %= 1 / 12; }
    spawnTime += delta;
    while (spawnTime > .36) { spawnTime -= .36; if (drops.length < 9) addDrop(); }
    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i]; drop.y += drop.speed * delta;
      if (drop.y >= drop.impactY) {
        if (ripples.length < 18) ripples.push({ x: drop.x, y: drop.impactY,
          age: 0, life: random(1.8, 2.5), depth: drop.depth });
        drops.splice(i, 1);
      }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].age += delta;
      if (ripples[i].age >= ripples[i].life) ripples.splice(i, 1);
    }
    drawEffects(); frame = requestAnimationFrame(tick);
  }
  function setPlaying(value) {
    playing = value;
    button.setAttribute('aria-pressed', String(value));
    button.textContent = value ? '暂停动效' : '继续动效';
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (value) {
      ripples.length = 0;
      frame = requestAnimationFrame(tick);
    } else {
      drops.length = 0;
      drawEffects();
    }
  }
  button.addEventListener('click', () => setPlaying(!playing));
  motionPreference.addEventListener('change', event => setPlaying(!event.matches));
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    if (!document.hidden && playing) frame = requestAnimationFrame(tick);
  });
  let resizeTimer;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 160); });
  new MutationObserver(() => {
    dark = root.dataset.theme === 'dark';
    pigmentColor = dark ? '181,196,183' : '45,54,48';
    drawWater();
    drawMist();
    drawEffects();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  button.hidden = false;
  resize(); setPlaying(playing);
})();
