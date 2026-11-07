export function experienceView() {
  return `<div class="experience journal">
    <canvas class="ink-scene" aria-hidden="true"></canvas>
    <header class="journal-nav"><a href="#home" class="journal-logo">show up<span>↗</span></a><span>A FIELD GUIDE TO YOUR EVERYDAY</span><a href="#today">Open my journal ↗</a></header>
    <section class="journal-opening"><p class="journal-label">VOL. 01 / BEGIN WHERE YOU ARE</p><h1>Life happens<br>when you<br><em>show up.</em></h1><div class="journal-bottom"><p>A little focus. A walk outside.<br>A message to someone you miss.<br>Make room for a life that feels like yours.</p><a class="journal-action" href="#today">Make one small move <span>↗</span></a></div><span class="margin-note">SCROLL TO FOLLOW THE THREAD ↓</span></section>
    <section class="journal-chapter chapter-small"><div><p class="journal-label">01 / LESS FRICTION, MORE BEGINNING</p><h2>Two minutes.<br><em>That counts.</em></h2><p>You don’t need to feel ready. Choose a cue, give your habit a tiny version, and make starting easy.</p><a href="#habits" class="journal-action">Shape your routine ↗</a></div><div class="specimen"><span>THE SMALLEST POSSIBLE START</span><strong>02<span>min</span></strong><div class="specimen-rule"></div><p>Open one problem.<br>Read one page.<br>Put on your shoes.</p><span>AN EXPERIMENT YOU CAN REPEAT TOMORROW.</span></div></section>
    <section class="journal-manifesto"><p class="journal-label">A REMINDER, FOR BOTH OF US</p><h2>You are allowed<br>to build a life<br><em>you enjoy.</em></h2><a href="#plans">Put something good on your calendar ↗</a></section>
    <section class="journal-chapter chapter-outside"><div><p class="journal-label">02 / COLLECT A LITTLE LIFE</p><h2>Take the<br><em>long way.</em></h2><p>A new corner of Delhi. Chai with an old friend. An hour with no particular destination.</p><a class="journal-action" href="#delhi">Find a side quest ↗</a></div><div class="field-map" aria-label="Illustrated routes for exploring"><div class="map-river"></div><a href="#delhi" class="map-pin pin-one">01 <span>Somewhere new</span></a><a href="#plans" class="map-pin pin-two">02 <span>Someone familiar</span></a><a href="#delhi" class="map-pin pin-three">03 <span>A little curiosity</span></a><span class="map-caption">DELHI / A CHANGE OF SCENERY</span></div></section>
    <section class="journal-finale"><p class="journal-label">03 / A WEEK MADE OF SMALL THINGS</p><h2>Leave a<br><em>little trace.</em></h2><p>Let your week tell the story of the times you tried.</p><a class="journal-action" href="#today">Start your next page ↗</a><footer><span>SHOW UP — YOUR PACE, YOUR LIFE.</span><a href="#week">Read your week ↗</a><button class="journal-motion" aria-pressed="false">Pause artwork</button></footer></section>
  </div>`.replaceAll('↗', '<svg class="journal-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>');
}

export function mountExperience(root) {
  const canvas = root.querySelector('canvas');
  const context = canvas.getContext('2d');
  const controller = new AbortController();
  const {signal} = controller;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const button = root.querySelector('.journal-motion');
  let paused = localStorage.getItem('show-up.motion-paused') === 'yes';
  let width = innerWidth, height = innerHeight, frame = 0, phase = 0, lastTime = 0;
  let pointerX = .75, pointerY = .5;
  function resize() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = width * ratio; canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    wake();
  }
  function draw(now) {
    frame = 0;
    const still = paused || reduced.matches;
    const delta = Math.min((now - lastTime) / 1000 || 0, .04);
    lastTime = now;
    if (!still) phase += delta;
    const progress = scrollY / Math.max(height, root.scrollHeight - height);
    context.clearRect(0, 0, width, height);
    const centerX = width * (.77 - .32 * Math.sin(progress * Math.PI));
    const centerY = height * .48;
    const scale = Math.min(width * .37, height * .54);
    for (let strand = 0; strand < 36; strand++) {
      context.beginPath();
      for (let point = 0; point <= 210; point++) {
        const angle = point / 210 * Math.PI * 2;
        const radius = .28 + strand / 50;
        const twist = angle * 3 + phase * .22 + progress * 9;
        const ripple = Math.sin(twist) * (.13 + progress * .08);
        const x = centerX + Math.cos(angle + progress * 3) * scale * (radius + ripple);
        const y = centerY + Math.sin(angle) * scale * (radius + ripple) * .8;
        const distance = Math.hypot(x - pointerX * width, y - pointerY * height);
        const bend = still ? 0 : Math.exp(-distance / 140) * 24 * Math.sin(angle * 4 + phase);
        if (point === 0) context.moveTo(x + bend, y + bend); else context.lineTo(x + bend, y + bend);
      }
      context.strokeStyle = strand % 6 === 0 ? '#d74b32' : '#192e4c';
      context.globalAlpha = strand % 6 === 0 ? .7 : .24;
      context.lineWidth = strand % 6 === 0 ? 1.3 : .7;
      context.stroke();
    }
    context.globalAlpha = 1;
    if (!still) wake();
  }
  function wake() { if (!frame && !document.hidden) frame = requestAnimationFrame(draw); }
  function motion() {
    button.textContent = paused || reduced.matches ? 'Enable artwork' : 'Pause artwork';
    button.setAttribute('aria-pressed', String(paused || reduced.matches));
    wake();
  }
  button.addEventListener('click', () => {paused = !paused; localStorage.setItem('show-up.motion-paused', paused ? 'yes' : 'no'); motion();}, {signal});
  window.addEventListener('resize', resize, {signal});
  window.addEventListener('scroll', wake, {passive:true, signal});
  window.addEventListener('pointermove', event => {pointerX = event.clientX / width; pointerY = event.clientY / height; wake();}, {passive:true, signal});
  document.addEventListener('visibilitychange', () => {cancelAnimationFrame(frame); frame = 0; wake();}, {signal});
  reduced.addEventListener('change', motion, {signal});
  resize(); motion();
  return () => {controller.abort(); cancelAnimationFrame(frame);};
}
