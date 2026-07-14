// 第二段階: 建物 GLB 配置モジュール
// ------------------------------------------------------------------
// 設計図(2000m四方 / +z=北 / +x=東)の区画に沿って、assets 由来の
// 建物 GLB(public/models/buildings/ にコピー済み)を配置する。
//
// 方針:
//  - characters.js と同じ「非同期流し込み」で、まず空 Group を scene に置き、
//    GLB が読めたら中身を埋める(FPS スパイクを避け、生成箇所を汚さない)。
//  - 各建物のワールド AABB を cover.js の covers.colliders に push する。
//    colliders は参照渡しの配列で resolveXZ / resolveStandOn / raycastNearestT /
//    ミニマップが毎フレーム走査するため、push した瞬間に
//    プレイヤー衝突・弾道判定・ミニマップへ自動反映される。
//  - アリーナ中心(原点・半径 CLEAR)/道路/川は座標側で回避済み。
//  - 'city' ステージ選択時のみ配置する。
//
// 重要: プレイヤー/カメラ/UI/操作/戦闘/エフェクトには一切触れない(追加のみ)。

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { getTerrainHeightAt } from './stage.js';
import { getSelectedStage } from './stage-select.js';
import { preloadCharacters } from './characters.js';

const BASE = import.meta.env.BASE_URL || '/';
const DIR = `${BASE}models/buildings/`;

// 全棟一律のスケール倍率。キャラクターとの体格比を合わせるための係数。
// def.h（目標高さ）にこの値を掛け、縦横高さを等比で拡大する。
const BUILDING_SCALE = 2;

// 配置定義
//  file : GLB ファイル名(スペース込みの実ファイル名)
//  x,z  : ワールド座標(+x=東, +z=北)
//  h    : 目標高さ(ワールド単位。size.y をこの値へ正規化)
//  ry   : 向き(ラジアン。前面を道路/アリーナ側へ向ける補正)
//  zone : 区画メモ(デバッグ用)
const PLACEMENTS = [
  // --- 駅前ロータリー ---
  { file: 'train station 3d model.glb',      x: -255, z:  50, h: 26, ry: 0,             zone: 'station' },
  // --- メインストリート / 商業 ---
  { file: 'office building 3d model.glb',     x: -150, z: 110, h: 68, ry:  Math.PI / 2, zone: 'mainstreet' },
  { file: 'modern building 3d model.glb',     x: -100, z: 115, h: 58, ry:  Math.PI / 2, zone: 'mainstreet' },
  { file: 'architecture building 3d model.glb',x: -210, z: 110, h: 40, ry:  Math.PI / 2, zone: 'mainstreet' },
  { file: 'bank building 3d model.glb',       x: -150, z:  20, h: 24, ry: -Math.PI / 2, zone: 'commercial' },
  { file: 'storefront building 3d model.glb', x: -100, z:  20, h: 14, ry: -Math.PI / 2, zone: 'commercial' },
  { file: 'cafe 3d model.glb',                x: -205, z:  25, h: 10, ry: -Math.PI / 2, zone: 'commercial' },
  { file: 'drug store 3d model.glb',          x: -250, z: 110, h: 12, ry:  Math.PI / 2, zone: 'commercial' },
  { file: 'convenience store 3d model.glb',   x: -250, z:   5, h:  9, ry: 0,             zone: 'commercial' },
  // --- 公民施設 ---
  { file: 'hospital building 3d model.glb',   x: -140, z: 180, h: 34, ry: 0,             zone: 'civic' },
  { file: 'police station 3d model.glb',      x:   30, z: 115, h: 20, ry:  Math.PI / 2, zone: 'civic' },
  // --- 住宅街(川の東) ---
  { file: 'apartment building 3d model.glb',  x:  310, z: 130, h: 46, ry:  Math.PI / 2, zone: 'residential' },
  { file: 'family restaurant 3d model.glb',   x:  330, z:  30, h: 11, ry: -Math.PI / 2, zone: 'residential' },
  // --- 工業エリア ---
  { file: 'industrial warehouse 3d model.glb',x: -250, z: -280, h: 22, ry: 0,           zone: 'industrial' },
  { file: 'gas station 3d model.glb',         x: -120, z: -180, h:  8, ry: 0,           zone: 'industrial' },
  { file: 'fire station 3d model.glb',        x: -350, z: -200, h: 18, ry: 0,           zone: 'industrial' },
  // --- 南東郊外 ---
  { file: 'modern house 3d model.glb',        x:  300, z: -400, h: 12, ry: -Math.PI / 2, zone: 'suburb' },
  { file: 'modern house 3d model (1).glb',    x:  430, z: -420, h: 12, ry: -Math.PI / 2, zone: 'suburb' },
];

let loader = null;
function getLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder); // EXT_meshopt_compression 対応
  }
  return loader;
}

// GLB シーンを正規化して outerGroup(接地済み・目標高さ)に組み込む。
//  - X/Z を中心寄せ、足元を y=0 に合わせる
//  - size.y が目標高さになるようスケール
//  - 影を有効化
function attachModel(outerGroup, gltfScene, def) {
  const root = gltfScene;
  root.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const rawH = size.y > 1e-6 ? size.y : 1;
  const scale = (def.h / rawH) * BUILDING_SCALE;

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material && 'side' in o.material) o.material.side = THREE.FrontSide;
    }
  });

  // wrapper: 正規化スケール + 正面補正。root は中心原点・足元0へ。
  const wrapper = new THREE.Group();
  root.position.x = -center.x;
  root.position.z = -center.z;
  root.position.y = -box.min.y;
  wrapper.add(root);
  wrapper.scale.setScalar(scale);
  wrapper.rotation.y = def.ry || 0;
  outerGroup.add(wrapper);
}

// 配置後の建物からワールド AABB を作り、コライダーとして covers に登録する。
// XZ をわずかに内側へ縮めて、庇などで引っかかるのを防ぐ。
function registerCollider(outerGroup, covers) {
  outerGroup.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(outerGroup);
  // XZ を 8% 内側へ(足元の張り出し対策)。Y はそのまま。
  const shrink = 0.08;
  const dx = (box.max.x - box.min.x) * shrink * 0.5;
  const dz = (box.max.z - box.min.z) * shrink * 0.5;
  box.min.x += dx; box.max.x -= dx;
  box.min.z += dz; box.max.z -= dz;
  box.userData = { type: 'wall', walkable: false, suppressBeacon: true };
  covers.colliders.push(box);
}

// 1件だけ非同期ロード(失敗時は指定回数まで再試行)。
// 各 GLB が 57〜60MB と巨大なため、同時並行だと同時接続/メモリが飽和して
// fetch が失敗する(TypeError: Failed to fetch)。必ず逐次でロードする。
function loadOne(ld, url, retries = 2) {
  return new Promise((resolve) => {
    const attempt = (left) => {
      ld.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (err) => {
          if (left > 0) {
            // 少し待って再試行(飽和明け・一時的失敗の回復狙い)
            setTimeout(() => attempt(left - 1), 400);
          } else {
            console.error(`[buildings] GLB load failed: ${url}`, err);
            resolve(null);
          }
        },
      );
    };
    attempt(retries);
  });
}

// メイン: city ステージでのみ建物を「逐次」非同期配置。
// scene に Group を追加し、covers.colliders にコライダーを流し込む。
// 空の outer グループは先に全て配置しておき、GLB は1棟ずつ読み込んで中身を埋める。
export function placeBuildings(scene, covers) {
  if (getSelectedStage() !== 'city') return;
  if (!covers || !Array.isArray(covers.colliders)) return;

  const parent = new THREE.Group();
  parent.name = 'buildings';
  scene.add(parent);

  // outer グループ(接地済み)を同期的に全配置しておく。
  const jobs = PLACEMENTS.map((def) => {
    const groundY = getTerrainHeightAt(def.x, def.z);
    const outer = new THREE.Group();
    outer.name = `bld_${def.zone}`;
    outer.position.set(def.x, groundY, def.z);
    parent.add(outer);
    return { def, outer };
  });

  // 1棟ずつ順番にロード(同時接続の飽和を回避)。
  // 先にキャラ GLB のプリロード完了を待つ。巨大な建物ロードと競合させると
  // キャラ側の fetch まで巻き添えで失敗する(プレイヤー不可視)ため、
  // 小さく高速なキャラを確実に先着させてから建物へ進む。
  const ld = getLoader();
  (async () => {
    try { await preloadCharacters(); } catch (_) { /* キャラ側で解決済み */ }
    for (const { def, outer } of jobs) {
      const gltf = await loadOne(ld, DIR + def.file);
      if (!gltf) continue;
      attachModel(outer, gltf.scene, def);
      registerCollider(outer, covers);
    }
  })();

  return parent;
}
