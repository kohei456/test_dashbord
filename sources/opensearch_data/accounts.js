import { Client } from "@opensearch-project/opensearch";

// 環境変数の取得
const node = process.env.EVIDENCE_OPENSEARCH_ENDPOINT;
const indexName = process.env.EVIDENCE_OPENSEARCH_INDEX;
const username = process.env.EVIDENCE_OPENSEARCH_USERNAME;
const password = process.env.EVIDENCE_OPENSEARCH_PASSWORD;
const sslVerify = process.env.EVIDENCE_OPENSEARCH_SSL_VERIFY;

// 接続情報の必須チェック
if (!node || !indexName || !username || !password) {
    throw new Error(
        "OpenSearchの環境変数が不足しています。.envファイルを確認してください。"
    );
}

// OpenSearchクライアントの初期化
const client = new Client({
    node: node,
    auth: {
        username: username,
        password: password,
    },
    ssl: {
        rejectUnauthorized: sslVerify !== "false",
    },
});

// アカウント一覧を取得（集約クエリを使用）
const response = await client.search({
    index: indexName,
    body: {
        size: 0, // ドキュメント自体は不要
        aggs: {
            unique_accounts: {
                terms: {
                    field: "cloud.account.uid.keyword", // キーワードフィールドを使用
                    size: 1000, // 最大1000アカウント
                },
            },
        },
    },
});

// アカウント一覧を配列に変換
export const data = response.body.aggregations.unique_accounts.buckets.map((bucket) => {
    return {
        account_id: bucket.key,
        finding_count: bucket.doc_count,
    };
});
