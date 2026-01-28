import { Client } from "@opensearch-project/opensearch";

// 1. 環境変数の取得（EVIDENCE_ プレフィックスを推奨） [1, 2]
const node = process.env.EVIDENCE_OPENSEARCH_ENDPOINT;
const indexName = process.env.EVIDENCE_OPENSEARCH_INDEX;
const username = process.env.EVIDENCE_OPENSEARCH_USERNAME;
const password = process.env.EVIDENCE_OPENSEARCH_PASSWORD;
const sslVerify = process.env.EVIDENCE_OPENSEARCH_SSL_VERIFY;

// 接続情報の必須チェック
if (!node ||!indexName ||!username ||!password) {
    throw new Error(
        "OpenSearchの環境変数が不足しています。.envファイルを確認してください。"
    );
}

// 2. OpenSearchクライアントの初期化 [3, 4]
const client = new Client({
    node: node,
    auth: {
        username: username,
        password: password,
    },
    ssl: {
        // 自己署名証明書などの場合、環境変数で検証をオフにできるように設定 
        rejectUnauthorized: sslVerify!== "false",
    },
});

/**
 * ネストされたオブジェクトを平坦化するヘルパー関数
 * EvidenceのSQLはネストされたオブジェクトを直接サポートしていないため必須 
 */
function flatten(obj, prefix = '', res = {}) {
    for (const key in obj) {
        const propName = prefix? `${prefix}_${key}` : key;
        if (typeof obj[key] === 'object' && obj[key]!== null &&!Array.isArray(obj[key])) {
            flatten(obj[key], propName, res);
        } else {
            res[propName] = obj[key];
        }
    }
    return res;
}

// 3. データの取得（Top-level await を使用） 
const response = await client.search({
    index: indexName,
    body: {
        query: {
            match_all: {}, // 必要に応じてクエリをカスタマイズ
        },
        size: 500, // 取得件数の上限
    },
});

// 4. Evidenceが要求する 'data' という名前でエクスポート 
// hits.hits からデータを抽出し、平坦化を適用して配列を作成します
export const data = response.body.hits.hits.map((hit) => {
    return {
        _id: hit._id,
       ...flatten(hit._source) // データをフラットな構造に変換 
    };
});