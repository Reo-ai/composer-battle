// 建物・遮蔽物モジュール
// FPS モード用のカバー・柱・L字廊下・高台などを配置し、
// AABB コライダーを提供する。
// アリーナ (ARENA_RADIUS=14) の外側に配置して既存の演出を邪魔しないようにする。

import * as THREE from 'three';
import { getTerrainHeightAt } from './stage.js';

const WALL_COLOR = 0x8a8a90;
const WALL_EDGE = 0x2a2a30;
const PLATFORM_COLOR = 0x6c6c74;
const PILLAR_COLOR = 0xa0a0a8;

// カバー物のプリセット（アリーナ中心 (0,0) 周りの相対座標）
// { type, x, z, sx, sy, sz, rot } の単純データにしておくと配置が楽
const LAYOUT = [
  // -------- 東側：L字廊下 --------
  { type: 'wall', x:  22, z:  -8, sx: 12, sy: 3.2, sz: 0.8, rot: 0 },
  { type: 'wall', x:  28, z:  -2, sx: 0.8, sy: 3.2, sz: 12, rot: 0 },
  { type: 'wall', x:  16, z:   0, sx: 0.8, sy: 3.2, sz: 6,  rot: 0 },

  // -------- 西側：小部屋（窓っぽい隙間つき） --------
  { type: 'wall', x: -22, z:  -6, sx: 10, sy: 3.2, sz: 0.8, rot: 0 },
  { type: 'wall', x: -27, z:   0, sx: 0.8, sy: 3.2, sz: 12, rot: 0 },
  { type: 'wall', x: -22, z:   6, sx: 4,  sy: 3.2, sz: 0.8, rot: 0 },
  { type: 'wall', x: -18, z:   6, sx: 2,  sy: 1.4, sz: 0.8, rot: 0 }, // 窓の下枠(低い壁)
  { type: 'wall', x: -17, z:   0, sx: 0.8, sy: 3.2, sz: 4,  rot: 0 },

  // -------- 北側：T字ジャンクション --------
  { type: 'wall', x:   0, z:  22, sx: 14, sy: 3.2, sz: 0.8, rot: 0 },
  { type: 'wall', x:   0, z:  28, sx: 0.8, sy: 3.2, sz: 8,  rot: 0 },

  // -------- 南側：カバー壁の列（半身高さ） --------
  { type: 'cover', x: -8, z: -22, sx: 3.2, sy: 1.2, sz: 0.8, rot: 0 },
  { type: 'cover', x:  0, z: -22, sx: 3.2, sy: 1.2, sz: 0.8, rot: 0 },
  { type: 'cover', x:  8, z: -22, sx: 3.2, sy: 1.2, sz: 0.8, rot: 0 },
  { type: 'cover', x: -4, z: -26, sx: 3.2, sy: 1.2, sz: 0.8, rot: 0 },
  { type: 'cover', x:  4, z: -26, sx: 3.2, sy: 1.2, sz: 0.8, rot: 0 },

  // -------- 柱（縦長ピラー） --------
  { type: 'pillar', x:  18, z:  18, sx: 1.4, sy: 4.8, sz: 1.4, rot: 0 },
  { type: 'pillar', x: -18, z:  18, sx: 1.4, sy: 4.8, sz: 1.4, rot: 0 },
  { type: 'pillar', x:  18, z: -18, sx: 1.4, sy: 4.8, sz: 1.4, rot: 0 },
  { type: 'pillar', x: -18, z: -18, sx: 1.4, sy: 4.8, sz: 1.4, rot: 0 },
  { type: 'pillar', x:   0, z:   0, sx: 1.2, sy: 4.2, sz: 1.2, rot: 0 }, // 中央
  { type: 'pillar', x:  10, z:  10, sx: 1.0, sy: 3.6, sz: 1.0, rot: 0 },
  { type: 'pillar', x: -10, z:  10, sx: 1.0, sy: 3.6, sz: 1.0, rot: 0 },
  { type: 'pillar', x:  10, z: -10, sx: 1.0, sy: 3.6, sz: 1.0, rot: 0 },
  { type: 'pillar', x: -10, z: -10, sx: 1.0, sy: 3.6, sz: 1.0, rot: 0 },

  // -------- 高台（プラットフォーム + 階段） --------
  { type: 'platform', x: 34, z:  8, sx: 8, sy: 2.4, sz: 6, rot: 0 },
  { type: 'stair',    x: 30, z:  8, sx: 3, sy: 1.2, sz: 6, rot: 0 },

  { type: 'platform', x: -34, z: -8, sx: 8, sy: 2.4, sz: 6, rot: 0 },
  { type: 'stair',    x: -30, z: -8, sx: 3, sy: 1.2, sz: 6, rot: 0 },
];

export function buildCoverLayout(scene) {
  const group = new THREE.Group();
  group.name = 'cover-layout';
  scene.add(group);

  const colliders = []; // THREE.Box3 の配列（XZ 平面用に y は広めに取る）

  const wallMat = new THREE.MeshStandardMaterial({
    color: WALL_COLOR, roughness: 0.85, metalness: 0.05,
  });
  const coverMat = new THREE.MeshStandardMaterial({
    color: 0x7a7a82, roughness: 0.9, metalness: 0.02,
  });
  const pillarMat = new THREE.MeshStandardMaterial({
    color: PILLAR_COLOR, roughness: 0.7, metalness: 0.15,
  });
  const platformMat = new THREE.MeshStandardMaterial({
    color: PLATFORM_COLOR, roughness: 0.8, metalness: 0.1,
  });
  const stairMat = new THREE.MeshStandardMaterial({
    color: 0x5a5a62, roughness: 0.85, metalness: 0.05,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: WALL_EDGE });

  for (const item of LAYOUT) {
    // 地形高さに合わせて Y ベースを決める
    const groundY = getTerrainHeightAt(item.x, item.z);
    const halfY = item.sy * 0.5;
    const baseY = groundY + halfY;

    let mat = wallMat;
    if (item.type === 'cover') mat = coverMat;
    else if (item.type === 'pillar') mat = pillarMat;
    else if (item.type === 'platform') mat = platformMat;
    else if (item.type === 'stair') mat = stairMat;

    const geom = new THREE.BoxGeometry(item.sx, item.sy, item.sz);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(item.x, baseY, item.z);
    if (item.rot) mesh.rotation.y = item.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 輪郭線（省コストな見栄え強化）
    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, edgeMat);
    line.position.copy(mesh.position);
    if (item.rot) line.rotation.y = item.rot;
    group.add(line);

    // AABB コライダー（rot は 0 前提。将来必要になれば OBB 化する）
    const min = new THREE.Vector3(
      item.x - item.sx * 0.5,
      baseY - halfY,
      item.z - item.sz * 0.5,
    );
    const max = new THREE.Vector3(
      item.x + item.sx * 0.5,
      baseY + halfY,
      item.z + item.sz * 0.5,
    );
    // stair はキャラが登れるように Y 上限を控えめにする（コライダーは通常通り）
    const box = new THREE.Box3(min, max);
    box.userData = { type: item.type, walkable: item.type === 'platform' || item.type === 'stair' };
    colliders.push(box);
  }

  // XZ 平面での押し出し解決
  // pos: THREE.Vector3, radius: number
  // 返り値: 位置を書き換えた上で衝突があれば true
  function resolveXZ(pos, radius) {
    let hit = false;
    for (const box of colliders) {
      // walkable な物（プラットフォーム/階段）は「上に乗れる」ものとして、
      // 足元が上面より上にある場合はスキップ
      const topY = box.max.y;
      if (box.userData && box.userData.walkable) {
        if (pos.y >= topY - 0.05) continue; // 上に立っているのでXZ衝突は無視
      }
      // AABB 拡張してキャラ半径ぶんふくらませる（XZ のみ）
      const minX = box.min.x - radius;
      const maxX = box.max.x + radius;
      const minZ = box.min.z - radius;
      const maxZ = box.max.z + radius;
      if (pos.x < minX || pos.x > maxX || pos.z < minZ || pos.z > maxZ) continue;
      // Y 範囲チェック（頭上を通過する場合はスキップ）
      if (pos.y > box.max.y + 0.2 || pos.y + 1.8 < box.min.y) continue;

      // 最も近い辺に押し出す
      const dxLeft   = pos.x - minX;
      const dxRight  = maxX - pos.x;
      const dzFront  = pos.z - minZ;
      const dzBack   = maxZ - pos.z;
      const minPen = Math.min(dxLeft, dxRight, dzFront, dzBack);
      if (minPen === dxLeft)   pos.x = minX;
      else if (minPen === dxRight)  pos.x = maxX;
      else if (minPen === dzFront)  pos.z = minZ;
      else                          pos.z = maxZ;
      hit = true;
    }
    return hit;
  }

  // プラットフォーム/階段の上に乗る処理（Y のみ）
  // pos.y をカバー上面までせり上げる
  function resolveStandOn(pos, radius) {
    let topSupport = -Infinity;
    for (const box of colliders) {
      if (!box.userData || !box.userData.walkable) continue;
      const minX = box.min.x - radius * 0.4;
      const maxX = box.max.x + radius * 0.4;
      const minZ = box.min.z - radius * 0.4;
      const maxZ = box.max.z + radius * 0.4;
      if (pos.x < minX || pos.x > maxX || pos.z < minZ || pos.z > maxZ) continue;
      // 落下 or 少し上ぐらいなら乗せる
      if (pos.y > box.max.y - 0.6 && pos.y < box.max.y + 3.0) {
        if (box.max.y > topSupport) topSupport = box.max.y;
      }
    }
    return topSupport;
  }

  // レイと最初に衝突する AABB との交差距離（ヒットスキャン射撃で壁抜け防止に使う）
  // ray: {origin: Vector3, direction: Vector3(normalized)}, maxDist: number
  // 返り値: t (距離) または null
  function raycastNearestT(origin, dir, maxDist) {
    let nearest = maxDist;
    const invDx = 1 / (dir.x || 1e-8);
    const invDy = 1 / (dir.y || 1e-8);
    const invDz = 1 / (dir.z || 1e-8);
    for (const box of colliders) {
      let t1 = (box.min.x - origin.x) * invDx;
      let t2 = (box.max.x - origin.x) * invDx;
      let tmin = Math.min(t1, t2);
      let tmax = Math.max(t1, t2);

      t1 = (box.min.y - origin.y) * invDy;
      t2 = (box.max.y - origin.y) * invDy;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));

      t1 = (box.min.z - origin.z) * invDz;
      t2 = (box.max.z - origin.z) * invDz;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));

      if (tmax < 0 || tmin > tmax) continue;
      const t = tmin > 0 ? tmin : tmax;
      if (t > 0 && t < nearest) nearest = t;
    }
    return nearest < maxDist ? nearest : null;
  }

  return {
    group,
    colliders,
    resolveXZ,
    resolveStandOn,
    raycastNearestT,
    update(/* dt */) {
      // 現状アニメーションなし。将来的にドアやリフトを増やすならここで動かす
    },
  };
}
