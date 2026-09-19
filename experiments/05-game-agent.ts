// 実験5: ターン制ゲームの NPC 行動決定（リアルタイム性と判断の妥当性）
import { choice, noul } from "@typesafe-ai/sdk";
import { makeClient } from "../src/lib/client.ts";
import { stats, table, writeReport } from "../src/lib/report.ts";

const client = makeClient();

type World = { turn: number; npc: { hp: number; maxHp: number; potions: number; mp: number }; player: { hp: number; distance: number; weapon: string; lastAction: string }; allies: number };
type Act = "attack" | "cast_fireball" | "drink_potion" | "retreat" | "call_allies" | "talk";

// ルールベースの参照方針（正解代わり）
function rulePolicy(w: World): Act[] {
  const { npc, player } = w;
  if (npc.hp <= npc.maxHp * 0.25 && npc.potions > 0) return ["drink_potion"];
  if (npc.hp <= npc.maxHp * 0.25 && npc.potions === 0) return w.allies > 0 ? ["call_allies", "retreat"] : ["retreat"];
  if (player.lastAction === "surrender" || player.lastAction === "talk") return ["talk"];
  if (player.distance > 3 && npc.mp >= 10) return ["cast_fireball"];
  if (player.distance > 3) return ["retreat", "call_allies", "cast_fireball"];
  return ["attack"];
}

const questions = {
  action: choice("あなたは `npc`（ダンジョンの衛兵）です。`player` が侵入してきました。この状況で次にとるべき行動は？", {
    attack: "剣で近接攻撃する（距離が近いときのみ有効）",
    cast_fireball: "火球の魔法を放つ（MP を 10 消費、遠距離でも当たる）",
    drink_potion: "回復薬を飲んで HP を回復する",
    retreat: "後退して距離を取る",
    call_allies: "仲間の衛兵を呼ぶ",
    talk: "武器を下げて話しかける・投降を受け入れる",
  }),
  inDanger: noul("`npc` は今、命の危険がある状態か？"),
  hostile: noul("`player` の直前の行動 `player.lastAction` は敵対的か？"),
};

const rng = (() => { let s = 42; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; })();
let w: World = { turn: 0, npc: { hp: 100, maxHp: 100, potions: 2, mp: 30 }, player: { hp: 80, distance: 6, weapon: "弓", lastAction: "approach" }, allies: 2 };
const rows: (string | number)[][] = [];
const lat: number[] = [];
let agree = 0, agreeTop = 0;
const playerActions = ["attack", "shoot_arrow", "approach", "retreat", "talk", "surrender"];

for (let t = 1; t <= 25; t++) {
  w.turn = t;
  const t0 = performance.now();
  const r = await client.systemOne({ state: w, questions });
  lat.push(performance.now() - t0);
  const a = r.answers.action.choice as Act;
  const ok = rulePolicy(w);
  if (ok.includes(a)) agree++;
  if (ok[0] === a) agreeTop++;
  rows.push([t, `HP${w.npc.hp} 薬${w.npc.potions} MP${w.npc.mp} 距離${w.player.distance} 前:${w.player.lastAction}`, ok.join("/"), `${ok.includes(a) ? "✅" : "❌"} ${a}`, r.answers.action.confidence.toFixed(2), r.answers.inDanger.noul.toFixed(2), r.answers.hostile.noul.toFixed(2), lat[lat.length - 1].toFixed(0)]);
  // 世界を進める（簡易シミュレーション）
  if (a === "drink_potion" && w.npc.potions > 0) { w.npc.potions--; w.npc.hp = Math.min(w.npc.maxHp, w.npc.hp + 40); }
  if (a === "cast_fireball" && w.npc.mp >= 10) w.npc.mp -= 10;
  if (a === "retreat") w.player.distance += 2;
  if (a === "call_allies" && w.allies > 0) w.allies--;
  if (a === "attack" && w.player.distance <= 2) w.player.hp -= 15;
  const pa = playerActions[Math.floor(rng() * playerActions.length)];
  w.player.lastAction = pa;
  if (pa === "approach") w.player.distance = Math.max(1, w.player.distance - 3);
  if (pa === "retreat") w.player.distance += 2;
  if (pa === "attack" && w.player.distance <= 2) w.npc.hp -= 25;
  if (pa === "shoot_arrow") w.npc.hp -= 12;
  w.npc.hp = Math.max(1, w.npc.hp);
  w = structuredClone(w);
}
const s = stats(lat);
writeReport("05-game-agent", `# 実験5: ターン制ゲーム NPC の行動決定

- 日時: ${new Date().toISOString()} / モデル: jev-latest / 25 ターン逐次実行
- state はゲームの世界状態そのもの（JSON: npc の HP/薬/MP、player の距離/直前行動、仲間の数）。日本語の質問 3 件
- 「参照」はルールベース方針が妥当とみなす行動（複数可、先頭が最優先）。プレイヤーの行動は乱数

${table(["turn", "状況", "参照", "Jev の行動", "conf", "危険", "敵対", "ms"], rows)}

## 結果

| 指標 | 値 |
| --- | --- |
| 参照方針と一致（許容集合内） | ${agree}/25 |
| 最優先行動と一致 | ${agreeTop}/25 |
| レイテンシ p50 / p90 / max (ms) | ${s.p50.toFixed(0)} / ${s.p90.toFixed(0)} / ${s.max.toFixed(0)} |

## 所見

（実行後に追記）
`);
console.table(rows); console.log({ agree, agreeTop, s });
