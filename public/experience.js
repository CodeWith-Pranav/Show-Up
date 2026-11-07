import {createSculpture} from './sculpture.js';

export function experienceView() {
  const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>';
  return `<div class="experience">
    <div class="exp-stage" aria-hidden="true"><div class="exp-grid"></div><div class="exp-aura"></div><canvas class="sculpture"></canvas><div class="exp-fallback"></div><div class="exp-grain"></div></div>
    <header class="exp-header"><a class="exp-brand" href="#home" aria-label="Show Up home"><span class="exp-mark">↗</span>show up<span class="exp-brand-dot">®</span></a><span class="exp-header-note">A LITTLE MORE LIFE, EVERY DAY.</span><div class="exp-header-actions"><button class="exp-motion" type="button" aria-pressed="false">Pause motion</button><a class="exp-enter" href="#today">My dashboard <span>↗</span></a></div></header>
    <div class="exp-rail" aria-label="Experience chapters"><button data-chapter="0" aria-label="Chapter 1, Show up" aria-current="step"><span>01</span><i></i></button><button data-chapter="1" aria-label="Chapter 2, Start small"><span>02</span><i></i></button><button data-chapter="2" aria-label="Chapter 3, Make room"><span>03</span><i></i></button><button data-chapter="3" aria-label="Chapter 4, Begin"><span>04</span><i></i></button></div>
    <section class="exp-chapter exp-opening" aria-labelledby="exp-title">
      <div class="exp-copy"><p class="exp-kicker"><span class="exp-live"></span> YOUR LIFE. IN MOTION.</p><h1 id="exp-title"><span class="exp-line">Small steps.</span><span class="exp-line exp-italic">Bigger life.</span></h1><p class="exp-description">A space for the things you want to do.<br>The person you want to become.<br>And the life happening in between.</p><a class="exp-cta" href="#today"><span>Let’s show up</span><b>↗</b></a></div>
      <div class="exp-object-label"><span class="exp-cross">+</span> MOMENTUM / FORM 001<br><small>MOVE YOUR CURSOR. FIND YOUR RHYTHM.</small></div>
      <button class="exp-scroll" data-chapter="1"><span>SCROLL TO FEEL IT</span><b>↓</b></button><span class="exp-corner-note">HABITS · FOCUS · PEOPLE</span>
    </section>
    <section class="exp-chapter exp-focus" aria-labelledby="exp-focus-title"><span class="exp-ghost" aria-hidden="true">02:00</span><div class="exp-copy"><p class="exp-kicker">01 / BUILD A LITTLE MOMENTUM</p><h2 id="exp-focus-title">Great days<br>start <em>small.</em></h2><p class="exp-description">Open the book. Read one problem.<br>Give yourself two minutes to begin.<br>You can build from there.</p><a class="exp-text-link" href="#habits">Find your smallest step <span>↗</span></a><div class="exp-detail"><span class="exp-detail-icon">↗</span><div><strong>A small effort counts.</strong><p>Log the full version or the small version.<br>Both belong in your week.</p></div></div></div></section>
    <div class="exp-marquee" aria-hidden="true"><div>SHOW UP FOR YOURSELF. <span>✳</span> SHOW UP FOR YOUR LIFE. <span>✳</span> SHOW UP FOR YOURSELF. <span>✳</span></div></div>
    <section class="exp-chapter exp-life" aria-labelledby="exp-life-title"><div class="exp-copy"><p class="exp-kicker">02 / MAKE SPACE FOR THE REST</p><h2 id="exp-life-title">Life is bigger<br>than your<br><em>to-do list.</em></h2><p class="exp-description">An unplanned walk. A familiar face.<br>A new corner of your city.<br>Make room for something good.</p><a class="exp-text-link" href="#plans">Make a real plan <span>↗</span></a></div><div class="exp-outings"><a href="#delhi"><span>01</span>A change of scenery<b>↗</b></a><a href="#plans"><span>02</span>Chai with someone<b>↗</b></a><a href="#week"><span>03</span>A moment to reflect<b>↗</b></a><p>LESS AUTOPILOT. MORE BEING HERE.</p></div></section>
    <section class="exp-chapter exp-finale" aria-labelledby="exp-finale-title"><div class="exp-final-content"><p class="exp-kicker">03 / YOUR NEXT CHAPTER</p><h2 id="exp-finale-title">You don’t need<br>a perfect day.<br><em>Just a start.</em></h2><a class="exp-cta exp-final-cta" href="#today"><span>Make today yours</span><b>↗</b></a><p class="exp-final-note">Your habits. Your pace. Your life.</p></div><div class="exp-endbar"><a href="#home">SHOW UP ↗</a><button type="button" data-act="sources">The thinking behind it</button><button type="button" data-chapter="0">BACK TO TOP ↑</button></div></section>
    <div class="exp-pointer" aria-hidden="true"></div><div class="exp-progress" aria-hidden="true"></div>
  </div>`.replaceAll('↗',arrow);
}

export function mountExperience(root) {
  const controller = new AbortController();
  const {signal} = controller;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = [...root.querySelectorAll('.exp-chapter')];
  const rail = [...root.querySelectorAll('.exp-rail button')];
  const pointer = root.querySelector('.exp-pointer');
  const progressBar = root.querySelector('.exp-progress');
  const motionButton = root.querySelector('.exp-motion');
  let paused = false;
  try {paused = localStorage.getItem('show-up.motion-paused') === 'yes';} catch {}
  let frame = 0, time = 0, last = 0, progress = 0, target = 0;
  let mouseX = 0, mouseY = 0, pointerX = 0, pointerY = 0;
  let currentChapter = -1, offsets = [];
  const sculpture = createSculpture(root.querySelector('.sculpture'));
  root.classList.toggle('has-sculpture', Boolean(sculpture));
  function measure() {
    offsets = chapters.map(section => section.offsetTop);
    sculpture?.resize();
    scroll();
  }
  function scroll() {
    const y = window.scrollY;
    let index = 0;
    while (index < offsets.length - 1 && y >= offsets[index + 1]) index++;
    const span = (offsets[index + 1] ?? offsets[index] + innerHeight) - offsets[index];
    target = Math.min(3, index + Math.max(0, y - offsets[index]) / span);
    const active = Math.min(3, Math.round(target));
    if (active !== currentChapter) {
      currentChapter = active;
      root.dataset.chapter = String(active);
      rail.forEach((button, i) => i === active ? button.setAttribute('aria-current', 'step') : button.removeAttribute('aria-current'));
    }
    progressBar.style.transform = `scaleX(${Math.min(1, y / Math.max(1, root.scrollHeight - innerHeight))})`;
    wake();
  }
  function updateMotion() {
    const still = paused || reduced.matches;
    root.classList.toggle('motion-paused', still);
    motionButton.textContent = reduced.matches ? 'Reduced motion' : still ? 'Enable motion' : 'Pause motion';
    motionButton.setAttribute('aria-pressed', String(still));
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    wake();
  }
  function tick(now) {
    frame = 0;
    if (last && now - last < 1000 / 30) {wake(); return;}
    const delta = Math.min((now - last) / 1000 || .016, .05);
    last = now;
    const still = paused || reduced.matches;
    time += still ? 0 : delta;
    progress += still ? target - progress : (target - progress) * (1 - Math.exp(-delta * 10));
    const amount = still ? 0 : progress;
    root.style.setProperty('--scene-progress', String(progress));
    root.querySelector('.exp-marquee > div').style.transform = `translateX(${-amount * 105}px)`;
    pointer.style.transform = `translate3d(${pointerX}px,${pointerY}px,0)`;
    sculpture?.draw(time, progress, still ? 0 : mouseX, still ? 0 : mouseY);
    if (!still || Math.abs(progress - target) > .001) wake();
  }
  function wake() {if (!frame && !document.hidden) frame = requestAnimationFrame(tick);}
  window.addEventListener('scroll', scroll, {passive: true, signal});
  window.addEventListener('resize', measure, {passive: true, signal});
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || paused || reduced.matches) return;
    mouseX = event.clientX / innerWidth * 2 - 1;
    mouseY = event.clientY / innerHeight * 2 - 1;
    pointerX = event.clientX;
    pointerY = event.clientY;
    pointer.classList.add('is-visible');
    pointer.classList.toggle('is-link', Boolean(event.target.closest('a, button')));
    wake();
  }, {passive: true, signal});
  document.addEventListener('pointerleave', () => pointer.classList.remove('is-visible'), {signal});
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    if (!document.hidden) wake();
  }, {signal});
  reduced.addEventListener('change', updateMotion, {signal});
  motionButton.addEventListener('click', () => {
    if (reduced.matches) {
      motionButton.textContent = 'Device reduces motion';
      return;
    }
    paused = !paused;
    try {localStorage.setItem('show-up.motion-paused', paused ? 'yes' : 'no');} catch {}
    updateMotion();
  }, {signal});
  root.addEventListener('click', event => {
    const chapterButton = event.target.closest('[data-chapter]');
    if (!chapterButton || chapterButton === root) return;
    const index = Number(chapterButton.dataset.chapter);
    chapters[index]?.scrollIntoView({behavior: paused || reduced.matches ? 'instant' : 'smooth'});
  }, {signal});
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) entry.target.classList.add('is-in-view');
  }, {threshold: .15});
  chapters.forEach(chapter => observer.observe(chapter));
  measure(); updateMotion();
  return () => {controller.abort(); observer.disconnect(); cancelAnimationFrame(frame); sculpture?.dispose();};
}
