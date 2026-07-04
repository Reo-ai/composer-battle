// ステージ選択の共有ヘルパー
// タイトル画面でユーザーが選んだステージ種別を保持し、
// stage.js / cover.js の両方から参照できるようにする。
//
//   'wild' … 変更前の荒野ステージ（夕焼け・土の大地）
//   'city' … 新規の都会ステージ（青空・ビル群）
//
// 選択値は sessionStorage（キー: cb_stage）に保存する。
// index.html のゲート用スクリプトが main.js を import する前に値をセットするので、
// モジュール読み込み時（cover.js の LAYOUT 構築時）には確定している。

export const STAGE_TYPES = ['wild', 'city'];
const STORAGE_KEY = 'cb_stage';
const DEFAULT_STAGE = 'city';

// 現在選択されているステージ種別を返す（未選択なら既定値）
export function getSelectedStage() {
  try {
    const v = (typeof sessionStorage !== 'undefined') && sessionStorage.getItem(STORAGE_KEY);
    if (v === 'wild' || v === 'city') return v;
  } catch (_) { /* sessionStorage 不可環境は既定値へ */ }
  // URL パラメータ ?stage=wild|city も許可（共有リンク用）
  try {
    const p = new URLSearchParams(location.search).get('stage');
    if (p === 'wild' || p === 'city') return p;
  } catch (_) { /* noop */ }
  return DEFAULT_STAGE;
}

// ステージ種別を保存する（タイトル画面のボタンから呼ぶ）
export function setSelectedStage(stage) {
  const s = (stage === 'wild' || stage === 'city') ? stage : DEFAULT_STAGE;
  try { sessionStorage.setItem(STORAGE_KEY, s); } catch (_) { /* noop */ }
  return s;
}

// 選択をクリアしてタイトルに戻れるようにする
export function clearSelectedStage() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) { /* noop */ }
}

export function isCity() { return getSelectedStage() === 'city'; }
export function isWild() { return getSelectedStage() === 'wild'; }
