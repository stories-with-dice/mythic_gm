/* global THREE */
/* =========================================================================
   3D DICE  (three.js, js/vendor/three.min.js)
   -------------------------------------------------------------------------
   Ported from the author's Wox 3D Dice Roller (overlay/render.js): the same
   dice shapes, face labels, textures, precomputed throw and sound events.
   Changed for the app: one full-window stage (div#diceStage, made on first
   use) with one WebGL renderer that every throw reuses; no result panel (the
   tab shows the result); a callback when the dice land.

   Dice3D.throwDice(list, opts) -> { skip(), stop(), settleTime } or null
     list: [{ shape:'d4'|'d6'|'d8'|'d10'|'d10t'|'d10u'|'d12'|'d20'|…|'token',
              top:'<label on the up face>', sides, pair, group }]
     (each item may have `skin`: a SKINS id for that die only)
     opts: { palette (a SKINS id for every die), size (px), sound (bool), volume (0-1),
             revealDelay (s after the dice stop), hold (s the dice stay
             after the reveal), onSettled() }
   Returns null when WebGL is not available (the caller shows the result at
   once). A click on the stage or Escape skips to the landing. Wrapped in an
   IIFE: only window.Dice3D is global.
   ========================================================================= */
(function () {
  'use strict';

  const rnd = Math.random;
  const between = (a, b) => a + (b - a) * rnd();

  // ---------- skins ----------
  // A skin is the body pattern of every face texture (pattern), the label
  // color (ink) and the surface (roughness, metalness). The scene has no
  // environment map, so metalness stays low (high metalness renders dark).
  // The pattern is drawn
  // on each 256 x 256 face canvas before the label.
  const SKINS = {
    ivory:    { label: 'Ivory',          body: '#f1e8d4', ink: '#2b2620', pattern: 'grain',    rough: 0.45, metal: 0.02 },
    indigo:   { label: 'Indigo',         body: '#2f3066', ink: '#f4f3f8', pattern: 'gradient', rough: 0.38, metal: 0.02 },
    crimson:  { label: 'Crimson',        body: '#b3122e', ink: '#ffffff', pattern: 'gradient', rough: 0.42,  metal: 0.02 },
    sapphire: { label: 'Sapphire',       body: '#1f4fa8', ink: '#ffffff', pattern: 'gradient', rough: 0.38,  metal: 0.02 },
    emerald:  { label: 'Emerald',        body: '#11805b', ink: '#f5e6b8', pattern: 'gradient', rough: 0.38,  metal: 0.02 },
    obsidian: { label: 'Obsidian',       body: '#1d1d22', ink: '#e9c46a', pattern: 'gradient', rough: 0.18, metal: 0.1 },
    amethyst: { label: 'Amethyst',       body: '#6b3fa0', ink: '#ffffff', pattern: 'swirl',    rough: 0.3,  metal: 0.02, body2: '#b48ad8' },
    gold:     { label: 'Gold',           body: '#e0b34a', ink: '#2a1d05', pattern: 'brushed',  rough: 0.5,  metal: 0.3 },
    steel:    { label: 'Steel',          body: '#b4bac3', ink: '#16181c', pattern: 'brushed',  rough: 0.5,  metal: 0.3 },
    marble:   { label: 'Marble',         body: '#eeece8', ink: '#1f1f22', pattern: 'marble',   rough: 0.22, metal: 0.02 },
    wood:     { label: 'Oak wood',       body: '#9a6a3c', ink: '#f8ecd4', pattern: 'wood',     rough: 0.6,  metal: 0.0 },
    nebula:   { label: 'Nebula',         body: '#141a3c', ink: '#ffffff', pattern: 'stars',    rough: 0.25, metal: 0.05, body2: '#5b2a7a' },
  };
  const SKIN_IDS = Object.keys(SKINS);
  const PALETTES = SKINS;   // older name, kept for callers

  // Seeded random per texture, so a cached face always looks the same.
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return () => {
      h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shade(hex, amt) {   // amt -1..1: darker .. lighter
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function paintBody(g, sk, r) {
    const W = 256;
    switch (sk.pattern) {
      case 'gradient': {
        const gr = g.createRadialGradient(90, 80, 10, 128, 128, 190);
        gr.addColorStop(0, shade(sk.body, 0.18)); gr.addColorStop(1, shade(sk.body, -0.25));
        g.fillStyle = gr; g.fillRect(0, 0, W, W);
        break;
      }
      case 'grain': {
        g.fillStyle = sk.body; g.fillRect(0, 0, W, W);
        for (let i = 0; i < 260; i++) {
          g.fillStyle = `rgba(120,100,70,${0.04 + r() * 0.06})`;
          g.fillRect(r() * W, r() * W, 1 + r() * 2, 1 + r() * 2);
        }
        break;
      }
      case 'swirl': {
        const gr = g.createLinearGradient(0, 0, W, W);
        gr.addColorStop(0, sk.body); gr.addColorStop(0.5, sk.body2); gr.addColorStop(1, sk.body);
        g.fillStyle = gr; g.fillRect(0, 0, W, W);
        g.globalAlpha = 0.18;
        for (let i = 0; i < 6; i++) {
          g.strokeStyle = i % 2 ? '#ffffff' : shade(sk.body, -0.4);
          g.lineWidth = 6 + r() * 14;
          g.beginPath(); g.arc(r() * W, r() * W, 40 + r() * 120, r() * 6, r() * 6 + 2.5); g.stroke();
        }
        g.globalAlpha = 1;
        break;
      }
      case 'brushed': {
        const gr = g.createLinearGradient(0, 0, W, W);
        gr.addColorStop(0, shade(sk.body, 0.35)); gr.addColorStop(0.45, sk.body); gr.addColorStop(1, shade(sk.body, -0.3));
        g.fillStyle = gr; g.fillRect(0, 0, W, W);
        for (let y = 0; y < W; y += 2) {
          g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.06})`;
          g.fillRect(0, y, W, 1);
        }
        break;
      }
      case 'marble': {
        g.fillStyle = sk.body; g.fillRect(0, 0, W, W);
        for (let i = 0; i < 5; i++) {
          g.strokeStyle = `rgba(70,72,82,${0.18 + r() * 0.25})`;
          g.lineWidth = 0.8 + r() * 2.2;
          g.beginPath();
          let x = r() * W, y = -10;
          g.moveTo(x, y);
          while (y < W + 10) {
            const nx = x + (r() - 0.5) * 70, ny = y + 20 + r() * 40;
            g.quadraticCurveTo(x + (r() - 0.5) * 60, (y + ny) / 2, nx, ny);
            x = nx; y = ny;
          }
          g.stroke();
        }
        break;
      }
      case 'wood': {
        g.fillStyle = sk.body; g.fillRect(0, 0, W, W);
        const ph = r() * 6;
        for (let y = -10; y < W + 10; y += 7 + r() * 6) {
          g.strokeStyle = `rgba(60,34,14,${0.18 + r() * 0.22})`;
          g.lineWidth = 1 + r() * 2.5;
          g.beginPath();
          for (let x = 0; x <= W; x += 8) {
            const yy = y + Math.sin(x / 38 + ph + y / 50) * 6;
            if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
          }
          g.stroke();
        }
        break;
      }
      case 'stars': {
        const gr = g.createRadialGradient(80 + r() * 100, 80 + r() * 100, 10, 128, 128, 200);
        gr.addColorStop(0, sk.body2); gr.addColorStop(1, sk.body);
        g.fillStyle = gr; g.fillRect(0, 0, W, W);
        for (let i = 0; i < 90; i++) {
          const big = r() < 0.08;
          g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
          g.beginPath(); g.arc(r() * W, r() * W, big ? 1.6 : 0.6 + r() * 0.6, 0, 7); g.fill();
        }
        break;
      }
      default:
        g.fillStyle = sk.body; g.fillRect(0, 0, W, W);
    }
  }

  // ---------- shapes ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const PHI = (1 + Math.sqrt(5)) / 2;

  // Die key -> body. d3, d5 and d7 use the d6, d10 and d14 bodies with each
  // number twice, like the common printed versions of those dice.
  const GEOM = {
    d3: 'd6', d4: 'd4', d5: 'trap5', d6: 'd6', dF: 'd6', d7: 'trap7', d8: 'd8',
    d10: 'trap5', d10t: 'trap5', d10u: 'trap5', d12: 'd12', d14: 'trap7', d16: 'trap8',
    d20: 'd20', d24: 'd24', d30: 'd30', token: 'token',
  };

  // n-gonal trapezohedron (d10 for n=5, d14 for n=7, d16 for n=8).
  function trapezohedron(n, stretch) {
    const c = Math.cos(Math.PI / n);
    const e = (1 - c) / (1 + c); // makes the kite faces planar
    const out = [V(0, 0, stretch), V(0, 0, -stretch)];
    for (let k = 0; k < n; k++) {
      const a = (k * 2 * Math.PI) / n;
      const b = a + Math.PI / n;
      out.push(V(Math.cos(a), Math.sin(a), e * stretch), V(Math.cos(b), Math.sin(b), -e * stretch));
    }
    return out;
  }

  function dodecahedron() {
    const out = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push(V(x, y, z));
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      out.push(V(0, a / PHI, b * PHI), V(a / PHI, b * PHI, 0), V(a * PHI, 0, b / PHI));
    }
    return out;
  }

  function shapeVertices(geom) {
    const out = [];
    switch (geom) {
      case 'd4':
        return [V(1, 1, 1), V(1, -1, -1), V(-1, 1, -1), V(-1, -1, 1)];
      case 'd6':
        for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push(V(x, y, z));
        return out;
      case 'd8':
        return [V(1, 0, 0), V(-1, 0, 0), V(0, 1, 0), V(0, -1, 0), V(0, 0, 1), V(0, 0, -1)];
      case 'trap5': return trapezohedron(5, 1);
      case 'trap7': return trapezohedron(7, 1.35);
      case 'trap8': return trapezohedron(8, 1.4);
      case 'd12':
        return dodecahedron();
      case 'd20':
        for (const a of [-1, 1]) for (const b of [-1, 1]) {
          out.push(V(0, a, b * PHI), V(a, b * PHI, 0), V(a * PHI, 0, b));
        }
        return out;
      case 'd24': { // deltoidal icositetrahedron: 24 kites
        const r = Math.SQRT1_2;
        const a = (1 + 2 * Math.SQRT2) / 7;
        for (const s of [-1, 1]) out.push(V(s, 0, 0), V(0, s, 0), V(0, 0, s));
        for (const s of [-1, 1]) for (const t of [-1, 1]) out.push(V(0, s * r, t * r), V(s * r, 0, t * r), V(s * r, t * r, 0));
        for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push(V(x * a, y * a, z * a));
        return out;
      }
      case 'd30': { // rhombic triacontahedron: dodecahedron + icosahedron vertices
        out.push(...dodecahedron());
        for (const s of [-1, 1]) for (const t of [-1, 1]) {
          out.push(V(0, s * PHI, t), V(s * PHI, t, 0), V(s, 0, t * PHI));
        }
        return out;
      }
      default: { // token: a thick coin
        for (let k = 0; k < 24; k++) {
          const a = (k * 2 * Math.PI) / 24;
          out.push(V(Math.cos(a), Math.sin(a), 0.22), V(Math.cos(a), Math.sin(a), -0.22));
        }
        return out;
      }
    }
  }

  const SCALE = {
    d3: 1.12, d4: 1.25, d5: 1.02, d6: 1.12, dF: 1.12, d7: 1.12, d8: 1.08, d10: 1.02, d10t: 1.02, d10u: 1.02,
    d12: 1.0, d14: 1.12, d16: 1.14, d20: 1.04, d24: 1.06, d30: 1.08, token: 0.9,
  };

  function labelsFor(key, sides) {
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => String(a + k));
    switch (key) {
      case 'd3': return [...range(1, 3), ...range(1, 3)];
      case 'd4': return range(1, 4);
      case 'd5': return [...range(1, 5), ...range(1, 5)];
      case 'd6': return range(1, 6);
      case 'd7': return [...range(1, 7), ...range(1, 7)];
      case 'd14': return range(1, 14);
      case 'd16': return range(1, 16);
      case 'd24': return range(1, 24);
      case 'd30': return range(1, 30);
      case 'dF': return ['+', '+', '−', '−', ' ', ' '];
      case 'd8': return range(1, 8);
      case 'd10': return range(1, 10);
      case 'd10u': return range(0, 9);
      case 'd10t': return range(0, 9).map((d) => (d === '0' ? '00' : `${d}0`));
      case 'd12': return range(1, 12);
      case 'd20': return range(1, 20);
      default: return [String(sides || '?')];
    }
  }

  // Brute-force convex hull: every plane through three vertices with all
  // vertices on one side is a face. Fine for at most 48 vertices.
  function hullFaces(verts) {
    const faces = [];
    const n = verts.length;
    const eps = 1e-6;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
      const nrm = new THREE.Vector3().subVectors(verts[b], verts[a]).cross(new THREE.Vector3().subVectors(verts[c], verts[a]));
      if (nrm.lengthSq() < 1e-10) continue;
      nrm.normalize();
      let d = nrm.dot(verts[a]);
      let pos = 0;
      let neg = 0;
      for (const v of verts) {
        const s = nrm.dot(v) - d;
        if (s > eps) pos++;
        else if (s < -eps) neg++;
      }
      if (pos && neg) continue;
      if (pos) { nrm.negate(); d = -d; }
      if (faces.some((f) => f.normal.dot(nrm) > 0.9999)) continue;
      const idx = [];
      verts.forEach((v, k) => { if (Math.abs(nrm.dot(v) - d) < 1e-4) idx.push(k); });
      const center = new THREE.Vector3();
      idx.forEach((k) => center.add(verts[k]));
      center.divideScalar(idx.length);
      const u0 = new THREE.Vector3().subVectors(verts[idx[0]], center).normalize();
      const w0 = new THREE.Vector3().crossVectors(nrm, u0);
      const ang = (k) => {
        const p = new THREE.Vector3().subVectors(verts[k], center);
        return Math.atan2(p.dot(w0), p.dot(u0));
      };
      idx.sort((x, y) => ang(x) - ang(y));
      faces.push({ normal: nrm, center, idx });
    }
    return faces;
  }

  const textureCache = new Map();
  const shapeCache = new Map();

  function faceTexture(palette, draw, cacheKey) {
    const key = `${palette}|${cacheKey}`;
    if (textureCache.has(key)) return textureCache.get(key);
    const sk = SKINS[palette] || SKINS.ivory;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    paintBody(g, sk, seeded(key));
    g.fillStyle = sk.ink;
    g.strokeStyle = sk.ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // a soft edge keeps the label readable on patterned and metal skins
    if (sk.pattern !== 'gradient' && sk.pattern !== 'grain') {
      g.shadowColor = sk.ink === '#ffffff' || sk.ink === '#f8ecd4' || sk.ink === '#f4f3f8' ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.45)';
      g.shadowBlur = 4;
    }
    draw(g);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    textureCache.set(key, tex);
    return tex;
  }

  function drawLabel(g, text, x, y, px, angle, underline) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.font = `700 ${px}px -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif`;
    if (text === '+' || text === '−') {
      const L = px * 0.42;
      g.lineWidth = px * 0.16;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-L, 0); g.lineTo(L, 0);
      if (text === '+') { g.moveTo(0, -L); g.lineTo(0, L); }
      g.stroke();
    } else {
      g.fillText(text, 0, px * 0.04);
      if (underline) g.fillRect(-px * 0.28, px * 0.42, px * 0.56, px * 0.07);
    }
    g.restore();
  }

  // Builds the geometry and the face data of one die shape (cached).
  function buildShape(key, sides) {
    const ck = key === 'token' ? `token${sides}` : key;
    if (shapeCache.has(ck)) return shapeCache.get(ck);
    const geom = GEOM[key] || 'token';
    const verts = shapeVertices(geom);
    const maxLen = Math.max(...verts.map((v) => v.length()));
    verts.forEach((v) => v.multiplyScalar(SCALE[key] / maxLen));
    const faces = hullFaces(verts);
    const labels = labelsFor(key, sides);

    // Face axes for texture mapping: v points to the "up" of the label.
    faces.forEach((f) => {
      let far = f.idx[0];
      let farLen = -1;
      for (const k of f.idx) {
        const l = verts[k].distanceTo(f.center);
        if (l > farLen + 1e-6) { farLen = l; far = k; }
      }
      // kites and rhombi point their label to the far vertex, squares to an edge, others to a vertex
      let upPoint = verts[f.idx[0]];
      if (geom.startsWith('trap') || geom === 'd24' || geom === 'd30') upPoint = verts[far];
      else if (f.idx.length === 4) upPoint = verts[f.idx[0]].clone().add(verts[f.idx[1]]).multiplyScalar(0.5);
      f.v = new THREE.Vector3().subVectors(upPoint, f.center).normalize();
      f.u = new THREE.Vector3().crossVectors(f.v, f.normal).normalize();
      f.radius = farLen;
      f.inradius = Math.min(...f.idx.map((k, j) => {
        const a = verts[k];
        const b = verts[f.idx[(j + 1) % f.idx.length]];
        const ab = new THREE.Vector3().subVectors(b, a);
        const ac = new THREE.Vector3().subVectors(f.center, a);
        return ac.clone().sub(ab.clone().multiplyScalar(ac.dot(ab) / ab.lengthSq())).length();
      }));
    });

    // Label assignment: opposite faces sum to n+1 where the die has opposite faces.
    if (key === 'token') {
      faces.forEach((f) => { f.label = null; });
      const caps = faces.filter((f) => Math.abs(f.normal.z) > 0.9);
      caps.sort((a, b) => b.normal.z - a.normal.z);
      caps[0].label = 'TOP';
      caps[1].label = `d${sides}`;
    } else if (key !== 'd4') {
      const N = labels.length;
      let k = 0;
      faces.forEach((f) => {
        if (f.label !== undefined) return;
        f.label = labels[k];
        const opp = faces.find((o) => o.label === undefined && o.normal.dot(f.normal) < -0.999);
        if (opp) opp.label = labels[N - 1 - k];
        k++;
      });
    }

    const shape = { key, verts, faces, labels, sides };
    shapeCache.set(ck, shape);
    return shape;
  }

  function buildMesh(shape, palette, topLabel) {
    const { key, verts, faces } = shape;
    const pos = [];
    const nor = [];
    const uv = [];
    const geo = new THREE.BufferGeometry();
    const mats = [];
    const sixNine = shape.labels.includes('6') && shape.labels.includes('9');
    const plain = faceTexture(palette, () => {}, 'plain');

    faces.forEach((f, fi) => {
      const toUV = (p) => {
        const d = new THREE.Vector3().subVectors(p, f.center);
        return [0.5 + (0.5 * d.dot(f.u)) / f.radius, 0.5 + (0.5 * d.dot(f.v)) / f.radius];
      };
      const start = pos.length / 3;
      const ring = f.idx.map((k) => verts[k]);
      for (let j = 0; j < ring.length; j++) {
        const tri = [f.center, ring[j], ring[(j + 1) % ring.length]];
        for (const p of tri) {
          pos.push(p.x, p.y, p.z);
          nor.push(f.normal.x, f.normal.y, f.normal.z);
          uv.push(...toUV(p));
        }
      }
      geo.addGroup(start, pos.length / 3 - start, fi);

      const inUV = (0.5 * f.inradius) / f.radius;
      let tex = plain;
      if (key === 'd4') {
        const corner = f.idx.map((k) => ({ k, uv: toUV(verts[k]) }));
        const lbl = corner.map((c) => shape.labels[c.k]).join('');
        tex = faceTexture(palette, (g) => {
          for (const c of corner) {
            const du = c.uv[0] - 0.5;
            const dv = c.uv[1] - 0.5;
            const x = 128 + 256 * 0.56 * du;
            const y = 128 - 256 * 0.56 * dv;
            drawLabel(g, shape.labels[c.k], x, y, 256 * inUV * 0.8, Math.atan2(du, dv), false);
          }
        }, `d4:${lbl}`);
      } else if (f.label) {
        const text = f.label === 'TOP' ? topLabel : f.label;
        const isSide = key === 'token' && f.label !== 'TOP';
        const px = 256 * inUV * (text.length >= 3 ? 0.9 : text.length === 2 ? 1.15 : 1.45) * (isSide ? 0.75 : 1);
        tex = faceTexture(palette, (g) => drawLabel(g, text, 128, 128, px, 0, sixNine && (text === '6' || text === '9')), `${key}:${text}:${Math.round(px)}`);
      }
      const sk = SKINS[palette] || SKINS.ivory;
      mats.push(new THREE.MeshStandardMaterial({ map: tex, roughness: sk.rough, metalness: sk.metal }));
    });

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 10),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
    );
    mesh.add(edges);
    return mesh;
  }

  // Local direction that must point at the camera, and the label "up" on it.
  function topOf(shape, top) {
    if (shape.key === 'd4') {
      const k = shape.labels.indexOf(top);
      const dir = shape.verts[Math.max(0, k)].clone().normalize();
      const up = new THREE.Vector3(0, 0, 1).cross(dir);
      if (up.lengthSq() < 1e-6) up.set(1, 0, 0);
      return { dir, up: up.normalize() };
    }
    let candidates = shape.faces.filter((f) => (shape.key === 'token' ? f.label === 'TOP' : f.label === top));
    if (!candidates.length) candidates = [shape.faces[0]];
    const f = candidates[Math.floor(rnd() * candidates.length)];
    return { dir: f.normal.clone(), up: f.v.clone() };
  }

  // ---------- stage: one renderer, made on first use ----------
  let S = null;
  function stage() {
    if (S) return S;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const host = document.getElementById('diceStage') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'diceStage' }));
    host.className = 'dice-stage';
    host.hidden = true;
    if (!host.querySelector('.dice-backdrop')) host.insertAdjacentHTML('afterbegin', '<div class="dice-backdrop"></div>');
    host.appendChild(renderer.domElement);
    host.addEventListener('pointerdown', () => { if (current) current.skip(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current && !current.settled) { e.stopPropagation(); current.skip(); } }, true);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a99, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 5;
    scene.add(sun, sun.target);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.32 }));
    floor.receiveShadow = true;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 10000);
    S = { host, renderer, scene, sun, floor, camera };
    return S;
  }

  // Sizes the stage to the window: the camera sees exactly W x H pixels at z = 0.
  function layout(st, W, H) {
    const FOV = 30;
    const camDist = H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
    st.renderer.setSize(W, H);
    st.camera.aspect = W / H;
    st.camera.far = camDist * 3;
    st.camera.position.set(W / 2, H / 2, camDist);
    st.camera.lookAt(W / 2, H / 2, 0);
    st.camera.updateProjectionMatrix();
    st.sun.position.set(W / 2 - W * 0.25, H / 2 + H * 0.45, 1600);
    st.sun.target.position.set(W / 2, H / 2, 0);
    const sc = st.sun.shadow.camera;
    sc.left = -W * 0.75; sc.right = W * 0.75; sc.top = H * 0.9; sc.bottom = -H * 0.9;
    sc.near = 100; sc.far = 4000;
    sc.updateProjectionMatrix();
    st.floor.scale.set(W * 3, H * 3, 1);
    st.floor.position.set(W / 2, H / 2, 0);
  }

  let current = null;
  const DT = 1 / 120;
  const G = 2600;
  const FACES_PER_TURN = { d3: 4, d4: 3, d5: 5, d6: 4, dF: 4, d7: 7, d8: 5, d10: 5, d10t: 5, d10u: 5, d12: 6, d14: 7, d16: 8, d20: 8, d24: 9, d30: 10, token: 3 };

  function throwDice(list, opts) {
    opts = opts || {};
    if (current) current.stop();
    if (!list || !list.length || typeof THREE === 'undefined') return null;
    let st;
    try { st = stage(); } catch (e) { return null; }   // no WebGL
    const W = window.innerWidth;
    const H = window.innerHeight;
    layout(st, W, H);

    const n = list.length;
    const size = (opts.size || 70) * Math.min(1, Math.sqrt(10 / Math.max(n, 1)));
    // opts.palette: one skin for all dice; d.skin (per die) wins, for "Random".
    const skinOf = (d) => (SKINS[d.skin] ? d.skin : SKINS[opts.palette] ? opts.palette : 'ivory');

    const dice = list.map((d) => {
      const shape = buildShape(d.shape === 'token' ? 'token' : d.shape, d.sides);
      const mesh = buildMesh(shape, skinOf(d), d.top);
      mesh.scale.setScalar(size);
      st.scene.add(mesh);
      const t = topOf(shape, d.top);
      const qa = new THREE.Quaternion().setFromUnitVectors(t.dir, new THREE.Vector3(0, 0, 1));
      const up = t.up.clone().applyQuaternion(qa);
      const spin = Math.atan2(up.x, up.y) + between(-0.4, 0.4);
      const qFinal = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spin).multiply(qa);
      return { data: d, shape, mesh, qFinal, r: size * (SCALE[shape.key] || 1) };
    });

    // ---------- throw simulation (precomputed) ----------
    const sidesFrom = ['bottom', 'left', 'right', 'bottomLeft', 'bottomRight'];
    const from = sidesFrom[Math.floor(rnd() * sidesFrom.length)];
    const origin = {
      bottom: [W * between(0.3, 0.7), -H * 0.15],
      left: [-W * 0.08, H * between(0.25, 0.6)],
      right: [W * 1.08, H * between(0.25, 0.6)],
      bottomLeft: [-W * 0.05, -H * 0.1],
      bottomRight: [W * 1.05, -H * 0.1],
    }[from];
    const FLOOR_Y = 0;   // no result panel: the whole window is the table
    const spreadX = Math.min(W * 0.3, 60 + size * 1.4 * Math.sqrt(n));
    const spreadY = Math.min(H * 0.3, 40 + size * 1.0 * Math.sqrt(n));
    const centerY = H * 0.5;

    const bodies = dice.map((d, k) => {
      const pair = d.data.pair && k > 0 && list[k - 1].pair && list[k - 1].group === d.data.group && d.data.shape === 'd10u';
      const sx = origin[0] + between(-60, 60) + (pair ? d.r * 2.2 : 0);
      const sy = origin[1] + between(-60, 60);
      const tx = W / 2 + between(-spreadX, spreadX);
      const ty = centerY + between(-spreadY, spreadY);
      const flight = between(0.95, 1.25);
      const vx = (tx - sx) / flight;
      const vy = (ty - sy) / flight;
      return {
        r: d.r,
        x: sx, y: sy, z: between(d.r * 1.5, d.r * 3.5),
        vx, vy, vz: between(350, 750),
        inside: false, settled: false, path: 0,
        axis: new THREE.Vector3(-vy, vx, 0).normalize(),
        axis2: new THREE.Vector3(between(-1, 1), between(-1, 1), between(-0.3, 0.3)).normalize(),
        frames: [],
      };
    });

    const soundEvents = [];
    const lastClack = new Map();
    function simulate() {
      const maxSteps = Math.round(4.2 / DT);
      let step = 0;
      for (; step < maxSteps; step++) {
        const forceStop = step > maxSteps - 2;
        for (let k = 0; k < bodies.length; k++) {
          const b = bodies[k];
          if (!b.settled) {
            b.vz -= G * DT;
            b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT;
            b.path += Math.hypot(b.vx, b.vy) * DT;
            if (b.z <= 0) {
              b.z = 0;
              if (b.vz < -120) {
                soundEvents.push({ t: step * DT, type: 'impact', s: Math.min(1, -b.vz / 1400), x: b.x, k });
                b.vz = -b.vz * 0.38; b.vx *= 0.82; b.vy *= 0.82;
              } else b.vz = 0;
            }
            if (b.z === 0) {
              const f = Math.exp(-2.6 * DT);
              b.vx *= f; b.vy *= f;
            }
            const r = b.r;
            const lowY = FLOOR_Y + r;
            if (!b.inside && ((b.x > r && b.x < W - r && b.y > lowY && b.y < H - r) || step * DT > 0.8)) b.inside = true;
            if (b.inside) {
              if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * 0.5; }
              if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx) * 0.5; }
              if (b.y < lowY) { b.y = lowY; b.vy = Math.abs(b.vy) * 0.5; }
              if (b.y > H - r) { b.y = H - r; b.vy = -Math.abs(b.vy) * 0.5; }
            }
            if ((b.z === 0 && Math.hypot(b.vx, b.vy) < 18) || forceStop) {
              b.settled = true; b.vx = b.vy = b.vz = 0; b.z = 0;
            }
          }
        }
        // die-to-die collisions
        for (let a = 0; a < bodies.length; a++) for (let c = a + 1; c < bodies.length; c++) {
          const p = bodies[a];
          const q = bodies[c];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const min = p.r + q.r;
          const dist = Math.hypot(dx, dy);
          if (dist >= min || dist < 1e-6 || Math.abs(p.z - q.z) > min) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = min - dist;
          const wp = p.settled && !q.settled ? 0.15 : q.settled && !p.settled ? 0.85 : 0.5;
          p.x -= nx * overlap * wp; p.y -= ny * overlap * wp;
          q.x += nx * overlap * (1 - wp); q.y += ny * overlap * (1 - wp);
          const rel = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
          const pairKey = a * 1000 + c;
          if (rel < -50 && step * DT - (lastClack.get(pairKey) ?? -1) > 0.04) {
            lastClack.set(pairKey, step * DT);
            soundEvents.push({ t: step * DT, type: 'clack', s: Math.min(1, -rel / 900), x: (p.x + q.x) / 2, k: a, k2: c });
          }
          if (rel < 0) {
            const j = -rel * 0.75;
            if (!p.settled) { p.vx -= nx * j; p.vy -= ny * j; }
            if (!q.settled) { q.vx += nx * j; q.vy += ny * j; }
            if (p.settled && rel < -60) { p.settled = false; p.vx -= nx * j * 0.4; p.vy -= ny * j * 0.4; }
            if (q.settled && rel < -60) { q.settled = false; q.vx += nx * j * 0.4; q.vy += ny * j * 0.4; }
          }
        }
        for (const b of bodies) b.frames.push(b.x, b.y, b.z, b.path);
        if (bodies.every((b) => b.settled)) break;
      }
      return step + 1;
    }
    const steps = simulate();
    const settleTime = steps * DT;
    bodies.forEach((b) => { b.total = b.frames[b.frames.length - 1]; });

    // Rolling clicks: one soft click each time a die tips onto its next face.
    bodies.forEach((b, k) => {
      const stepAngle = (2 * Math.PI) / (FACES_PER_TURN[dice[k].shape.key] || 5);
      let lastIndex = 0;
      for (let f = 1; f < steps; f++) {
        const z = b.frames[f * 4 + 2];
        const path = b.frames[f * 4 + 3];
        const index = Math.floor((path / b.r) * 1.1 / stepAngle);
        if (index === lastIndex) continue;
        lastIndex = index;
        const speed = (path - b.frames[(f - 1) * 4 + 3]) / DT;
        if (z > 1 || speed < 25) continue;
        soundEvents.push({ t: f * DT, type: 'roll', s: Math.min(1, speed / 900) * 0.55, x: b.frames[f * 4], k });
      }
    });

    const tmpQ = new THREE.Quaternion();
    const tmpQ2 = new THREE.Quaternion();
    const tmpV = new THREE.Vector3();
    function pose(k, t) {
      const d = dice[k];
      const b = bodies[k];
      const f = Math.min(steps - 1, Math.max(0, Math.floor(t / DT))) * 4;
      const x = b.frames[f];
      const y = b.frames[f + 1];
      const z = b.frames[f + 2];
      const remaining = (b.total - b.frames[f + 3]) / d.r;
      tmpQ.setFromAxisAngle(b.axis, -remaining * 1.1);
      tmpQ2.setFromAxisAngle(b.axis2, -remaining * 0.35);
      d.mesh.quaternion.copy(tmpQ).multiply(tmpQ2).multiply(d.qFinal);
      let low = Infinity;   // keep the lowest vertex on the table
      for (const v of d.shape.verts) {
        tmpV.copy(v).applyQuaternion(d.mesh.quaternion);
        if (tmpV.z < low) low = tmpV.z;
      }
      d.mesh.position.set(x, y, z - low * size);
    }

    // ---------- sound ----------
    let audio = null;
    if (opts.sound && window.DiceSound) {
      const sizeFactor = Math.pow(70 / size, 0.25);
      const pitch = dice.map((d) => (window.DiceSound.PITCH[d.shape.key] || 3000) * sizeFactor * between(0.92, 1.08));
      try {
        audio = window.DiceSound.play(soundEvents, (k) => pitch[k], { volume: opts.volume === undefined ? 0.7 : Number(opts.volume), width: W });
      } catch (e) { audio = null; }
    }

    // ---------- loop ----------
    const revealDelay = opts.revealDelay === undefined ? 0.35 : opts.revealDelay;
    const hold = opts.hold === undefined ? 1.6 : opts.hold;
    let t0 = performance.now();
    let raf = 0;
    let fadeTimer = 0;
    let fading = false;
    const host = st.host;
    host.classList.remove('out', 'revealed');
    host.hidden = false;

    const run = {
      settleTime,
      settled: false,
      sounds: soundEvents.length,
      skip() {
        if (run.settled) return;
        t0 = performance.now() - (settleTime + revealDelay) * 1000;
        if (audio && audio.suspend) audio.suspend().then(() => audio.resume()).catch(() => {});
      },
      stop() {
        cancelAnimationFrame(raf);
        clearTimeout(fadeTimer);
        dice.forEach((d) => {
          st.scene.remove(d.mesh);
          d.mesh.geometry.dispose();
          d.mesh.material.forEach((m) => m.dispose());
          d.mesh.children.forEach((c) => { c.geometry.dispose(); c.material.dispose(); });
        });
        host.hidden = true;
        host.classList.remove('out', 'revealed');
        if (current === run) current = null;
        if (!run.settled) { run.settled = true; if (opts.onSettled) opts.onSettled(); }
      },
    };

    function frame(now) {
      const t = (now - t0) / 1000;
      for (let k = 0; k < dice.length; k++) pose(k, t);
      st.renderer.render(st.scene, st.camera);
      if (!run.settled && t >= settleTime + revealDelay) {
        run.settled = true;
        host.classList.add('revealed');
        if (opts.onSettled) opts.onSettled();
      }
      if (!fading && t > settleTime + revealDelay + hold) {
        fading = true;
        host.classList.add('out');
        fadeTimer = setTimeout(run.stop, 450);
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    current = run;
    raf = requestAnimationFrame(frame);
    return run;
  }

  // The stage element with only its backdrop: shown at once when an action
  // rolls its first die, so no frame shows the result before the dice.
  function cover() {
    let host = document.getElementById('diceStage');
    if (!host) {
      host = document.createElement('div');
      host.id = 'diceStage';
      host.className = 'dice-stage';
      host.innerHTML = '<div class="dice-backdrop"></div>';
      document.body.appendChild(host);
    }
    host.classList.remove('out', 'revealed');
    host.hidden = false;
    return host;
  }
  function uncover() {
    const host = document.getElementById('diceStage');
    if (host && !current) host.hidden = true;
  }

  window.Dice3D = { throwDice, cover, uncover, buildShape, SKINS, SKIN_IDS, PALETTES, isRolling: () => !!(current && !current.settled) };
})();
