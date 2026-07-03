// 乗り物ファクトリ集（地上スポーン + 実マウント）
// 5種: ホバーバイク / スカイボード / ジェットスケート / ドラゴン / UFO
// 各乗り物は THREE.Group を返し、足元(0, ~0.1, 0)に配置する想定。
// player.object の子として add され、プレイヤーが乗っている間ずっと表示される。

import * as THREE from 'three';

function emissiveMat(color, intensity = 0.6, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts.emissive ?? color,
    emissiveIntensity: intensity,
    roughness: opts.roughness ?? 0.45,
    metalness: opts.metalness ?? 0.4,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}
function plainMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.25,
  });
}
function withShadow(mesh) {
  mesh.castShadow = true;
  return mesh;
}

// =====================================================
// ホバーバイク
// =====================================================
function veh_hoverBike() {
  const g = new THREE.Group();
  g.name = 'vehicle_hoverBike';

  // 本体（フレーム）
  const frame = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.22, 1.8),
    plainMat(0x3344aa, { metalness: 0.6 })
  ));
  frame.position.y = 0.35;
  g.add(frame);

  // ノーズ
  const nose = withShadow(new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.5, 6),
    plainMat(0x3344aa, { metalness: 0.6 })
  ));
  nose.position.set(0, 0.35, 1.05);
  nose.rotation.x = Math.PI / 2;
  g.add(nose);

  // シート
  const seat = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.1, 0.5),
    plainMat(0x222222, { roughness: 0.85 })
  ));
  seat.position.set(0, 0.5, -0.15);
  g.add(seat);

  // ハンドル
  const bar = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8),
    plainMat(0x111111)
  ));
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.7, 0.55);
  g.add(bar);

  // 推進ノズル（青く光る）
  const nozzle = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.12, 0.3, 12),
    emissiveMat(0x44aaff, 2.0)
  ));
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.35, -1.05);
  g.add(nozzle);

  // ホバー（下のグロー）
  const hoverA = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 0.06, 14),
    emissiveMat(0x66ccff, 2.4, { transparent: true, opacity: 0.7 })
  );
  hoverA.position.set(0, 0.05, 0.6);
  g.add(hoverA);
  const hoverB = hoverA.clone();
  hoverB.position.z = -0.6;
  g.add(hoverB);

  return g;
}

// =====================================================
// スカイボード（サーフボード型）
// =====================================================
function veh_skyBoard() {
  const g = new THREE.Group();
  g.name = 'vehicle_skyBoard';

  // ボード本体
  const board = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.08, 1.7),
    plainMat(0xff6633, { metalness: 0.3 })
  ));
  board.position.y = 0.15;
  g.add(board);

  // ノーズの曲線（球で代用）
  const nose = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    plainMat(0xff6633)
  ));
  nose.scale.set(1, 0.3, 0.5);
  nose.position.set(0, 0.18, 0.9);
  g.add(nose);

  // 縞模様（白）
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.082, 1.6),
    emissiveMat(0xffffff, 0.4, { metalness: 0.2 })
  );
  stripe.position.y = 0.16;
  g.add(stripe);

  // 後方ジェット
  for (let i = 0; i < 2; i++) {
    const jet = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.4, 10),
      emissiveMat(0xff8855, 2.2, { transparent: true, opacity: 0.8 })
    );
    jet.position.set(i ? 0.15 : -0.15, 0.1, -0.95);
    jet.rotation.x = -Math.PI / 2;
    g.add(jet);
  }

  // 下のグロー
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, 0.05, 14),
    emissiveMat(0xff9966, 1.8, { transparent: true, opacity: 0.5 })
  );
  glow.position.y = 0.04;
  g.add(glow);

  return g;
}

// =====================================================
// ジェットスケート（足元の高速スケート）
// =====================================================
function veh_jetSkate() {
  const g = new THREE.Group();
  g.name = 'vehicle_jetSkate';

  // 2枚の板（左右）
  for (let i = 0; i < 2; i++) {
    const skate = withShadow(new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.08, 0.9),
      plainMat(0x444444, { metalness: 0.7 })
    ));
    skate.position.set(i ? 0.18 : -0.18, 0.1, 0);
    g.add(skate);

    // ジェットノズル
    const noz = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.05, 0.16, 10),
      emissiveMat(0x00ffaa, 2.4)
    );
    noz.rotation.x = Math.PI / 2;
    noz.position.set(i ? 0.18 : -0.18, 0.11, -0.5);
    g.add(noz);

    // 下のグロー
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 0.04, 12),
      emissiveMat(0x66ffcc, 2.0, { transparent: true, opacity: 0.7 })
    );
    glow.position.set(i ? 0.18 : -0.18, 0.03, 0);
    g.add(glow);
  }

  return g;
}

// =====================================================
// ドラゴン（騎乗）— リアル造形版
// カクカクした継ぎ目を排し、背骨スプラインに沿った
// 可変半径チューブで首〜胴〜尻尾を1本の滑らかな体に。
// 鱗はプロシージャルテクスチャ(色+バンプ)、翼膜は
// たわみ付きパラメトリック曲面+血管テクスチャ。
// userData.mouth / userData.animate は従来と同じAPI。
// =====================================================

// --- 鱗テクスチャ(色マップ + バンプ)を生成 ---
function _dragonScaleTextures(baseHex) {
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const b = document.createElement('canvas'); b.width = b.height = size;
  const btx = b.getContext('2d');
  if (!ctx || !btx) return { map: null, bump: null }; // 2D非対応環境フォールバック
  const base = new THREE.Color(baseHex);
  ctx.fillStyle = '#' + base.getHexString();
  ctx.fillRect(0, 0, size, size);
  btx.fillStyle = '#808080'; btx.fillRect(0, 0, size, size);
  // 千鳥配置の半円鱗
  const rw = 26, rh = 18;
  for (let row = -1; row < size / rh + 1; row++) {
    const off = (row % 2) * rw / 2;
    for (let col = -1; col < size / rw + 1; col++) {
      const x = col * rw + off, y = row * rh;
      const v = (Math.random() - 0.5) * 0.16;
      const col2 = base.clone().offsetHSL(0.004 * (Math.random() - 0.5), 0.04 * (Math.random() - 0.5), v * 0.5);
      ctx.fillStyle = '#' + col2.getHexString();
      ctx.beginPath(); ctx.arc(x, y, rw * 0.52, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, rw * 0.52, 0, Math.PI); ctx.stroke();
      // バンプ: 鱗ごとに明→暗のグラデで盛り上げ
      const g = btx.createRadialGradient(x, y, 1, x, y, rw * 0.55);
      g.addColorStop(0, '#b5b5b5'); g.addColorStop(0.8, '#6a6a6a'); g.addColorStop(1, '#3d3d3d');
      btx.fillStyle = g;
      btx.beginPath(); btx.arc(x, y, rw * 0.52, 0, Math.PI); btx.fill();
    }
  }
  const map = new THREE.CanvasTexture(c);
  const bump = new THREE.CanvasTexture(b);
  map.wrapS = map.wrapT = bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

// --- 可変半径チューブ: スプライン+半径列から滑らかな体を作る ---
function _taperedTube(points, radii, tubularSegs = 64, radialSegs = 14, mat) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const pos = [], norm = [], uv = [], idx = [];
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const p = curve.getPointAt(t);
    // 半径列を線形補間
    const rf = t * (radii.length - 1);
    const r0 = Math.floor(rf), r1 = Math.min(r0 + 1, radii.length - 1);
    const radius = radii[r0] + (radii[r1] - radii[r0]) * (rf - r0);
    const N = frames.normals[Math.min(i, tubularSegs - 1)];
    const B = frames.binormals[Math.min(i, tubularSegs - 1)];
    for (let j = 0; j <= radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2;
      const sin = Math.sin(a), cos = Math.cos(a);
      const nx = cos * N.x + sin * B.x, ny = cos * N.y + sin * B.y, nz = cos * N.z + sin * B.z;
      pos.push(p.x + radius * nx, p.y + radius * ny, p.z + radius * nz);
      norm.push(nx, ny, nz);
      uv.push(j / radialSegs * 3, t * 10);
    }
  }
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * (radialSegs + 1) + j;
      const bb = a + radialSegs + 1;
      idx.push(a, bb, a + 1, bb, bb + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function veh_dragon() {
  const g = new THREE.Group();
  g.name = 'vehicle_dragon';

  const SCALE_RED = 0xa32020, HORN_DARK = 0x1d1714, MEMBRANE = 0x8a1a12;
  const tex = _dragonScaleTextures(SCALE_RED);
  const bellyTex = _dragonScaleTextures(0xc47a3a);
  const scaleMat = new THREE.MeshStandardMaterial({
    color: tex.map ? 0xffffff : SCALE_RED,
    map: tex.map, bumpMap: tex.bump, bumpScale: 0.9,
    roughness: 0.55, metalness: 0.25,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: bellyTex.map ? 0xffffff : 0xc47a3a,
    map: bellyTex.map, bumpMap: bellyTex.bump, bumpScale: 0.7,
    roughness: 0.6, metalness: 0.2,
  });
  const hornMat = plainMat(HORN_DARK, { roughness: 0.32, metalness: 0.6 });
  const darkMat = plainMat(0x5a1010, { roughness: 0.55, metalness: 0.3 });

  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---- 体幹: 首の付け根→胸→腹→腰まで1本の滑らかなチューブ ----
  const body = _taperedTube(
    [V(0, 3.85, 2.65), V(0, 3.3, 2.5), V(0, 2.6, 2.2), V(0, 1.95, 1.7),
     V(0, 1.6, 0.9), V(0, 1.5, 0.0), V(0, 1.5, -0.9), V(0, 1.55, -1.8)],
    [0.24, 0.3, 0.38, 0.55, 0.78, 0.85, 0.66, 0.45],
    72, 16, scaleMat);
  g.add(body);
  // 喉〜腹の琥珀ライン(体の下面に沿う細いチューブ)
  const belly = _taperedTube(
    [V(0, 3.6, 2.85), V(0, 2.4, 2.45), V(0, 1.35, 1.55), V(0, 0.95, 0.5),
     V(0, 0.9, -0.4), V(0, 1.05, -1.4)],
    [0.13, 0.2, 0.38, 0.48, 0.45, 0.28],
    48, 12, bellyMat);
  g.add(belly);

  // ---- 尻尾: 別チューブ(tailPivotで揺らす)・鞭状に細く長く ----
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 1.55, -1.8);
  g.add(tailPivot);
  const tail = _taperedTube(
    [V(0, 0, 0.2), V(0, -0.1, -1.0), V(0.25, -0.35, -2.0),
     V(0.1, -0.7, -3.1), V(-0.15, -0.95, -4.0), V(0, -1.05, -4.6)],
    [0.44, 0.34, 0.24, 0.15, 0.08, 0.03],
    56, 12, scaleMat);
  tailPivot.add(tail);
  // 先端の槍状棘
  for (let i = 0; i < 3; i++) {
    const blade = withShadow(new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.55, 6), hornMat));
    blade.position.set((i - 1) * 0.09, -1.05, -4.75);
    blade.rotation.x = Math.PI / 2 + 0.45;
    blade.rotation.z = (i - 1) * 0.3;
    tailPivot.add(blade);
  }

  // ---- 頭部: 滑らかな頭骨+チューブのスナウト ----
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 4.0, 2.8);
  headGroup.rotation.x = 0.15;
  g.add(headGroup);

  const skull = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 20, 16), scaleMat));
  skull.scale.set(0.82, 0.78, 1.1);
  headGroup.add(skull);
  // スナウト(上顎): 頭骨から鼻先へ滑らかにタペリング
  const snout = _taperedTube(
    [V(0, 0.06, 0.15), V(0, 0.05, 0.55), V(0, 0.0, 0.95), V(0, -0.03, 1.15)],
    [0.28, 0.22, 0.15, 0.10],
    24, 12, scaleMat);
  headGroup.add(snout);
  // 下顎(開閉)
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.16, 0.1);
  headGroup.add(jaw);
  const jawTube = _taperedTube(
    [V(0, 0, 0.05), V(0, -0.02, 0.5), V(0, -0.02, 0.9), V(0, 0.0, 1.05)],
    [0.18, 0.14, 0.09, 0.05],
    20, 10, darkMat);
  jaw.add(jawTube);
  const throatGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 8), emissiveMat(0xff5500, 3.5));
  throatGlow.position.set(0, 0.03, 0.2);
  jaw.add(throatGlow);

  // 牙
  const toothMat = plainMat(0xe8dcc4, { roughness: 0.3 });
  [[-0.11, 1.0, 0.2], [0.11, 1.0, 0.2], [-0.12, 0.7, 0.16], [0.12, 0.7, 0.16], [-0.11, 0.42, 0.12], [0.11, 0.42, 0.12]].forEach(([x, z, len]) => {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.028, len, 6), toothMat);
    t.rotation.x = Math.PI; t.position.set(x, -0.12, z);
    headGroup.add(t);
  });
  [[-0.08, 0.85, 0.13], [0.08, 0.85, 0.13], [-0.08, 0.55, 0.1], [0.08, 0.55, 0.1]].forEach(([x, z, len]) => {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.026, len, 6), toothMat);
    t.position.set(x, 0.05, z);
    jaw.add(t);
  });

  // 目 + 眉稜
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 12, 10), emissiveMat(0xffb300, 3.2));
    eye.position.set(sx * 0.22, 0.1, 0.3);
    headGroup.add(eye);
    const brow = withShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8), scaleMat));
    brow.scale.set(1.1, 0.45, 1.4);
    brow.position.set(sx * 0.22, 0.2, 0.28);
    brow.rotation.z = sx * -0.3;
    headGroup.add(brow);
  }

  // 角: 後方へ湾曲したチューブ(リアルな曲がり角)
  for (const sx of [-1, 1]) {
    const horn = _taperedTube(
      [V(sx * 0.18, 0.25, -0.1), V(sx * 0.26, 0.5, -0.5),
       V(sx * 0.3, 0.62, -0.95), V(sx * 0.28, 0.55, -1.3)],
      [0.09, 0.065, 0.04, 0.012],
      20, 8, hornMat);
    headGroup.add(horn);
    const horn2 = _taperedTube(
      [V(sx * 0.3, 0.05, -0.15), V(sx * 0.42, 0.15, -0.45), V(sx * 0.46, 0.1, -0.7)],
      [0.05, 0.032, 0.01],
      14, 7, hornMat);
    headGroup.add(horn2);
  }

  // 火炎放射の発射起点
  const mouth = new THREE.Object3D();
  mouth.position.set(0, -0.06, 1.25);
  headGroup.add(mouth);

  // ---- 翼: 骨チューブ + たわみ付き曲面膜(血管テクスチャ) ----
  function _membraneTexture() {
    const s = 256;
    const c = document.createElement('canvas'); c.width = c.height = s;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const grad = ctx.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#8a1a12'); grad.addColorStop(0.6, '#6e120e'); grad.addColorStop(1, '#4d0c0a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, s, s);
    // 血管: 根本から放射状に枝分かれ
    ctx.strokeStyle = 'rgba(35,8,6,0.65)';
    for (let i = 0; i < 5; i++) {
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(6, s - 6);
      const ex = 40 + i * 52, ey = 10 + i * 26;
      ctx.quadraticCurveTo(ex * 0.45, s - ey * 0.8 - 40, ex, ey); ctx.stroke();
      for (let k = 1; k <= 3; k++) {
        ctx.lineWidth = 1.1;
        const t = k / 4;
        const mx = 6 + (ex - 6) * t * 0.9, my = (s - 6) + (ey - (s - 6)) * t;
        ctx.beginPath(); ctx.moveTo(mx, my);
        ctx.lineTo(mx + 26 + Math.random() * 18, my - 12 - Math.random() * 20); ctx.stroke();
      }
    }
    const tex2 = new THREE.CanvasTexture(c);
    return tex2;
  }
  const _memTex = _membraneTexture();
  const membraneMat = new THREE.MeshStandardMaterial({
    color: _memTex ? 0xffffff : MEMBRANE,
    map: _memTex,
    roughness: 0.5, metalness: 0.05,
    transparent: true, opacity: 0.96, side: THREE.DoubleSide,
    emissive: 0x7a1608, emissiveIntensity: 0.35,
  });

  function buildWing(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.45, 2.1, 0.5);
    // 骨: 上腕→前腕(チューブでなだらかに)
    const armTube = _taperedTube(
      [V(0, 0, 0), V(side * 0.9, 0.45, 0.05), V(side * 2.0, 0.75, 0),
       V(side * 3.3, 1.0, -0.05)],
      [0.14, 0.11, 0.085, 0.06],
      24, 8, darkMat);
    pivot.add(armTube);
    const kn = V(side * 3.3, 1.0, -0.05);
    const fingerTips = [
      V(side * 6.3, 1.75, 0.35),
      V(side * 6.0, 1.5, -1.15),
      V(side * 5.0, 1.25, -2.35),
      V(side * 3.6, 0.9, -3.15),
      V(side * 2.0, 0.55, -3.3),
    ];
    // 翼指チューブ
    for (const tip of fingerTips) {
      const mid = kn.clone().lerp(tip, 0.5); mid.y += 0.06;
      pivot.add(_taperedTube([kn.clone(), mid, tip.clone()], [0.05, 0.035, 0.012], 14, 6, darkMat));
    }
    // フック爪
    const hook = _taperedTube(
      [kn.clone(), V(side * 3.5, 1.35, 0.3), V(side * 3.45, 1.55, 0.5)],
      [0.05, 0.03, 0.008], 10, 6, hornMat);
    pivot.add(hook);

    // 膜: 指と指の間をたわみ付きグリッドで張る(縁はスカラップ状に切れ込み)
    const rootTop = V(side * 0.08, 0.15, 0.5);
    const rootMid = V(side * 0.08, -0.05, -0.7);
    const rootBot = V(side * 0.08, -0.15, -1.7);
    const spokes = [kn.clone().lerp(fingerTips[0], 1.0), ...fingerTips.slice(1)];
    const roots = [rootTop, rootMid.clone().lerp(rootTop, 0.5), rootMid, rootMid.clone().lerp(rootBot, 0.5), rootBot];
    const NU = 8, NV = 8; // 分割数
    const pos = [], uvArr = [], idx = [];
    let vertBase = 0;
    for (let sIdx = 0; sIdx < spokes.length - 1; sIdx++) {
      const A = spokes[sIdx], B = spokes[sIdx + 1];
      const RA = roots[sIdx], RB = roots[sIdx + 1];
      for (let iu = 0; iu <= NU; iu++) {
        const u = iu / NU;
        const tipP = A.clone().lerp(B, u);
        const rootP = RA.clone().lerp(RB, u);
        // 縁のスカラップ: 指間中央で外縁を内側に切れ込ませる
        const vmax = 1 - 0.22 * Math.sin(u * Math.PI);
        for (let iv = 0; iv <= NV; iv++) {
          const v = (iv / NV) * vmax;
          const p = rootP.clone().lerp(tipP, v);
          // たわみ: 膜中央が下がる(重力と張力)
          p.y -= Math.sin(v * Math.PI) * Math.sin(u * Math.PI) * 0.22;
          pos.push(p.x, p.y, p.z);
          uvArr.push((sIdx + u) / (spokes.length - 1), v);
        }
      }
      for (let iu = 0; iu < NU; iu++) {
        for (let iv = 0; iv < NV; iv++) {
          const a = vertBase + iu * (NV + 1) + iv;
          const bq = a + NV + 1;
          idx.push(a, bq, a + 1, bq, bq + 1, a + 1);
        }
      }
      vertBase = pos.length / 3;
    }
    const memGeo = new THREE.BufferGeometry();
    memGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    memGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    memGeo.setIndex(idx);
    memGeo.computeVertexNormals();
    const membrane = new THREE.Mesh(memGeo, membraneMat);
    membrane.castShadow = true;
    pivot.add(membrane);
    // 前縁の膜(腕〜指1)
    const leadPos = [], leadIdx = [];
    const NL = 10;
    for (let i = 0; i <= NL; i++) {
      const t = i / NL;
      const top = rootTop.clone().lerp(fingerTips[0], t);
      const bot = rootTop.clone().lerp(kn, Math.min(t * 1.15, 1));
      top.y -= Math.sin(t * Math.PI) * 0.05;
      leadPos.push(top.x, top.y, top.z, bot.x, bot.y, bot.z);
    }
    for (let i = 0; i < NL; i++) {
      const a = i * 2;
      leadIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const leadGeo = new THREE.BufferGeometry();
    leadGeo.setAttribute('position', new THREE.Float32BufferAttribute(leadPos, 3));
    leadGeo.setIndex(leadIdx);
    leadGeo.computeVertexNormals();
    const leadMem = new THREE.Mesh(leadGeo, membraneMat);
    pivot.add(leadMem);
    return pivot;
  }
  const wingR = buildWing(1);
  const wingL = buildWing(-1);
  g.add(wingR, wingL);

  // ---- 脚: 関節で曲がるチューブ ----
  function buildLeg(sx, z, big) {
    const leg = new THREE.Group();
    const r = big ? 0.28 : 0.17;
    const tube = _taperedTube(
      [V(0, 0, 0), V(sx > 0 ? 0.12 : -0.12, -0.5, big ? 0.25 : 0.1),
       V(0, -0.95, big ? -0.05 : 0.05), V(0, -1.3, 0.25)],
      [r, r * 0.75, r * 0.45, r * 0.35],
      28, 10, scaleMat);
    leg.add(tube);
    const foot = withShadow(new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.55, 10, 8), darkMat));
    foot.scale.set(1.2, 0.5, 1.8);
    foot.position.set(0, -1.32, 0.3);
    leg.add(foot);
    for (let i = -1; i <= 1; i++) {
      const claw = _taperedTube(
        [V(i * 0.1, -1.3, 0.45), V(i * 0.12, -1.36, 0.62), V(i * 0.13, -1.3, 0.75)],
        [0.045, 0.028, 0.008], 10, 6, hornMat);
      leg.add(claw);
    }
    leg.position.set(sx, 1.35, z);
    return leg;
  }
  g.add(buildLeg(0.6, 1.1, false), buildLeg(-0.6, 1.1, false));
  g.add(buildLeg(0.72, -0.95, true), buildLeg(-0.72, -0.95, true));

  // ---- 背中の棘: 湾曲チューブでリアルに ----
  const spikeCount = 14;
  for (let i = 0; i < spikeCount; i++) {
    const t = i / (spikeCount - 1);
    const z = 2.35 - t * 5.3;
    const y = 2.45 + Math.sin(t * Math.PI) * 0.05 - t * 0.95;
    const size = 0.34 * (1 - t * 0.6) + 0.06;
    const spike = _taperedTube(
      [V(0, y, z), V(0, y + size * 0.7, z - size * 0.45), V(0, y + size, z - size * 0.9)],
      [size * 0.28, size * 0.16, 0.01],
      10, 6, hornMat);
    g.add(spike);
  }

  // ---- 鞍(着座位置は従来と同じ local (0, 2.35, 0.3)) ----
  const saddle = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.12, 0.7), plainMat(0x3a2212, { roughness: 0.8 })));
  saddle.position.set(0, 2.35, 0.3);
  g.add(saddle);
  const saddleBack = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.28, 0.1), plainMat(0x2b190d, { roughness: 0.8 })));
  saddleBack.position.set(0, 2.5, -0.08);
  g.add(saddleBack);
  const strap = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.05, 8, 24), plainMat(0x241407, { roughness: 0.9 }));
  strap.rotation.y = Math.PI / 2;
  strap.position.set(0, 1.5, 0.3);
  g.add(strap);

  // ---- アニメーション(API従来通り) ----
  g.userData.mouth = mouth;
  g.userData.animate = (t, opts = {}) => {
    const flying = !!opts.flying;
    const spd = opts.speed ?? 0;
    const flapSpeed = flying ? 4.8 : 1.5;
    const flapAmp = flying ? 0.6 : 0.16;
    const flap = Math.sin(t * flapSpeed) * flapAmp + (flying ? 0.1 : 0.42);
    wingR.rotation.z = -flap;
    wingL.rotation.z = flap;
    wingR.rotation.x = wingL.rotation.x = Math.sin(t * flapSpeed - 0.6) * (flying ? 0.1 : 0.03);
    tailPivot.rotation.y = Math.sin(t * 1.7) * (0.2 + Math.min(spd * 0.012, 0.22));
    tailPivot.rotation.x = Math.sin(t * 1.2) * 0.08;
    headGroup.rotation.x = 0.15 + Math.sin(t * 1.1) * 0.05 + (opts.firing ? -0.22 : 0);
    headGroup.rotation.y = Math.sin(t * 0.7) * 0.07;
    jaw.rotation.x = opts.firing ? 0.65 : 0.05 + Math.sin(t * 0.9) * 0.03;
  };

  return g;
}

// =====================================================
// UFO（円盤型）
// =====================================================
function veh_ufo() {
  const g = new THREE.Group();
  g.name = 'vehicle_ufo';

  // 円盤本体
  const disc = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.4, 0.22, 24),
    plainMat(0xcccccc, { metalness: 0.85, roughness: 0.25 })
  ));
  disc.position.y = 0.35;
  g.add(disc);

  // 下面のグロー
  const underglow = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.1, 0.06, 24),
    emissiveMat(0x66ffcc, 2.2, { transparent: true, opacity: 0.7 })
  );
  underglow.position.y = 0.22;
  g.add(underglow);

  // コックピットドーム
  const dome = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    emissiveMat(0x88ddff, 0.7, { transparent: true, opacity: 0.55, metalness: 0.6 })
  ));
  dome.position.y = 0.45;
  g.add(dome);

  // 周囲の点灯ライト
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      emissiveMat(i % 2 ? 0xffff66 : 0xff66cc, 2.4)
    );
    light.position.set(Math.cos(ang) * 1.25, 0.31, Math.sin(ang) * 1.25);
    g.add(light);
  }

  return g;
}

// =====================================================
// カタログ
// 各乗り物に: 速度倍率, 持続時間, 騎乗時の座標オフセット(player.object上)
// playerOffsetY: プレイヤーの足元が乗り物のどこにくるか（高さ）
// playerOffsetZ: 前後オフセット（ドラゴンは鞍の位置）
// scale: 全体サイズ
// =====================================================
export const VEHICLES = [
  {
    id: 'veh_hoverBike', name: 'ホバーバイク',  factory: veh_hoverBike,
    speedMul: 1.3, duration: 50, color: 0x44aaff,
    playerOffsetY: 0.55, playerOffsetZ: -0.15, scale: 1.0,
    respawn: 12,
    groundOnly: true, maxAltitude: 1.2,
    desc: '青いホバーエンジンで低空を疾走する軽量バイク。走り続けるほど徐々に加速していき、約10秒で最大 +200% の爆速に到達する。ただし停止すると加速効果がリセットされ +30% に戻るため、止まらず走り続けるのがコツ。',
    statsText: ['初期速度 +30%', '走り続けると徐々に加速 → 最大 +200%(約10秒で最速)', '停止すると加速がリセットされ +30% に戻る', '低空ホバー走行 / 上下移動 不可', '持続 50秒'],
  },
  {
    id: 'veh_skyBoard',  name: 'スカイボード',  factory: veh_skyBoard,
    speedMul: 2.1, duration: 14, color: 0xff8855,
    playerOffsetY: 0.22, playerOffsetZ: 0,    scale: 1.0,
    respawn: 12,
    flightCapable: true, ascendBoost: 1.5,
    desc: '風を操って空を滑走する反重力ボード。飛行と上昇性能に優れ、乗ると周囲に激しい風のオーラが渦巻く。Shift を押している間は後方に暴風の噴射がかかり、体当たりでも同じ追い風のダメージを与えられる (相手が風に当たっていなくてもOK)。',
    statsText: ['移動速度 +110%', '飛行可能', '上昇 +50%', 'Shift中: 後方 暴風 & 体当たりで追い風分のダメージ', '持続 14秒'],
  },
  {
    id: 'veh_jetSkate',  name: 'ジェットスケート', factory: veh_jetSkate,
    speedMul: 2.4, duration: 12, color: 0x66ffcc,
    playerOffsetY: 0.18, playerOffsetZ: 0,    scale: 1.0,
    respawn: 12,
    groundOnly: true, maxAltitude: 0.6,
    desc: '足元に噴射ジェットを備えた超高速スケート。地表専用だが持ち物の中で最速級。急な方向転換もお手のもの。',
    statsText: ['移動速度 +140%', '地表専用 超高速', '上下移動 不可', '持続 12秒'],
  },
  {
    id: 'veh_dragon',    name: '★伝説のレッドドラゴン', factory: veh_dragon,
    speedMul: 2.0, duration: 27, color: 0xff44cc,
    // 騎乗型: 鞍(local y2.35, z0.3)の真上にプレイヤーが座る配置
    playerOffsetY: -2.5, playerOffsetZ: -0.3,  scale: 1.0,
    rideHeight: 1.6, // 騎乗中は地面からこの分高く浮く(ドラゴンが地面に埋まらない)
    respawn: 18,
    flightCapable: true, ascendBoost: 2.6,
    legendary: true, legendaryColor: 0xff44cc,
    dragonExhaustFire: true, // 移動時、エンジン後方から火炎を噴射
    desc: '古の伝承に語られる竜王。搭乗中は火炎放射が強化され、飛行時にはエンジンから火炎を噴出する。',
    statsText: [
      '★【伝説】★ 古の竜王',
      '移動速度 +100%',
      '飛行可能',
      '上昇 +160%',
      '火炎放射 強化（威力&範囲アップ）',
      '移動中エンジンから火炎噴射',
      '持続 27秒',
    ],
  },
  {
    id: 'veh_ufo',       name: '★伝説のUFO',           factory: veh_ufo,
    speedMul: 2.5, duration: 25, color: 0xb945ff,
    playerOffsetY: 0.48, playerOffsetZ: 0,    scale: 1.0,
    respawn: 18,
    flightCapable: true, ascendBoost: 2.8, hoverDrift: true,
    legendary: true, legendaryColor: 0xb945ff,
    desc: '異星の技術で造られた円盤。無重力ドリフトで空を自在に駆け、雷撃攻撃も強化される。搭乗中は最高速。',
    statsText: [
      '★【伝説】★ 異星の遺物',
      '移動速度 +150%',
      '飛行可能 縦横無尽',
      '上昇 +180%',
      '無重力ドリフト',
      '雷撃 強化（威力&範囲アップ）',
      '持続 25秒',
    ],
  },
];

export function getVehicleById(id) {
  return VEHICLES.find(v => v.id === id) || null;
}
