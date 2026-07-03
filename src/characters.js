// 仮キャラ（グレーボックス）の生成
// 後でGLBに差し替えるので、必ず Group を返す
// 各キャラは Group の position/rotation で動かす

import * as THREE from 'three';

// キャラクター全体の表示スケール（仕様: 元サイズの2倍）
// 全 create 関数の末尾で group.scale.setScalar(CHARACTER_SCALE) を呼ぶ。
// プレイヤー/敵の当たり判定半径(radius)もこの倍率に合わせて拡張する。
export const CHARACTER_SCALE = 2.0;

// ヘルパー: メッシュに影設定
function withShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// --- 作曲ネコ ---
// 黒い猫、青いフード、ヘッドホン
export function createCatNeko() {
  const group = new THREE.Group();
  group.name = 'cat_neko';

  // フード（青いカプセル）= 胴体
  const body = withShadow(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 0.6, 4, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a7ec8, roughness: 0.6 })
  ));
  body.position.y = 0.7;
  group.add(body);

  // 頭（黒球）
  const head = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 })
  ));
  head.position.y = 1.5;
  group.add(head);

  // 顔の白い部分（口元）
  const muzzle = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
  ));
  muzzle.position.set(0, 1.4, 0.28);
  muzzle.scale.set(1, 0.7, 0.7);
  group.add(muzzle);

  // 耳（黒い三角錐 x2）
  const earGeo = new THREE.ConeGeometry(0.14, 0.25, 4);
  const earMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const earL = withShadow(new THREE.Mesh(earGeo, earMat));
  earL.position.set(-0.25, 1.85, 0);
  earL.rotation.z = -0.2;
  group.add(earL);
  const earR = withShadow(new THREE.Mesh(earGeo, earMat));
  earR.position.set(0.25, 1.85, 0);
  earR.rotation.z = 0.2;
  group.add(earR);

  // ヘッドホン（紫の輪）
  const headphone = withShadow(new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.06, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x8844cc, metalness: 0.3, roughness: 0.4 })
  ));
  headphone.position.y = 1.6;
  headphone.rotation.x = Math.PI / 2;
  group.add(headphone);

  // 目（白い小さな球 x2）
  const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.13, 1.5, 0.36);
  group.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.13, 1.5, 0.36);
  group.add(eyeR);

  // 腕（黒い円柱 x2）
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.5, 4, 8);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const armL = withShadow(new THREE.Mesh(armGeo, armMat));
  armL.position.set(-0.5, 0.8, 0);
  armL.rotation.z = 0.3;
  group.add(armL);
  const armR = withShadow(new THREE.Mesh(armGeo, armMat));
  armR.position.set(0.5, 0.8, 0);
  armR.rotation.z = -0.3;
  group.add(armR);

  // しっぽ
  const tail = withShadow(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.07, 0.4, 4, 8),
    armMat
  ));
  tail.position.set(0, 0.7, -0.5);
  tail.rotation.x = -0.5;
  group.add(tail);

  group.scale.setScalar(CHARACTER_SCALE);
  return group;
}

// --- 作曲先生 ---
// 緑カーディガン、茶髪、眼鏡
export function createSensei() {
  const group = new THREE.Group();
  group.name = 'sensei';

  // 胴体（緑カーディガン）
  const body = withShadow(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.7, 4, 16),
    new THREE.MeshStandardMaterial({ color: 0x6b9e5c, roughness: 0.7 })
  ));
  body.position.y = 0.75;
  group.add(body);

  // 頭（肌色）
  const head = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xfac8a8, roughness: 0.6 })
  ));
  head.position.y = 1.55;
  group.add(head);

  // 髪（茶色板）- 後ろ
  const hairBack = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x4a2d1a, roughness: 0.8 })
  ));
  hairBack.position.set(0, 1.65, -0.05);
  hairBack.scale.set(1, 0.8, 1);
  group.add(hairBack);

  // 前髪（茶色の板）
  const bang = withShadow(new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.15, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x4a2d1a })
  ));
  bang.position.set(0, 1.78, 0.32);
  group.add(bang);

  // 眼鏡（黒い枠）
  const glassesL = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.015, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  glassesL.position.set(-0.12, 1.55, 0.34);
  group.add(glassesL);
  const glassesR = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.015, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  glassesR.position.set(0.12, 1.55, 0.34);
  group.add(glassesR);
  // 眼鏡ブリッジ
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.015, 0.015),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  bridge.position.set(0, 1.55, 0.34);
  group.add(bridge);

  // 腕（肌色 + 緑袖）
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.55, 4, 8);
  const armMat = new THREE.MeshStandardMaterial({ color: 0x6b9e5c });
  const armL = withShadow(new THREE.Mesh(armGeo, armMat));
  armL.position.set(-0.52, 0.85, 0);
  armL.rotation.z = 0.3;
  group.add(armL);
  const armR = withShadow(new THREE.Mesh(armGeo, armMat));
  armR.position.set(0.52, 0.85, 0);
  armR.rotation.z = -0.3;
  group.add(armR);

  // ズボン（グレー）
  const pants = withShadow(new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.5, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
  ));
  pants.position.y = 0.15;
  group.add(pants);

  group.scale.setScalar(CHARACTER_SCALE);
  return group;
}

// --- 作曲フクロウ オト ---
// 茶色フクロウ、緑ベレー、白い胸
export function createOwlOto() {
  const group = new THREE.Group();
  group.name = 'owl_oto';

  // 胴体（茶色のずんぐり丸い体）
  const body = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.7 })
  ));
  body.position.y = 0.8;
  body.scale.set(1, 1.1, 1);
  group.add(body);

  // お腹（白）
  const belly = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xfaf2dc })
  ));
  belly.position.set(0, 0.75, 0.18);
  belly.scale.set(1, 1.1, 0.6);
  group.add(belly);

  // 頭（茶色）
  const head = withShadow(new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.7 })
  ));
  head.position.y = 1.5;
  group.add(head);

  // ベレー帽（緑）
  const beretBase = withShadow(new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.45, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0x5a8a3f })
  ));
  beretBase.position.y = 1.85;
  group.add(beretBase);
  // ベレーのてっぺん突起
  const beretTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x5a8a3f })
  );
  beretTop.position.set(0.15, 1.99, 0);
  group.add(beretTop);

  // 目の周り（白い大きい円板 x2）
  const eyeAreaGeo = new THREE.SphereGeometry(0.18, 12, 12);
  const eyeAreaMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const eyeAreaL = new THREE.Mesh(eyeAreaGeo, eyeAreaMat);
  eyeAreaL.position.set(-0.15, 1.5, 0.32);
  eyeAreaL.scale.set(1, 1, 0.5);
  group.add(eyeAreaL);
  const eyeAreaR = new THREE.Mesh(eyeAreaGeo, eyeAreaMat);
  eyeAreaR.position.set(0.15, 1.5, 0.32);
  eyeAreaR.scale.set(1, 1, 0.5);
  group.add(eyeAreaR);

  // 黒目
  const pupilGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
  pupilL.position.set(-0.15, 1.5, 0.42);
  group.add(pupilL);
  const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
  pupilR.position.set(0.15, 1.5, 0.42);
  group.add(pupilR);

  // くちばし（オレンジ三角錐）
  const beak = withShadow(new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.15, 4),
    new THREE.MeshStandardMaterial({ color: 0xe89a3a })
  ));
  beak.position.set(0, 1.35, 0.45);
  beak.rotation.x = Math.PI / 2;
  group.add(beak);

  // 翼（茶色の板 x2）
  const wingGeo = new THREE.BoxGeometry(0.15, 0.5, 0.4);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x6b4528 });
  const wingL = withShadow(new THREE.Mesh(wingGeo, wingMat));
  wingL.position.set(-0.5, 0.85, 0);
  wingL.rotation.z = 0.2;
  group.add(wingL);
  const wingR = withShadow(new THREE.Mesh(wingGeo, wingMat));
  wingR.position.set(0.5, 0.85, 0);
  wingR.rotation.z = -0.2;
  group.add(wingR);

  group.scale.setScalar(CHARACTER_SCALE);
  return group;
}

// キャラ定義（IDで切り替えるためのレジストリ）
// 注意: maxHp は「4メモリ × baseSegmentHp」になるように設計（旧3メモリ時代の
// ダメージ感を維持するため、1メモリあたりの HP を 30〜43 程度にしている）。
// オーバーヒール取得時は maxSegments が 5 に増え、maxHp も baseSegmentHp 分だけ増える。
export const CHARACTERS = {
  cat_neko: {
    name: '作曲ネコ',
    create: createCatNeko,
    color: 0x3a7ec8,
    maxHp: 1188,           // 297 × 4 (体力さらに3倍)
    baseSegmentHp: 297,
    moveSpeed: 6,
    attack: 10,
    desc: 'バランス型の作曲家ネコ。安定した火力と機動力。',
    ultName: '音符の嵐',
    ultDesc: '周囲に音符弾を撒き散らし範囲攻撃を行う。',
  },
  sensei: {
    name: '作曲先生',
    create: createSensei,
    color: 0x6b9e5c,
    maxHp: 1548,           // 387 × 4 (体力さらに3倍)
    baseSegmentHp: 387,
    moveSpeed: 5,
    attack: 8,
    desc: '耐久型の作曲先生。被弾時に自己回復する。',
    ultName: '蒼天和音柱',
    ultDesc: '巨大な和音の柱を地面から立ち上げ、当たった敵に大ダメージ。',
  },
  owl_oto: {
    name: '作曲フクロウ オト',
    create: createOwlOto,
    color: 0xe89a3a,
    maxHp: 1080,           // 270 × 4 (体力さらに3倍)
    baseSegmentHp: 270,
    moveSpeed: 7,
    attack: 12,
    desc: '速射高火力のフクロウ。低耐久だが手数で押し切る。',
    ultName: '夜想曲ヴォルテックス',
    ultDesc: '夜の渦を発生させ、周囲の敵を引き寄せて連続ヒット。',
  },
};
