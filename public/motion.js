const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let orbitNode, disposeOrbit, revealObserver;

function animate(element, frames, options) {
  if (!reducedMotion.matches && element?.animate) element.animate(frames, options);
}

// Keep the same canvas across data updates so checking a habit never resets it.
export function updateViewMotion(view, changedPage) {
  const slot = view.querySelector('.orbit');
  if (slot && orbitNode) slot.replaceWith(orbitNode);
  else if (slot) {
    orbitNode = slot;
    disposeOrbit = createOrbit(slot);
  } else {
    disposeOrbit?.();
    orbitNode = undefined;
    disposeOrbit = undefined;
  }
  const progress = view.querySelector('progress');
  const fill = view.querySelector('.progress-fill');
  if (fill && progress) fill.style.transform = `scaleX(${progress.value / progress.max})`;
  revealObserver?.disconnect();
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animate(entry.target, [{opacity: .35, transform: 'translateY(16px)'},
          {opacity: 1, transform: 'translateY(0)'}],
          {duration: 500, easing: 'cubic-bezier(.16,1,.3,1)'});
        revealObserver.unobserve(entry.target);
      }
    }, {threshold: .08});
    for (const card of view.querySelectorAll('.card')) {
      if (card.getBoundingClientRect().top >= innerHeight) revealObserver.observe(card);
    }
  }
  if (!changedPage) return;
  const sections = view.querySelectorAll(':scope > .intro, :scope > .hero, :scope > .columns, :scope > .cards-grid, :scope > .stats-grid, :scope > .filters');
  sections.forEach((section, index) => animate(section,
    [{opacity: 0, transform: 'translateY(14px)'}, {opacity: 1, transform: 'translateY(0)'}],
    {duration: 460, delay: Math.min(index * 55, 165), easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards'}));
}

export function habitFeedback(view, button, previousValue) {
  const progress = view.querySelector('progress');
  const fill = view.querySelector('.progress-fill');
  if (progress && fill && previousValue !== undefined) {
    animate(fill, [{transform: `scaleX(${previousValue / progress.max})`},
      {transform: `scaleX(${progress.value / progress.max})`}],
      {duration: 550, easing: 'cubic-bezier(.16,1,.3,1)'});
  }
  if (button?.getAttribute('aria-pressed') !== 'true') return;
  animate(button.closest('.habit'), [{boxShadow: '0 0 0 0 #a0ebcd70'},
    {boxShadow: '0 0 0 10px #a0ebcd00'}], {duration: 650, easing: 'ease-out'});
  animate(button.querySelector('svg'), [{transform: 'scale(.4) rotate(-30deg)'},
    {transform: 'scale(1.2) rotate(5deg)', offset: .65}, {transform: 'scale(1)'}], {duration: 380});
}

function createOrbit(node) {
  const canvas = node.querySelector('canvas');
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const controller = new AbortController();
  const {signal} = controller;
  let width = 0, height = 0, frame = 0, visible = false, lastTime = 0;
  let yaw = -.35, pitch = .25, targetYaw = .5, targetPitch = .25;
  let idleUntil = performance.now() + 1600;
  let pointerDown = false;
  const rings = [];
  // Three perpendicular orbital bands, with depth-aware perspective projection.
  for (let ring = 0; ring < 3; ring++) {
    const points = [];
    const tilt = ring * Math.PI / 3 + .25;
    for (let i = 0; i <= 160; i++) {
      const angle = i / 160 * Math.PI * 2;
      const radius = 1.05 + ring * .09;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points.push([x, y * Math.cos(tilt), y * Math.sin(tilt)]);
    }
    rings.push(points);
  }
  const dots = Array.from({length: 220}, (_, i) => {
    const y = 1 - i / 219 * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = i * 2.3999632297;
    return [Math.cos(angle) * radius * .72, y * .72, Math.sin(angle) * radius * .72];
  });
  function project(point) {
    const [x, y, z] = point;
    const rotatedX = x * Math.cos(yaw) - z * Math.sin(yaw);
    const rotatedZ = x * Math.sin(yaw) + z * Math.cos(yaw);
    const rotatedY = y * Math.cos(pitch) - rotatedZ * Math.sin(pitch);
    const depth = y * Math.sin(pitch) + rotatedZ * Math.cos(pitch);
    const scale = Math.min(width * .34, height * .34) * 3.8 / (3.8 - depth);
    return [width / 2 + rotatedX * scale, height / 2 + rotatedY * scale, depth];
  }
  function draw() {
    context.clearRect(0, 0, width, height);
    const radius = Math.min(width, height) * .4;
    const glow = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius);
    glow.addColorStop(0, '#9d7bff55');
    glow.addColorStop(.5, '#764bdb24');
    glow.addColorStop(1, '#764bdb00');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    const projectedDots = dots.map(project).sort((a, b) => a[2] - b[2]);
    for (const [x, y, z] of projectedDots) {
      context.fillStyle = `rgba(203,187,255,${.16 + (z + .72) * .4})`;
      context.beginPath();
      context.arc(x, y, 1 + (z + .72) * .8, 0, Math.PI * 2);
      context.fill();
    }
    rings.forEach((ring, index) => {
      const projected = ring.map(project);
      for (let i = 1; i < projected.length; i++) {
        const [x, y, z] = projected[i];
        context.strokeStyle = `rgba(${index === 1 ? '160,235,205' : '194,172,255'},${.22 + (z + 1.3) * .23})`;
        context.lineWidth = 1.1 + (z + 1.3) * .25;
        context.beginPath();
        context.moveTo(projected[i - 1][0], projected[i - 1][1]);
        context.lineTo(x, y);
        context.stroke();
      }
      const [x, y] = projected[30 + index * 43];
      context.fillStyle = index === 1 ? '#a0ebcd' : '#e9ddff';
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
    });
  }
  function tick(time) {
    frame = 0;
    const delta = Math.min((time - lastTime) / 1000 || .016, .05);
    lastTime = time;
    const ease = 1 - Math.exp(-delta * 7);
    yaw += (targetYaw - yaw) * ease;
    pitch += (targetPitch - pitch) * ease;
    draw();
    if (time < idleUntil || Math.abs(targetYaw - yaw) + Math.abs(targetPitch - pitch) > .001) wake();
  }
  function wake() {
    if (!visible || document.hidden || frame || reducedMotion.matches) return;
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function resize() {
    const bounds = node.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
    node.classList.add('is-ready');
  }
  node.addEventListener('click', event => {
    const control = event.target.closest('[data-orbit]');
    if (!control) return;
    const direction = control.dataset.orbit;
    targetYaw = direction === 'reset' ? .5 : targetYaw + (direction === 'left' ? -.6 : .6);
    targetPitch = .25;
    if (reducedMotion.matches) {yaw = targetYaw; pitch = targetPitch; draw();}
    else wake();
  }, {signal});
  node.addEventListener('pointerdown', () => {pointerDown = true;}, {signal});
  node.addEventListener('pointermove', event => {
    if (event.target.closest('.orbit-controls')) return;
    if (reducedMotion.matches || (event.pointerType === 'touch' && !pointerDown)) return;
    const bounds = node.getBoundingClientRect();
    targetYaw = (event.clientX - bounds.left) / bounds.width * 2.4 - 1.2;
    targetPitch = ((event.clientY - bounds.top) / bounds.height - .5) * 1.2;
    idleUntil = performance.now() + 150;
    wake();
  }, {signal, passive: true});
  const reset = () => {pointerDown = false; targetYaw = .5; targetPitch = .25; wake();};
  node.addEventListener('pointerleave', reset, {signal});
  window.addEventListener('pointerup', () => {pointerDown = false;}, {signal});
  node.addEventListener('pointercancel', reset, {signal});
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : wake(), {signal});
  reducedMotion.addEventListener('change', () => {pause(); draw(); wake();}, {signal});
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(node);
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) wake(); else pause();
  });
  observer.observe(node);
  resize();
  return () => {pause(); controller.abort(); resizeObserver.disconnect(); observer.disconnect();};
}
