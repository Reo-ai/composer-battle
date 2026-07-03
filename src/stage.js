// ステージ構築（DBZ風リアル荒野バトルステージ）
// 中央：岩場アリーナ + 光る溶岩亀裂
// 周囲：荒野・枯れ木・乾いた草・岩塊
// 遠景：高密度ロックスパイア・多層山稜・霞プレート
// 空：濃厚な夕焼けドーム + 太陽 + レンズフレア
// 大気：砂塵・流雲・浮島・カラス
// buildStage(scene) は { update(dt) } を返す。

import * as THREE from 'three';

// ステージを大幅拡張（260→900→1800→2700、FPS化に合わせ地上面積を 1.5 倍に）
const TERRAIN_SIZE = 2700;
const TERRAIN_SEGS = 1350;  // 密度は 2m/segment を維持（1800→2700 に比例）
const ARENA_RADIUS = 14;
const ARENA_CENTER = new THREE.Vector2(0, 0);
// ステージ境界（外周のアイテム散布などで使う）
export const STAGE_BOUNDS = {
  size: TERRAIN_SIZE,
  half: TERRAIN_SIZE / 2,
  arenaRadius: ARENA_RADIUS,
};
// 地形高さを外部から問い合わせるためのエクスポート
export function getTerrainHeightAt(x, z) {
  return terrainHeightAt(x, z);
}

export function buildStage(scene) {
  // ---- 背景・フォグ ----
  // 濃厚な夕焼け基調（DBZ風）。FogExp2 で奥行きが自然に霞む
  scene.background = new THREE.Color(0x7a2a1a);
  // ステージ拡張により霞密度を下げて視界を確保
  scene.fog = new THREE.FogExp2(0xb04a26, 0.0042);

  // ---- ライティング ----
  // 半球光：上から夕焼け、下から暗赤紫
  const hemi = new THREE.HemisphereLight(0xffa070, 0x2a1828, 0.75);
  scene.add(hemi);

  // 太陽：強めの方向光（影付き）— 影マップ4Kでシャープに、撮影範囲を拡張
  const sun = new THREE.DirectionalLight(0xffc080, 2.2);
  sun.position.set(180, 220, 100);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -200;
  sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200;
  sun.shadow.camera.bottom = -200;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);

  // リムライト：逆方向の冷たい紫。立体感が出てDBZ感
  const rim = new THREE.DirectionalLight(0x6a3e8a, 0.55);
  rim.position.set(-180, 90, -120);
  scene.add(rim);

  // フィルライト：地平の暖色反射（広域に薄く差し込む）
  const fill = new THREE.DirectionalLight(0xff8848, 0.28);
  fill.position.set(0, 30, -250);
  scene.add(fill);

  // ---- 空ドーム ----
  scene.add(createSkyDome());

  // ---- 太陽ディスク + レンズフレア ----
  scene.add(createSunDisc(sun.position));
  scene.add(createLensFlare(sun.position));

  // ---- 遠景の霞プレート（深度感）----
  scene.add(createHazePlanes());

  // ---- 多層山稜（遠景） ----
  scene.add(createMountainLayers());

  // ---- メイン地形（ノイズで起伏、岩肌テクスチャ） ----
  const groundTex = createRockTexture(0x6a3a25, 0x3a1f15);
  const terrain = createTerrain(groundTex);
  scene.add(terrain);

  // ---- 中央バトル台座 ----
  scene.add(createArenaPlatform());

  // ---- 溶岩亀裂（光る地割れ） ----
  const lavaCracks = createLavaCracks();
  scene.add(lavaCracks);
  const lavaMat = lavaCracks.material;

  // ---- 巨大ロックスパイア（中〜遠距離まで広く分布） ----
  const SPIRE_COUNT = 56;
  for (let i = 0; i < SPIRE_COUNT; i++) {
    const a = (i / SPIRE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const r = 60 + Math.random() * 540; // 60〜600 (1.5倍拡張)
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (insideArena(x, z, 3)) continue;
    scene.add(createRockSpire(x, z));
  }

  // ---- 枯れ木（広範囲に散布） ----
  const swayables = [];
  for (let i = 0; i < 90; i++) {
    const p = randomPositionAvoidingArena(30, 630);
    const tree = createDeadTree(p.x, p.z);
    scene.add(tree);
    swayables.push({ obj: tree, phase: Math.random() * Math.PI * 2, amp: 0.025 });
  }

  // ---- 岩塊（地面に多数散らす） ----
  for (let i = 0; i < 240; i++) {
    const p = randomPositionAvoidingArena(27, 645);
    scene.add(createBoulder(p.x, p.z));
  }

  // ---- 乾いた草・茂み ----
  for (let i = 0; i < 420; i++) {
    const p = randomPositionAvoidingArena(27, 645);
    const brush = createDryBrush(p.x, p.z);
    scene.add(brush);
    swayables.push({ obj: brush, phase: Math.random() * Math.PI * 2, amp: 0.05 });
  }

  // ---- 流雲（高所、広範囲を覆う） ----
  const clouds = [];
  const CLOUD_COUNT = 70;
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const a = (i / CLOUD_COUNT) * Math.PI * 2 + Math.random() * 0.45;
    const r = 120 + Math.random() * 420; // 120〜540 (1.5倍拡張)
    const y = 45 + Math.random() * 55;   // 45〜100
    const cloud = createCloud();
    cloud.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    scene.add(cloud);
    clouds.push({ obj: cloud, angle: a, radius: r, speed: 0.003 + Math.random() * 0.008 });
  }

  // ---- 浮島（広域に多数配置、高度もばらつく） ----
  const FLOATING_ROCKS = [
    [28, 14, 8, 4.0],   [-22, 18, -12, 3.4], [14, 22, -28, 3.0],
    [-30, 10, 18, 4.6], [5, 26, 30, 3.4],    [80, 30, 60, 5.0],
    [-90, 22, 40, 4.2], [120, 38, -50, 5.8], [-70, 18, -110, 3.8],
    [160, 26, 30, 4.4], [-150, 32, -60, 5.0], [40, 42, -160, 4.6],
    [-40, 28, 180, 4.0],[200, 44, 130, 6.2], [-220, 36, -150, 5.2],
    [110, 50, 250, 4.8],[-180, 24, 220, 4.2],[260, 30, -200, 5.6],
  ];
  for (const [fx, fy, fz, fs] of FLOATING_ROCKS) {
    scene.add(createFloatingRock(fx, fy, fz, fs));
  }

  // ---- 砂塵（大気の粒） ----
  const dust = createDustStorm();
  scene.add(dust);

  // ---- カラス（旋回） — マップが広いので数を増やす ----
  const birds = [];
  for (let i = 0; i < 16; i++) {
    const bird = createCrow();
    scene.add(bird);
    birds.push({
      obj: bird,
      angle: Math.random() * Math.PI * 2,
      radius: 90 + Math.random() * 450, // 90〜540 (1.5倍拡張)
      height: 28 + Math.random() * 50,
      speed: 0.05 + Math.random() * 0.08,
      flapPhase: Math.random() * Math.PI * 2,
    });
  }

  let time = 0;

  return {
    update(dt) {
      time += dt;
      const wind = 0.5 + Math.sin(time * 0.3) * 0.2;

      // 枯れ木・草の風揺れ
      for (const s of swayables) {
        s.obj.rotation.z = Math.sin(time * 1.4 + s.phase) * s.amp * wind;
      }

      // 雲の漂い
      for (const c of clouds) {
        c.angle += c.speed * dt;
        c.obj.position.x = Math.cos(c.angle) * c.radius;
        c.obj.position.z = Math.sin(c.angle) * c.radius;
      }

      // カラスの旋回・羽ばたき
      for (const b of birds) {
        b.angle += b.speed * dt;
        const x = Math.cos(b.angle) * b.radius;
        const z = Math.sin(b.angle) * b.radius;
        b.obj.position.set(x, b.height + Math.sin(time * 0.5 + b.flapPhase) * 1.2, z);
        b.obj.rotation.y = -b.angle + Math.PI / 2;
        b.flapPhase += dt * 7;
        const flap = Math.sin(b.flapPhase) * 0.6;
        if (b.obj.userData.leftWing && b.obj.userData.rightWing) {
          b.obj.userData.leftWing.rotation.z = 0.3 + flap;
          b.obj.userData.rightWing.rotation.z = -0.3 - flap;
        }
      }

      // 溶岩亀裂のパルス
      if (lavaMat.uniforms && lavaMat.uniforms.uTime) {
        lavaMat.uniforms.uTime.value = time;
      }

      // 砂塵の上昇＋ドリフト
      const positions = dust.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i);
        let x = positions.getX(i);
        y += dt * (0.45 + (i % 5) * 0.08);
        x += Math.sin(time * 0.2 + i * 0.1) * dt * 0.4;
        if (y > 42) y = -3;
        positions.setY(i, y);
        positions.setX(i, x);
      }
      positions.needsUpdate = true;
    },
  };
}

// ---- ヘルパー ----

function insideArena(x, z, margin = 0) {
  const d = Math.hypot(x - ARENA_CENTER.x, z - ARENA_CENTER.y);
  return d < ARENA_RADIUS + margin;
}

function randomPositionAvoidingArena(minR, maxR) {
  for (let attempt = 0; attempt < 14; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!insideArena(x, z, 2)) return { x, z };
  }
  return { x: maxR, z: 0 };
}

// 地形高さ：荒々しい起伏 + 中央は平坦
// ---- ノイズ関数群（決定的な擬似乱数 + 補間 + fbm） ----
// マイクラ感を消すため、複数オクターブの value noise + ridge noise を合成
function _hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function _valueNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = _hash2(xi,     zi);
  const b = _hash2(xi + 1, zi);
  const c = _hash2(xi,     zi + 1);
  const d = _hash2(xi + 1, zi + 1);
  // smoothstep 補間（Perlin より軽量）
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// 0..1 範囲 → -1..1 範囲の symmetric noise
function _snoise(x, z) {
  return _valueNoise(x, z) * 2.0 - 1.0;
}
// fBm（5オクターブ）：自然な丘陵
function _fbm(x, z) {
  let v = 0, amp = 1.0, freq = 1.0, total = 0;
  for (let i = 0; i < 5; i++) {
    v += amp * _snoise(x * freq, z * freq);
    total += amp;
    freq *= 2.03;
    amp  *= 0.5;
  }
  return v / total;
}
// ridge noise：尖った稜線（山脈っぽさ）
function _ridge(x, z) {
  let v = 0, amp = 1.0, freq = 1.0, total = 0;
  for (let i = 0; i < 4; i++) {
    const n = 1.0 - Math.abs(_snoise(x * freq, z * freq));
    v += amp * n * n;
    total += amp;
    freq *= 2.07;
    amp  *= 0.5;
  }
  return v / total;
}

function terrainHeightAt(x, z) {
  const d = Math.hypot(x, z);
  // 中央のアリーナエリアは平坦に
  const flatness = THREE.MathUtils.smoothstep(d, ARENA_RADIUS, ARENA_RADIUS + 8);

  // 大局的な起伏：fbm で自然なうねり
  const macro = _fbm(x * 0.018, z * 0.018) * 5.2;
  // 中域：fbm を 2.5x スケールで重ねて中規模の起伏を作る
  const meso  = _fbm(x * 0.06,  z * 0.06)  * 1.6;
  // 細部：fbm の高周波で岩の凸凹
  const micro = _fbm(x * 0.22,  z * 0.22)  * 0.45;
  // 尾根：ridge noise で峰っぽさ（高所のみ強調）
  const ridge = _ridge(x * 0.04, z * 0.04);

  // 基本標高
  let h = macro + meso + micro;
  // 尾根は標高に応じて加算（低地には影響しない＝侵食された地形に見える）
  const ridgeBlend = THREE.MathUtils.smoothstep(h, 0.5, 4.0);
  h += ridge * ridgeBlend * 5.0;

  // 侵食：水流の谷を弱めに掘る（fbm の谷方向に下げる）
  const erosion = Math.max(0, 0.5 - _fbm(x * 0.10 + 100, z * 0.10 + 100));
  h -= erosion * 1.2;

  // 中央のフラット化
  h *= flatness;

  // 遠方ほど隆起（地平の山並みへ繋ぐ）— 1.5 倍拡張に合わせ、平地エリアと立ち上がり距離も比例
  const edge = Math.max(0, (d - 420) / 660);
  h += edge * edge * 22.0;

  return h;
}

// ---- パーツ ----

function createSkyDome() {
  // ステージ拡張に合わせて空ドームも拡大、ポリゴンも増（滑らかなグラデ）
  const geo = new THREE.SphereGeometry(1650, 64, 40);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor:     { value: new THREE.Color(0x0e0820) }, // 上空：藍紫
      upperColor:   { value: new THREE.Color(0x3a1640) }, // 紫
      midColor:     { value: new THREE.Color(0x8b2a3a) }, // 朱紫
      horizonColor: { value: new THREE.Color(0xff7838) }, // 地平線：濃いオレンジ
      groundColor:  { value: new THREE.Color(0xffba66) }, // 地平より下：淡い橙
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 upperColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 col;
        if (h > 0.55) {
          col = mix(upperColor, topColor, smoothstep(0.55, 1.0, h));
        } else if (h > 0.18) {
          col = mix(midColor, upperColor, smoothstep(0.18, 0.55, h));
        } else if (h > 0.0) {
          col = mix(horizonColor, midColor, smoothstep(0.0, 0.18, h));
        } else {
          col = mix(horizonColor, groundColor, smoothstep(0.0, -0.4, h));
        }
        // 横方向の縞ノイズで雲のような層を仄かに
        float band = sin(vWorldPosition.y * 0.04 + vWorldPosition.x * 0.005) * 0.5 + 0.5;
        col += vec3(0.04, 0.02, 0.0) * band * smoothstep(-0.05, 0.25, h);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -3;
  // 空の高さを2倍にする（Y方向にスケール）
  mesh.scale.y = 2;
  return mesh;
}

function createSunDisc(sunPos) {
  const group = new THREE.Group();
  const dir = sunPos.clone().normalize();
  const placement = dir.multiplyScalar(1350);

  const sunMat = new THREE.SpriteMaterial({
    color: 0xfff0c2,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    depthTest: false,
  });
  const sun = new THREE.Sprite(sunMat);
  sun.scale.set(70, 70, 1);
  sun.position.copy(placement);
  sun.renderOrder = -2;
  group.add(sun);

  // 内側グロー
  const innerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xffb060,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  innerGlow.scale.set(160, 160, 1);
  innerGlow.position.copy(placement);
  innerGlow.renderOrder = -2;
  group.add(innerGlow);

  // 外側ハロ
  const outerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    color: 0xff8040,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  outerGlow.scale.set(360, 360, 1);
  outerGlow.position.copy(placement);
  outerGlow.renderOrder = -2;
  group.add(outerGlow);

  return group;
}

// レンズフレア風（太陽の延長線上に小さな円盤を散らす）— ステージ拡張に合わせて大きく
function createLensFlare(sunPos) {
  const group = new THREE.Group();
  const dir = sunPos.clone().normalize();
  const offsets = [
    { d: 0.85, size: 22, color: 0xff8c60, alpha: 0.35 },
    { d: 0.70, size: 12, color: 0xff5040, alpha: 0.30 },
    { d: 0.55, size: 14, color: 0xffd070, alpha: 0.25 },
    { d: 0.35, size: 26, color: 0xff9050, alpha: 0.20 },
    { d: 0.10, size: 18, color: 0xffe0a0, alpha: 0.18 },
  ];
  for (const o of offsets) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      color: o.color,
      transparent: true,
      opacity: o.alpha,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }));
    sprite.scale.set(o.size, o.size, 1);
    sprite.position.copy(dir).multiplyScalar(1320 * o.d);
    sprite.renderOrder = -2;
    group.add(sprite);
  }
  return group;
}

// 遠景の霞プレート — 光のカーテン状の仕切りに見えるため無効化（空Groupを返す）
function createHazePlanes() {
  return new THREE.Group();
}

// 多層山稜（手前ほど濃く、奥は薄く）— 4層に増、ステージ拡張に合わせて距離・密度を大幅増
function createMountainLayers() {
  const group = new THREE.Group();
  const layers = [
    { dist: 570,  h: 70,  count: 64, color: 0x3a2530, opacity: 1.0 },
    { dist: 750,  h: 100, count: 54, color: 0x4a2a3a, opacity: 0.85 },
    { dist: 960,  h: 140, count: 44, color: 0x5a3040, opacity: 0.70 },
    { dist: 1200, h: 180, count: 36, color: 0x6a3a48, opacity: 0.55 },
  ];
  for (const l of layers) {
    const mat = new THREE.MeshBasicMaterial({
      color: l.color,
      transparent: l.opacity < 1,
      opacity: l.opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    for (let i = 0; i < l.count; i++) {
      const a = (i / l.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
      const h = l.h * (0.7 + Math.random() * 0.6);
      const w = h * (0.85 + Math.random() * 0.55);
      const segs = 10 + Math.floor(Math.random() * 5);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(w, h, segs), mat);
      cone.position.set(Math.cos(a) * l.dist, h / 2 - 6, Math.sin(a) * l.dist);
      cone.rotation.y = Math.random() * Math.PI;
      cone.renderOrder = -1;
      group.add(cone);
    }
  }
  return group;
}

// 岩肌テクスチャ（Canvas で生成）— 高解像度化（1024^2）+ ディテール強化
function createRockTexture(baseHex, dirtHex) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const baseCol = new THREE.Color(baseHex);
  const dirtCol = new THREE.Color(dirtHex);

  ctx.fillStyle = `rgb(${(baseCol.r * 255) | 0}, ${(baseCol.g * 255) | 0}, ${(baseCol.b * 255) | 0})`;
  ctx.fillRect(0, 0, size, size);

  // 大きな下地ノイズ（地層っぽい斑）
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // ざらつき（多重周波数で粒状感）
      const n = (Math.random() - 0.5) * 55;
      const m = Math.sin(x * 0.04) * Math.cos(y * 0.04) * 16
              + Math.sin(x * 0.13 + y * 0.07) * 10
              + Math.cos(x * 0.21 - y * 0.18) * 6;
      img.data[i + 0] = Math.max(0, Math.min(255, img.data[i + 0] + n + m));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n + m * 0.78));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n + m * 0.5));
    }
  }
  ctx.putImageData(img, 0, 0);

  // 大きめの汚れシミ（密度UP）
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 14 + Math.random() * 64;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${(dirtCol.r * 255) | 0}, ${(dirtCol.g * 255) | 0}, ${(dirtCol.b * 255) | 0}, 0.55)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 小さなディテール斑点（高解像度のメリットを活かす）
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 4;
    ctx.fillStyle = `rgba(${(dirtCol.r * 200) | 0}, ${(dirtCol.g * 200) | 0}, ${(dirtCol.b * 200) | 0}, ${0.25 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ひび割れ風線（多層、密度UP）
  for (let layer = 0; layer < 2; layer++) {
    ctx.strokeStyle = `rgba(${(dirtCol.r * (180 - layer * 40)) | 0}, ${(dirtCol.g * (180 - layer * 40)) | 0}, ${(dirtCol.b * (180 - layer * 40)) | 0}, ${0.5 - layer * 0.15})`;
    ctx.lineWidth = 1.2 - layer * 0.5;
    for (let i = 0; i < 48; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      const steps = 8 + Math.floor(Math.random() * 10);
      const stepLen = 30 + layer * 20;
      for (let s = 0; s < steps; s++) {
        x += (Math.random() - 0.5) * stepLen * 2;
        y += (Math.random() - 0.5) * stepLen * 2;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = 16; // 高解像度ステージ向けに16倍異方性
  return tex;
}

function createTerrain(mapTex) {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cGround = new THREE.Color(0x6e3a22);  // 標準の土
  const cDark   = new THREE.Color(0x3c1d10);  // 谷の影
  const cAsh    = new THREE.Color(0x5a4a3e);  // 高所の灰
  const cBurn   = new THREE.Color(0x8a2820);  // アリーナ周辺の焼け
  const cClay   = new THREE.Color(0x8a5030);  // 露出した粘土層
  const cRock   = new THREE.Color(0x4a3025);  // 岩肌

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i); // 回転前は Y が奥行き
    const h = terrainHeightAt(x, y);
    pos.setZ(i, h);

    // 周辺サンプルで傾斜を推定（簡易normal代用）
    const eps = 1.5;
    const hx = terrainHeightAt(x + eps, y) - terrainHeightAt(x - eps, y);
    const hz = terrainHeightAt(x, y + eps) - terrainHeightAt(x, y - eps);
    const slope = Math.hypot(hx, hz) / (eps * 2);  // 0..∞、急斜面ほど大

    // ベースカラー：標準の土
    let col = cGround.clone();
    // 谷（低標高）は暗く
    const lowness = THREE.MathUtils.smoothstep(-h, -2, 1.5);
    col.lerp(cDark, lowness * 0.55);
    // 高所は乾いた灰（雪線ならぬ「ash線」）
    col.lerp(cAsh, THREE.MathUtils.smoothstep(h, 2.5, 6.5) * 0.75);
    // 急斜面は岩が露出
    col.lerp(cRock, Math.min(1, slope * 1.4) * 0.65);
    // 中域標高の緩斜面には粘土層を見せる
    if (h > 0.5 && h < 3.0 && slope < 0.5) {
      col.lerp(cClay, 0.35);
    }
    // 中央付近は熱で焼けた赤茶
    const d = Math.hypot(x, y);
    if (d < ARENA_RADIUS + 8) {
      const t = Math.max(0, 1 - d / (ARENA_RADIUS + 8));
      col.lerp(cBurn, t * 0.35);
    }
    // 高周波カラーノイズ（砂粒・斑模様）
    const n1 = _snoise(x * 1.2, y * 1.2) * 0.04;
    const n2 = _snoise(x * 5.0, y * 5.0) * 0.025;
    col.offsetHSL(0, 0, n1 + n2);

    colors[i * 3 + 0] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: mapTex,
    vertexColors: true,
    roughness: 0.97,
    metalness: 0.02,
    flatShading: false,
  });
  // テクスチャを細かく繰り返してマイクラ感を消す
  if (mapTex) {
    mapTex.wrapS = mapTex.wrapT = THREE.RepeatWrapping;
    mapTex.repeat.set(28, 28);
    mapTex.anisotropy = 8;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

// 中央のバトル台座（薄い円盤の岩床）
function createArenaPlatform() {
  const group = new THREE.Group();
  const tex = createRockTexture(0x8a4a30, 0x4a2418);

  // 上面
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS * 0.95, 0.6, 48, 1),
    new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xa66048,
      roughness: 0.95,
    })
  );
  top.position.y = 0.3;
  top.receiveShadow = true;
  group.add(top);

  // 縁の砕けた岩 — 高密度 + 2層ノイズで自然な岩塊に
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
    const r = ARENA_RADIUS + 0.1 + Math.random() * 0.6;
    const s = 0.5 + Math.random() * 0.6;
    const rockGeo = new THREE.IcosahedronGeometry(s, 3);
    const rPos = rockGeo.attributes.position;
    const sX = Math.random() * 100;
    const sZ = Math.random() * 100;
    for (let j = 0; j < rPos.count; j++) {
      const rx = rPos.getX(j);
      const ry = rPos.getY(j);
      const rz = rPos.getZ(j);
      // 2層ノイズで球面を侵食岩塊へ
      const n1 = _fbm(rx * 1.8 + sX, rz * 1.8 + sZ) * 0.30;
      const n2 = _snoise(rx * 4.5 + ry * 2.5, rz * 4.5 + sX) * 0.10;
      const scale = 1 + n1 + n2;
      rPos.setX(j, rx * scale);
      rPos.setY(j, ry * scale);
      rPos.setZ(j, rz * scale);
    }
    rockGeo.computeVertexNormals();
    const rock = new THREE.Mesh(
      rockGeo,
      new THREE.MeshStandardMaterial({
        color: 0x5a3020,
        roughness: 1,
        flatShading: false,
      })
    );
    rock.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.y = 0.6 + Math.random() * 0.3;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  return group;
}

// 溶岩亀裂（地面の上に薄い発光ディスクを置く）
function createLavaCracks() {
  const geo = new THREE.CircleGeometry(ARENA_RADIUS * 2.5, 96);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xff6020) },
      uColor2: { value: new THREE.Color(0xffd060) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uColor2;
      varying vec2 vUv;

      // 簡易ノイズ
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        // 中心からの放射状クラック
        float ang = atan(c.y, c.x);
        float bands = sin(ang * 6.0 + noise(c * 8.0) * 6.0) * 0.5 + 0.5;
        float spokes = pow(bands, 8.0);

        // ランダムクラック
        float n = noise(vUv * 18.0);
        float crack = smoothstep(0.55, 0.78, n) * smoothstep(0.95, 0.4, r);

        // パルス
        float pulse = 0.6 + sin(uTime * 2.0) * 0.4;
        float intensity = (spokes * 0.6 + crack) * pulse;

        // 中央ほど強い
        float falloff = smoothstep(1.0, 0.0, r);

        vec3 col = mix(uColor, uColor2, intensity);
        float alpha = intensity * falloff * 0.9;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.62; // 台座の上に薄く重ねる
  mesh.renderOrder = 1;
  return mesh;
}

// ロックスパイア（高くそびえる岩柱）— 高密度ジオメトリ + 2層 fbm ノイズで自然な岩肌に
function createRockSpire(x, z) {
  const group = new THREE.Group();
  const height = 6 + Math.random() * 12;
  const baseR = 0.8 + Math.random() * 1.2;
  const topR = 0.15 + Math.random() * 0.3;
  // 高密度化: 周方向 32 / 高さ方向 28
  const segs = 32;
  const heightSegs = 28;

  const geo = new THREE.CylinderGeometry(topR, baseR, height, segs, heightSegs);
  // 2層 fbm + ridge による侵食岩肌
  const pos = geo.attributes.position;
  const seedX = Math.random() * 100;
  const seedZ = Math.random() * 100;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    // 円柱の中心軸からの方向と距離
    const r = Math.hypot(px, pz);
    if (r < 0.001) continue; // 中心軸は変位させない
    const nx = px / r;
    const nz = pz / r;
    // マクロ層: 大きな凹凸（縦の縞・侵食）
    const macro = _fbm(seedX + py * 0.35, seedZ + Math.atan2(pz, px) * 1.2) * 0.55;
    // メソ層: 中程度のゴツゴツ
    const meso  = _fbm(seedX * 2 + px * 0.9, seedZ * 2 + pz * 0.9 + py * 0.4) * 0.28;
    // ミクロ層: 表面のざらつき
    const micro = _snoise(px * 3.5 + seedX, pz * 3.5 + py * 2.0 + seedZ) * 0.08;
    // 上端と下端では変位を抑える
    const yNorm = (py + height / 2) / height; // 0..1
    const edgeMask = Math.sin(yNorm * Math.PI); // 上下端で 0
    const disp = (macro + meso) * edgeMask + micro;
    // 法線方向に押し出す
    pos.setX(i, px + nx * disp);
    pos.setZ(i, pz + nz * disp);
    // 縦方向にも少し揺らぎを入れて層状の侵食感
    pos.setY(i, py + _snoise(px * 1.5 + seedX, pz * 1.5 + seedZ) * 0.12);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a2a1c,
    roughness: 0.98,
    flatShading: false, // 滑らかなシェーディングでリアルに
  });
  const spire = new THREE.Mesh(geo, mat);
  spire.position.y = height / 2;
  spire.castShadow = true;
  spire.receiveShadow = true;
  group.add(spire);

  // 根元の小岩（高密度版）
  for (let i = 0; i < 4; i++) {
    const r = 0.4 + Math.random() * 0.5;
    const rockGeo = new THREE.IcosahedronGeometry(r, 3); // detail=3 で高密度
    const rPos = rockGeo.attributes.position;
    const rSeedX = Math.random() * 100;
    const rSeedZ = Math.random() * 100;
    for (let j = 0; j < rPos.count; j++) {
      const rx = rPos.getX(j);
      const ry = rPos.getY(j);
      const rz = rPos.getZ(j);
      const len = Math.hypot(rx, ry, rz);
      if (len < 0.001) continue;
      // 2層ノイズで球面を変形
      const n1 = _fbm(rx * 1.5 + rSeedX, rz * 1.5 + rSeedZ) * 0.25;
      const n2 = _snoise(rx * 4.0 + ry * 3.0, rz * 4.0 + rSeedX) * 0.08;
      const scale = 1 + n1 + n2;
      rPos.setX(j, rx * scale);
      rPos.setY(j, ry * scale * (0.7 + Math.random() * 0.05));
      rPos.setZ(j, rz * scale);
    }
    rockGeo.computeVertexNormals();
    const rock = new THREE.Mesh(
      rockGeo,
      new THREE.MeshStandardMaterial({
        color: 0x3a2018,
        roughness: 1,
        flatShading: false,
      })
    );
    const ra = Math.random() * Math.PI * 2;
    rock.position.set(
      Math.cos(ra) * (baseR + 0.3),
      r * 0.4,
      Math.sin(ra) * (baseR + 0.3)
    );
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  group.position.set(x, terrainHeightAt(x, z), z);
  group.rotation.y = Math.random() * Math.PI * 2;
  return group;
}

// 枯れ木（DBZ的な荒野の象徴）
function createDeadTree(x, z) {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x2e1f15,
    roughness: 1,
  });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.35, 2.6, 7),
    trunkMat
  );
  trunk.position.y = 1.3;
  trunk.castShadow = true;
  tree.add(trunk);

  // 主枝
  const branches = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < branches; i++) {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.12, 1.0 + Math.random() * 0.4, 5),
      trunkMat
    );
    const a = (i / branches) * Math.PI * 2 + Math.random() * 0.5;
    branch.position.set(
      Math.cos(a) * 0.3,
      1.8 + Math.random() * 0.8,
      Math.sin(a) * 0.3
    );
    branch.rotation.z = Math.PI / 2 - 0.4 + Math.random() * 0.5;
    branch.rotation.y = -a;
    branch.castShadow = true;
    tree.add(branch);

    // 副枝
    if (Math.random() > 0.5) {
      const twig = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.06, 0.5, 4),
        trunkMat
      );
      twig.position.copy(branch.position);
      twig.position.y += 0.3;
      twig.position.x += Math.cos(a) * 0.4;
      twig.position.z += Math.sin(a) * 0.4;
      twig.rotation.z = Math.PI / 2 - 0.2 + Math.random() * 0.6;
      twig.rotation.y = -a + (Math.random() - 0.5) * 0.6;
      tree.add(twig);
    }
  }

  tree.position.set(x, terrainHeightAt(x, z), z);
  tree.rotation.y = Math.random() * Math.PI * 2;
  const s = 1.0 + Math.random() * 0.7;
  tree.scale.setScalar(s);
  return tree;
}

// 荒野の岩塊 — 高密度 icosahedron + 2層 fbm ノイズで自然な侵食岩
function createBoulder(x, z) {
  const s = 0.5 + Math.random() * 1.3;
  // detail=4 で高密度（約 2562 頂点）
  const geo = new THREE.IcosahedronGeometry(s, 4);
  const pos = geo.attributes.position;
  const sX = Math.random() * 100;
  const sZ = Math.random() * 100;
  const sY = Math.random() * 100;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const len = Math.hypot(px, py, pz);
    if (len < 0.001) continue;
    // マクロ層: 大きな凹凸
    const macro = _fbm(px * 1.2 + sX, pz * 1.2 + sZ) * 0.32;
    // ミクロ層: 細かいざらつき
    const micro = _snoise(px * 5.0 + sY, pz * 5.0 + py * 3.0) * 0.07;
    const scale = 1 + macro + micro;
    pos.setX(i, px * scale);
    pos.setY(i, py * scale);
    pos.setZ(i, pz * scale);
  }
  geo.computeVertexNormals();

  const baseHue = 0.05 + Math.random() * 0.04;
  const baseSat = 0.15 + Math.random() * 0.15;
  const baseLight = 0.18 + Math.random() * 0.12;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(baseHue, baseSat, baseLight),
    roughness: 1,
    flatShading: false,
  });
  const rock = new THREE.Mesh(geo, mat);
  rock.position.set(x, terrainHeightAt(x, z) + s * 0.45, z);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.scale.y = 0.65 + Math.random() * 0.35;
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

// 乾いた草・茂み
function createDryBrush(x, z) {
  const group = new THREE.Group();
  const palette = [0x7a6230, 0x665022, 0x8a7340];
  const mat = new THREE.MeshStandardMaterial({
    color: palette[Math.floor(Math.random() * palette.length)],
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.4 + Math.random() * 0.25), mat);
    blade.position.set(
      (Math.random() - 0.5) * 0.35,
      0.2,
      (Math.random() - 0.5) * 0.35
    );
    blade.rotation.y = Math.random() * Math.PI;
    blade.rotation.z = (Math.random() - 0.5) * 0.25;
    group.add(blade);
  }
  group.position.set(x, terrainHeightAt(x, z), z);
  return group;
}

// 流雲（暗赤味を帯びた）
function createCloud() {
  const cloud = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd89a78,
    roughness: 1,
    flatShading: false,
    emissive: 0x3a1410,
    emissiveIntensity: 0.3,
  });
  const n = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    const s = 2.0 + Math.random() * 3.2;
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), mat);
    lobe.position.set(
      (Math.random() - 0.5) * 7,
      (Math.random() - 0.5) * 1.4,
      (Math.random() - 0.5) * 7
    );
    lobe.scale.y = 0.5;
    cloud.add(lobe);
  }
  return cloud;
}

// 浮島（小規模な岩塊が空に浮かぶ）— 高密度 + 2層ノイズで自然な侵食
function createFloatingRock(x, y, z, size) {
  const island = new THREE.Group();
  // 高密度化 (detail=4)
  const geo = new THREE.IcosahedronGeometry(size, 4);
  const pos = geo.attributes.position;
  const sX = Math.random() * 100;
  const sZ = Math.random() * 100;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const len = Math.hypot(px, py, pz);
    if (len < 0.001) continue;
    // 下面を尖らせる: 下半分のみ強い変位
    const downBias = py < 0 ? Math.abs(py / size) : 0;
    const macro = _fbm(px * 0.8 + sX, pz * 0.8 + sZ) * (0.30 + downBias * 0.35);
    const micro = _snoise(px * 3.5 + sX, pz * 3.5 + py * 2.0) * 0.07;
    const scale = 1 + macro + micro;
    pos.setX(i, px * scale);
    pos.setY(i, py * scale - downBias * size * 0.4); // 下に伸ばす
    pos.setZ(i, pz * scale);
  }
  geo.computeVertexNormals();

  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0x5a3a28,
      roughness: 0.95,
      flatShading: false,
    })
  );
  rock.scale.y = 0.65;
  rock.castShadow = true;
  rock.receiveShadow = true;
  island.add(rock);

  // 上面に小石を散らす（高密度版）
  for (let i = 0; i < 5; i++) {
    const pSize = 0.25 + Math.random() * 0.3;
    const pebGeo = new THREE.IcosahedronGeometry(pSize, 2);
    const pPos = pebGeo.attributes.position;
    const pSX = Math.random() * 100;
    for (let j = 0; j < pPos.count; j++) {
      const rx = pPos.getX(j);
      const ry = pPos.getY(j);
      const rz = pPos.getZ(j);
      const n = _fbm(rx * 3.0 + pSX, rz * 3.0) * 0.22;
      const scale = 1 + n;
      pPos.setX(j, rx * scale);
      pPos.setY(j, ry * scale);
      pPos.setZ(j, rz * scale);
    }
    pebGeo.computeVertexNormals();
    const pebble = new THREE.Mesh(
      pebGeo,
      new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 1, flatShading: false })
    );
    pebble.position.set(
      (Math.random() - 0.5) * size * 1.3,
      size * 0.55,
      (Math.random() - 0.5) * size * 1.3
    );
    pebble.rotation.set(Math.random(), Math.random(), Math.random());
    island.add(pebble);
  }

  island.position.set(x, y, z);
  return island;
}

// 砂塵の粒（広範囲に散らす）— マップ拡張に合わせて粒数・範囲を大幅に拡大
function createDustStorm() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 840;
    positions[i * 3 + 1] = Math.random() * 55;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 840;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffd0a0,
    size: 0.18,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

// カラス（旋回用）
function createCrow() {
  const bird = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a1418, roughness: 0.9, side: THREE.DoubleSide });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat);
  body.scale.set(1.5, 0.55, 0.55);
  bird.add(body);

  const wingGeo = new THREE.BufferGeometry();
  const wingVerts = new Float32Array([
    0, 0, 0,
    0.95, 0, -0.35,
    0.7, 0, 0.25,
  ]);
  wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
  wingGeo.setIndex([0, 1, 2]);
  wingGeo.computeVertexNormals();

  const leftWing = new THREE.Mesh(wingGeo, mat);
  leftWing.position.set(0, 0.05, 0);
  bird.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, mat);
  rightWing.position.set(0, 0.05, 0);
  rightWing.scale.x = -1;
  bird.add(rightWing);

  bird.userData.leftWing = leftWing;
  bird.userData.rightWing = rightWing;
  return bird;
}
