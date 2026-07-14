// キャラクター生成（GLBモデル読み込み版）
// 各キャラは THREE.Group を返す。Group の position/rotation で動かす。
//
// 重要: プレイヤーは main.js のモジュール評価時に同期的に create() される。
// GLB 読み込みは非同期なので、まず空の Group を返し、モデルが読み込めたら
// あとから中身(inner holder)を埋める「非同期流し込み」パターンを採用する。
// これによりキャラ生成箇所(main.js / enemy.js)は一切変更せず GLB 化できる。

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// キャラクター全体の表示スケール（仕様: 元サイズの2倍）
// 返す Group に group.scale.setScalar(CHARACTER_SCALE) を掛ける。
// プレイヤー/敵の当たり判定半径(radius)もこの倍率に合わせて拡張されている。
export const CHARACTER_SCALE = 2.0;

// --- モデル定義 ---
// url    : public/models 配下の最適化済み GLB（Vite が public/ をルート配信）
// height : 正規化後のローカル高さ（この値 × CHARACTER_SCALE が実際の表示高さ）
//          旧・手続き生成キャラは内部高さ約2.0 → ×2 で約4.0 だったので合わせる。
// rotationY : モデルが +Z 正面を向くよう回転補正（ラジアン）。今回のモデル群は
//          固有正面が +X 方向のため、+Z(オブジェクト前方=正面)に合わせるには
//          -Math.PI/2 を与える（+Math.PI/2 だと背中がこちらを向いて真逆になる）。
const BASE = import.meta.env.BASE_URL || '/';
const MODEL_DEFS = {
  cat_neko: { url: `${BASE}models/cat_neko.glb`, height: 2.2, rotationY: -Math.PI / 2 },
  sensei:   { url: `${BASE}models/sensei.glb`,   height: 2.0, rotationY: -Math.PI / 2 },
  owl_oto:  { url: `${BASE}models/owl_oto.glb`,  height: 2.2, rotationY: -Math.PI / 2 },
};

// 読み込み済みテンプレート(正規化済み Object3D)のキャッシュ
const templates = {};
// テンプレート未着時に「埋めてほしい holder」を待たせるリスト
// waiters[key] = [ { holder }, ... ]
const waiters = {};

let loader = null;
function getLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    // EXT_meshopt_compression のデコードに必要
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

// 読み込んだ GLB シーンを正規化する:
//  - X/Z を中心に寄せ、足元を y=0 に合わせる
//  - 指定ローカル高さになるようスケール
//  - 影を有効化
// 正規化結果を内包した Group(テンプレート)を返す。
function buildTemplate(gltfScene, def) {
  const root = gltfScene;
  root.updateWorldMatrix(true, true);

  // バウンディングボックスを算出
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // 高さ基準でスケール（0除算回避）
  const rawHeight = size.y > 1e-6 ? size.y : 1;
  const scale = def.height / rawHeight;

  // 影設定
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      // 両面描画にして薄い面の欠けを防ぐ
      if (o.material && 'side' in o.material) o.material.side = THREE.FrontSide;
    }
  });

  // 中心寄せ + 足元を原点へ。ラッパーGroupにオフセット/スケールを持たせる。
  const wrapper = new THREE.Group();
  // まず root を中心原点・足元0に移動（元スケールのまま）
  root.position.x = -center.x;
  root.position.z = -center.z;
  root.position.y = -box.min.y;
  wrapper.add(root);
  // ラッパー側で正規化スケール + 正面補正回転
  wrapper.scale.setScalar(scale);
  wrapper.rotation.y = def.rotationY || 0;
  return wrapper;
}

// holder(空Group)にテンプレートのクローンを入れる
function fillHolder(holder, key) {
  const tpl = templates[key];
  if (!tpl) return;
  const inst = tpl.clone(true);
  holder.add(inst);
}

// 単体プリロード
function loadModel(key) {
  const def = MODEL_DEFS[key];
  if (!def) return Promise.resolve();
  return new Promise((resolve) => {
    getLoader().load(
      def.url,
      (gltf) => {
        templates[key] = buildTemplate(gltf.scene, def);
        // 待っていた holder を全部埋める
        const list = waiters[key] || [];
        for (const holder of list) fillHolder(holder, key);
        waiters[key] = [];
        resolve();
      },
      undefined,
      (err) => {
        console.error(`[characters] GLB load failed: ${key}`, err);
        resolve();
      }
    );
  });
}

// 全モデルのプリロード（Promise を返す。await 可能）
let preloadPromise = null;
export function preloadCharacters() {
  if (!preloadPromise) {
    preloadPromise = Promise.all(Object.keys(MODEL_DEFS).map(loadModel));
  }
  return preloadPromise;
}

// create の共通処理: 表示スケール済みの外側Group + 内側holderを返す。
// テンプレートが既にあれば即クローン、なければ waiters に登録して後で埋める。
function createCharacter(key) {
  const group = new THREE.Group();
  group.name = key;

  // 内側holder（回転や向きの微調整はここに集約可能）
  const holder = new THREE.Group();
  holder.name = `${key}_holder`;
  group.add(holder);

  if (templates[key]) {
    fillHolder(holder, key);
  } else {
    (waiters[key] = waiters[key] || []).push(holder);
  }

  group.scale.setScalar(CHARACTER_SCALE);
  return group;
}

// --- 各キャラの create（レジストリ互換のためエクスポート維持） ---
export function createCatNeko() { return createCharacter('cat_neko'); }
export function createSensei()  { return createCharacter('sensei'); }
export function createOwlOto()  { return createCharacter('owl_oto'); }

// モジュール読み込み時にプリロード開始（fire-and-forget）
// プレイヤーは main.js のモジュール評価時に create されるため、ここで先行して走らせる。
preloadCharacters();

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
