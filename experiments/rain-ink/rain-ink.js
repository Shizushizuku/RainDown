/* A standalone watercolor study: following one ink drop to the paper. */
(() => {
  'use strict';
  const paper = document.querySelector('#paper');
  const ink = document.querySelector('#ink');
  const pc = paper.getContext('2d');
  const ctx = ink.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const timing = { fall: 500, approach: 1900, impact: 3150, end: 6500 };
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  const mix = (a, b, p) => a + (b - a) * p;
  let width, height, dpr, frame, started, paperTile, blurTile, granulation;

  function random(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  }
  function surface(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    return canvas;
  }
  function makeTextures() {
    const rand = random(2701), size = 512;
    paperTile = surface(size, size);
    const p = paperTile.getContext('2d'), data = p.createImageData(size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = (rand() - .5) * 12;
      data.data[i] = 246 + v; data.data[i + 1] = 243 + v;
      data.data[i + 2] = 234 + v; data.data[i + 3] = 255;
    }
    p.putImageData(data, 0, 0);
    for (let i = 0; i < 1900; i++) {
      const x = rand() * size, y = rand() * size;
      p.strokeStyle = rand() > .5 ? 'rgba(100,91,68,.055)' : 'rgba(255,255,250,.25)';
      p.lineWidth = .3 + rand() * .6;
      p.beginPath(); p.moveTo(x, y);
      p.lineTo(x + (rand() - .5) * 20, y + rand() * 15); p.stroke();
    }
    blurTile = surface(size, size);
    const b = blurTile.getContext('2d'); b.globalAlpha = 1 / 20;
    for (let i = 0; i < 20; i++) {
      const offset = i * 5;
      b.drawImage(paperTile, 0, offset); b.drawImage(paperTile, 0, offset - size);
    }
    granulation = surface(size, size);
    const g = granulation.getContext('2d');
    for (let i = 0; i < 20000; i++) {
      g.fillStyle = rand() > .66 ? `rgba(21,25,24,${rand() * .14})` : `rgba(255,252,240,${rand() * .16})`;
      g.fillRect(rand() * size, rand() * size, .4 + rand() * 1.6, .4 + rand() * 2);
    }
    for (let i = 0; i < 280; i++) {
      const x = rand() * size, y = rand() * size;
      g.strokeStyle = `rgba(21,25,24,${.02 + rand() * .065})`;
      g.lineWidth = .4 + rand() * .5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - .5) * 8, y + rand() * 22); g.stroke();
    }
  }
  function drawPaper(t) {
    const braking = ease((t - timing.approach) / (timing.impact - timing.approach));
    const motion = ease((t - timing.fall) / 600) * (1 - braking);
    const u = Math.max(0, Math.min(t - timing.fall, 1400));
    const v = Math.max(0, Math.min(t - timing.approach, timing.impact - timing.approach));
    const offset = .00014 * u * u + .19 * v * (1 - v / (2 * (timing.impact - timing.approach)));
    pc.setTransform(dpr, 0, 0, dpr, 0, 0);
    pc.fillStyle = '#f6f3ea'; pc.fillRect(0, 0, width, height);
    pc.save(); pc.translate(0, -offset);
    pc.fillStyle = pc.createPattern(paperTile, 'repeat');
    pc.fillRect(0, offset, width, height);
    pc.globalAlpha = motion * .8;
    pc.fillStyle = pc.createPattern(blurTile, 'repeat');
    pc.fillRect(0, offset, width, height); pc.restore();
    const vignette = pc.createRadialGradient(width / 2, height * .48, height * .12,
      width / 2, height * .48, Math.max(width, height) * .75);
    vignette.addColorStop(0, 'rgba(255,255,250,.13)');
    vignette.addColorStop(1, 'rgba(127,111,80,.055)');
    pc.fillStyle = vignette; pc.fillRect(0, 0, width, height);
  }
  function organicPath(radius, phase, irregularity = 1) {
    ctx.beginPath();
    for (let i = 0; i <= 192; i++) {
      const a = i / 192 * Math.PI * 2;
      const slow = Math.sin(a * 5 + phase) * .047 + Math.sin(a * 9 - phase * .71) * .025;
      const fibre = Math.sin(a * 23 + 1.8) * .011 + Math.sin(a * 47 - 2.2) * .006;
      const r = radius * (1 + (slow + fibre) * irregularity);
      const x = Math.cos(a) * r, y = Math.sin(a) * r * .89;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function dropPath(tremor) {
    ctx.beginPath(); ctx.moveTo(0, -1);
    ctx.bezierCurveTo(.15 + tremor, -.91, .48, -.48, .78, .06);
    ctx.bezierCurveTo(1.14, .62, .85, 1, 0, 1);
    ctx.bezierCurveTo(-.85, 1, -1.14, .62, -.78, .06);
    ctx.bezierCurveTo(-.48, -.48, -.15 + tremor, -.91, 0, -1);
    ctx.closePath();
  }
  function drawGround(t) {
    const arrival = ease((t - timing.approach) / (timing.impact - timing.approach));
    if (arrival <= 0) return;
    const y = height * .82;
    const x = width / 2;
    const spread = Math.min(width * .74, height * .58);
    pc.save(); pc.globalAlpha = arrival;
    const shadow = pc.createRadialGradient(x, y, 2, x, y, spread);
    shadow.addColorStop(0, 'rgba(58,60,53,.13)');
    shadow.addColorStop(.4, 'rgba(79,75,61,.045)');
    shadow.addColorStop(1, 'rgba(79,75,61,0)');
    pc.translate(x, y); pc.scale(1, .11); pc.translate(-x, -y);
    pc.fillStyle = shadow;
    pc.fillRect(x - spread, y - spread, spread * 2, spread * 2);
    pc.restore();
  }
  function drawDrop(t) {
    const compression = ease((t - timing.impact) / 230);
    const fall = ease((t - timing.fall) / 450) * (1 - ease((t - timing.approach) / 1250));
    const radius = Math.min(11, width * .03);
    const fullHeight = Math.min(23, height * .046);
    const ry = fullHeight * (1 - compression * .89);
    const rx = radius * (1 + compression * 1.24);
    const y = mix(-fullHeight * 1.6, height * .82 - fullHeight,
      ease(t / timing.impact)) + fullHeight - ry;
    const x = width / 2 + Math.sin(t * .017) * 2 * fall;
    ctx.save(); ctx.globalAlpha = 1 - compression;
    ctx.translate(x, y); ctx.scale(rx, ry);
    const tremor = Math.sin(t * .013) * .028 * fall;
    ctx.save(); ctx.shadowColor = 'rgba(30,34,33,.13)'; ctx.shadowBlur = 14 / Math.min(rx, ry);
    dropPath(tremor); ctx.fillStyle = 'rgba(42,47,44,.045)'; ctx.fill(); ctx.restore();
    dropPath(tremor); ctx.fillStyle = 'rgba(42,49,46,.09)'; ctx.fill();
    ctx.save(); ctx.clip();
    const body = ctx.createRadialGradient(-.29, -.23, .03, .12, .17, 1.2);
    body.addColorStop(0, 'rgba(251,249,237,.65)');
    body.addColorStop(.26, 'rgba(132,139,128,.035)');
    body.addColorStop(.61, 'rgba(38,47,43,.13)');
    body.addColorStop(.86, 'rgba(24,33,30,.21)');
    body.addColorStop(1, 'rgba(18,27,25,.33)');
    ctx.fillStyle = body; ctx.fillRect(-1, -1, 2, 2);
    ctx.globalAlpha = .65; ctx.drawImage(granulation, -1, -1, 2, 2);
    ctx.globalAlpha = 1;
    const rand = random(602);
    for (let i = 0; i < 16; i++) {
      const px = (rand() - .5) * 1.4, py = (rand() - .5) * 1.5;
      const r = .16 + rand() * .42;
      const stain = ctx.createRadialGradient(px, py, 0, px, py, r);
      stain.addColorStop(0, i % 4 ? 'rgba(20,30,26,.055)' : 'rgba(255,251,237,.11)');
      stain.addColorStop(1, 'rgba(34,39,34,0)');
      ctx.fillStyle = stain; ctx.fillRect(px-r, py-r, r*2, r*2);
    }
    ctx.restore();
    dropPath(tremor); ctx.strokeStyle = 'rgba(27,37,33,.09)'; ctx.lineWidth = .012;
    ctx.stroke(); ctx.restore();
  }
  function drawSplash(t) {
    const elapsed = t - timing.impact;
    const x = width / 2, y = height * .82;
    const base = Math.min(34, width * .09);
    const open = ease(elapsed / 850), settle = ease((elapsed - 1200) / 2300);
    // The flattened landing pool stays on the paper, with fine feathering at its edge.
    ctx.save(); ctx.translate(x, y);
    const poolWidth = base * (.45 + 2.7 * open);
    const poolHeight = base * (.07 + .22 * open);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, poolWidth);
    pool.addColorStop(0, `rgba(28,37,33,${.36 - settle * .10})`);
    pool.addColorStop(.35, `rgba(34,42,36,${.19 - settle * .04})`);
    pool.addColorStop(.78, 'rgba(46,50,43,.065)'); pool.addColorStop(1, 'rgba(46,50,43,0)');
    ctx.save(); ctx.scale(1, poolHeight / poolWidth);
    ctx.fillStyle = pool; ctx.fillRect(-poolWidth, -poolWidth, poolWidth * 2, poolWidth * 2);
    ctx.restore();
    // Sediment settles into a slightly uneven mark on the paper.
    ctx.save(); ctx.scale(1, .16);
    for (let layer = 0; layer < 3; layer++) {
      organicPath(poolWidth * (.33 + layer * .23), layer * .8, 1.7);
      ctx.fillStyle = `rgba(26,34,29,${(.105 - layer * .021) * (1 - settle * .18)})`;
      ctx.fill();
    }
    ctx.restore();
    const core = ctx.createRadialGradient(0, 0, 1, 0, 0, base * .95);
    core.addColorStop(0, `rgba(20,29,25,${.19 - settle * .045})`);
    core.addColorStop(.5, 'rgba(29,37,32,.09)');
    core.addColorStop(1, 'rgba(29,37,32,0)');
    ctx.save(); ctx.scale(1, .12);
    ctx.fillStyle = core;
    ctx.fillRect(-base, -base, base * 2, base * 2);
    ctx.restore();
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath(); ctx.ellipse(0, 0, poolWidth * (.56 + ring * .18),
        poolHeight * (.64 + ring * .21), 0, Math.PI * .08, Math.PI * .92);
      ctx.strokeStyle = `rgba(30,39,34,${(.15 - ring * .037) * (1 - settle * .6)})`;
      ctx.lineWidth = .6 + ring * .3; ctx.stroke();
    }
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, poolWidth, poolHeight * 1.1, 0, 0, Math.PI * 2);
    ctx.clip(); ctx.globalAlpha = .8;
    ctx.drawImage(granulation, -poolWidth, -poolHeight * 1.2, poolWidth * 2, poolHeight * 2.4);
    ctx.restore();
    // Fine capillary jets rise and separate into suspended ink droplets.
    const rand = random(921);
    const flight = Math.min(elapsed / 920, 1);
    const fade = 1 - ease((elapsed - 600) / 650);
    if (fade > 0) {
      for (let i = 0; i < 16; i++) {
        const side = i < 9 ? -1 : 1;
        const distance = base * (.38 + rand() * 2.35);
        const heightRise = base * (.25 + rand() * 1.3);
        const lag = rand() * .35;
        const q = clamp((flight - lag) / (1 - lag));
        const sx = side * base * (.18 + rand() * .35);
        const px = sx + side * distance * q;
        const py = -heightRise * 4 * q * (1 - q);
        const alpha = fade * (.11 + rand() * .21);
        ctx.strokeStyle = `rgba(26,36,31,${alpha * .45})`;
        ctx.lineWidth = .35 + rand() * 1.25;
        ctx.beginPath();
        const tail = Math.max(0, q - .2 - rand() * .09);
        for (let step = 0; step <= 8; step++) {
          const part = mix(tail, q, step / 8);
          const tx = sx + side * distance * part;
          const ty = -heightRise * 4 * part * (1 - part);
          if (step === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.fillStyle = `rgba(27,37,32,${alpha})`;
        ctx.beginPath(); ctx.ellipse(px, py, .7 + rand() * 2.8,
          1 + rand() * 3.1, side * .25, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  function draw(t) {
    drawPaper(t); drawGround(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (t >= timing.impact) drawSplash(t);
    if (t < timing.impact + 230) drawDrop(t);
    if (t >= timing.end) document.body.classList.add('finished');
  }
  function tick(now) {
    const t = Math.min(now - started, timing.end);
    draw(t);
    if (t < timing.end) frame = requestAnimationFrame(tick);
  }
  function replay() {
    cancelAnimationFrame(frame);
    document.body.classList.remove('finished');
    if (reduceMotion.matches) { draw(timing.end); return; }
    started = performance.now(); frame = requestAnimationFrame(tick);
  }
  function setup() {
    width = innerWidth; height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    for (const canvas of [paper, ink]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    makeTextures(); replay();
  }
  document.querySelector('#replay').addEventListener('click', replay);
  reduceMotion.addEventListener('change', replay);
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer); resizeTimer = setTimeout(setup, 160);
  });
  setup();
})();
