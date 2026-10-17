const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("style.css", "utf8");
const game = fs.readFileSync("game.js", "utf8");
const src = fs.readFileSync("messages.js", "utf8");
const sandbox = { window: {} };
vm.runInNewContext(src, sandbox);
const data = sandbox.window.BABA_CONTENT;
assert.equal(data.goal, 30);
assert.deepEqual(Object.keys(data.milestones).map(Number), [5, 10, 15, 20, 25]);
assert.equal(data.victory.length, 4);
assert.equal(Array.from(data.victory).flat().length, 9);
for (const count of [5, 10, 15, 20, 25]) {
  assert.ok(data.milestones[count].length >= 2);
  assert.ok(data.milestones[count].every((text) => text.trim().length > 0));
}
const requiredIds = [
  "welcome", "game", "victory", "gift", "startButton", "world", "player",
  "heartsLayer", "particlesLayer", "counter", "progressFill", "progressTrack",
  "remaining", "leftButton", "rightButton", "muteButton", "milestoneOverlay",
  "milestoneText", "milestoneCount", "continueButton", "victoryLines",
  "nextVictory", "present", "giftIntro", "openGift", "couponReveal",
  "saveCoupon", "replayButton", "saveNotice"
];
for (const id of requiredIds) assert.ok(html.includes('id="' + id + '"'), id + " missing");
for (const file of ["style.css", "messages.js", "game.js", "favicon.svg"]) {
  assert.ok(html.includes('"' + file + '"'), file + " missing in HTML");
  assert.ok(fs.existsSync(file), file + " missing on disk");
}
for (const token of ["requestAnimationFrame", "detectCollections", "showMilestone",
  "showVictory", "revealVictoryGroup", "openGift", "saveCoupon", "replay",
  "visibilitychange", "pointerdown", "keydown", "touch"]) {
  assert.ok((game + css).includes(token), token + " feature missing");
}
assert.ok(html.includes('lang="ar" dir="rtl"'));
assert.ok(html.includes('viewport-fit=cover'));
assert.ok(css.includes("prefers-reduced-motion"));
assert.ok(css.includes("safe-area-inset"));
assert.ok(!html.includes('src="/'), "Root-relative asset path");
assert.ok(!html.includes('href="/'), "Root-relative link");
console.log("PASS: 30-heart goal, five milestones, nine victory lines, UI wiring, RTL, asset paths, responsive hooks");