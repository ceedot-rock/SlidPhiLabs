import { hash32 } from "./cell.js";
import { GROUND } from "./runner-engine.js";

export function draw(ctx, g, w, h) {
  const look = g.camLook ?? 0.22;
  const cam = g.x - look;
  const punch = (g.landPunch || 0) * 10;
  const shakeX = ((hash32((g.t * 90) | 0) / 0xffffffff - 0.5) * (g.shake || 0)) || 0;
  const shakeY = ((hash32((g.t * 77) | 0) / 0xffffffff - 0.5) * (g.shake || 0)) + punch;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  const sky = g.night;
  ctx.fillStyle = `rgb(${6 + sky * 14},${4 + (1 - sky) * 10},${10 + sky * 22})`;
  ctx.fillRect(0, 0, w, h);
  const heatA = 0.05 + g.host.heat * 0.35 + g.heat * 0.1;
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, `rgba(196,163,90,${heatA})`);
  grd.addColorStop(0.5, "rgba(0,0,0,0)");
  grd.addColorStop(1, `rgba(18,36,22,${0.4 + g.mud * 0.35})`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  const gy = GROUND * h;
  const sx = (x) => (x - cam) * w * 0.72;

  for (let layer = 0; layer < 3; layer++) {
    const par = 0.15 + layer * 0.28;
    const a = 0.12 + layer * 0.1 + sky * 0.12;
    ctx.fillStyle = `rgba(${22 + layer * 6},${28 + layer * 4},${24},${a})`;
    for (let i = 0; i < 14; i++) {
      const px = ((i * (70 + layer * 23) - cam * w * par) % (w + 120)) - 50;
      const tall = 30 + layer * 40 + ((hash32(i + g.seed + layer * 19) >> 8) % (80 + layer * 40));
      ctx.fillRect(px, gy - tall * (0.45 + layer * 0.2), 10 + layer * 8, tall);
    }
  }

  ctx.strokeStyle = `rgba(196,211,106,${0.4 + g.host.strength * 0.3})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(w, gy);
  ctx.stroke();

  // 29-sense ribbon — the field
  const ribY = gy + 10;
  for (let i = 0; i < 29; i++) {
    const v = g.host.sense[i] || 0;
    ctx.fillStyle = `rgba(196,211,106,${0.15 + v * 0.7})`;
    ctx.fillRect(12 + i * ((w - 24) / 29), ribY, Math.max(2, (w - 24) / 29 - 1), 4 + v * 10);
  }
  for (let i = 0; i < 36; i++) {
    const v = g.host.speak[i] || 0;
    ctx.fillStyle = `rgba(196,163,90,${0.08 + v * 0.45})`;
    ctx.fillRect(12 + i * ((w - 24) / 36), ribY + 16, Math.max(1, (w - 24) / 36 - 1), 3 + v * 8);
  }

  for (const hz of g.hazards) {
    const x = sx(hz.x);
    const pulse = 0.7 + 0.3 * Math.sin(g.t * 8 + hz.x);
    ctx.globalAlpha = hz.hit ? 0.35 : pulse;
    ctx.fillStyle = hz.kind === "gap" ? "#05060a" : "#c45a4a";
    if (hz.kind === "gap") ctx.fillRect(x, gy - 2, hz.w * w * 0.72, h - gy + 2);
    else if (hz.kind === "low") ctx.fillRect(x, gy - 18, 32, 18);
    else if (hz.kind === "high") ctx.fillRect(x, gy - 96, 18, 54);
    else ctx.fillRect(x, gy - 50, 26, 50);
    ctx.globalAlpha = 1;
    if (!hz.hit && hz.kind !== "gap") {
      ctx.fillStyle = `rgba(232,246,168,${0.15 + (hz.pulse || 0) * 0.3})`;
      ctx.fillRect(x - 6, gy - 100, 4, 90);
    }
  }

  const px = sx(g.x + 0.12);
  const py = g.y * h;
  const run = Math.sin(g.t * 18 + g.x * 40);
  const stretch = g.vy < -0.004 ? 1.12 : g.landPunch > 0.2 ? 0.88 : 1;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(1 / stretch, stretch);
  if (g.dash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(196,211,106,${0.2 + g.dash * 0.04})`;
    ctx.beginPath();
    ctx.ellipse(-18, -8, 40 + g.dash, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.fillStyle = `rgba(196,211,106,${0.18 + g.host.heat * 0.4})`;
  ctx.beginPath();
  ctx.ellipse(0, 8, 26 + g.dash * 0.4, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8f6a8";
  if (g.sliding > 0) {
    ctx.fillRect(-24, -12, 48, 14);
    ctx.fillStyle = "#c4d36a";
    ctx.fillRect(14, -18, 16, 10);
  } else {
    ctx.fillRect(-10, -44, 20, 38);
    ctx.fillStyle = "#c4d36a";
    ctx.fillRect(-6, -58, 14, 14);
    ctx.strokeStyle = "#e8f6a8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(-8 + run * 16, 10);
    ctx.moveTo(8, -8);
    ctx.lineTo(8 - run * 16, 10);
    ctx.stroke();
  }
  ctx.restore();

  for (const s of g.sparks) {
    ctx.globalAlpha = Math.max(0, s.life);
    ctx.fillStyle = g.alive ? "#c4d36a" : "#e8c070";
    ctx.fillRect(sx(s.x), s.y * h, 3, 3);
  }
  ctx.globalAlpha = 1;

  const pad = 18 + (typeof CSS !== "undefined" ? 0 : 0);
  ctx.fillStyle = "#e8dfc8";
  ctx.font = "700 22px Georgia, serif";
  ctx.fillText(String(g.dist | 0) + " m", pad, 28);
  ctx.fillStyle = "#8a806c";
  ctx.font = "13px sans-serif";
  ctx.fillText("SPACE jump · ↓ slide · SHIFT burst", pad, 48);
  if (!g.alive) {
    ctx.fillStyle = `rgba(10,8,6,${Math.min(0.62, 0.25 + g.deadAt)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c4a35a";
    ctx.font = "700 42px Georgia, serif";
    ctx.fillText("Down.", w / 2 - 70, h / 2 - 10);
    ctx.fillStyle = "#e8dfc8";
    ctx.font = "16px sans-serif";
    ctx.fillText((g.dist | 0) + " m  ·  click to run again", w / 2 - 110, h / 2 + 28);
  }
  ctx.restore();
}
