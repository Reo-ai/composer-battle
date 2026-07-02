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
// ドラゴン（騎乗）
// =====================================================
function veh_dragon() {
  const g = new THREE.Group();
  g.name = 'vehicle_dragon';

  // 胴体
  const body = withShadow(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.2, 6, 14),
    plainMat(0xaa2244, { metalness: 0.4 })
  ));
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.45;
  g.add(body);

  // 首
  const neck = withShadow(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.5, 4, 10),
    plainMat(0xaa2244)
  ));
  neck.rotation.x = -0.6;
  neck.position.set(0, 0.7, 1.05);
  g.add(neck);

  // 頭
  const head = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.32, 0.5),
    plainMat(0x882233)
  ));
  head.position.set(0, 0.95, 1.4);
  g.add(head);

  // 角
  for (let i = 0; i < 2; i++) {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.25, 6),
      plainMat(0x222222)
    );
    horn.position.set(i ? 0.12 : -0.12, 1.18, 1.35);
    horn.rotation.z = i ? -0.3 : 0.3;
    g.add(horn);
  }

  // 目（赤く光る）
  for (let i = 0; i < 2; i++) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      emissiveMat(0xff3300, 2.5)
    );
    eye.position.set(i ? 0.14 : -0.14, 0.98, 1.6);
    g.add(eye);
  }

  // 翼（左右）
  for (let i = 0; i < 2; i++) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.04, 0.8),
      emissiveMat(0xff5566, 0.4, { transparent: true, opacity: 0.85 })
    );
    wing.position.set(i ? 0.7 : -0.7, 0.7, 0.1);
    wing.rotation.z = i ? -0.3 : 0.3;
    g.add(wing);
  }

  // しっぽ
  const tail = withShadow(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.7, 4, 8),
    plainMat(0xaa2244)
  ));
  tail.rotation.x = 0.4;
  tail.position.set(0, 0.5, -0.9);
  g.add(tail);

  // 鞍（プレイヤーが乗る場所）
  const saddle = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.1, 0.4),
    plainMat(0x4a2d1a)
  ));
  saddle.position.set(0, 0.85, 0.2);
  g.add(saddle);

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
    playerOffsetY: 0.92, playerOffsetZ: 0.2,  scale: 1.0,
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
