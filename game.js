(() => {
  "use strict";
  const copy = window.BABA_CONTENT;
  if (!copy) { throw new Error("Romantic content did not load"); }
  const byId = (id) => document.getElementById(id);
  const els = {
    welcome: byId("welcome"), game: byId("game"), victory: byId("victory"), gift: byId("gift"),
    start: byId("startButton"), world: byId("world"), player: byId("player"),
    hearts: byId("heartsLayer"), particles: byId("particlesLayer"),
    counter: byId("counter").querySelector("b"), progress: byId("progressFill"),
    progressTrack: byId("progressTrack"), remaining: byId("remaining"),
    left: byId("leftButton"), right: byId("rightButton"), mute: byId("muteButton"),
    overlay: byId("milestoneOverlay"), message: byId("milestoneText"),
    messageCount: byId("milestoneCount"), continue: byId("continueButton"),
    victoryLines: byId("victoryLines"), nextVictory: byId("nextVictory"),
    present: byId("present"), giftIntro: byId("giftIntro"), openGift: byId("openGift"),
    reveal: byId("couponReveal"), save: byId("saveCoupon"), replay: byId("replayButton"),
    saveNotice: byId("saveNotice")
  };
  const state = {
    phase: "welcome", count: 0, x: 50, hearts: [], direction: 0, target: null,
    raf: 0, last: 0, sound: true, audio: null, victoryGroup: -1, timers: new Set()
  };
  const GOAL = copy.goal;
  const SPEED = 49;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function later(fn, delay) {
    const id = window.setTimeout(() => { state.timers.delete(id); fn(); }, delay);
    state.timers.add(id);
    return id;
  }
  function clearTimers() {
    state.timers.forEach((id) => clearTimeout(id));
    state.timers.clear();
  }
  function showScreen(id) {
    ["welcome", "game", "victory", "gift"].forEach((name) => {
      els[name].hidden = name !== id;
    });
    document.body.classList.toggle("playing", id === "game");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function focusSafely(el) {
    try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
  }
  function audioReady() {
    if (!state.sound || state.audio) return;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) return;
    try { state.audio = new AudioEngine(); } catch (_) { state.audio = null; }
  }
  function tone(frequency, length = .11, volume = .023, delay = 0) {
    if (!state.sound) return;
    audioReady();
    if (!state.audio) return;
    try {
      if (state.audio.state === "suspended") state.audio.resume().catch(() => {});
      const context = state.audio;
      const now = context.currentTime + delay;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.15, now + length);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, now + length);
      osc.connect(gain); gain.connect(context.destination);
      osc.start(now); osc.stop(now + length + .015);
    } catch (_) { /* Sounds must never block gameplay. */ }
  }
  function playSound(type) {
    if (type === "collect") { tone(690, .09); tone(930, .13, .017, .07); }
    if (type === "milestone") { tone(530, .16); tone(700, .18, .022, .12); tone(890, .22, .02, .24); }
    if (type === "win" || type === "gift") {
      [540, 675, 805, 1020].forEach((f, i) => tone(f, .24, .019, .11 * i));
    }
  }
  function setPlayerPosition() {
    els.player.style.left = state.x + "%";
  }
  function resetInput() {
    state.direction = 0;
    state.target = null;
    els.left.classList.remove("pressed");
    els.right.classList.remove("pressed");
    els.player.classList.remove("moving");
  }
  function stopLoop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.last = 0;
    resetInput();
  }
  function startLoop() {
    if (state.raf || state.phase !== "playing" || document.hidden) return;
    state.last = performance.now();
    state.raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    state.raf = 0;
    if (state.phase !== "playing" || document.hidden) return;
    const delta = Math.min((now - state.last) / 1000, .045);
    state.last = now;
    const before = state.x;
    if (state.direction !== 0) {
      state.x = clamp(state.x + state.direction * SPEED * delta, 5, 95);
    } else if (state.target != null) {
      const distance = state.target - state.x;
      const step = SPEED * delta;
      if (Math.abs(distance) <= step) { state.x = state.target; state.target = null; }
      else state.x = clamp(state.x + Math.sign(distance) * step, 5, 95);
    }
    els.player.classList.toggle("moving", Math.abs(before - state.x) > .015);
    setPlayerPosition();
    detectCollections();
    if (state.phase === "playing") state.raf = requestAnimationFrame(frame);
  }
  function spawnHeart() {
    if (state.count >= GOAL || state.hearts.length >= 4) return;
    let x = 50, found = false;
    for (let i = 0; i < 85; i++) {
      x = 9 + Math.random() * 82;
      if (Math.abs(x - state.x) > 14 && state.hearts.every((h) => Math.abs(h.x - x) > 14)) {
        found = true; break;
      }
    }
    if (!found) {
      const slots = [9, 27, 45, 63, 81, 91];
      x = slots.find((n) => Math.abs(n - state.x) > 11 && state.hearts.every((h) => Math.abs(h.x - n) > 10)) ?? 9;
    }
    const el = document.createElement("span");
    el.className = "collectible";
    el.style.left = x + "%";
    el.style.animationDelay = (-Math.random() * 1.7) + "s";
    el.innerHTML = '<svg viewBox="0 0 48 44" focusable="false"><use href="#heart-art"></use></svg>';
    els.hearts.appendChild(el);
    state.hearts.push({ x, el });
  }
  function fillHearts() {
    while (state.hearts.length < 4 && state.count < GOAL) spawnHeart();
  }
  function createParticles(x, y, number = 9) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stageWidth = els.world.clientWidth;
    const stageHeight = els.world.clientHeight;
    for (let i = 0; i < number; i++) {
      const dot = document.createElement("span");
      const a = Math.PI * 2 * i / number + Math.random() * .5;
      const r = 26 + Math.random() * 48;
      dot.className = "particle";
      dot.style.left = (x / 100 * stageWidth) + "px";
      dot.style.top = (stageHeight - y) + "px";
      dot.style.setProperty("--tx", Math.cos(a) * r + "px");
      dot.style.setProperty("--ty", Math.sin(a) * r + "px");
      dot.style.background = i % 3 === 0 ? "#fff" : i % 3 === 1 ? "#ed7fa6" : "#f6a0ba";
      els.particles.appendChild(dot);
      later(() => dot.remove(), 850);
    }
  }
  function updateProgress() {
    els.counter.textContent = String(state.count);
    els.progress.style.width = (state.count / GOAL * 100) + "%";
    els.progressTrack.setAttribute("aria-valuenow", String(state.count));
    els.remaining.textContent = state.count === GOAL
      ? "جمعتي كل القلوب"
      : "باقي " + (GOAL - state.count) + " قلب يا شطورة";
  }
  function detectCollections() {
    for (let i = state.hearts.length - 1; i >= 0; i--) {
      const heart = state.hearts[i];
      if (Math.abs(heart.x - state.x) > 8.5) continue;
      heart.el.remove();
      state.hearts.splice(i, 1);
      state.count = Math.min(GOAL, state.count + 1);
      updateProgress();
      createParticles(heart.x, window.innerWidth < 540 ? 150 : 170);
      els.player.classList.remove("celebrate");
      void els.player.offsetWidth;
      els.player.classList.add("celebrate");
      later(() => els.player.classList.remove("celebrate"), 540);
      playSound("collect");
      if (state.count === GOAL) { showVictory(); return; }
      fillHearts();
      if (state.count % 5 === 0) { showMilestone(state.count); return; }
    }
  }
  function showMilestone(count) {
    state.phase = "milestone";
    stopLoop();
    els.message.replaceChildren();
    for (const line of copy.milestones[count]) {
      const p = document.createElement("p");
      p.textContent = line;
      els.message.appendChild(p);
    }
    els.messageCount.textContent = count + " / " + GOAL;
    els.overlay.hidden = false;
    playSound("milestone");
    focusSafely(els.continue);
  }
  function resume() {
    if (state.phase !== "milestone") return;
    els.overlay.hidden = true;
    state.phase = "playing";
    focusSafely(els.world);
    startLoop();
  }
  function victorySprinkles() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < 34; i++) {
      const dot = document.createElement("span");
      dot.className = "victory-sprinkle";
      dot.style.left = (5 + Math.random() * 90) + "%";
      dot.style.top = (15 + Math.random() * 70) + "%";
      dot.style.backgroundColor = i % 4 === 0 ? "#fff" : i % 2 === 0 ? "#f8a6c2" : "#ee669a";
      dot.style.setProperty("--tx", (-80 + Math.random() * 160) + "px");
      dot.style.setProperty("--ty", (-130 - Math.random() * 150) + "px");
      dot.style.animationDelay = (Math.random() * .5) + "s";
      els.victory.appendChild(dot);
      later(() => dot.remove(), 2300);
    }
  }
  function showVictory() {
    state.phase = "victory";
    stopLoop();
    state.hearts.forEach((h) => h.el.remove());
    state.hearts = [];
    els.victoryLines.replaceChildren();
    state.victoryGroup = -1;
    showScreen("victory");
    revealVictoryGroup();
    victorySprinkles();
    playSound("win");
  }
  function revealVictoryGroup() {
    if (state.victoryGroup >= copy.victory.length - 1) return;
    state.victoryGroup++;
    const group = document.createElement("div");
    group.className = "victory-stanza";
    for (const line of copy.victory[state.victoryGroup]) {
      const p = document.createElement("p");
      p.textContent = line;
      group.appendChild(p);
    }
    els.victoryLines.appendChild(group);
    els.nextVictory.textContent = state.victoryGroup === copy.victory.length - 1
      ? "شوفي هديتك يا حبيبتي" : "كملي يا حبيبة بابا";
    group.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function goToGift() {
    if (state.phase !== "victory" || state.victoryGroup !== copy.victory.length - 1) return;
    state.phase = "gift";
    showScreen("gift");
  }
  function openGift() {
    if (state.phase !== "gift") return;
    state.phase = "giftOpening";
    els.openGift.disabled = true;
    els.present.classList.add("opening");
    playSound("gift");
    later(() => {
      if (state.phase !== "giftOpening") return;
      els.present.hidden = true;
      els.giftIntro.hidden = true;
      els.openGift.hidden = true;
      els.reveal.hidden = false;
      state.phase = "coupon";
      els.reveal.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 1050);
  }
  function drawRoundRect(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function paintCoupon() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    const gradient = ctx.createLinearGradient(0, 0, 1200, 800);
    gradient.addColorStop(0, "#fffafd");
    gradient.addColorStop(.55, "#fff0f7");
    gradient.addColorStop(1, "#ffd9e9");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 800);
    ctx.strokeStyle = "#ec91b2"; ctx.lineWidth = 9;
    drawRoundRect(ctx, 28, 28, 1144, 744, 55); ctx.stroke();
    ctx.strokeStyle = "#f7bfd2"; ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    drawRoundRect(ctx, 49, 49, 1102, 702, 42); ctx.stroke();
    ctx.setLineDash([]);
    function centered(text, y, font, color) {
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.direction = "rtl";
      ctx.fillText(text, 600, y, 1030);
    }
    centered("هدية خاصة", 128, "bold 28px system-ui", "#b96a8b");
    ctx.fillStyle = "#f36a9b";
    ctx.beginPath();
    ctx.moveTo(600, 210);
    ctx.bezierCurveTo(510, 133, 463, 229, 600, 318);
    ctx.bezierCurveTo(737, 229, 690, 133, 600, 210);
    ctx.fill();
    centered("قسيمة دلع مفتوحة", 385, "900 66px 'Geeza Pro',system-ui,sans-serif", "#d94d82");
    centered("لحبيبة بابا وحدهاااا", 466, "bold 41px 'Geeza Pro',system-ui,sans-serif", "#a66582");
    centered("بوسات واحضان ودلع بلا حدوووود", 564, "bold 46px 'Geeza Pro',system-ui,sans-serif", "#874762");
    ctx.strokeStyle = "#ebb0c9"; ctx.lineWidth = 2; ctx.setLineDash([7, 10]);
    ctx.beginPath(); ctx.moveTo(255, 629); ctx.lineTo(945, 629); ctx.stroke();
    ctx.setLineDash([]);
    centered("صالحة للاستخدام في اي وقت وما تنتهي ابددددا", 692, "bold 31px 'Geeza Pro',system-ui,sans-serif", "#9a6680");
    return canvas;
  }
  function saveCoupon() {
    if (state.phase !== "coupon") return;
    try {
      const canvas = paintCoupon();
      const download = (blob) => {
        if (!blob) { els.saveNotice.textContent = "ما ضبط حفظ الصورة جربي لقطة شاشة"; return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "قسيمة-دلع-مفتوحة.png";
        document.body.appendChild(a); a.click(); a.remove();
        later(() => URL.revokeObjectURL(url), 30000);
        els.saveNotice.textContent = "اذا ما نزلت الصورة تقدرين تاخذين لقطة شاشة";
      };
      if (canvas.toBlob) canvas.toBlob(download, "image/png");
      else {
        const a = document.createElement("a");
        a.download = "قسيمة-دلع-مفتوحة.png";
        a.href = canvas.toDataURL("image/png");
        document.body.appendChild(a); a.click(); a.remove();
      }
    } catch (_) { els.saveNotice.textContent = "ما ضبط حفظ الصورة جربي لقطة شاشة"; }
  }
  function clearGame() {
    stopLoop();
    clearTimers();
    state.hearts.forEach((h) => h.el.remove());
    state.hearts = [];
    els.hearts.replaceChildren();
    els.particles.replaceChildren();
    els.victory.querySelectorAll(".victory-sprinkle").forEach((n) => n.remove());
    els.player.classList.remove("celebrate", "moving");
    state.count = 0; state.x = 50; state.victoryGroup = -1;
    els.overlay.hidden = true;
    els.reveal.hidden = true;
    els.present.hidden = false;
    els.present.classList.remove("opening");
    els.giftIntro.hidden = false;
    els.openGift.hidden = false;
    els.openGift.disabled = false;
    els.saveNotice.textContent = "";
    els.victoryLines.replaceChildren();
    setPlayerPosition();
    updateProgress();
  }
  function startGame() {
    clearGame();
    state.phase = "playing";
    showScreen("game");
    fillHearts();
    audioReady();
    tone(660, .11, .015);
    focusSafely(els.world);
    startLoop();
  }
  function replay() {
    clearGame();
    state.phase = "welcome";
    showScreen("welcome");
  }
  function bindMovement(button, direction) {
    button.addEventListener("pointerdown", (event) => {
      if (state.phase !== "playing") return;
      event.preventDefault();
      state.target = null;
      state.direction = direction;
      button.classList.add("pressed");
      if (button.setPointerCapture) {
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
      }
    });
    function stop(event) {
      if (event) event.preventDefault();
      if (state.direction === direction) state.direction = 0;
      button.classList.remove("pressed");
    }
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
  }
  function init() {
    els.start.addEventListener("click", startGame);
    els.continue.addEventListener("click", resume);
    els.nextVictory.addEventListener("click", () => {
      if (state.victoryGroup < copy.victory.length - 1) revealVictoryGroup();
      else goToGift();
    });
    els.openGift.addEventListener("click", openGift);
    els.save.addEventListener("click", saveCoupon);
    els.replay.addEventListener("click", replay);
    els.mute.addEventListener("click", () => {
      state.sound = !state.sound;
      els.mute.classList.toggle("muted", !state.sound);
      els.mute.setAttribute("aria-pressed", String(!state.sound));
      els.mute.setAttribute("aria-label", state.sound ? "كتم الصوت" : "تشغيل الصوت");
      if (state.sound) tone(720, .09, .018);
    });
    bindMovement(els.left, -1);
    bindMovement(els.right, 1);
    els.world.addEventListener("pointerdown", (event) => {
      if (state.phase !== "playing") return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      const rect = els.world.getBoundingClientRect();
      state.target = clamp((event.clientX - rect.left) / rect.width * 100, 5, 95);
      state.direction = 0;
    });
    document.addEventListener("keydown", (event) => {
      if (state.phase !== "playing") return;
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        event.preventDefault(); state.target = null; state.direction = -1;
      } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        event.preventDefault(); state.target = null; state.direction = 1;
      }
    });
    document.addEventListener("keyup", (event) => {
      if (state.phase !== "playing") return;
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) state.direction = 0;
    });
    window.addEventListener("blur", resetInput);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopLoop();
      else if (state.phase === "playing") startLoop();
    });
    showScreen("welcome");
    updateProgress();
  }
  init();
})();