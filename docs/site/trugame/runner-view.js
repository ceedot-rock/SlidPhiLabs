import { hash32 } from "./cell.js";
import { GROUND } from "./runner-engine.js";

function u32(n) {
  return hash32(n >>> 0) >>> 0;
}

export function draw(ctx, g, w, h) {
  const look = g.camLook ?? 0.22;
  const cam = g.x - look;
  const punch = (g.landPunch || 0) * 12;
  const sh = g.shake || 0;
  const shakeX = (u32((g.t * 90) | 0) / 0xffffffff - 0.5) * sh;
  const shakeY = (u32((g.t * 77) | 0) / 0xffffffff - 0.5) * sh + punch;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  const gy = GROUND * h;
  const vpX = w * 0.72;
  const vpY = h * 0.28;
  const sx = (x) => (x - cam) * w * 0.72;
  const sky = g.night;

  ctx.fillStyle = `rgb(${4 + sky * 16},${3 + (1 - sky) * 8},${8 + sky * 28})`;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 48; i++) {
    const st = u32(g.seed + i * 91);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(g.t * (0.4 + (st % 7) * 0.1) + i));
    ctx.globalAlpha = tw * (0.25 + sky * 0.5);
    ctx.fillStyle = "#d8e8c0";
    ctx.fillRect((st % w), ((st >> 8) % (gy * 0.55)), 1 + (st % 2), 1 + (st % 2));
  }
  ctx.globalAlpha = 1;
  const heatA = 0.06 + g.host.heat * 0.45;
  const halo = ctx.createRadialGradient(vpX, vpY, 10, vpX, vpY, h * 0.7);
  halo.addColorStop(0, `rgba(196,163,90,${heatA})`);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  for (let layer = 0; layer < 4; layer++) {
    const par = 0.08 + layer * 0.22;
    const a = 0.08 + layer * 0.12 + sky * 0.1;
    ctx.fillStyle = `rgba(${16 + layer * 8},${22 + layer * 6},${20 + layer * 4},${a})`;
    for (let i = 0; i < 16; i++) {
      const span = w + 160;
      const px = ((i * (55 + layer * 19) - cam * w * par) % span + span) % span - 70;
      const tall = 24 + layer * 36 + ((u32(i + g.seed + layer * 19) >> 8) % (70 + layer * 50));
      const bw = 6 + layer * 7;
      ctx.beginPath();
      ctx.moveTo(px, gy);
      ctx.lineTo(px + bw * 0.3, gy - tall * (0.4 + layer * 0.18));
      ctx.lineTo(px + bw, gy);
      ctx.fill();
    }
  }

  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(w, gy);
  ctx.lineTo(vpX + w * 0.08, vpY + 40);
  ctx.lineTo(vpX - w * 0.18, vpY + 40);
  ctx.closePath();
  ctx.fillStyle = `rgba(12,18,12,${0.55 + g.mud * 0.3})`;
  ctx.fill();

  const tile = 48;
  const off = ((cam * w * 0.72) % tile + tile) % tile;
  ctx.strokeStyle = `rgba(196,211,106,${0.12 + g.host.strength * 0.15})`;
  ctx.lineWidth = 1;
  for (let x = -off; x < w + tile; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(vpX + (x - w * 0.5) * 0.15, vpY + 48);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(196,211,106,${0.45 + g.host.strength * 0.25})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(w, gy);
  ctx.stroke();

  const ribY = gy + 8;
  for (let i = 0; i < 29; i++) {
    const v = g.host.sense[i] || 0;
    ctx.fillStyle = `rgba(196,211,106,${0.12 + v * 0.75})`;
    ctx.fillRect(10 + i * ((w - 20) / 29), ribY, Math.max(2, (w - 20) / 29 - 1), 5 + v * 12);
  }
  for (let i = 0; i < 36; i++) {
    const v = g.host.speak[i] || 0;
    ctx.fillStyle = `rgba(196,163,90,${0.08 + v * 0.5})`;
    ctx.fillRect(10 + i * ((w - 20) / 36), ribY + 18, Math.max(1, (w - 20) / 36 - 1), 3 + v * 9);
  }

  ctx.globalCompositeOperation = "lighter";
  for (const hz of g.hazards) {
    const x = sx(hz.x);
    const pulse = 0.65 + 0.35 * Math.sin(g.t * 9 + hz.x * 4);
    ctx.globalAlpha = hz.hit ? 0.2 : pulse;
    if (hz.kind === "gap") {
      ctx.fillStyle = "#03040a";
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillRect(x, gy + 1, hz.w * w * 0.72, h - gy);
      ctx.fillStyle = `rgba(196,90,70,${0.5})`;
      ctx.fillRect(x, gy - 2, hz.w * w * 0.72, 3);
      ctx.globalCompositeOperation = "lighter";
    } else if (hz.kind === "low") {
      ctx.fillStyle = "#e07060";
      ctx.fillRect(x, gy - 16, 36, 16);
      ctx.fillStyle = `rgba(255,180,120,${0.35})`;
      ctx.fillRect(x - 4, gy - 20, 44, 4);
    } else if (hz.kind === "high") {
      ctx.fillStyle = "#d06070";
      ctx.fillRect(x + 4, 0, 14, gy - 88);
      ctx.fillRect(x, gy - 96, 22, 14);
    } else {
      ctx.fillStyle = "#c45a4a";
      ctx.fillRect(x, gy - 54, 28, 54);
      ctx.fillStyle = `rgba(255,140,100,${0.25})`;
      ctx.fillRect(x, gy - 54, 28, 6);
    }
    if (!hz.hit && hz.kind !== "gap") {
      ctx.fillStyle = `rgba(232,246,168,${0.2 + (hz.pulse || 0) * 0.4})`;
      ctx.fillRect(x - 10, gy - 110, 3, 100);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const px = sx(g.x + 0.12);
  const py = g.y * h;
  const run = Math.sin(g.t * 20 + g.x * 42);
  const stretch = g.vy < -0.004 ? 1.14 : g.landPunch > 0.2 ? 0.86 : 1;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(1 / stretch, stretch);
  ctx.globalCompositeOperation = "lighter";
  if (g.dash > 0) {
    for (let k = 1; k <= 4; k++) {
      ctx.fillStyle = `rgba(196,211,106,${0.08 * (5 - k)})`;
      ctx.fillRect(-12 - k * 10, -48, 18, 40);
    }
  }
  ctx.fillStyle = `rgba(196,211,106,${0.22 + g.host.heat * 0.5})`;
  ctx.beginPath();
  ctx.ellipse(0, 10, 28 + g.dash * 0.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#e8f6a8";
  if (g.sliding > 0) {
    ctx.beginPath();
    ctx.ellipse(4, -6, 28, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c4d36a";
    ctx.beginPath();
    ctx.arc(22, -10, 7, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.roundRect(-11, -46, 22, 40, 6);
    ctx.fill();
    ctx.fillStyle = "#c4d36a";
    ctx.beginPath();
    ctx.arc(0, -54, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e8f6a8";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, -10);
    ctx.lineTo(-7 + run * 15, 12);
    ctx.moveTo(7, -10);
    ctx.lineTo(7 - run * 15, 12);
    ctx.stroke();
  }
  ctx.restore();

  ctx.globalCompositeOperation = "lighter";
  for (const s of g.sparks) {
    ctx.globalAlpha = Math.max(0, s.life);
    const sz = 2 + s.life * 3;
    ctx.fillStyle = g.alive ? "#d8f080" : "#ffc070";
    ctx.fillRect(sx(s.x), s.y * h, sz, sz);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.2, w * 0.5, h * 0.5, h * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, `rgba(0,0,0,${0.35 + g.host.heat * 0.35})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  const pad = 16;
  ctx.fillStyle = "#e8dfc8";
  ctx.font = "700 22px Georgia, serif";
  ctx.fillText(String(g.dist | 0) + " m", pad, 28);
  ctx.fillStyle = "#8a806c";
  ctx.font = "13px sans-serif";
  ctx.fillText("SPACE jump · ↓ slide · SHIFT burst", pad, 48);
  if (!g.alive) {
    ctx.fillStyle = `rgba(8,6,4,${Math.min(0.7, 0.3 + g.deadAt)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#c4a35a";
    ctx.font = "700 48px Georgia, serif";
    ctx.fillText("Down.", w / 2 - 78, h / 2 - 8);
    ctx.fillStyle = "#e8dfc8";
    ctx.font = "16px sans-serif";
    ctx.fillText((g.dist | 0) + " m  ·  click to run again", w / 2 - 112, h / 2 + 32);
  }
  ctx.restore();
}
