// 武器ファクトリ集
// 剣10 + 銃10 + 杖10 = 30種類
// 各武器は THREE.Group を返す。グリップが原点にくるよう設計し、
// player.swordHolder の (0.4, 0, 0.3) に attach される前提。
// configには戦闘パラメータ（ダメージ倍率/連射倍率/弾スタイル/持続時間等）も含む。

import * as THREE from 'three';

// ----- 共通ヘルパ -----
function emissiveMat(color, intensity = 0.6, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts.emissive ?? color,
    emissiveIntensity: intensity,
    roughness: opts.roughness ?? 0.45,
    metalness: opts.metalness ?? 0.35,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}
function plainMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.2,
  });
}
function withShadow(mesh) {
  mesh.castShadow = true;
  return mesh;
}

// グリップ（共通）
function makeGrip(color = 0x4a2d1a, length = 0.22, radius = 0.045) {
  const g = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.9, length, 10),
    plainMat(color, { roughness: 0.85 })
  );
  g.position.y = -length / 2;
  return withShadow(g);
}

// =====================================================
// 剣 10種類
// =====================================================

function sword_ironLong() {
  const g = new THREE.Group();
  const blade = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 1.35, 0.04),
    emissiveMat(0xdcdcdc, 0.3, { metalness: 0.85 })
  ));
  blade.position.y = 0.675;
  const guard = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.06, 0.12),
    plainMat(0x8b6914, { metalness: 0.5 })
  ));
  g.add(blade, guard, makeGrip(0x4a2d1a, 0.25));
  return g;
}

function sword_katana() {
  const g = new THREE.Group();
  const blade = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.5, 0.025),
    emissiveMat(0xe8f0ff, 0.5, { metalness: 0.95 })
  ));
  blade.position.y = 0.75;
  blade.rotation.z = 0.05;
  const guard = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.04, 0.18),
    plainMat(0x222222, { metalness: 0.7 })
  ));
  const grip = makeGrip(0xb22222, 0.28, 0.04);
  g.add(blade, guard, grip);
  return g;
}

function sword_broadsword() {
  const g = new THREE.Group();
  const blade = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.2, 0.05),
    emissiveMat(0xb0c4de, 0.3, { metalness: 0.85 })
  ));
  blade.position.y = 0.6;
  const guard = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.08, 0.14),
    plainMat(0xdaa520, { metalness: 0.7 })
  ));
  g.add(blade, guard, makeGrip(0x222222, 0.26));
  return g;
}

function sword_dagger() {
  const g = new THREE.Group();
  const blade = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.55, 0.03),
    emissiveMat(0xc0c0ff, 0.5, { metalness: 0.9 })
  ));
  blade.position.y = 0.27;
  const guard = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.04, 0.08),
    plainMat(0x4b0082)
  ));
  g.add(blade, guard, makeGrip(0x000033, 0.18, 0.035));
  return g;
}

function sword_flame() {
  const g = new THREE.Group();
  const blade = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.35, 0.05),
    emissiveMat(0xff5a1a, 1.4, { metalness: 0.4 })
  ));
  blade.position.y = 0.675;
  // 炎のオーラ（半透明オレンジ）
  const aura = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 1.5, 0.16),
    emissiveMat(0xffaa33, 1.8, { transparent: true, opacity: 0.45 })
  );
  aura.position.y = 0.7;
  // 鍔
  const guard = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.07, 0.13),
    plainMat(0x6b1e00, { metalness: 0.7 })
  ));
  g.add(aura, blade, guard, makeGrip(0x3b0a00, 0.25));
  return g;
}

function sword_frost() {
  const g = new THREE.Group();
  const blade = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.4, 0.05),
    emissiveMat(0x88e0ff, 1.2, { metalness: 0.6 })
  ));
  blade.position.y = 0.7;
  // 氷の結晶
  for (let i = 0; i < 3; i++) {
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.06),
      emissiveMat(0xc0f0ff, 1.5, { transparent: true, opacity: 0.7 })
    );
    crystal.position.set(0, 0.4 + i * 0.35, 0.06);
    g.add(crystal);
  }
  const guard = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.06, 0.12),
    plainMat(0x4682b4, { metalness: 0.7 })
  ));
  g.add(blade, guard, makeGrip(0x002244, 0.25));
  return g;
}

function sword_thunder() {
  const g = new THREE.Group();
  const blade = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.4, 0.05),
    emissiveMat(0xfff066, 1.6, { metalness: 0.7 })
  ));
  blade.position.y = 0.7;
  // ジグザグ（小さい菱形を3つ）
  for (let i = 0; i < 3; i++) {
    const z = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.06, 0.06),
      emissiveMat(0xffff00, 2.0)
    );
    z.position.set((i % 2 ? 0.08 : -0.08), 0.45 + i * 0.3, 0);
    z.rotation.z = (i % 2 ? 0.5 : -0.5);
    g.add(z);
  }
  const guard = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.06, 0.12),
    plainMat(0xdaa520, { metalness: 0.8 })
  ));
  g.add(blade, guard, makeGrip(0x222200, 0.25));
  return g;
}

function sword_holy() {
  const g = new THREE.Group();
  const blade = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 1.45, 0.05),
    emissiveMat(0xfff5cc, 1.3, { metalness: 0.85 })
  ));
  blade.position.y = 0.725;
  // 後光
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.22, 16),
    emissiveMat(0xffe680, 1.8, { transparent: true, opacity: 0.6 })
  );
  halo.position.y = 1.45;
  halo.rotation.x = Math.PI / 2;
  // 十字鍔
  const guard = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.08, 0.14),
    plainMat(0xffd700, { metalness: 0.9 })
  ));
  g.add(blade, halo, guard, makeGrip(0xffffff, 0.26));
  return g;
}

function sword_demon() {
  const g = new THREE.Group();
  // ギザギザ刃（縦長三角錐 + 板）
  const blade = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 1.3, 0.06),
    emissiveMat(0x440022, 0.8, { metalness: 0.5 })
  ));
  blade.position.y = 0.65;
  // 黒い炎オーラ
  const aura = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 1.4, 0.18),
    emissiveMat(0x88004f, 2.0, { transparent: true, opacity: 0.5 })
  );
  aura.position.y = 0.7;
  // とげ
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.12, 4),
      emissiveMat(0xff0066, 1.5)
    );
    spike.position.set(0.1, 0.3 + i * 0.3, 0);
    spike.rotation.z = -Math.PI / 2;
    g.add(spike);
  }
  // 角のような鍔
  const guard = withShadow(new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.18, 6),
    plainMat(0x220011, { metalness: 0.8 })
  ));
  guard.rotation.x = Math.PI;
  g.add(aura, blade, guard, makeGrip(0x000000, 0.26));
  return g;
}

function sword_rainbow() {
  const g = new THREE.Group();
  // 虹色になる多層ブレード
  const colors = [0xff3a3a, 0xffaa33, 0xfff066, 0x6cff66, 0x66aaff, 0xaa66ff];
  colors.forEach((c, i) => {
    const layer = new THREE.Mesh(
      new THREE.BoxGeometry(0.09 + i * 0.012, 1.35 - i * 0.05, 0.04),
      emissiveMat(c, 1.5, { transparent: true, opacity: 0.7 })
    );
    layer.position.y = 0.675;
    g.add(layer);
  });
  const core = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.4, 0.03),
    emissiveMat(0xffffff, 2.0)
  ));
  core.position.y = 0.7;
  g.add(core);
  const guard = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.08, 0.14),
    emissiveMat(0xffffff, 0.8, { metalness: 0.9 })
  ));
  g.add(guard, makeGrip(0x444444, 0.25));
  return g;
}

// =====================================================
// 銃 10種類
// =====================================================

function gun_pistol() {
  const g = new THREE.Group();
  const body = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.18, 0.32),
    plainMat(0x222222, { metalness: 0.7 })
  ));
  body.position.set(0, 0.04, -0.05);
  const barrel = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.28, 10),
    plainMat(0x111111, { metalness: 0.8 })
  ));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.08, 0.16);
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.22, 0.12),
    plainMat(0x4a2d1a)
  ));
  grip.position.set(0, -0.1, -0.08);
  grip.rotation.x = 0.25;
  g.add(body, barrel, grip);
  return g;
}

function gun_rifle() {
  const g = new THREE.Group();
  const body = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.16, 0.7),
    plainMat(0x3a3a3a, { metalness: 0.7 })
  ));
  body.position.set(0, 0.05, 0.15);
  const barrel = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.45, 10),
    plainMat(0x111111, { metalness: 0.85 })
  ));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.09, 0.55);
  const stock = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.16, 0.28),
    plainMat(0x6b4423)
  ));
  stock.position.set(0, 0.04, -0.3);
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.2, 0.1),
    plainMat(0x222222)
  ));
  grip.position.set(0, -0.1, -0.05);
  g.add(body, barrel, stock, grip);
  return g;
}

function gun_shotgun() {
  const g = new THREE.Group();
  const body = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.18, 0.55),
    plainMat(0x6b4423, { metalness: 0.4 })
  ));
  body.position.set(0, 0.05, 0.12);
  const barrelA = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10),
    plainMat(0x222222, { metalness: 0.8 })
  ));
  barrelA.rotation.x = Math.PI / 2;
  barrelA.position.set(-0.04, 0.1, 0.45);
  const barrelB = barrelA.clone();
  barrelB.position.x = 0.04;
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.2, 0.12),
    plainMat(0x4a2d1a)
  ));
  grip.position.set(0, -0.1, -0.12);
  g.add(body, barrelA, barrelB, grip);
  return g;
}

function gun_sniper() {
  const g = new THREE.Group();
  const body = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.95),
    plainMat(0x2a3a2a, { metalness: 0.6 })
  ));
  body.position.set(0, 0.05, 0.25);
  const barrel = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.7, 10),
    plainMat(0x111111, { metalness: 0.9 })
  ));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.08, 0.7);
  const scope = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10),
    emissiveMat(0x000000, 0.4, { emissive: 0x002244, metalness: 0.85 })
  ));
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.18, 0.2);
  const stock = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.16, 0.32),
    plainMat(0x222222)
  ));
  stock.position.set(0, 0.04, -0.35);
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.2, 0.1),
    plainMat(0x222222)
  ));
  grip.position.set(0, -0.1, -0.08);
  g.add(body, barrel, scope, stock, grip);
  return g;
}

function gun_smg() {
  const g = new THREE.Group();
  const body = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.15, 0.42),
    plainMat(0x2a2a2a, { metalness: 0.6 })
  ));
  body.position.set(0, 0.04, 0.05);
  const barrel = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.26, 10),
    plainMat(0x111111, { metalness: 0.85 })
  ));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.07, 0.32);
  const mag = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.08),
    plainMat(0x111111)
  ));
  mag.position.set(0, -0.12, 0.04);
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.09),
    plainMat(0x222222)
  ));
  grip.position.set(0, -0.1, -0.12);
  g.add(body, barrel, mag, grip);
  return g;
}

function gun_plasma() {
  const g = new THREE.Group();
  const body = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.2, 0.45),
    emissiveMat(0x00aaff, 0.4, { emissive: 0x0066aa, metalness: 0.7 })
  ));
  body.position.set(0, 0.05, 0.1);
  // プラズマコイル
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.014, 6, 16),
      emissiveMat(0x66f0ff, 2.0)
    );
    ring.position.set(0, 0.08, 0.25 + i * 0.08);
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
  }
  const core = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 12, 12),
    emissiveMat(0x00ffff, 2.5)
  ));
  core.position.set(0, 0.08, 0.5);
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.12),
    plainMat(0x111133)
  ));
  grip.position.set(0, -0.1, -0.1);
  g.add(body, core, grip);
  return g;
}

function gun_rocket() {
  const g = new THREE.Group();
  const tube = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 0.8, 12),
    plainMat(0x447744, { metalness: 0.5 })
  ));
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0.08, 0.25);
  // 後方の煙突
  const back = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.07, 0.18, 10),
    plainMat(0x222222)
  ));
  back.rotation.x = Math.PI / 2;
  back.position.set(0, 0.08, -0.2);
  // 弾頭の覗き見え（赤）
  const tip = withShadow(new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.14, 12),
    emissiveMat(0xcc2222, 0.8)
  ));
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.08, 0.7);
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.12),
    plainMat(0x222222)
  ));
  grip.position.set(0, -0.1, 0.0);
  g.add(tube, back, tip, grip);
  return g;
}

function gun_laser() {
  const g = new THREE.Group();
  const body = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, 0.5),
    emissiveMat(0xff2266, 0.5, { metalness: 0.85 })
  ));
  body.position.set(0, 0.05, 0.12);
  const lens = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 12),
    emissiveMat(0xff66aa, 2.5)
  ));
  lens.position.set(0, 0.08, 0.42);
  const finA = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.18, 0.18),
    emissiveMat(0xff2266, 1.2)
  ));
  finA.position.set(-0.06, 0.1, 0.15);
  const finB = finA.clone();
  finB.position.x = 0.06;
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.2, 0.11),
    plainMat(0x440022)
  ));
  grip.position.set(0, -0.1, -0.08);
  g.add(body, lens, finA, finB, grip);
  return g;
}

function gun_minigun() {
  const g = new THREE.Group();
  // 6本砲身
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const b = withShadow(new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8),
      plainMat(0x222222, { metalness: 0.85 })
    ));
    b.rotation.x = Math.PI / 2;
    b.position.set(Math.cos(ang) * 0.07, 0.08 + Math.sin(ang) * 0.07, 0.3);
    g.add(b);
  }
  const hub = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12),
    plainMat(0x444444, { metalness: 0.7 })
  ));
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 0.08, 0.55);
  const body = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.35),
    plainMat(0x333333, { metalness: 0.6 })
  ));
  body.position.set(0, 0.08, 0.05);
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.22, 0.12),
    plainMat(0x111111)
  ));
  grip.position.set(0, -0.12, -0.12);
  g.add(hub, body, grip);
  return g;
}

function gun_railgun() {
  const g = new THREE.Group();
  const body = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, 1.05),
    emissiveMat(0x6644aa, 0.4, { metalness: 0.85 })
  ));
  body.position.set(0, 0.07, 0.35);
  // レール（左右に光る板）
  const railA = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.05, 1.1),
    emissiveMat(0xcc88ff, 2.0)
  ));
  railA.position.set(-0.08, 0.13, 0.38);
  const railB = railA.clone();
  railB.position.x = 0.08;
  const core = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 12),
    emissiveMat(0xffffff, 2.5)
  ));
  core.position.set(0, 0.07, 0.92);
  const grip = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.12),
    plainMat(0x110022)
  ));
  grip.position.set(0, -0.1, -0.1);
  g.add(body, railA, railB, core, grip);
  return g;
}

// =====================================================
// 魔法の杖 10種類
// =====================================================

function makeStaff(rodColor, headFactory, rodLen = 1.4) {
  const g = new THREE.Group();
  const rod = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, rodLen, 10),
    plainMat(rodColor, { roughness: 0.7 })
  ));
  rod.position.y = rodLen / 2;
  g.add(rod);
  const head = headFactory();
  head.position.y = rodLen + 0.08;
  g.add(head);
  return g;
}

function wand_fire() {
  return makeStaff(0x6b1e00, () => {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 14, 14),
      emissiveMat(0xff5a1a, 2.2)
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 14),
      emissiveMat(0xffaa33, 1.8, { transparent: true, opacity: 0.45 })
    );
    grp.add(core, halo);
    return grp;
  });
}

function wand_ice() {
  return makeStaff(0x002244, () => {
    const grp = new THREE.Group();
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      emissiveMat(0x88e0ff, 1.8, { transparent: true, opacity: 0.85 })
    );
    grp.add(crystal);
    // 周囲の小さな氷
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const c = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.05),
        emissiveMat(0xc0f0ff, 2.0)
      );
      c.position.set(Math.cos(ang) * 0.2, 0, Math.sin(ang) * 0.2);
      grp.add(c);
    }
    return grp;
  });
}

function wand_thunder() {
  return makeStaff(0x222200, () => {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 12),
      emissiveMat(0xfff066, 2.4)
    );
    grp.add(core);
    // 雷ジグザグ
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const bolt = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.22, 0.04),
        emissiveMat(0xffff00, 2.5)
      );
      bolt.position.set(Math.cos(ang) * 0.16, 0, Math.sin(ang) * 0.16);
      bolt.rotation.z = (i % 2) ? 0.6 : -0.6;
      grp.add(bolt);
    }
    return grp;
  });
}

function wand_holy() {
  return makeStaff(0xffffff, () => {
    const grp = new THREE.Group();
    // 十字
    const v = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.32, 0.05),
      emissiveMat(0xffe680, 1.8, { metalness: 0.85 })
    );
    const h = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.05, 0.05),
      emissiveMat(0xffe680, 1.8, { metalness: 0.85 })
    );
    h.position.y = 0.05;
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.22, 18),
      emissiveMat(0xfff5cc, 2.2, { transparent: true, opacity: 0.7 })
    );
    halo.rotation.x = Math.PI / 2;
    grp.add(v, h, halo);
    return grp;
  });
}

function wand_dark() {
  return makeStaff(0x110011, () => {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 14, 14),
      emissiveMat(0x66007f, 2.0)
    );
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 12),
      emissiveMat(0xaa00ff, 1.6, { transparent: true, opacity: 0.4 })
    );
    // 角
    const hornA = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.18, 6),
      emissiveMat(0x440044, 1.0)
    );
    hornA.position.set(-0.1, 0.12, 0);
    hornA.rotation.z = 0.6;
    const hornB = hornA.clone();
    hornB.position.x = 0.1;
    hornB.rotation.z = -0.6;
    grp.add(core, aura, hornA, hornB);
    return grp;
  });
}

function wand_nature() {
  return makeStaff(0x3b2a0e, () => {
    const grp = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 14),
      emissiveMat(0x66ff88, 1.6)
    );
    // 葉っぱ
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        emissiveMat(0x44cc44, 0.9)
      );
      leaf.scale.set(1, 0.3, 1.6);
      leaf.position.set(Math.cos(ang) * 0.13, -0.02, Math.sin(ang) * 0.13);
      leaf.rotation.y = ang;
      grp.add(leaf);
    }
    grp.add(orb);
    return grp;
  });
}

function wand_star() {
  return makeStaff(0xffffff, () => {
    const grp = new THREE.Group();
    // 星（5つの三角錐を放射状に）
    const starColor = 0xfff066;
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.22, 4),
        emissiveMat(starColor, 2.2)
      );
      tip.position.set(Math.cos(ang) * 0.14, Math.sin(ang) * 0.14, 0);
      tip.rotation.z = ang - Math.PI / 2;
      grp.add(tip);
    }
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      emissiveMat(0xffffaa, 2.5)
    );
    grp.add(core);
    return grp;
  });
}

function wand_void() {
  return makeStaff(0x000000, () => {
    const grp = new THREE.Group();
    // 黒いブラックホール風
    const dark = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2, metalness: 0.95 })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.025, 8, 24),
      emissiveMat(0xaa00ff, 2.4)
    );
    ring.rotation.x = Math.PI / 2;
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.018, 8, 24),
      emissiveMat(0x4400ff, 2.0, { transparent: true, opacity: 0.7 })
    );
    ring2.rotation.x = Math.PI / 2;
    ring2.rotation.z = Math.PI / 4;
    grp.add(dark, ring, ring2);
    return grp;
  });
}

function wand_prism() {
  return makeStaff(0xddddff, () => {
    const grp = new THREE.Group();
    // 多面体
    const prism = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.15, 0),
      emissiveMat(0xffffff, 1.5, { metalness: 0.8 })
    );
    grp.add(prism);
    // 周囲の色付きキューブ
    const colors = [0xff3a3a, 0xfff066, 0x66aaff, 0xaa66ff];
    colors.forEach((c, i) => {
      const ang = (i / 4) * Math.PI * 2;
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.05),
        emissiveMat(c, 2.0)
      );
      cube.position.set(Math.cos(ang) * 0.25, 0, Math.sin(ang) * 0.25);
      grp.add(cube);
    });
    return grp;
  });
}

function wand_chaos() {
  return makeStaff(0x222222, () => {
    const grp = new THREE.Group();
    // ねじれた角つき
    const core = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.14),
      emissiveMat(0xff0066, 1.8)
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.03, 8, 18),
      emissiveMat(0x00ffaa, 2.0)
    );
    ring.rotation.x = Math.PI / 3;
    const ring2 = ring.clone();
    ring2.rotation.x = -Math.PI / 3;
    ring2.material = emissiveMat(0xff8800, 2.0);
    grp.add(core, ring, ring2);
    return grp;
  });
}

// =====================================================
// 武器カタログ
// 戦闘パラメータ: dmgMul, fireMul, duration, color, projectileStyle, projectileOpts
// =====================================================

export const SWORDS = [
  { id: 'sword_ironLong',   name: 'アイアンロング',    factory: sword_ironLong,   dmgMul: 1.6, fireMul: 1.0, duration: 16, color: 0xdcdcdc,
    statsText: ['攻撃力 +60%', '連射速度 ±0%', '持続 16秒'] },
  { id: 'sword_katana',     name: '紅蓮の刀',          factory: sword_katana,     dmgMul: 2.0, fireMul: 1.2, duration: 14, color: 0xe8f0ff,
    statsText: ['攻撃力 +100%', '連射速度 +20%', '持続 14秒'] },
  { id: 'sword_broadsword', name: 'ブロードソード',    factory: sword_broadsword, dmgMul: 2.4, fireMul: 0.7, duration: 16, color: 0xb0c4de,
    statsText: ['攻撃力 +140%', '連射速度 -30%', '持続 16秒'] },
  { id: 'sword_dagger',     name: 'シャドウダガー',    factory: sword_dagger,     dmgMul: 1.3, fireMul: 2.0, duration: 14, color: 0xc0c0ff,
    statsText: ['攻撃力 +30%', '連射速度 +100%', '持続 14秒'] },
  { id: 'sword_flame',      name: 'フレイムブレード',  factory: sword_flame,      dmgMul: 2.2, fireMul: 1.1, duration: 15, color: 0xff5a1a,
    statsText: ['攻撃力 +120%', '連射速度 +10%', '持続 15秒', '炎属性'] },
  { id: 'sword_frost',      name: 'フロストエッジ',    factory: sword_frost,      dmgMul: 1.9, fireMul: 1.1, duration: 15, color: 0x88e0ff,
    statsText: ['攻撃力 +90%', '連射速度 +10%', '持続 15秒', '氷属性'] },
  { id: 'sword_thunder',    name: 'サンダーソード',    factory: sword_thunder,    dmgMul: 2.1, fireMul: 1.3, duration: 14, color: 0xfff066,
    statsText: ['攻撃力 +110%', '連射速度 +30%', '持続 14秒', '雷属性'] },
  { id: 'sword_holy',       name: '聖剣エクスカリオン', factory: sword_holy,      dmgMul: 2.6, fireMul: 1.0, duration: 14, color: 0xfff5cc,
    statsText: ['攻撃力 +160%', '連射速度 ±0%', '持続 14秒', '聖属性'] },
  { id: 'sword_demon',      name: '魔剣デモンファング', factory: sword_demon,     dmgMul: 2.8, fireMul: 0.9, duration: 13, color: 0xff0066,
    statsText: ['攻撃力 +180%', '連射速度 -10%', '持続 13秒', '闇属性'] },
  { id: 'sword_rainbow',    name: 'プリズムブレード',  factory: sword_rainbow,    dmgMul: 2.3, fireMul: 1.5, duration: 14, color: 0xffffff,
    statsText: ['攻撃力 +130%', '連射速度 +50%', '持続 14秒', '虹属性'] },
];

export const GUNS = [
  { id: 'gun_pistol',  name: 'ピストル',          factory: gun_pistol,  dmgMul: 1.4, fireMul: 1.6, duration: 15, color: 0xcccccc, projectileStyle: 'note',
    statsText: ['攻撃力 +40%', '連射速度 +60%', '持続 15秒'] },
  { id: 'gun_rifle',   name: 'アサルトライフル',  factory: gun_rifle,   dmgMul: 1.6, fireMul: 2.4, duration: 14, color: 0xffaa66, projectileStyle: 'note',
    statsText: ['攻撃力 +60%', '連射速度 +140%', '持続 14秒'] },
  { id: 'gun_shotgun', name: 'ショットガン',      factory: gun_shotgun, dmgMul: 2.0, fireMul: 0.6, duration: 14, color: 0xffcc66, projectileStyle: 'note', spread: 5,
    statsText: ['攻撃力 +100%', '連射速度 -40%', '5発同時発射', '持続 14秒'] },
  { id: 'gun_sniper',  name: 'スナイパーライフル', factory: gun_sniper, dmgMul: 3.2, fireMul: 0.4, duration: 14, color: 0x88ff88, projectileStyle: 'note', projectileSpeed: 80,
    statsText: ['攻撃力 +220%', '連射速度 -60%', '弾速 超高速', '持続 14秒'] },
  { id: 'gun_smg',     name: 'SMG',               factory: gun_smg,     dmgMul: 1.1, fireMul: 3.0, duration: 13, color: 0xff6688, projectileStyle: 'note',
    statsText: ['攻撃力 +10%', '連射速度 +200%', '持続 13秒'] },
  { id: 'gun_plasma',  name: 'プラズマガン',      factory: gun_plasma,  dmgMul: 2.2, fireMul: 1.4, duration: 14, color: 0x00ffff, projectileStyle: 'fire',
    statsText: ['攻撃力 +120%', '連射速度 +40%', 'プラズマ弾', '持続 14秒'] },
  { id: 'gun_rocket',  name: 'ロケットランチャー', factory: gun_rocket, dmgMul: 4.0, fireMul: 0.3, duration: 13, color: 0xff4422, projectileStyle: 'fire', projectileRadius: 0.5,
    statsText: ['攻撃力 +300%', '連射速度 -70%', '爆風範囲 大', '持続 13秒'] },
  { id: 'gun_laser',   name: 'レーザーガン',      factory: gun_laser,   dmgMul: 1.8, fireMul: 2.0, duration: 14, color: 0xff66aa, projectileStyle: 'fire', projectileSpeed: 70,
    statsText: ['攻撃力 +80%', '連射速度 +100%', '弾速 高速', '持続 14秒'] },
  { id: 'gun_minigun', name: 'ミニガン',          factory: gun_minigun, dmgMul: 1.0, fireMul: 4.0, duration: 12, color: 0xffff88, projectileStyle: 'note',
    statsText: ['攻撃力 ±0%', '連射速度 +300%', '持続 12秒'] },
  { id: 'gun_railgun', name: 'レールガン',        factory: gun_railgun, dmgMul: 4.5, fireMul: 0.25, duration: 14, color: 0xcc88ff, projectileStyle: 'fire', projectileSpeed: 100,
    statsText: ['攻撃力 +350%', '連射速度 -75%', '弾速 極超高速', '持続 14秒'] },
];

export const WANDS = [
  { id: 'wand_fire',    name: 'フレイムロッド',  factory: wand_fire,    dmgMul: 2.0, fireMul: 1.3, duration: 15, color: 0xff5a1a, projectileStyle: 'fire', projectileHoming: 0.3,
    statsText: ['攻撃力 +100%', '連射速度 +30%', '弾追尾 +30%', '持続 15秒'] },
  { id: 'wand_ice',     name: 'アイスロッド',    factory: wand_ice,     dmgMul: 1.8, fireMul: 1.5, duration: 15, color: 0x88e0ff, projectileStyle: 'fire', projectileHoming: 0.2,
    statsText: ['攻撃力 +80%', '連射速度 +50%', '弾追尾 +20%', '持続 15秒'] },
  { id: 'wand_thunder', name: 'サンダーロッド',  factory: wand_thunder, dmgMul: 2.2, fireMul: 1.6, duration: 14, color: 0xfff066, projectileStyle: 'fire', projectileHoming: 0.35,
    statsText: ['攻撃力 +120%', '連射速度 +60%', '弾追尾 +35%', '持続 14秒'] },
  { id: 'wand_holy',    name: '聖なる杖',        factory: wand_holy,    dmgMul: 2.0, fireMul: 1.4, duration: 16, color: 0xfff5cc, projectileStyle: 'fire', projectileHoming: 0.4,
    statsText: ['攻撃力 +100%', '連射速度 +40%', '弾追尾 +40%', '持続 16秒'] },
  { id: 'wand_dark',    name: '闇の杖',          factory: wand_dark,    dmgMul: 2.5, fireMul: 1.2, duration: 14, color: 0xaa00ff, projectileStyle: 'fire', projectileHoming: 0.45,
    statsText: ['攻撃力 +150%', '連射速度 +20%', '弾追尾 +45%', '持続 14秒'] },
  { id: 'wand_nature',  name: '森の杖',          factory: wand_nature,  dmgMul: 1.7, fireMul: 1.8, duration: 16, color: 0x66ff88, projectileStyle: 'fire', projectileHoming: 0.3,
    statsText: ['攻撃力 +70%', '連射速度 +80%', '弾追尾 +30%', '持続 16秒'] },
  { id: 'wand_star',    name: 'スターロッド',    factory: wand_star,    dmgMul: 2.1, fireMul: 1.7, duration: 15, color: 0xfff066, projectileStyle: 'fire', projectileHoming: 0.5,
    statsText: ['攻撃力 +110%', '連射速度 +70%', '弾追尾 +50%', '持続 15秒'] },
  { id: 'wand_void',    name: '虚無の杖',        factory: wand_void,    dmgMul: 2.8, fireMul: 1.0, duration: 14, color: 0xaa00ff, projectileStyle: 'fire', projectileHoming: 0.6, projectileRadius: 0.45,
    statsText: ['攻撃力 +180%', '連射速度 ±0%', '弾追尾 +60%', '爆風 大', '持続 14秒'] },
  { id: 'wand_prism',   name: 'プリズムワンド',  factory: wand_prism,   dmgMul: 2.0, fireMul: 2.0, duration: 14, color: 0xffffff, projectileStyle: 'fire', projectileHoming: 0.4,
    statsText: ['攻撃力 +100%', '連射速度 +100%', '弾追尾 +40%', '持続 14秒'] },
  { id: 'wand_chaos',   name: 'カオスロッド',    factory: wand_chaos,   dmgMul: 2.6, fireMul: 1.5, duration: 13, color: 0xff0066, projectileStyle: 'fire', projectileHoming: 0.55,
    statsText: ['攻撃力 +160%', '連射速度 +50%', '弾追尾 +55%', '持続 13秒'] },
];

// 種別をkindに紐付け
export const WEAPON_CATALOG = {
  sword: SWORDS,
  gun:   GUNS,
  wand:  WANDS,
};

// 全武器を kind 付きの平坦リストで返す（itemsスポーン用）
export function getAllWeapons() {
  const out = [];
  for (const kind of ['sword', 'gun', 'wand']) {
    for (const w of WEAPON_CATALOG[kind]) {
      out.push({ ...w, kind });
    }
  }
  return out;
}

// IDから武器設定を取得
export function getWeaponById(id) {
  for (const kind of ['sword', 'gun', 'wand']) {
    const w = WEAPON_CATALOG[kind].find(x => x.id === id);
    if (w) return { ...w, kind };
  }
  return null;
}
