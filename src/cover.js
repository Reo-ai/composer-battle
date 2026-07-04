// 建物・遮蔽物モジュール
// FPS モード用のカバー・柱・L字廊下・高台などを配置し、
// AABB コライダーを提供する。
// アリーナ (ARENA_RADIUS=14) の外側に配置して既存の演出を邪魔しないようにする。

import * as THREE from 'three';
import { getTerrainHeightAt } from './stage.js';
import { getSelectedStage } from './stage-select.js';

const WALL_COLOR = 0x8a8a90;
const WALL_EDGE = 0x2a2a30;
const PLATFORM_COLOR = 0x6c6c74;
const PILLAR_COLOR = 0xa0a0a8;

// カバー物のプリセット（アリーナ中心 (0,0) 周りの相対座標）
// { type, x, z, sx, sy, sz, rot } の単純データにしておくと配置が楽
const LAYOUT = [
  // -------- 東側：L字廊下（拡大版 / 建物っぽく厚みと高さを増す） --------
  { type: 'wall', x:  24, z:  -8, sx: 18, sy: 5.5, sz: 1.4, rot: 0 },
  { type: 'wall', x:  32, z:  -1, sx: 1.4, sy: 5.5, sz: 16, rot: 0 },
  { type: 'wall', x:  16, z:   1, sx: 1.4, sy: 5.5, sz: 10, rot: 0 },
  { type: 'wall', x:  20, z:   7, sx: 10, sy: 5.5, sz: 1.4, rot: 0 }, // 追加：内壁
  { type: 'wall', x:  26, z:  10, sx: 1.4, sy: 4.0, sz: 6,  rot: 0 }, // 追加：ヨコ路の突き当り

  // -------- 西側：小部屋 → 二部屋建物（窓っぽい隙間つき） --------
  { type: 'wall', x: -24, z:  -8, sx: 14, sy: 5.5, sz: 1.4, rot: 0 },
  { type: 'wall', x: -31, z:   0, sx: 1.4, sy: 5.5, sz: 18, rot: 0 },
  { type: 'wall', x: -22, z:   9, sx: 6,  sy: 5.5, sz: 1.4, rot: 0 },
  { type: 'wall', x: -16, z:   9, sx: 3,  sy: 2.0, sz: 1.4, rot: 0 }, // 窓の下枠(低い壁)
  { type: 'wall', x: -17, z:   1, sx: 1.4, sy: 5.5, sz: 6,  rot: 0 },
  { type: 'wall', x: -24, z:   3, sx: 1.4, sy: 5.5, sz: 4,  rot: 0 }, // 追加：中仕切り

  // -------- 北側：T字ジャンクション → 大型ゲート --------
  { type: 'wall', x:   0, z:  24, sx: 22, sy: 6.0, sz: 1.4, rot: 0 },
  { type: 'wall', x:   0, z:  32, sx: 1.4, sy: 6.0, sz: 14, rot: 0 },
  { type: 'wall', x:  -8, z:  30, sx: 1.4, sy: 5.5, sz: 6,  rot: 0 }, // 追加：ゲートの左袖
  { type: 'wall', x:   8, z:  30, sx: 1.4, sy: 5.5, sz: 6,  rot: 0 }, // 追加：ゲートの右袖
  { type: 'wall', x:   0, z:  36, sx: 14, sy: 3.0, sz: 1.4, rot: 0 }, // 追加：奥の低壁

  // -------- 南側：カバー壁 + 大きなバンカー --------
  { type: 'cover', x: -8, z: -22, sx: 4.5, sy: 1.8, sz: 1.2, rot: 0 },
  { type: 'cover', x:  0, z: -22, sx: 4.5, sy: 1.8, sz: 1.2, rot: 0 },
  { type: 'cover', x:  8, z: -22, sx: 4.5, sy: 1.8, sz: 1.2, rot: 0 },
  { type: 'cover', x: -4, z: -27, sx: 4.5, sy: 1.8, sz: 1.2, rot: 0 },
  { type: 'cover', x:  4, z: -27, sx: 4.5, sy: 1.8, sz: 1.2, rot: 0 },
  // 南バンカー（背の高い箱建物）
  { type: 'wall', x:  16, z: -30, sx: 12, sy: 4.8, sz: 1.4, rot: 0 }, // 前壁
  { type: 'wall', x:  22, z: -25, sx: 1.4, sy: 4.8, sz: 10, rot: 0 }, // 右壁
  { type: 'wall', x:  10, z: -25, sx: 1.4, sy: 4.8, sz: 10, rot: 0 }, // 左壁
  { type: 'wall', x: -16, z: -30, sx: 12, sy: 4.8, sz: 1.4, rot: 0 }, // 対称：西南バンカー前壁
  { type: 'wall', x: -22, z: -25, sx: 1.4, sy: 4.8, sz: 10, rot: 0 },
  { type: 'wall', x: -10, z: -25, sx: 1.4, sy: 4.8, sz: 10, rot: 0 },

  // -------- 柱（縦長ピラー：拡大） --------
  { type: 'pillar', x:  18, z:  18, sx: 2.0, sy: 6.5, sz: 2.0, rot: 0 },
  { type: 'pillar', x: -18, z:  18, sx: 2.0, sy: 6.5, sz: 2.0, rot: 0 },
  { type: 'pillar', x:  18, z: -18, sx: 2.0, sy: 6.5, sz: 2.0, rot: 0 },
  { type: 'pillar', x: -18, z: -18, sx: 2.0, sy: 6.5, sz: 2.0, rot: 0 },
  { type: 'pillar', x:   0, z:   0, sx: 1.8, sy: 5.5, sz: 1.8, rot: 0 }, // 中央
  { type: 'pillar', x:  10, z:  10, sx: 1.5, sy: 5.0, sz: 1.5, rot: 0 },
  { type: 'pillar', x: -10, z:  10, sx: 1.5, sy: 5.0, sz: 1.5, rot: 0 },
  { type: 'pillar', x:  10, z: -10, sx: 1.5, sy: 5.0, sz: 1.5, rot: 0 },
  { type: 'pillar', x: -10, z: -10, sx: 1.5, sy: 5.0, sz: 1.5, rot: 0 },
  // 追加：外周の巨大ピラー4本（遠距離のランドマーク兼カバー）
  { type: 'pillar', x:  38, z:  38, sx: 3.2, sy: 9.0, sz: 3.2, rot: 0 },
  { type: 'pillar', x: -38, z:  38, sx: 3.2, sy: 9.0, sz: 3.2, rot: 0 },
  { type: 'pillar', x:  38, z: -38, sx: 3.2, sy: 9.0, sz: 3.2, rot: 0 },
  { type: 'pillar', x: -38, z: -38, sx: 3.2, sy: 9.0, sz: 3.2, rot: 0 },

  // -------- 高台（プラットフォーム + 階段：拡大 & 増設） --------
  { type: 'platform', x: 36, z:  10, sx: 12, sy: 3.6, sz: 10, rot: 0 },
  { type: 'stair',    x: 29, z:  10, sx: 4,  sy: 1.8, sz: 8,  rot: 0 },

  { type: 'platform', x: -36, z: -10, sx: 12, sy: 3.6, sz: 10, rot: 0 },
  { type: 'stair',    x: -29, z: -10, sx: 4,  sy: 1.8, sz: 8,  rot: 0 },

  // 追加高台：北奥（狙撃ポジション）
  { type: 'platform', x:   0, z:  42, sx: 10, sy: 4.0, sz: 8, rot: 0 },
  { type: 'stair',    x:   0, z:  36, sx: 6,  sy: 2.0, sz: 4, rot: 0 },

  // ========================================================================
  // Apex 風 高層ビル 4 棟（マップ全体に散らす）
  // 1 棟あたり: 外壁 4 枚 + 各階の床プラットフォーム + 螺旋階段 + 屋上プラットフォーム
  // フロア高 = 6m、9 階建て（54m）
  // pushTower(...) で機械的に量産する
  // ========================================================================
  //   → 実データは buildCoverLayout() の頭で LAYOUT に追記する
];

// ============================================================================
// Apex Oasis 風のシティスケープ
//   heroTower: 24×14m 平面 × 90m の青ガラス塔(2 棟)
//     - 4 面ガラス外壁(全高)
//     - 4 階ごとの黒帯(3 本)
//     - 外周スパイラルスロープ(30 段 × 3m 上昇、2 周ぶん)
//     - 屋上デッキ + 4 辺パラペット
//   スカイブリッジ: 2 棟を Y=45m で連結
//   中層 12 棟 / 遠景 8 棟 / 赤ドーム 2 基
// すべての塔・ビル・ドームは suppressBeacon:true, noEdges:true で
// 赤青旗の抑制 + 輪郭線非表示にする。
// ============================================================================

function pushHeroTower(cx, cz, dir) {
  const W = 24, D = 14, H = 90;
  const HALF_W = W * 0.5, HALF_D = D * 0.5;
  const WALL_TH = 0.5;
  const GLASS = { matKind: 'glass', noEdges: true, suppressBeacon: true };
  const BAND  = { matKind: 'band',  noEdges: true, suppressBeacon: true };

  // 4 面外壁(青ガラス、全高)
  LAYOUT.push({ type: 'wall', ...GLASS, x: cx, z: cz - HALF_D, sx: W, sy: H, sz: WALL_TH, rot: 0 });
  LAYOUT.push({ type: 'wall', ...GLASS, x: cx, z: cz + HALF_D, sx: W, sy: H, sz: WALL_TH, rot: 0 });
  LAYOUT.push({ type: 'wall', ...GLASS, x: cx - HALF_W, z: cz, sx: WALL_TH, sy: H, sz: D, rot: 0 });
  LAYOUT.push({ type: 'wall', ...GLASS, x: cx + HALF_W, z: cz, sx: WALL_TH, sy: H, sz: D, rot: 0 });

  // 4 階(24m)ごとの黒帯(3 本、外壁より少し外に突き出す)
  for (const by of [24, 48, 72]) {
    LAYOUT.push({ type: 'wall', ...BAND, x: cx, z: cz - HALF_D - 0.2, sx: W + 0.6, sy: 1.8, sz: 0.9, yOffset: by - 0.9, rot: 0 });
    LAYOUT.push({ type: 'wall', ...BAND, x: cx, z: cz + HALF_D + 0.2, sx: W + 0.6, sy: 1.8, sz: 0.9, yOffset: by - 0.9, rot: 0 });
    LAYOUT.push({ type: 'wall', ...BAND, x: cx - HALF_W - 0.2, z: cz, sx: 0.9, sy: 1.8, sz: D + 0.6, yOffset: by - 0.9, rot: 0 });
    LAYOUT.push({ type: 'wall', ...BAND, x: cx + HALF_W + 0.2, z: cz, sx: 0.9, sy: 1.8, sz: D + 0.6, yOffset: by - 0.9, rot: 0 });
  }

  // 外周スパイラルスロープ(30 段 × 3m = 90m 上昇、2 周ぶん)
  // 各段は塔外周から OFFSET だけ外側に突き出し、
  // dir=+1 で反時計回り、dir=-1 で時計回りに登る
  const STEPS = 30;
  const PERIM = 2 * (W + D); // 76m
  const OFFSET = 2.8;
  const STEP_TH = 0.6;
  for (let i = 0; i < STEPS; i++) {
    const yTop = (i + 1) * (H / STEPS); // 3m ずつ上昇
    // 経路距離(SE 角基点、2 周ぶん)
    let dp = (i + 0.5) * (PERIM * 2) / STEPS;
    dp = ((dp % PERIM) + PERIM) % PERIM;
    if (dir < 0) dp = (PERIM - dp) % PERIM;
    let x, z, sx, sz;
    if (dp < W) {
      // 南面: SE→SW
      x = cx + HALF_W - dp;
      z = cz - HALF_D - OFFSET;
      sx = 3.6; sz = 2.6;
    } else if (dp < W + D) {
      // 西面: SW→NW
      x = cx - HALF_W - OFFSET;
      z = cz - HALF_D + (dp - W);
      sx = 2.6; sz = 3.6;
    } else if (dp < 2 * W + D) {
      // 北面: NW→NE
      x = cx - HALF_W + (dp - W - D);
      z = cz + HALF_D + OFFSET;
      sx = 3.6; sz = 2.6;
    } else {
      // 東面: NE→SE
      x = cx + HALF_W + OFFSET;
      z = cz + HALF_D - (dp - 2 * W - D);
      sx = 2.6; sz = 3.6;
    }
    LAYOUT.push({
      type: 'stair', matKind: 'ramp', noEdges: true, suppressBeacon: true,
      x, z, sx, sy: STEP_TH, sz,
      yOffset: yTop - STEP_TH,
      rot: 0,
    });
  }

  // 屋上デッキ
  LAYOUT.push({
    type: 'platform', matKind: 'deck', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: W - 1.2, sy: 0.8, sz: D - 1.2,
    yOffset: H - 0.8, rot: 0,
  });
  // 屋上パラペット(4 辺)
  const PARA_H = 1.1;
  const PARA = { matKind: 'band', noEdges: true, suppressBeacon: true };
  LAYOUT.push({ type: 'wall', ...PARA, x: cx, z: cz - HALF_D + 0.4, sx: W, sy: PARA_H, sz: 0.4, yOffset: H, rot: 0 });
  LAYOUT.push({ type: 'wall', ...PARA, x: cx, z: cz + HALF_D - 0.4, sx: W, sy: PARA_H, sz: 0.4, yOffset: H, rot: 0 });
  LAYOUT.push({ type: 'wall', ...PARA, x: cx - HALF_W + 0.4, z: cz, sx: 0.4, sy: PARA_H, sz: D, yOffset: H, rot: 0 });
  LAYOUT.push({ type: 'wall', ...PARA, x: cx + HALF_W - 0.4, z: cz, sx: 0.4, sy: PARA_H, sz: D, yOffset: H, rot: 0 });
}

// 単純な 1 ボックス建物(中層 / 遠景で使い分け)
function pushCityBox(cx, cz, w, d, h, kind /* 'city' | 'cityFar' */) {
  LAYOUT.push({
    type: 'wall', matKind: kind, noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: w, sy: h, sz: d, rot: 0,
  });
}

// 赤ドーム(装飾専用: コライダーなし)
function pushDome(cx, cz, r) {
  LAYOUT.push({
    type: 'wall', geomKind: 'domeHalf', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: r, sy: r, sz: r, yOffset: -r * 0.5, rot: 0,
  });
}

// ============================================================================
// 以下のシティスケープ(ヒーロー塔/中層/遠景ビル/ドーム)は
// 'city' ステージ選択時のみ LAYOUT に追加する。
// 'wild'(荒野)では追加せず、上の共有 LAYOUT だけで構成される。
// ============================================================================
if (getSelectedStage() === 'city') {

// ---- ヒーロー塔 2 棟 + スカイブリッジ ----
pushHeroTower( 48, 78,  1);
pushHeroTower(-48, 78, -1);
// スカイブリッジ(Y=45m デッキ + 両側パラペット)
LAYOUT.push({
  type: 'platform', matKind: 'deck', noEdges: true, suppressBeacon: true,
  x: 0, z: 78, sx: 72, sy: 1.2, sz: 6, yOffset: 45 - 1.2, rot: 0,
});
LAYOUT.push({
  type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true,
  x: 0, z: 78 - 3.2, sx: 72, sy: 1.1, sz: 0.3, yOffset: 45, rot: 0,
});
LAYOUT.push({
  type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true,
  x: 0, z: 78 + 3.2, sx: 72, sy: 1.1, sz: 0.3, yOffset: 45, rot: 0,
});

// ---- 中層 24 棟 (半径 110〜195m) ----
const _midConfigs = [
  { r: 140, ang:  20, w: 18, d: 14, h: 26 },
  { r: 130, ang:  60, w: 22, d: 20, h: 32 },
  { r: 150, ang: 100, w: 14, d: 12, h: 20 },
  { r: 145, ang: 140, w: 24, d: 16, h: 28 },
  { r: 170, ang: 180, w: 20, d: 18, h: 24 },
  { r: 135, ang: 220, w: 16, d: 14, h: 22 },
  { r: 155, ang: 260, w: 26, d: 20, h: 34 },
  { r: 140, ang: 300, w: 18, d: 14, h: 26 },
  { r: 175, ang: 340, w: 22, d: 18, h: 30 },
  { r: 160, ang:   0, w: 14, d: 12, h: 18 },
  { r: 150, ang:  40, w: 20, d: 14, h: 24 },
  { r: 165, ang:  80, w: 18, d: 16, h: 28 },
  // ここから増設 12 棟(角度を互い違いに、半径帯をずらして密度アップ)
  { r: 115, ang:  10, w: 16, d: 14, h: 22 },
  { r: 190, ang:  50, w: 20, d: 16, h: 30 },
  { r: 120, ang:  85, w: 18, d: 14, h: 24 },
  { r: 185, ang: 120, w: 24, d: 18, h: 34 },
  { r: 118, ang: 160, w: 14, d: 12, h: 20 },
  { r: 195, ang: 200, w: 22, d: 20, h: 32 },
  { r: 125, ang: 240, w: 18, d: 14, h: 26 },
  { r: 188, ang: 280, w: 26, d: 20, h: 36 },
  { r: 112, ang: 320, w: 16, d: 14, h: 22 },
  { r: 192, ang: 355, w: 20, d: 16, h: 28 },
  { r: 128, ang: 130, w: 18, d: 16, h: 24 },
  { r: 180, ang: 300, w: 22, d: 18, h: 30 },
];
for (const c of _midConfigs) {
  const rad = c.ang * Math.PI / 180;
  pushCityBox(Math.cos(rad) * c.r, Math.sin(rad) * c.r, c.w, c.d, c.h, 'city');
}

// ---- 遠景 16 棟 (半径 230〜340m) ----
const _farConfigs = [
  { r: 250, ang:  30, w: 32, d: 26, h: 48 },
  { r: 280, ang:  75, w: 40, d: 30, h: 56 },
  { r: 260, ang: 120, w: 28, d: 24, h: 44 },
  { r: 300, ang: 165, w: 44, d: 34, h: 60 },
  { r: 250, ang: 210, w: 32, d: 28, h: 48 },
  { r: 290, ang: 255, w: 36, d: 30, h: 52 },
  { r: 270, ang: 300, w: 30, d: 24, h: 46 },
  { r: 310, ang: 345, w: 40, d: 32, h: 58 },
  // ここから増設 8 棟(角度を互い違いに、外側リングも追加)
  { r: 235, ang:  55, w: 30, d: 24, h: 46 },
  { r: 330, ang:  95, w: 42, d: 32, h: 62 },
  { r: 240, ang: 145, w: 34, d: 28, h: 50 },
  { r: 335, ang: 190, w: 46, d: 36, h: 64 },
  { r: 245, ang: 235, w: 30, d: 26, h: 46 },
  { r: 325, ang: 280, w: 40, d: 30, h: 58 },
  { r: 255, ang: 320, w: 34, d: 28, h: 50 },
  { r: 340, ang:   5, w: 44, d: 34, h: 60 },
];
for (const c of _farConfigs) {
  const rad = c.ang * Math.PI / 180;
  pushCityBox(Math.cos(rad) * c.r, Math.sin(rad) * c.r, c.w, c.d, c.h, 'cityFar');
}

// ---- 赤ドーム 2 基(遠景ランドマーク) ----
pushDome( 220, -180, 22);
pushDome(-240, -160, 25);

} // end if (city ステージのみシティスケープを追加)


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

  // ---- Apex Oasis 風のシティ用マテリアル ----
  // 青ガラス塔外壁
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x3a6f9c, roughness: 0.18, metalness: 0.9,
    emissive: 0x1a3a5c, emissiveIntensity: 0.35,
  });
  // 外壁に走る黒帯(数階ごとの水平ライン)
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x0d0e14, roughness: 0.5, metalness: 0.55,
    emissive: 0x000000,
  });
  // スパイラルスロープ(踏面) — ハザード黒
  const rampMat = new THREE.MeshStandardMaterial({
    color: 0x1c1e26, roughness: 0.65, metalness: 0.35,
  });
  // 屋上・スカイブリッジ(明るいコンクリ質)
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xb0b4bc, roughness: 0.55, metalness: 0.2,
  });
  // 中層〜遠景ビル(暗めの青ガラス)
  const cityMat = new THREE.MeshStandardMaterial({
    color: 0x28486a, roughness: 0.3, metalness: 0.75,
    emissive: 0x0e1c2c, emissiveIntensity: 0.2,
  });
  const cityFarMat = new THREE.MeshStandardMaterial({
    color: 0x1a2838, roughness: 0.55, metalness: 0.55,
  });
  // 赤ドーム(Apex の球体ランドマーク)
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x6c1216, roughness: 0.55, metalness: 0.35,
    emissive: 0x1a0203, emissiveIntensity: 0.15,
  });

  for (const item of LAYOUT) {
    // 地形高さに合わせて Y ベースを決める
    // item.yOffset があれば「地面から yOffset の高さ」に箱の下面を合わせる
    // (Apex 風タワーの上階床/踊り場を持ち上げるために使う)
    const groundY = getTerrainHeightAt(item.x, item.z);
    const halfY = item.sy * 0.5;
    const yOff = item.yOffset || 0;
    const baseY = groundY + halfY + yOff;

    // 基本マテリアル(type)を選ぶ
    let mat = wallMat;
    if (item.type === 'cover') mat = coverMat;
    else if (item.type === 'pillar') mat = pillarMat;
    else if (item.type === 'platform') mat = platformMat;
    else if (item.type === 'stair') mat = stairMat;
    // 都市モジュール用の matKind オーバーライド
    if (item.matKind === 'glass')   mat = glassMat;
    else if (item.matKind === 'band')    mat = bandMat;
    else if (item.matKind === 'ramp')    mat = rampMat;
    else if (item.matKind === 'deck')    mat = deckMat;
    else if (item.matKind === 'city')    mat = cityMat;
    else if (item.matKind === 'cityFar') mat = cityFarMat;

    // メッシュ(sphere ドームは別枝、通常は Box)
    let geom;
    if (item.geomKind === 'domeHalf') {
      // 半球ドーム: sx = 半径、sy = 半径(高さ)、sz = 半径
      // matKind 未指定なら赤ドーム
      if (!item.matKind) mat = domeMat;
      geom = new THREE.SphereGeometry(item.sx, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    } else {
      geom = new THREE.BoxGeometry(item.sx, item.sy, item.sz);
    }
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(item.x, baseY, item.z);
    if (item.rot) mesh.rotation.y = item.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // 輪郭線(cardboard 感を消すため noEdges/球体では skip)
    if (!item.noEdges && item.geomKind !== 'domeHalf') {
      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(edges, edgeMat);
      line.position.copy(mesh.position);
      if (item.rot) line.rotation.y = item.rot;
      group.add(line);
    }

    // ドームは AABB を作らない(装飾専用、コライダー不要)
    if (item.geomKind === 'domeHalf') continue;

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
    box.userData = {
      type: item.type,
      walkable: item.type === 'platform' || item.type === 'stair',
      // 塔由来 platform の上に赤青旗を立てないためのフラグ
      suppressBeacon: !!item.suppressBeacon,
    };
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
