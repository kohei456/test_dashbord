import { Client } from "@opensearch-project/opensearch";

export const my_data = async () => {
    // 環境変数から認証情報を取得（.envファイルに設定）
    const node = process.env.EVIDENCE_OPENSEARCH_ENDPOINT;
    const indexName = process.env.EVIDENCE_OPENSEARCH_INDEX;
    const username = process.env.EVIDENCE_OPENSEARCH_USERNAME;
    const password = process.env.EVIDENCE_OPENSEARCH_PASSWORD;

    // 必須の環境変数チェック
    if (!node || !indexName || !username || !password) {
        throw new Error(
            "環境変数が設定されていません。.envファイルに以下を設定してください:\n" +
            "EVIDENCE_OPENSEARCH_ENDPOINT, EVIDENCE_OPENSEARCH_INDEX, EVIDENCE_OPENSEARCH_USERNAME, EVIDENCE_OPENSEARCH_PASSWORD"
        );
    }

    // OpenSearchクライアントの設定
    const client = new Client({
        node: node,
        auth: {
            username: username,
            password: password,
        },
        // SSL証明書の検証設定（環境変数で制御）
        ssl: {
            rejectUnauthorized: process.env.EVIDENCE_OPENSEARCH_SSL_VERIFY !== "false",
        },
    });

    try {
        // 接続テスト（デバッグ用）
        console.log("OpenSearchに接続中...");
        console.log("Node: " + node);
        console.log("Index: " + indexName);

        // OpenSearchからデータを検索
        const response = await client.search({
            index: indexName,
            body: {
                query: {
                    match_all: {}, // 必要に応じてクエリを変更
                },
                size: 100, // 取得件数を調整
            },
        });

        const hitCount = response.body.hits.hits.length;
        console.log("取得件数: " + hitCount + "件");

        // データが0件の場合は空配列を返す
        if (hitCount === 0) {
            console.warn("OpenSearchからデータが取得できませんでした。インデックスが空か、クエリ条件を確認してください。");
            return [];
        }

        // OpenSearchのレスポンス形式から、表示したいデータの配列を取り出す
        return response.body.hits.hits.map((hit) => ({
            ...hit._source,
            id: hit._id,
        }));
    } catch (error) {
        console.error("OpenSearchからのデータ取得に失敗しました:");
        console.error(error.message || error);
        throw error;
    }
};
