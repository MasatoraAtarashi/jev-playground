// 実験2: 同一内容の日英ペアで choice / score / noul の一致率
import { choice, noul, score } from "@typesafe-ai/sdk";
import { makeClient } from "../src/lib/client.ts";
import { table, writeReport } from "../src/lib/report.ts";

const client = makeClient();

type Case = { id: string; ja: string; en: string; gold: { cat: string; urgency: number; refund: boolean } };
const cases: Case[] = [
  { id: "c1", ja: "二重に課金されています。今すぐ返金してください！", en: "I was charged twice. Refund me right now!", gold: { cat: "billing", urgency: 2, refund: true } },
  { id: "c2", ja: "ログインボタンを押しても何も起きません。Chrome最新版です。", en: "Nothing happens when I click the login button. Latest Chrome.", gold: { cat: "technical", urgency: 1, refund: false } },
  { id: "c3", ja: "御社のプランの違いについて教えていただけますか。急ぎではありません。", en: "Could you explain the differences between your plans? No rush.", gold: { cat: "information", urgency: 0, refund: false } },
  { id: "c4", ja: "先月解約したのに今月も請求が来ました。返金をお願いします。", en: "I cancelled last month but was billed again this month. Please refund.", gold: { cat: "billing", urgency: 1, refund: true } },
  { id: "c5", ja: "本番環境のAPIが全て500を返しています。全顧客に影響しており至急対応をお願いします。", en: "All production API calls return 500. All customers are affected, need immediate help.", gold: { cat: "technical", urgency: 2, refund: false } },
  { id: "c6", ja: "領収書の宛名を会社名に変更できますか？", en: "Can I change the name on the receipt to my company name?", gold: { cat: "billing", urgency: 0, refund: false } },
  { id: "c7", ja: "アプリが起動直後に落ちます。iPhone 15、iOS 18です。仕事で使うので困っています。", en: "The app crashes right after launch. iPhone 15, iOS 18. I need it for work.", gold: { cat: "technical", urgency: 1, refund: false } },
  { id: "c8", ja: "サポートの対応が遅すぎる。もう使いたくないので全額返金しろ。", en: "Your support is way too slow. I don't want to use this anymore, give me a full refund.", gold: { cat: "billing", urgency: 2, refund: true } },
  { id: "c9", ja: "APIのレート制限は1分あたり何回ですか？", en: "What is the API rate limit per minute?", gold: { cat: "information", urgency: 0, refund: false } },
  { id: "c10", ja: "データがすべて消えました。バックアップから復元できますか？非常に困っています。", en: "All my data is gone. Can you restore from backup? I'm in serious trouble.", gold: { cat: "technical", urgency: 2, refund: false } },
  { id: "c11", ja: "請求書の金額が見積もりと違います。確認してください。", en: "The invoice amount differs from the quote. Please check.", gold: { cat: "billing", urgency: 1, refund: false } },
  { id: "c12", ja: "無料トライアル中に間違って有料プランを購入してしまいました。取り消せますか？", en: "I accidentally purchased a paid plan during the free trial. Can this be reversed?", gold: { cat: "billing", urgency: 1, refund: true } },
];

const qs = (lang: "ja" | "en") => ({
  cat: choice(lang === "ja" ? "`message` の主な内容は？" : "What is `message` mainly about?", lang === "ja"
    ? { billing: "請求・課金・返金・領収書", technical: "不具合・エラー・技術的問題", information: "情報の問い合わせのみ" }
    : { billing: "Billing, charges, refunds, receipts", technical: "Bugs, errors, technical issues", information: "Information request only" }),
  urgency: score(lang === "ja" ? "`message` の緊急度は？" : "How urgent is `message`?", lang === "ja"
    ? ["急ぎではない", "通常", "至急"] : ["Not urgent", "Normal", "Urgent"]),
  refund: noul(lang === "ja" ? "`message` は返金を求めているか？" : "Does `message` request a refund?"),
});

const rows: (string | number)[][] = [];
let agree = { cat: 0, urg: 0, ref: 0 }, correct = { ja: { cat: 0, urg: 0, ref: 0 }, en: { cat: 0, urg: 0, ref: 0 } };
const detail: string[] = [];
for (const c of cases) {
  // 4 条件: 日本語文×日本語質問、日本語文×英語質問、英語文×英語質問
  const [jj, je, ee] = await Promise.all([
    client.systemOne({ state: { message: c.ja }, questions: qs("ja") }),
    client.systemOne({ state: { message: c.ja }, questions: qs("en") }),
    client.systemOne({ state: { message: c.en }, questions: qs("en") }),
  ]);
  const pick = (r: any) => ({ cat: r.answers.cat.choice as string, catConf: r.answers.cat.confidence as number, urg: Math.round(r.answers.urgency.score as number), urgRaw: r.answers.urgency.score as number, ref: r.answers.refund.noul as number });
  const a = pick(jj), b = pick(je), e = pick(ee);
  const refB = (x: number) => x >= 0.5;
  if (a.cat === e.cat) agree.cat++; if (a.urg === e.urg) agree.urg++; if (refB(a.ref) === refB(e.ref)) agree.ref++;
  if (a.cat === c.gold.cat) correct.ja.cat++; if (a.urg === c.gold.urgency) correct.ja.urg++; if (refB(a.ref) === c.gold.refund) correct.ja.ref++;
  if (e.cat === c.gold.cat) correct.en.cat++; if (e.urg === c.gold.urgency) correct.en.urg++; if (refB(e.ref) === c.gold.refund) correct.en.ref++;
  rows.push([c.id, `${c.gold.cat}/${c.gold.urgency}/${c.gold.refund ? "Y" : "N"}`,
    `${a.cat}(${a.catConf.toFixed(2)})/${a.urgRaw.toFixed(2)}/${a.ref.toFixed(2)}`,
    `${b.cat}(${b.catConf.toFixed(2)})/${b.urgRaw.toFixed(2)}/${b.ref.toFixed(2)}`,
    `${e.cat}(${e.catConf.toFixed(2)})/${e.urgRaw.toFixed(2)}/${e.ref.toFixed(2)}`]);
  detail.push(`- ${c.id}: 「${c.ja}」`);
  console.log(c.id, a, e);
}
const n = cases.length;
const pct = (x: number) => `${x}/${n} (${Math.round((100 * x) / n)}%)`;
writeReport("02-ja-vs-en", `# 実験2: 日本語 vs 英語の精度（同一内容ペア）

- 日時: ${new Date().toISOString()} / モデル: jev-latest / ${n} ケース
- 想定用途: サポート問い合わせの分類。各ケースに人手で正解（カテゴリ / 緊急度 0–2 / 返金要求）を付与
- 3 条件: **JJ** = 日本語文 × 日本語質問、**JE** = 日本語文 × 英語質問、**EE** = 英語文 × 英語質問
- セル表記: カテゴリ(confidence) / 緊急度 score / 返金 noul

${table(["case", "正解 cat/urg/refund", "JJ", "JE", "EE"], rows)}

## 正解との一致率

| 指標 | 日本語 (JJ) | 英語 (EE) |
| --- | --- | --- |
| カテゴリ choice | ${pct(correct.ja.cat)} | ${pct(correct.en.cat)} |
| 緊急度 score（四捨五入一致） | ${pct(correct.ja.urg)} | ${pct(correct.en.urg)} |
| 返金 noul（0.5 閾値） | ${pct(correct.ja.ref)} | ${pct(correct.en.ref)} |

## 日英の判定一致率（JJ vs EE）

- カテゴリ: ${pct(agree.cat)} / 緊急度: ${pct(agree.urg)} / 返金: ${pct(agree.ref)}

## ケース一覧（日本語文）

${detail.join("\n")}

## 所見

（実行後に追記）
`);
