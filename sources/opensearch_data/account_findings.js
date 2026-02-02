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

/**
 * ネストされたオブジェクトを平坦化するヘルパー関数
 */
function flatten(obj, prefix = '', res = {}) {
    for (const key in obj) {
        const propName = prefix ? `${prefix}_${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            flatten(obj[key], propName, res);
        } else {
            res[propName] = obj[key];
        }
    }
    return res;
}

// すべてのアカウントのデータを取得し、account_idカラムを追加
const response = await client.search({
    index: indexName,
    body: {
        query: {
            match_all: {},
        },
        size: 10000, // 大量のデータに対応
    },
});

// データを平坦化し、account_idカラムを追加
let allData = response.body.hits.hits.map((hit) => {
    const flatData = flatten(hit._source);
    // 新しいインデックス構造に対応: cloud.account.uid
    const accountId = flatData.cloud_account_uid || 'unknown';
    return {
        _id: hit._id,
        account_id: accountId, // アカウントIDを明示的に追加
        ...flatData,
    };
});

// 環境変数でユーザーアカウントが指定されている場合はフィルタリング
const userAccounts = process.env.EVIDENCE_USER_ACCOUNTS;

if (userAccounts) {
    const accountIds = userAccounts.split(',').map(id => id.trim());
    allData = allData.filter(item => accountIds.includes(item.account_id));
    console.log(`ユーザー別ビルド: ${accountIds.length}個のアカウントの検出結果のみを表示（${allData.length}件）`);
}

export const data = allData;
