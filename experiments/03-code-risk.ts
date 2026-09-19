// 実験3: コード変更（diff）の危険度チェック
import { choice, noul, score } from "@typesafe-ai/sdk";
import { makeClient } from "../src/lib/client.ts";
import { table, writeReport } from "../src/lib/report.ts";

const client = makeClient();

type Case = { id: string; title: string; diff: string; gold: { risk: number; needsReview: boolean; kind: string } };
const cases: Case[] = [
  { id: "d1", title: "READMEのtypo修正", gold: { risk: 0, needsReview: false, kind: "docs" }, diff: `--- a/README.md
+++ b/README.md
-## Instalation
+## Installation` },
  { id: "d2", title: "ログ出力の追加", gold: { risk: 0, needsReview: false, kind: "logic" }, diff: `--- a/src/order.ts
+++ b/src/order.ts
 export async function createOrder(input: OrderInput) {
+  logger.info("createOrder called", { userId: input.userId });
   return repo.insert(input);
 }` },
  { id: "d3", title: "WHERE句の削除", gold: { risk: 3, needsReview: true, kind: "data" }, diff: `--- a/src/admin/cleanup.ts
+++ b/src/admin/cleanup.ts
-  await db.query("DELETE FROM sessions WHERE expires_at < NOW()");
+  await db.query("DELETE FROM sessions");` },
  { id: "d4", title: "認証ミドルウェアの一時無効化", gold: { risk: 3, needsReview: true, kind: "security" }, diff: `--- a/src/server.ts
+++ b/src/server.ts
-app.use("/api", requireAuth);
+// app.use("/api", requireAuth); // TODO: デバッグ用に一時的にコメントアウト
 app.use("/api", router);` },
  { id: "d5", title: "ユニットテストの追加", gold: { risk: 0, needsReview: false, kind: "test" }, diff: `--- a/tests/price.test.ts
+++ b/tests/price.test.ts
+test("税込価格を計算する", () => {
+  expect(withTax(1000)).toBe(1100);
+});` },
  { id: "d6", title: "税率のハードコード変更", gold: { risk: 2, needsReview: true, kind: "logic" }, diff: `--- a/src/price.ts
+++ b/src/price.ts
-const TAX_RATE = 0.10;
+const TAX_RATE = 0.08;` },
  { id: "d7", title: "外部APIのタイムアウト延長", gold: { risk: 1, needsReview: true, kind: "config" }, diff: `--- a/src/http.ts
+++ b/src/http.ts
-  timeout: 3000,
+  timeout: 30000,` },
  { id: "d8", title: "シークレットのコミット", gold: { risk: 3, needsReview: true, kind: "security" }, diff: `--- a/src/config.ts
+++ b/src/config.ts
-const STRIPE_KEY = process.env.STRIPE_KEY;
+const STRIPE_KEY = "sk_live_51Hx9AbCdEfGhIjKlMnOpQrStUvWxYz";` },
  { id: "d9", title: "マイグレーション: カラム削除", gold: { risk: 3, needsReview: true, kind: "data" }, diff: `--- /dev/null
+++ b/migrations/0042_drop_legacy_email.sql
+ALTER TABLE users DROP COLUMN legacy_email;` },
  { id: "d10", title: "依存ライブラリのパッチ更新", gold: { risk: 1, needsReview: false, kind: "deps" }, diff: `--- a/package.json
+++ b/package.json
-    "lodash": "4.17.20",
+    "lodash": "4.17.21",` },
  { id: "d11", title: "eval による式の評価", gold: { risk: 3, needsReview: true, kind: "security" }, diff: `--- a/src/calc.ts
+++ b/src/calc.ts
-  return parseExpression(userInput);
+  return eval(userInput);` },
  { id: "d12", title: "CSSの余白調整", gold: { risk: 0, needsReview: false, kind: "ui" }, diff: `--- a/src/styles.css
+++ b/src/styles.css
-  padding: 8px;
+  padding: 12px;` },
  { id: "d13", title: "リトライ回数を無限に", gold: { risk: 2, needsReview: true, kind: "logic" }, diff: `--- a/src/queue.ts
+++ b/src/queue.ts
-  maxRetries: 3,
+  maxRetries: Infinity,` },
  { id: "d14", title: "型注釈の追加のみ", gold: { risk: 0, needsReview: false, kind: "refactor" }, diff: `--- a/src/util.ts
+++ b/src/util.ts
-export function sum(xs) {
+export function sum(xs: number[]): number {
   return xs.reduce((a, b) => a + b, 0);
 }` },
  { id: "d15", title: "本番のフィーチャーフラグをON", gold: { risk: 2, needsReview: true, kind: "config" }, diff: `--- a/config/production.yaml
+++ b/config/production.yaml
 features:
-  new_checkout: false
+  new_checkout: true` },
];

const questions = {
  risk: score("`diff` の変更を本番にデプロイした場合の危険度は？", [
    "安全: 動作に影響しない（ドキュメント・型・スタイル・テスト追加など）",
    "低: 影響は限定的で、問題があってもすぐ戻せる",
    "中: ユーザーや売上に影響しうる振る舞いの変更",
    "高: データ損失・セキュリティ・全体障害につながりうる",
  ]),
  needsReview: noul("`diff` は本番デプロイ前に人間のレビューを必須とすべきか？"),
  kind: choice("`diff` の変更の種類は？", {
    docs: "ドキュメントのみ", test: "テストのみ", ui: "見た目・スタイル", refactor: "振る舞いを変えないコード整理",
    logic: "ビジネスロジックの変更", config: "設定値・フラグの変更", deps: "依存ライブラリの更新",
    data: "DBスキーマやデータの破壊的操作", security: "認証・認可・シークレット・コード実行に関わる変更",
  }),
  irreversible: noul("`diff` の変更は、デプロイ後に元に戻しても影響が残る（不可逆）か？"),
  secret: noul("`diff` にAPIキー・パスワード等のシークレットが含まれているか？"),
};

const rows: (string | number)[][] = [];
let ok = { risk: 0, riskWithin1: 0, review: 0, kind: 0 };
const t0 = performance.now();
const results = await Promise.all(cases.map((c) => client.systemOne({ state: { title: c.title, diff: c.diff }, questions })));
const elapsed = performance.now() - t0;
cases.forEach((c, i) => {
  const a = results[i].answers;
  const r = a.risk.score, rr = Math.round(r);
  if (rr === c.gold.risk) ok.risk++;
  if (Math.abs(rr - c.gold.risk) <= 1) ok.riskWithin1++;
  if ((a.needsReview.noul >= 0.5) === c.gold.needsReview) ok.review++;
  if (a.kind.choice === c.gold.kind) ok.kind++;
  rows.push([c.id, c.title, c.gold.risk, r.toFixed(2), a.needsReview.noul.toFixed(2), c.gold.kind, `${a.kind.choice}(${a.kind.confidence.toFixed(2)})`, a.irreversible.noul.toFixed(2), a.secret.noul.toFixed(2)]);
});
const n = cases.length, pct = (x: number) => `${x}/${n} (${Math.round((100 * x) / n)}%)`;
writeReport("03-code-risk", `# 実験3: コード変更の危険度チェック（日本語質問）

- 日時: ${new Date().toISOString()} / モデル: jev-latest / ${n} diff / ${n} 件並列で合計 ${elapsed.toFixed(0)} ms
- state は \`{ title, diff }\`。質問は 5 件（危険度 score 0–3、要レビュー noul、種類 choice、不可逆 noul、シークレット noul）
- 正解は人手で付与。危険度の尺度: 0 安全 / 1 低 / 2 中 / 3 高

${table(["id", "変更", "正解risk", "risk", "要レビュー", "正解kind", "kind(conf)", "不可逆", "secret"], rows)}

## 正解との一致率

| 指標 | 一致 |
| --- | --- |
| 危険度（四捨五入で完全一致） | ${pct(ok.risk)} |
| 危険度（±1 以内） | ${pct(ok.riskWithin1)} |
| 要レビュー（0.5 閾値） | ${pct(ok.review)} |
| 種類 choice | ${pct(ok.kind)} |

## 所見

（実行後に追記）
`);
console.table(rows);
