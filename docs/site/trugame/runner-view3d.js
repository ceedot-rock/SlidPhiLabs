import * as THREE from "three";
import { GROUND } from "./runner-engine.js";

const Z = 18;
const YUP = 6.2;

function simToWorld(g) {
  return {
    z: g.x * Z,
    y: Math.max(0, (GROUND - g.y) * YUP),
  };
}

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x07080c, 1);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0c10, 0.045);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 220);
  scene.add(new THREE.AmbientLight(0x3a4438, 0.55));
  const sun = new THREE.DirectionalLight(0xc4a35a, 1.4);
  sun.position.set(-4, 10, -6);
  scene.add(sun);
  const rim = new THREE.PointLight(0xc4d36a, 2.2, 18);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 400, 1, 40),
    new THREE.MeshStandardMaterial({ color: 0x141a14, roughness: 0.92, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(400, 80, 0x3d4a32, 0x1c241c);
  grid.position.y = 0.02;
  scene.add(grid);

  const trees = new THREE.Group();
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x1a2218, roughness: 1 });
  for (let i = 0; i < 64; i++) {
    const h = 2 + (i % 7) * 0.55;
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.45 + (i % 3) * 0.12, h, 5), treeMat);
    const side = i % 2 === 0 ? -1 : 1;
    m.position.set(side * (4.2 + (i % 5) * 0.35), h / 2, (i * 6.2) % 240 - 20);
    trees.add(m);
  }
  scene.add(trees);

  const host = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xe8f6a8,
    emissive: 0xc4d36a,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 6, 12), bodyMat);
  body.position.y = 0.64;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bodyMat);
  head.position.y = 1.28;
  host.add(body, head);
  scene.add(host);

  const hazardGroup = new THREE.Group();
  scene.add(hazardGroup);
  const mats = {
    block: new THREE.MeshStandardMaterial({ color: 0xc45a4a, emissive: 0x5a2018, emissiveIntensity: 0.5 }),
    low: new THREE.MeshStandardMaterial({ color: 0xe07060, emissive: 0x6a2010, emissiveIntensity: 0.4 }),
    high: new THREE.MeshStandardMaterial({ color: 0xd06070, emissive: 0x401018, emissiveIntensity: 0.45 }),
    gap: new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 1 }),
  };
  const hzPool = [];
  function hzMesh() {
    let m = hzPool.pop();
    if (!m) m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.block);
    hazardGroup.add(m);
    m.visible = true;
    return m;
  }

  const sparkGeo = new THREE.BufferGeometry();
  const sparkMax = 80;
  const sparkPos = new Float32Array(sparkMax * 3);
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: 0xd8f080, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false })
  );
  scene.add(sparks);

  const ribbon = new THREE.Group();
  const ribSense = [];
  const ribSpeak = [];
  const sMat = new THREE.MeshBasicMaterial({ color: 0xc4d36a });
  const kMat = new THREE.MeshBasicMaterial({ color: 0xc4a35a });
  for (let i = 0; i < 29; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), sMat.clone());
    ribSense.push(m);
    ribbon.add(m);
  }
  for (let i = 0; i < 36; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), kMat.clone());
    ribSpeak.push(m);
    ribbon.add(m);
  }
  scene.add(ribbon);

  const overlay = document.createElement("canvas");
  overlay.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2";
  canvas.parentNode.appendChild(overlay);
  const octx = overlay.getContext("2d");

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    overlay.width = Math.floor(w * dpr);
    overlay.height = Math.floor(h * dpr);
    overlay.style.width = w + "px";
    overlay.style.height = h + "px";
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  function sync(g) {
    const { z, y } = simToWorld(g);
    const slide = g.sliding > 0;
    host.position.set(0, slide ? 0.15 : y, z);
    host.rotation.x = slide ? 1.1 : g.vy * -8;
    host.scale.set(slide ? 1.35 : 1, slide ? 0.45 : g.vy < -0.004 ? 1.12 : 1, 1);
    bodyMat.emissiveIntensity = 0.35 + g.host.heat * 1.1 + (g.dash > 0 ? 0.6 : 0);
    rim.position.set(0.4, y + 1.2, z);
    rim.intensity = 1.6 + g.host.heat * 3 + (g.dash > 0 ? 2 : 0);

    const shake = (g.shake || 0) * 0.012;
    camera.position.set(shake, 1.55 + y * 0.25 + (g.landPunch || 0) * 0.15, z - 6.4);
    camera.lookAt(0, 0.7 + y * 0.4, z + 3.2);
    ground.position.z = z;
    grid.position.z = z;

    while (hazardGroup.children.length) hzPool.push(hazardGroup.children.pop());
    for (const hz of g.hazards) {
      const hzZ = hz.x * Z;
      const m = hzMesh();
      if (hz.kind === "gap") {
        m.material = mats.gap;
        m.scale.set(3.2, 0.4, Math.max(0.4, hz.w * Z));
        m.position.set(0, -0.15, hzZ);
      } else if (hz.kind === "low") {
        m.material = mats.low;
        m.scale.set(1.6, 0.45, 0.7);
        m.position.set(0, 0.22, hzZ);
      } else if (hz.kind === "high") {
        m.material = mats.high;
        m.scale.set(1.4, 2.2, 0.5);
        m.position.set(0, 2.4, hzZ);
      } else {
        m.material = mats.block;
        m.scale.set(1.5, 1.35, 0.7);
        m.position.set(0, 0.68, hzZ);
      }
    }

    const n = Math.min(sparkMax, g.sparks.length);
    sparkPos.fill(0);
    for (let i = 0; i < n; i++) {
      const s = g.sparks[i];
      sparkPos[i * 3] = (s.x - g.x) * Z * 0.2;
      sparkPos[i * 3 + 1] = Math.max(0, (GROUND - s.y) * YUP);
      sparkPos[i * 3 + 2] = s.x * Z;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.setDrawRange(0, n);
    sparks.material.opacity = g.alive ? 0.85 : 1;

    ribbon.position.set(0, 0.05, z + 1.6);
    for (let i = 0; i < 29; i++) {
      const v = g.host.sense[i] || 0;
      ribSense[i].position.set((i - 14) * 0.12, 0.1 + v * 0.55, 0);
      ribSense[i].scale.y = 0.4 + v * 4;
    }
    for (let i = 0; i < 36; i++) {
      const v = g.host.speak[i] || 0;
      ribSpeak[i].position.set((i - 18) * 0.1, 0.05 + v * 0.35, 0.2);
      ribSpeak[i].scale.y = 0.3 + v * 3;
    }

    const w = innerWidth;
    const h = innerHeight;
    octx.clearRect(0, 0, w, h);
    octx.fillStyle = "#e8dfc8";
    octx.font = "700 22px Georgia, serif";
    octx.fillText(String(g.dist | 0) + " m", 16, 28);
    octx.fillStyle = "#8a806c";
    octx.font = "13px sans-serif";
    octx.fillText("SPACE jump · ↓ slide · SHIFT burst · 3D field", 16, 48);
    if (!g.alive) {
      octx.fillStyle = `rgba(8,6,4,${Math.min(0.65, 0.25 + g.deadAt)})`;
      octx.fillRect(0, 0, w, h);
      octx.fillStyle = "#c4a35a";
      octx.font = "700 48px Georgia, serif";
      octx.fillText("Down.", w / 2 - 78, h / 2 - 8);
      octx.fillStyle = "#e8dfc8";
      octx.font = "16px sans-serif";
      octx.fillText((g.dist | 0) + " m  ·  click to run again", w / 2 - 112, h / 2 + 32);
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  return { sync, render, resize };
}
