// 実験4: 日本語の依頼文からツール／スキルを選ぶ
import { choice, noul } from "@typesafe-ai/sdk";
import { makeClient } from "../src/lib/client.ts";
import { table, writeReport } from "../src/lib/report.ts";

const client = makeClient();

const tools = {
  web_search: "Web を検索して最新情報や外部の事実を調べる",
  read_file: "ローカルのファイル内容を読む",
  edit_file: "既存ファイルを書き換える・コードを修正する",
  run_shell: "シェルコマンド（テスト実行、ビルド、git 操作など）を実行する",
  create_pr: "GitHub にプルリクエストを作成する",
  send_slack: "Slack にメッセージを送る",
  calendar: "カレンダーの予定を確認・作成する",
  pdf_skill: "PDF を読む・作る・結合する",
  xlsx_skill: "Excel / CSV を読む・作る・集計する",
  pptx_skill: "PowerPoint のスライドを作る",
  none: "ツールは不要。会話だけで回答できる",
};
type Case = { id: string; text: string; gold: keyof typeof tools; ambiguous?: boolean };
const cases: Case[] = [
  { id: "t1", text: "この関数のバグを直して", gold: "edit_file" },
  { id: "t2", text: "テスト回してみて", gold: "run_shell" },
  { id: "t3", text: "React 19 の変更点を調べて", gold: "web_search" },
  { id: "t4", text: "この変更で PR 出しといて", gold: "create_pr" },
  { id: "t5", text: "来週の火曜の午後、空いてる時間ある？", gold: "calendar" },
  { id: "t6", text: "売上データの CSV を月ごとに集計して", gold: "xlsx_skill" },
  { id: "t7", text: "この 3 つの PDF を 1 つにまとめて", gold: "pdf_skill" },
  { id: "t8", text: "来月の全社会議用に 10 枚くらいのスライドを作って", gold: "pptx_skill" },
  { id: "t9", text: "チームに『デプロイ完了しました』って伝えといて", gold: "send_slack" },
  { id: "t10", text: "config.yaml に何が書いてあるか見せて", gold: "read_file" },
  { id: "t11", text: "TypeScript の型ガードって何？", gold: "none" },
  { id: "t12", text: "ありがとう、助かった！", gold: "none" },
  { id: "t13", text: "main にマージして", gold: "run_shell" },
  { id: "t14", text: "今日の為替レート教えて", gold: "web_search" },
  { id: "t15", text: "この資料、パワポにしといて", gold: "pptx_skill" },
  { id: "t16", text: "ちょっと見て", gold: "read_file", ambiguous: true },
  { id: "t17", text: "いい感じにして", gold: "edit_file", ambiguous: true },
  { id: "t18", text: "エラーログの原因を調べて直して", gold: "edit_file", ambiguous: true },
  { id: "t19", text: "請求書の PDF から金額だけ抜き出して表にして", gold: "pdf_skill", ambiguous: true },
  { id: "t20", text: "レビュー依頼、田中さんに送っておいて", gold: "send_slack" },
];

const questions = {
  tool: choice("`request` を実行するのに最初に使うべきツールは？", tools),
  needsClarify: noul("`request` は曖昧で、実行前にユーザーへ確認すべきか？"),
  destructive: noul("`request` の実行は外部に影響する・元に戻しにくい操作（送信・マージ・削除など）を含むか？"),
};

const t0 = performance.now();
const results = await Promise.all(cases.map((c) => client.systemOne({ state: { request: c.text }, questions })));
const elapsed = performance.now() - t0;
const rows: (string | number)[][] = [];
let ok = 0, okClear = 0, nClear = 0, top2 = 0;
const confOk: number[] = [], confNg: number[] = [];
cases.forEach((c, i) => {
  const a = results[i].answers;
  const hit = a.tool.choice === c.gold;
  const sorted = Object.entries(a.tool.probabilities).sort((x, y) => y[1] - x[1]);
  if (sorted.slice(0, 2).some(([k]) => k === c.gold)) top2++;
  if (hit) ok++; if (!c.ambiguous) { nClear++; if (hit) okClear++; }
  (hit ? confOk : confNg).push(a.tool.confidence);
  rows.push([c.id, c.text + (c.ambiguous ? " ※曖昧" : ""), c.gold, `${hit ? "✅" : "❌"} ${a.tool.choice}`, a.tool.confidence.toFixed(2), `${sorted[1][0]} ${sorted[1][1].toFixed(2)}`, a.needsClarify.noul.toFixed(2), a.destructive.noul.toFixed(2)]);
});
const n = cases.length, avg = (xs: number[]) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : "-";
writeReport("04-tool-selection", `# 実験4: 日本語依頼文からのツール／スキル選択

- 日時: ${new Date().toISOString()} / モデル: jev-latest / ${n} 件並列で合計 ${elapsed.toFixed(0)} ms
- 候補ツール ${Object.keys(tools).length} 種（Claude Code 風のツール群＋none）。質問 3 件（ツール choice、要確認 noul、破壊的 noul）
- 「※曖昧」は意図的に短い・曖昧な依頼。正解は「最初に使うべきツール」を人手で付与

${table(["id", "依頼", "正解", "選択", "conf", "2位", "要確認", "破壊的"], rows)}

## 結果

| 指標 | 値 |
| --- | --- |
| 正解率（全体） | ${ok}/${n} (${Math.round(100 * ok / n)}%) |
| 正解率（曖昧ケース除く） | ${okClear}/${nClear} (${Math.round(100 * okClear / nClear)}%) |
| Top-2 に正解を含む | ${top2}/${n} |
| 正解時の平均 confidence | ${avg(confOk)} |
| 不正解時の平均 confidence | ${avg(confNg)} |

## 所見

（実行後に追記）
`);
console.table(rows);
