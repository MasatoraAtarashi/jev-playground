import { TypeSafeClient } from "@typesafe-ai/sdk";

// キーは .env の TYPESAFE_API_KEY から。`node --env-file=.env` 経由で実行する前提。
// キーそのものは絶対にログ・レポートに出力しない。
export function makeClient(): TypeSafeClient {
  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error(
      "TYPESAFE_API_KEY が未設定です。.env に設定し、`npm run exp -- <file>` 形式で実行してください。",
    );
  }
  return new TypeSafeClient();
}
