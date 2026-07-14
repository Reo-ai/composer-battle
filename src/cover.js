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
// 建物のフットプリント上を格子状にサンプリングして地形の最大/最小高さを返す。
// 建物内の全パーツをこの「最大高さ(gmax)」の平らな基準に据えることで、
//   ・傾斜地でも建物が歪まない(浮き/食い込みの解消)
//   ・階段の各段が同じ基準になり、段差が一定 → ちゃんと登れる
// gmin は基礎(下まで伸ばす柱)で地面の隙間を塞ぐために使う。
// ============================================================================
function terrainRangeOverFootprint(cx, cz, halfW, halfD) {
  let gmax = -Infinity, gmin = Infinity;
  const N = 4;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = cx - halfW + (2 * halfW) * (i / N);
      const z = cz - halfD + (2 * halfD) * (j / N);
      const h = getTerrainHeightAt(x, z);
      if (h > gmax) gmax = h;
      if (h < gmin) gmin = h;
    }
  }
  return { gmax, gmin };
}

// ============================================================================
// 参考画像風「中央が開くオレンジの両開き自動ドア」を 1 面に設置する。
// 左右のドア葉を側方に寄せ、中央に人が通れる gap を空けた“開いた自動ドア”表現。
// (covers.update には位置が渡らずアニメ不可のため、常時開いた静的表現にする)
//   axis 'X': x=fixed の面(開口は Z 方向、厚みは X)
//   axis 'Z': z=fixed の面(開口は X 方向、厚みは Z)
//   center  : 面上の開口中心(X面なら cz、Z面なら cx)
//   openingW: 開口の全幅 / doorH: ドア高 / gap: 中央の通れる幅
// ドア葉は type:'wall' なのでコライダーが付き、側方は塞がり中央のみ通れる。
// ============================================================================
function pushAutoDoor(axis, fixed, center, openingW, doorH, gap) {
  const T = 0.28;
  const leafW = Math.max(0.5, (openingW - gap) / 2);
  const leafH = doorH - 0.12;
  const push = (x, z, sx, sy, sz, bottom, mk) => LAYOUT.push({
    type: 'wall', matKind: mk, noEdges: true, suppressBeacon: true,
    x, z, sx, sy, sz, yOffset: bottom, rot: 0,
  });
  if (axis === 'X') {
    push(fixed, center - gap / 2 - leafW / 2, T, leafH, leafW, 0, 'door');
    push(fixed, center + gap / 2 + leafW / 2, T, leafH, leafW, 0, 'door');
    push(fixed, center, T * 1.05, 0.45, openingW + 0.5, doorH - 0.45, 'doorFrame');
  } else {
    push(center - gap / 2 - leafW / 2, fixed, leafW, leafH, T, 0, 'door');
    push(center + gap / 2 + leafW / 2, fixed, leafW, leafH, T, 0, 'door');
    push(center, fixed, openingW + 0.5, 0.45, T * 1.05, doorH - 0.45, 'doorFrame');
  }
}

// ============================================================================
// Apex Oasis 風のシティスケープ
//   heroTower: 24×14m 平面 × 90m の青ガラス塔(2 棟)
//     - 4 面ガラス外壁(全高)
//     - 4 階ごとの黒帯(3 本)
//     - 外周スパイラル階段(120 段 × 0.75m 上昇、約 2 周ぶん・落ちない連続段)
//     - 屋上デッキ + 4 辺パラペット
//   スカイブリッジ: 2 棟を Y=45m で連結
//   中層 12 棟 / 遠景 8 棟 / 赤ドーム 2 基
// すべての塔・ビル・ドームは suppressBeacon:true, noEdges:true で
// 赤青旗の抑制 + 輪郭線非表示にする。
// ============================================================================

// ============================================================================
// 途切れのない連続スパイラル階段を生成する共通関数。
// 長方形リング(踏面の中心線)を dir 方向に laps 周しながら height まで登る。
// 面の変わり目(コーナー)には必ず「踊り場(landing)」を敷いて、隣り合う
// 面のつなぎ目に出来る隙間を塞ぐ。これで「曲がり角で途切れる」問題を無くす。
//   cx,cz        : リング中心
//   halfW,halfD  : 踏面の中心線が通る長方形の半サイズ(オフセット込みで渡す)
//   height       : 登り切る高さ
//   laps         : 周回数(多いほど傾斜がゆるくなる)
//   dir          : +1 / -1 で周回方向
//   width        : 踏面が中心線から左右へ張り出す全幅(塔外/建物内への張り出し)
//   opts.railSide: +1=中心と反対側(外)に手すり / -1=中心側(内)に手すり
//   opts.mat     : 段のマテリアル(既定 'ramp')
//   opts.along   : 進行方向の踏面 footprint(既定 3.4)
//   opts.stepH   : 段の縦の詰まり(既定 2.0。前段と大きく重なり落ちない)
function pushSpiralStair(cx, cz, halfW, halfD, height, laps, dir, width, opts = {}) {
  const railSide = opts.railSide ?? 1;
  const mat = opts.mat ?? 'ramp';
  const ALONG = opts.along ?? 3.4;
  const STEP_H = opts.stepH ?? 2.0;
  const SPACING = opts.spacingFactor ?? 0.5; // 段間隔 = ALONG × これ(小さいほど密で重なる)
  const RAIL_H = 1.4, RAIL_T = 0.35;
  const W = 2 * halfW, D = 2 * halfD;
  const PERIM = 2 * (W + D);
  // 隣段が横に大きく重なるよう、間隔を ALONG × SPACING に抑えて段数を決める。
  const STEPS = Math.max(laps * 12, Math.ceil(laps * PERIM / (ALONG * SPACING)));
  const RAIL = { type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true };

  // 2 面の組から、その間のコーナー(リング角)座標を引く。
  const cornerOf = (a, b) => {
    const key = Math.min(a, b) + ',' + Math.max(a, b);
    if (key === '0,1') return [cx - halfW, cz - halfD]; // 南×西 = SW
    if (key === '1,2') return [cx - halfW, cz + halfD]; // 西×北 = NW
    if (key === '2,3') return [cx + halfW, cz + halfD]; // 北×東 = NE
    return [cx + halfW, cz - halfD];                    // 東×南 = SE (0,3)
  };

  let prev = null;
  for (let i = 0; i < STEPS; i++) {
    const yTop = (i + 1) * (height / STEPS);
    let dp = (i + 0.5) * (PERIM * laps) / STEPS;
    dp = ((dp % PERIM) + PERIM) % PERIM;
    if (dir < 0) dp = (PERIM - dp) % PERIM;
    let face, x, z, sx, sz, outSign, perpAxis;
    if (dp < W) {                       // 南面: SE→SW
      face = 0; x = cx + halfW - dp; z = cz - halfD; sx = ALONG; sz = width; outSign = -1; perpAxis = 'z';
    } else if (dp < W + D) {            // 西面: SW→NW
      face = 1; x = cx - halfW; z = cz - halfD + (dp - W); sx = width; sz = ALONG; outSign = -1; perpAxis = 'x';
    } else if (dp < 2 * W + D) {        // 北面: NW→NE
      face = 2; x = cx - halfW + (dp - W - D); z = cz + halfD; sx = ALONG; sz = width; outSign = 1; perpAxis = 'z';
    } else {                            // 東面: NE→SE
      face = 3; x = cx + halfW; z = cz + halfD - (dp - 2 * W - D); sx = width; sz = ALONG; outSign = 1; perpAxis = 'x';
    }
    // 段本体(上面から下へ STEP_H 詰まったソリッド)
    LAYOUT.push({
      type: 'stair', matKind: mat, noEdges: true, suppressBeacon: true,
      x, z, sx, sy: STEP_H, sz, yOffset: yTop - STEP_H, rot: 0,
    });
    // 落下側(壁に接していない側)の手すり
    const railShift = (outSign * railSide) * (width / 2 - RAIL_T / 2);
    if (perpAxis === 'z') {
      LAYOUT.push({ ...RAIL, x, z: z + railShift, sx: ALONG, sy: RAIL_H, sz: RAIL_T, yOffset: yTop, rot: 0 });
    } else {
      LAYOUT.push({ ...RAIL, x: x + railShift, z, sx: RAIL_T, sy: RAIL_H, sz: ALONG, yOffset: yTop, rot: 0 });
    }
    // 面が変わったコーナーに踊り場を敷いて、つなぎ目の隙間を塞ぐ
    if (prev && prev.face !== face) {
      const [ccx, ccz] = cornerOf(prev.face, face);
      const landTop = Math.max(prev.yTop, yTop);
      const landSize = width + 1.8;
      LAYOUT.push({
        type: 'platform', matKind: 'deck', noEdges: true, suppressBeacon: true,
        x: ccx, z: ccz, sx: landSize, sy: STEP_H, sz: landSize,
        yOffset: landTop - STEP_H, rot: 0,
      });
      // 踊り場の落下側 2 辺に L 字の手すり
      const ox = Math.sign(ccx - cx) || 1, oz = Math.sign(ccz - cz) || 1;
      const ex = ox * railSide, ez = oz * railSide;
      LAYOUT.push({ ...RAIL, x: ccx + ex * (landSize / 2 - RAIL_T / 2), z: ccz, sx: RAIL_T, sy: RAIL_H, sz: landSize, yOffset: landTop, rot: 0 });
      LAYOUT.push({ ...RAIL, x: ccx, z: ccz + ez * (landSize / 2 - RAIL_T / 2), sx: landSize, sy: RAIL_H, sz: RAIL_T, yOffset: landTop, rot: 0 });
    }
    prev = { face, yTop };
  }
}

function pushHeroTower(cx, cz, dir) {
  const W = 48, D = 28, H = 180;  // 幅・奥行き・高さを従来の 2 倍に拡大
  const HALF_W = W * 0.5, HALF_D = D * 0.5;
  const WALL_TH = 0.5;
  const GLASS = { matKind: 'glass', noEdges: true, suppressBeacon: true };
  const BAND  = { matKind: 'band',  noEdges: true, suppressBeacon: true };

  // 4 面外壁(青ガラス、全高)
  LAYOUT.push({ type: 'wall', ...GLASS, x: cx, z: cz - HALF_D, sx: W, sy: H, sz: WALL_TH, rot: 0 });
  LAYOUT.push({ type: 'wall', ...GLASS, x: cx, z: cz + HALF_D, sx: W, sy: H, sz: WALL_TH, rot: 0 });
  LAYOUT.push({ type: 'wall', ...GLASS, x: cx - HALF_W, z: cz, sx: WALL_TH, sy: H, sz: D, rot: 0 });
  LAYOUT.push({ type: 'wall', ...GLASS, x: cx + HALF_W, z: cz, sx: WALL_TH, sy: H, sz: D, rot: 0 });

  // 黒帯(3 本、外壁より少し外に突き出す) ※タワー 2 倍化に合わせ高さも 2 倍
  for (const by of [48, 96, 144]) {
    LAYOUT.push({ type: 'wall', ...BAND, x: cx, z: cz - HALF_D - 0.2, sx: W + 0.6, sy: 1.8, sz: 0.9, yOffset: by - 0.9, rot: 0 });
    LAYOUT.push({ type: 'wall', ...BAND, x: cx, z: cz + HALF_D + 0.2, sx: W + 0.6, sy: 1.8, sz: 0.9, yOffset: by - 0.9, rot: 0 });
    LAYOUT.push({ type: 'wall', ...BAND, x: cx - HALF_W - 0.2, z: cz, sx: 0.9, sy: 1.8, sz: D + 0.6, yOffset: by - 0.9, rot: 0 });
    LAYOUT.push({ type: 'wall', ...BAND, x: cx + HALF_W + 0.2, z: cz, sx: 0.9, sy: 1.8, sz: D + 0.6, yOffset: by - 0.9, rot: 0 });
  }

  // 外周スパイラル階段(共通関数 pushSpiralStair で生成)。
  // 塔壁の外側 OFFSET だけ離れたリングを 2 周して屋上まで登る。
  // 各コーナーには踊り場が敷かれ、曲がり角で途切れず安心して登れる。
  //   ・railSide=+1 → 塔と反対(外)側に手すり(落下防止)
  //   ・OFFSET=2.6 塔から外へ / PERP=3.0 踏面幅 / ALONG=3.4 進行 footprint
  const OFFSET = 2.6;
  const PERP = 3.0;
  pushSpiralStair(
    cx, cz, HALF_W + OFFSET, HALF_D + OFFSET, H, 2, dir, PERP,
    { railSide: 1, mat: 'ramp', along: 3.4, stepH: 2.0 }
  );

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

// 扉つき・各階の床・窓・登れる階段を備えた「中に入れて FPS できるビル」を生成する。
//   cx,cz : 平面の中心座標
//   w,d   : 平面サイズ(X × Z)
//   floors: 階数(3〜8 を想定。屋上デッキまで登れる)
//   kind  : 外壁マテリアル('city' 等)
// 設計方針(Apex の建物のように「中で撃ち合える」ことを最優先):
//   ・階段は細く(幅 3m 程度)、原点と反対側の隅の 1 列だけに寄せる。
//     → フロアの大半は開けた歩ける床として残る。
//   ・扉は必ず「床側(原点向き)の面」にあけ、階段側には来ないようにする。
//     → ドアから入ると開けた 1 階フロアに出る(階段の塊に阻まれない)。
//   ・各階の外壁に大きな窓開口をあける(腰壁+まぐさ+方立)。
//     → 外が見え、撃ち合える開けた内装になる。
//   ・階段は「床から段上面まで詰まったソリッドの折り返し段」。細いので
//     フロアを潰さず、隙間ゼロなので落ちずに自然に登れる。
function pushBuilding(cx, cz, w, d, floors, kind) {
  const FH = 9.0;          // 1 階分の高さ（プレイヤーが動きやすいよう従来の 2 倍に拡大）
  const WT = 0.7;          // 外壁の厚み
  const SLAB_T = 0.5;      // 床スラブの厚み
  const iw = w - 2 * WT;   // 内寸(X)
  const id = d - 2 * WT;   // 内寸(Z)
  const SW = Math.min(3.0, iw * 0.34);  // 階段の幅(X)※細く隅に寄せる
  const DH = 3.4;          // 扉の高さ
  const SILL = 1.1;        // 窓の腰壁の高さ
  const HEAD = 0.6;        // 窓のまぐさ(上枠)の高さ
  const MULL = 0.3;        // 方立(窓を分割する柱)の幅

  // --- ローカル push ヘルパー(yOffset = 箱の下面の地面からの高さ) ---
  const wall = (x, z, sx, sy, sz, bottom) => LAYOUT.push({
    type: 'wall', matKind: kind, noEdges: true, suppressBeacon: true,
    x, z, sx, sy, sz, yOffset: bottom, rot: 0,
  });
  const slab = (x, z, sx, sz, bottom) => LAYOUT.push({
    type: 'platform', matKind: 'deck', noEdges: true, suppressBeacon: true,
    x, z, sx, sy: SLAB_T, sz, yOffset: bottom, rot: 0,
  });

  // --- 窓付きの外壁 1 面を各階ぶん生成する ---
  // axis 'X' : x=fixed の面(Z 方向に span 長さで伸びる。厚み WT は X 方向)
  // axis 'Z' : z=fixed の面(X 方向に span 長さで伸びる。厚み WT は Z 方向)
  // doorFace=true の面は 1 階だけ扉開口にする。
  const face = (axis, fixed, span, doorFace) => {
    const center0 = (axis === 'X') ? cz : cx;
    // 壁片を 1 枚置く(len=span 方向の長さ, thick=WT 固定方向)
    const seg = (center, len, bottom, height) => {
      if (axis === 'X') wall(fixed, center, WT, height, len, bottom);
      else              wall(center, fixed, len, height, WT, bottom);
    };
    for (let f = 0; f < floors; f++) {
      const base = f * FH;
      if (doorFace && f === 0) {
        // 1 階は扉(腰壁なし)。左右パネル + まぐさ。
        const DW = Math.min(4.0, span * 0.5);
        const sideW = (span - DW) / 2;
        seg(center0 - DW / 2 - sideW / 2, sideW, base, FH);
        seg(center0 + DW / 2 + sideW / 2, sideW, base, FH);
        seg(center0, DW, base + DH, FH - DH);      // 扉上のまぐさ
      } else {
        seg(center0, span, base, SILL);            // 腰壁
        seg(center0, span, base + FH - HEAD, HEAD); // 窓上のまぐさ
        const winBottom = base + SILL;
        const winH = FH - SILL - HEAD;
        for (const mx of [-span / 6, span / 6]) {   // 方立 2 本で窓を 3 分割
          seg(center0 + mx, MULL, winBottom, winH);
        }
      }
    }
  };

  // --- 外壁 4 面(1 面は 1 階を扉開口にする) ---
  const stairSign = (cx >= 0) ? 1 : -1;                 // 扉を原点向きに開ける X 方向
  const doorX = cx - stairSign * (w / 2 - WT / 2);      // 原点向き X 面 → 扉
  const backX = cx + stairSign * (w / 2 - WT / 2);      // 反対 X 面 → 窓
  face('X', doorX, d, true);                            // 扉のある面
  face('X', backX, d, false);                           // 窓
  face('Z', cz - (d / 2 - WT / 2), w, false);           // -Z 面(窓)
  face('Z', cz + (d / 2 - WT / 2), w, false);           // +Z 面(窓)

  // --- 内側スパイラル階段(ヒーロータワーと同じ pushSpiralStair)---
  // 中は吹き抜けにし、内壁に沿った連続スパイラルで屋上まで登る。
  // コーナーには踊り場が入るので曲がり角で途切れず、安心して登れる。
  //   ・踏面幅 SW を内壁のすぐ内側に張り出す(halfW/halfD は踏面中心線)
  //   ・railSide=-1 → 吹き抜け(中心)側に手すり(落下防止)
  //   ・laps=floors → 1 周でほぼ 1 階ぶん上昇の緩やかな傾斜
  const topH = floors * FH;                             // 登り切る高さ(屋上床レベル)
  const ringHalfW = iw / 2 - SW / 2;                    // 踏面中心線が通る半サイズ(X)
  const ringHalfD = id / 2 - SW / 2;                    // 踏面中心線が通る半サイズ(Z)
  pushSpiralStair(
    cx, cz, ringHalfW, ringHalfD, topH, floors, stairSign, SW,
    { railSide: -1, mat: 'ramp', along: 3.4, stepH: 2.0, spacingFactor: 0.6 }
  );

  // --- 各中間階の床(中央部だけ張る=外周のスパイラル階段は塞がない) ---
  // 階段の踏面(中心線 ringHalfW/D、幅 SW)の内側の縁までを床にする。
  // これで各階に立てる床が復活しつつ、外周スパイラルは吹き抜けのまま登れる。
  // 床の縁が階段の内側の縁とちょうど接するので、階段から各階へ踏み出せる。
  const floorHalfW = iw / 2 - SW;   // 階段踏面の内側の縁(X)
  const floorHalfD = id / 2 - SW;   // 階段踏面の内側の縁(Z)
  if (floorHalfW > 1.0 && floorHalfD > 1.0) {
    for (let f = 1; f < floors; f++) {   // 地面(0)と屋上(floors)を除いた中間階
      slab(cx, cz, floorHalfW * 2, floorHalfD * 2, f * FH - SLAB_T);
    }
  }

  // --- 屋上デッキ(吹き抜けの上にフタ=登り切ったら立てる床) ---
  slab(cx, cz, iw, id, topH - SLAB_T);
}

// 赤ドーム(装飾専用: コライダーなし)
function pushDome(cx, cz, r) {
  LAYOUT.push({
    type: 'wall', geomKind: 'domeHalf', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: r, sy: r, sz: r, yOffset: -r * 0.5, rot: 0,
  });
}

// ============================================================================
// リアル都市拡張ヘルパー群
// 道路・川・橋・歩道橋・高架デッキ・階段ランプ・街灯・木・ベンチ・噴水・
// タンク・煙突・パイプ・アーケード店。いずれも既存の LAYOUT/collider 方式に乗る。
// ============================================================================

// 路面: 地面に薄く敷く板(高さ 0.3m)。歩ける平台なので platform 扱い。
function pushRoad(cx, cz, sx, sz, rot = 0, mat = 'road') {
  LAYOUT.push({
    type: 'platform', matKind: mat, noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx, sy: 0.3, sz, yOffset: 0, rot,
  });
}

// 直線の階段ランプ: along 方向へ段々に上る。踏面は platform(歩ける)。
// dir=+1 で along 正方向に進むほど高く、-1 で逆。
function pushStepRamp(cx, cz, along, width, height, dir = 1, opts = {}) {
  const axis = opts.axis || 'x';            // 'x' か 'z'
  const steps = Math.max(3, Math.round(height / 1.3));
  const stepH = height / steps;
  const segLen = along / steps;
  const startA = -along * 0.5 + segLen * 0.5;
  for (let i = 0; i < steps; i++) {
    const a = startA + segLen * i;
    const top = stepH * (i + 1);           // その段の上面高さ
    const yOff = top - stepH * 0.5;        // 箱中心を段の中央へ
    const half = stepH * 0.5;
    const item = {
      type: 'stair', matKind: opts.mat || 'deck', noEdges: true, suppressBeacon: true,
      x: cx, z: cz, sy: stepH, yOffset: yOff, rot: 0,
    };
    if (axis === 'x') {
      item.x = cx + (dir > 0 ? a : -a);
      item.sx = segLen + 0.02; item.sz = width;
    } else {
      item.z = cz + (dir > 0 ? a : -a);
      item.sx = width; item.sz = segLen + 0.02;
    }
    // 上面を段の高さに合わせるため sy をそのまま、yOffset=top-half
    item.yOffset = top - half;
    LAYOUT.push(item);
  }
}

// 街灯: 細いポール + 発光するランプヘッド。
function pushLamp(cx, cz, h = 7) {
  LAYOUT.push({
    type: 'pillar', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: 0.5, sy: h, sz: 0.5, yOffset: 0, rot: 0,
  });
  LAYOUT.push({
    type: 'wall', matKind: 'lamp', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: 1.4, sy: 0.8, sz: 1.4, yOffset: h - 0.4, rot: 0,
  });
}

// 木: レンガ色の幹 + 緑の半球キャノピー(当たり判定は幹のみ)。
function pushTree(cx, cz, scale = 1) {
  const trunkH = 3.2 * scale;
  LAYOUT.push({
    type: 'pillar', matKind: 'brick', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: 0.9 * scale, sy: trunkH, sz: 0.9 * scale, yOffset: 0, rot: 0,
  });
  const r = 3.0 * scale;
  LAYOUT.push({
    type: 'wall', geomKind: 'domeHalf', matKind: 'park', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: r, sy: r, sz: r, yOffset: trunkH - r * 0.5, rot: 0,
  });
}

// ベンチ: 低い座面(歩ける平台)。
function pushBench(cx, cz, rot = 0) {
  LAYOUT.push({
    type: 'platform', matKind: 'deck', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: 3.0, sy: 0.8, sz: 0.9, yOffset: 0, rot,
  });
}

// 噴水: リング状の縁(4枚壁) + 中央水面 + 立ち上がり。
function pushFountain(cx, cz, r = 5) {
  const t = 0.8, wallH = 1.0;
  // 縁(北南東西)
  LAYOUT.push({ type: 'wall', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx, z: cz - r, sx: r * 2, sy: wallH, sz: t, yOffset: 0, rot: 0 });
  LAYOUT.push({ type: 'wall', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx, z: cz + r, sx: r * 2, sy: wallH, sz: t, yOffset: 0, rot: 0 });
  LAYOUT.push({ type: 'wall', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx - r, z: cz, sx: t, sy: wallH, sz: r * 2, yOffset: 0, rot: 0 });
  LAYOUT.push({ type: 'wall', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx + r, z: cz, sx: t, sy: wallH, sz: r * 2, yOffset: 0, rot: 0 });
  // 水面
  LAYOUT.push({ type: 'platform', matKind: 'water', noEdges: true, suppressBeacon: true, x: cx, z: cz, sx: r * 2 - t, sy: 0.4, sz: r * 2 - t, yOffset: 0.3, rot: 0 });
  // 中央の立ち上がり
  LAYOUT.push({ type: 'pillar', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx, z: cz, sx: 1.4, sy: 2.2, sz: 1.4, yOffset: 0, rot: 0 });
}

// 川・水路: 水面(低い板) + 両岸の護岸壁。axis='x' で東西に流れる。
function pushWaterChannel(cx, cz, length, width, axis = 'z') {
  const bankT = 1.2, bankH = 1.6;
  if (axis === 'z') {
    LAYOUT.push({ type: 'platform', matKind: 'water', noEdges: true, suppressBeacon: true, x: cx, z: cz, sx: width, sy: 0.4, sz: length, yOffset: 0, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx - width * 0.5 - bankT * 0.5, z: cz, sx: bankT, sy: bankH, sz: length, yOffset: 0, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx + width * 0.5 + bankT * 0.5, z: cz, sx: bankT, sy: bankH, sz: length, yOffset: 0, rot: 0 });
  } else {
    LAYOUT.push({ type: 'platform', matKind: 'water', noEdges: true, suppressBeacon: true, x: cx, z: cz, sx: length, sy: 0.4, sz: width, yOffset: 0, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx, z: cz - width * 0.5 - bankT * 0.5, sx: length, sy: bankH, sz: bankT, yOffset: 0, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx, z: cz + width * 0.5 + bankT * 0.5, sx: length, sy: bankH, sz: bankT, yOffset: 0, rot: 0 });
  }
}

// 橋: 水路を跨ぐデッキ + 欄干 + 橋脚。axis は跨ぐ方向。
function pushBridge(cx, cz, span, width, deckY, axis = 'x') {
  const railH = 1.1, railT = 0.3;
  if (axis === 'x') {
    LAYOUT.push({ type: 'platform', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx, z: cz, sx: span, sy: 0.8, sz: width, yOffset: deckY - 0.8, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true, x: cx, z: cz - width * 0.5, sx: span, sy: railH, sz: railT, yOffset: deckY, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true, x: cx, z: cz + width * 0.5, sx: span, sy: railH, sz: railT, yOffset: deckY, rot: 0 });
    LAYOUT.push({ type: 'pillar', noEdges: true, suppressBeacon: true, x: cx - span * 0.3, z: cz, sx: 1.4, sy: deckY, sz: 1.4, yOffset: 0, rot: 0 });
    LAYOUT.push({ type: 'pillar', noEdges: true, suppressBeacon: true, x: cx + span * 0.3, z: cz, sx: 1.4, sy: deckY, sz: 1.4, yOffset: 0, rot: 0 });
  } else {
    LAYOUT.push({ type: 'platform', matKind: 'deck', noEdges: true, suppressBeacon: true, x: cx, z: cz, sx: width, sy: 0.8, sz: span, yOffset: deckY - 0.8, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true, x: cx - width * 0.5, z: cz, sx: railT, sy: railH, sz: span, yOffset: deckY, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true, x: cx + width * 0.5, z: cz, sx: railT, sy: railH, sz: span, yOffset: deckY, rot: 0 });
    LAYOUT.push({ type: 'pillar', noEdges: true, suppressBeacon: true, x: cx, z: cz - span * 0.3, sx: 1.4, sy: deckY, sz: 1.4, yOffset: 0, rot: 0 });
    LAYOUT.push({ type: 'pillar', noEdges: true, suppressBeacon: true, x: cx, z: cz + span * 0.3, sx: 1.4, sy: deckY, sz: 1.4, yOffset: 0, rot: 0 });
  }
}

// 歩道橋: 細めの橋。既存 pushBridge を薄く使うラッパ。
function pushPedBridge(cx, cz, span, deckY, axis = 'x') {
  pushBridge(cx, cz, span, 3.4, deckY, axis);
}

// 高架デッキ(ポディウム): 柱の上に広いデッキ + パラペット。
// 下は柱間が抜けているのでアーケード(地下街的空間)として歩ける。
function pushElevatedDeck(cx, cz, sx, sz, deckY, opts = {}) {
  // デッキ天板(歩ける)
  LAYOUT.push({
    type: 'platform', matKind: opts.mat || 'deck', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx, sy: 1.2, sz, yOffset: deckY - 1.2, rot: 0,
  });
  // 支柱(四隅 + 中間)。歩行の邪魔にならないよう内側に配置。
  const px = sx * 0.5 - 3, pz = sz * 0.5 - 3;
  const cols = opts.cols || [
    [-px, -pz], [px, -pz], [-px, pz], [px, pz], [0, 0],
  ];
  for (const [ox, oz] of cols) {
    LAYOUT.push({
      type: 'pillar', noEdges: true, suppressBeacon: true,
      x: cx + ox, z: cz + oz, sx: 1.8, sy: deckY - 1.2, sz: 1.8, yOffset: 0, rot: 0,
    });
  }
  // 上面パラペット(4辺・落下防止の低い縁)
  if (!opts.noParapet) {
    const t = 0.4, h = 1.1;
    LAYOUT.push({ type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true, x: cx, z: cz - sz * 0.5, sx, sy: h, sz: t, yOffset: deckY, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true, x: cx, z: cz + sz * 0.5, sx, sy: h, sz: t, yOffset: deckY, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true, x: cx - sx * 0.5, z: cz, sx: t, sy: h, sz, yOffset: deckY, rot: 0 });
    LAYOUT.push({ type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true, x: cx + sx * 0.5, z: cz, sx: t, sy: h, sz, yOffset: deckY, rot: 0 });
  }
}

// 貯蔵タンク: 金属の円柱風(箱)+ 半球キャップ。
function pushTank(cx, cz, r = 5, h = 12) {
  LAYOUT.push({
    type: 'wall', matKind: 'metal', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: r * 2, sy: h, sz: r * 2, yOffset: 0, rot: 0,
  });
  LAYOUT.push({
    type: 'wall', geomKind: 'domeHalf', matKind: 'metal', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: r, sy: r * 0.7, sz: r, yOffset: h - r * 0.35, rot: 0,
  });
}

// 煙突: 細く高い金属柱 + 先端バンド。
function pushChimney(cx, cz, h = 26) {
  LAYOUT.push({
    type: 'wall', matKind: 'metal', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: 3.2, sy: h, sz: 3.2, yOffset: 0, rot: 0,
  });
  LAYOUT.push({
    type: 'wall', matKind: 'band', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sx: 3.6, sy: 1.4, sz: 3.6, yOffset: h - 2.5, rot: 0,
  });
}

// パイプ: 地上を這う金属の横パイプ(細い箱)。
function pushPipe(cx, cz, length, axis = 'x', yOff = 1.2) {
  const item = {
    type: 'wall', matKind: 'metal', noEdges: true, suppressBeacon: true,
    x: cx, z: cz, sy: 1.0, yOffset: yOff, rot: 0,
  };
  if (axis === 'x') { item.sx = length; item.sz = 1.0; }
  else { item.sx = 1.0; item.sz = length; }
  LAYOUT.push(item);
}

// アーケード店: 屋根付きの小さな店舗ユニット(奥壁 + 側壁 + 庇)。
// 正面(open 方向)は開いていて入って歩ける。open は 'north'|'south'|'east'|'west'。
function pushArcadeShop(cx, cz, w, d, open = 'north') {
  const H = 4.0, T = 0.5;
  // 屋根(庇・歩ける天板)
  LAYOUT.push({ type: 'platform', matKind: 'brick', noEdges: true, suppressBeacon: true, x: cx, z: cz, sx: w, sy: 0.5, sz: d, yOffset: H, rot: 0 });
  // 3方の壁を作り、open 方向だけ開ける
  if (open !== 'south') LAYOUT.push({ type: 'wall', matKind: 'brick', noEdges: true, suppressBeacon: true, x: cx, z: cz + d * 0.5, sx: w, sy: H, sz: T, yOffset: 0, rot: 0 });
  if (open !== 'north') LAYOUT.push({ type: 'wall', matKind: 'brick', noEdges: true, suppressBeacon: true, x: cx, z: cz - d * 0.5, sx: w, sy: H, sz: T, yOffset: 0, rot: 0 });
  if (open !== 'east')  LAYOUT.push({ type: 'wall', matKind: 'brick', noEdges: true, suppressBeacon: true, x: cx + w * 0.5, z: cz, sx: T, sy: H, sz: d, yOffset: 0, rot: 0 });
  if (open !== 'west')  LAYOUT.push({ type: 'wall', matKind: 'brick', noEdges: true, suppressBeacon: true, x: cx - w * 0.5, z: cz, sx: T, sy: H, sz: d, yOffset: 0, rot: 0 });
}

// ============================================================================
// 以下のシティスケープ(ヒーロー塔/中層/遠景ビル/ドーム)は
// 'city' ステージ選択時のみ LAYOUT に追加する。
// 'wild'(荒野)では追加せず、上の共有 LAYOUT だけで構成される。
// ============================================================================
if (getSelectedStage() === 'city') {

// ============================================================================
// ▼▼▼ 第一段階:地面・道路・川・橋・駅前ロータリー・公園・区画割り ▼▼▼
// 設計図(2000m四方 / +z=北 / +x=東)を基準にした地面レイヤー。
// この段階では建物は大量配置しない。アリーナ中心(原点)は戦闘のため常にクリアに保つ。
// ============================================================================
const CLEAR = 56;   // アリーナ戦闘クリア半径(この内側には地面タイル/障害物を置かない)

// 区画地面を粗いタイルで敷く。各タイルは中心の地形高さに追従するので斜面でも浮かない。
// アリーナ近傍(CLEAR+8 以内)のタイルはスキップして戦闘空間を確保する。
function pushField(cx, cz, sx, sz, mat, tile = 90) {
  const nx = Math.max(1, Math.round(sx / tile));
  const nz = Math.max(1, Math.round(sz / tile));
  const tw = sx / nx, td = sz / nz;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const px = cx - sx / 2 + tw * (i + 0.5);
      const pz = cz - sz / 2 + td * (j + 0.5);
      if (Math.hypot(px, pz) < CLEAR + 8) continue;
      LAYOUT.push({
        type: 'platform', matKind: mat, noEdges: true, suppressBeacon: true,
        x: px, z: pz, sx: tw + 0.6, sy: 0.12, sz: td + 0.6, yOffset: 0.02, rot: 0,
      });
    }
  }
}

// ---- 川(南北・設計 x=80 → 戦闘クリア確保のため x=110 へ東退避、幅70)----
pushWaterChannel(110, 0, 760, 70, 'z');
// ---- 橋 3 本(北/中央/南、幅16、低め Y=1.8 で段差なく渡れる)----
pushBridge(110,  300, 94, 16, 1.8, 'x');
pushBridge(110,   66, 94, 16, 1.8, 'x');
pushBridge(110, -250, 94, 16, 1.8, 'x');

// ---- 中央環状路(アリーナ外周を囲む。東側は川があるので開放)----
pushRoad( -2,  66, 130, 12);   // 北環状
pushRoad(-16, -66, 100, 12);   // 南環状
pushRoad(-66,   0,  12, 132);  // 西環状

// ---- 幹線道路(16m)----
pushRoad(-124,  66, 116, 16);  // 西→駅前ロータリー
pushRoad( -40, 150,  16, 170); // 北→公園
pushRoad( -66,-170,  16, 210); // 南→工業
pushRoad( 205,  66, 110, 16);  // 中央東→住宅(橋の先)
pushRoad( 210,-170,  16, 260); // 南東→郊外

// ---- 住宅街の格子路(12m)----
pushRoad(310,  60, 320, 12);
pushRoad(250, 150,  12, 220);
pushRoad(400, 150,  12, 220);

// ---- 駅前ロータリー(設計 -180,50 / 120×80)----
pushField(-180, 50, 120, 80, 'deck', 45);
pushFountain(-180, 50, 9);
for (let a = 0; a < 6; a++) {
  const rad = a * Math.PI / 3;
  pushLamp(-180 + Math.cos(rad) * 26, 50 + Math.sin(rad) * 18, 7);
}

// ---- 公園(設計 -40,80 → 戦闘クリア確保のため北へ寄せ -40,120 / 170×120)----
pushField(-40, 120, 170, 120, 'park', 60);
pushFountain(-40, 120, 6);
for (const [tx, tz] of [[-100,100],[-100,150],[20,100],[20,150],[-40,90],[-40,155]]) pushTree(tx, tz, 1.2);
pushBench(-70, 120, 0); pushBench(-10, 120, 0);
pushBench(-40, 95, 0);  pushBench(-40, 148, 0);
pushLamp(-110, 110, 6); pushLamp(30, 110, 6);
pushLamp(-110, 145, 6); pushLamp(30, 145, 6);

// ---- 住宅街 地面(設計 280,60 / 400×350 → 川の東)----
pushField(310, 60, 320, 320, 'brick', 105);
for (const [lx, lz] of [[250,-60],[400,-60],[250,180],[400,180]]) pushLamp(lx, lz, 7);
for (const [tx, tz] of [[300,-40],[340,40],[280,120],[380,160]]) pushTree(tx, tz, 1.0);

// ---- 工業エリア 地面(設計 -250,-280 / 450×350)----
pushField(-250, -280, 420, 320, 'metal', 105);
for (const [lx, lz] of [[-330,-360],[-160,-360],[-330,-200],[-160,-200]]) pushLamp(lx, lz, 7);

// ---- 南東 郊外 地面(設計 350,-450 / 700×600 の一部を芝地として敷設)----
pushField(350, -450, 520, 420, 'park', 130);

// ※ 建物(中層/遠景/ヒーロー塔/各区画の建屋)は 第二段階 で設計図に沿って配置する。
//    第一段階では地面・道路・川・橋・ロータリー・公園・区画割りのみを敷設する。

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

  // ---- リアル都市拡張用マテリアル ----
  // アスファルト道路(暗いグレー)
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x2c2e33, roughness: 0.95, metalness: 0.02,
  });
  // 川・水面(青・低ラフネスで反射)
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f6f9f, roughness: 0.12, metalness: 0.6,
    emissive: 0x0a2438, emissiveIntensity: 0.25,
    transparent: true, opacity: 0.86,
  });
  // 公園・芝生(緑)
  const parkMat = new THREE.MeshStandardMaterial({
    color: 0x3f7a3a, roughness: 0.9, metalness: 0.0,
  });
  // レンガ(住宅街の暖色)
  const brickMat = new THREE.MeshStandardMaterial({
    color: 0x8a5a3c, roughness: 0.85, metalness: 0.04,
  });
  // 工業金属(倉庫・タンク・パイプ)
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x6a6e74, roughness: 0.4, metalness: 0.8,
  });
  // 街灯(暖色の自発光)
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffd9a0, roughness: 0.4, metalness: 0.2,
    emissive: 0xffb347, emissiveIntensity: 1.2,
  });
  // オレンジの自動ドア(既存 pushAutoDoor 用・従来は灰色にフォールバック)
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0xd07a2a, roughness: 0.5, metalness: 0.35,
    emissive: 0x492304, emissiveIntensity: 0.4,
  });
  // ドア枠(濃いグレー)
  const doorFrameMat = new THREE.MeshStandardMaterial({
    color: 0x3a3c42, roughness: 0.7, metalness: 0.3,
  });

  // --- 形状キャッシュ(軽量化) ---
  // 同じ寸法の箱ジオメトリと輪郭線を使い回し、GPU へのアップロードと
  // メモリを大幅に削減する。位置・回転・当たり判定はメッシュ/コライダー側で
  // 個別に保持するので、見た目もゲーム挙動も一切変わらない。
  const boxGeomCache = new Map();
  const edgeGeomCache = new Map();
  const getBoxGeom = (sx, sy, sz) => {
    const key = sx + '|' + sy + '|' + sz;
    let g = boxGeomCache.get(key);
    if (!g) { g = new THREE.BoxGeometry(sx, sy, sz); boxGeomCache.set(key, g); }
    return g;
  };
  const getEdgeGeom = (sx, sy, sz) => {
    const key = sx + '|' + sy + '|' + sz;
    let e = edgeGeomCache.get(key);
    if (!e) { e = new THREE.EdgesGeometry(getBoxGeom(sx, sy, sz)); edgeGeomCache.set(key, e); }
    return e;
  };

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
    else if (item.matKind === 'road')      mat = roadMat;
    else if (item.matKind === 'water')     mat = waterMat;
    else if (item.matKind === 'park')      mat = parkMat;
    else if (item.matKind === 'brick')     mat = brickMat;
    else if (item.matKind === 'metal')     mat = metalMat;
    else if (item.matKind === 'lamp')      mat = lampMat;
    else if (item.matKind === 'door')      mat = doorMat;
    else if (item.matKind === 'doorFrame') mat = doorFrameMat;

    // メッシュ(sphere ドームは別枝、通常は Box)
    let geom;
    if (item.geomKind === 'domeHalf') {
      // 半球ドーム: sx = 半径、sy = 半径(高さ)、sz = 半径
      // matKind 未指定なら赤ドーム
      if (!item.matKind) mat = domeMat;
      geom = new THREE.SphereGeometry(item.sx, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    } else {
      geom = getBoxGeom(item.sx, item.sy, item.sz);  // 同寸法なら使い回す
    }
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(item.x, baseY, item.z);
    if (item.rot) mesh.rotation.y = item.rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // 建物は動かない静的オブジェクトなので、毎フレームの行列再計算を止める
    // (描画結果は完全に同一。CPU の無駄な更新だけを省く)
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);

    // 輪郭線(cardboard 感を消すため noEdges/球体では skip)
    if (!item.noEdges && item.geomKind !== 'domeHalf') {
      const edges = getEdgeGeom(item.sx, item.sy, item.sz);  // 輪郭線も使い回す
      const line = new THREE.LineSegments(edges, edgeMat);
      line.position.copy(mesh.position);
      if (item.rot) line.rotation.y = item.rot;
      line.matrixAutoUpdate = false;
      line.updateMatrix();
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

  // 段差乗り上げ（ステップアップ）の許容高さ。
  // これ以下の段差なら、歩ける箱(階段/プラットフォーム)を水平ブロックせず登れる。
  const STEP_UP = 2.0;

  // XZ 平面での押し出し解決
  // pos: THREE.Vector3, radius: number
  // 返り値: 位置を書き換えた上で衝突があれば true
  function resolveXZ(pos, radius) {
    let hit = false;
    // プレイヤー原点は接地点の約1m上にあるため、足元は pos.y - 1
    const feetY = pos.y - 1;
    for (const box of colliders) {
      // どの箱でも「上面に立っている（足元が上面以上）」なら
      // XZ 衝突を無視して乗れるようにする
      const topY = box.max.y;
      if (pos.y >= topY - 0.05) continue;
      // 歩ける箱(階段/プラットフォーム)で、上面が足元から STEP_UP 以内の低い段差なら
      // 水平衝突を無視して段差に乗り上げられる（FPSモードで階段を登れる）
      if (box.userData && box.userData.walkable && topY <= feetY + STEP_UP) continue;
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

  // 箱の上に乗る処理（Y のみ）
  // pos.y を箱の上面までせり上げる。
  // 建物(wall)/カバー/柱/プラットフォーム/階段いずれの上面にも立てるようにする。
  // ドームは AABB を持たないためここには来ない。
  function resolveStandOn(pos, radius) {
    let topSupport = -Infinity;
    for (const box of colliders) {
      if (!box.userData) continue;
      const minX = box.min.x - radius * 0.4;
      const maxX = box.max.x + radius * 0.4;
      const minZ = box.min.z - radius * 0.4;
      const maxZ = box.max.z + radius * 0.4;
      if (pos.x < minX || pos.x > maxX || pos.z < minZ || pos.z > maxZ) continue;
      // 歩ける箱(階段/プラットフォーム)は STEP_UP 分だけ下からでも乗り上げられる。
      // それ以外(壁/カバー/柱)は従来通り上面付近にいる時だけ乗せる。
      const lowerBound = (box.userData.walkable)
        ? box.max.y - (STEP_UP + 0.6)
        : box.max.y - 0.6;
      if (pos.y > lowerBound && pos.y < box.max.y + 3.0) {
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
