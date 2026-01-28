# 設計ドキュメント

## 概要

本システムは、IAM Identity Centerのユーザー情報とアカウント割り当てに基づいて、ユーザーごとにパーソナライズされたEvidenceレポートを配信する基盤です。日次で実行されるCI/CDパイプラインが各ユーザー専用の静的ページを生成し、認証後にユーザーIDに基づいて該当レポートを表示します。

主要な特徴：
- IAM Identity Center APIによるユーザー情報とアカウント割り当ての自動取得
- ユーザーごとの専用静的ページ生成（日次スケジュール）
- ユーザーIDベースのS3プレフィックスによるデータ分離
- ALB + Cognito + IAM Identity Centerによる認証
- Fargateでのユーザー専用ルーティング
- ECRによるコンテナイメージ管理

## アーキテクチャ

### システム構成

```
[IAM Identity Center]
    ↓ (API: ListUsers, ListAccountAssignments)
[Scheduled Build (Daily)]
    ↓ (Generate user-specific pages)
[S3: user-{userId1}/, user-{userId2}/, ...]
    ↑ (fetch files)
[Fargate Container]
    ↑ (JWT + user ID routing)
[ALB]
    ↑ (OIDC auth)
[Cognito] ←→ [IAM Identity Center]
    ↑
[User]
```

### レイヤー構成

1. **アイデンティティ層**: IAM Identity Center + Cognito
2. **CI/CD層**: GitHub Actions/CodeBuild + IAM Identity Center API統合
3. **ストレージ層**: S3 (ユーザー別プレフィックス) + ECR
4. **配信層**: ALB + Fargate

### データフロー

**ビルド時:**
1. スケジュールトリガー（日次）
2. IAM Identity Center APIからユーザー一覧取得
3. 各ユーザーのアカウント割り当て取得
4. ユーザーごとにEvidenceレポート生成
5. S3の`user-{userId}/`にアップロード

**配信時:**
1. ユーザーがALBにアクセス
2. Cognito認証（IAM Identity Center連携）
3. JWTにユーザーID含む
4. FargateがユーザーIDを抽出
5. `user-{userId}/`からファイル取得
6. ユーザーにレスポンス返却

## コンポーネントとインターフェース

### 1. IAM Identity Center統合

#### ユーザー情報取得
```javascript
// lib/identityCenter.js
/**
 * IAM Identity Centerからすべてのユーザーを取得
 * @returns {Promise<User[]>} ユーザー配列
 */
async function listUsers()

/**
 * 特定ユーザーのアカウント割り当てを取得
 * @param {string} userId - ユーザーID
 * @returns {Promise<AccountAssignment[]>} アカウント割り当て配列
 */
async function listAccountAssignmentsForUser(userId)

/**
 * すべてのユーザーとそのアカウント割り当てを取得
 * @returns {Promise<UserAccountMap>} ユーザーIDをキーとしたアカウントリストのマップ
 */
async function getUserAccountMap()
```

**データ構造:**
```typescript
interface User {
  userId: string;
  userName: string;
  email: string;
}

interface AccountAssignment {
  accountId: string;
  permissionSetArn: string;
}

interface UserAccountMap {
  [userId: string]: string[]; // アカウントIDの配列
}
```

### 2. CI/CDパイプライン

#### GitHub Actions Workflow
```yaml
# .github/workflows/build-user-reports.yml
name: Build User-Specific Evidence Reports
on:
  schedule:
    - cron: '0 0 * * *'  # 毎日午前0時（UTC）
  workflow_dispatch:  # 手動トリガー

jobs:
  fetch-users:
    runs-on: ubuntu-latest
    outputs:
      user-matrix: ${{ steps.get-users.outputs.matrix }}
    steps:
      - uses: actions/checkout@v3
      - name: Get IAM Identity Center Users
        id: get-users
        run: |
          # IAM Identity Center APIを呼び出してユーザー一覧とアカウント割り当てを取得
          node scripts/fetch-users.js
          
  build-user-reports:
    needs: fetch-users
    strategy:
      matrix: ${{ fromJson(needs.fetch-users.outputs.user-matrix) }}
    steps:
      - uses: actions/checkout@v3
      - name: Build Evidence for User
        env:
          USER_ID: ${{ matrix.userId }}
          ACCOUNT_IDS: ${{ matrix.accountIds }}
        run: npm run build:user
      - name: Sync to S3
        run: aws s3 sync ./build s3://bucket/user-${{ matrix.userId }}/
```

**インターフェース:**
- 入力: スケジュールトリガーまたは手動トリガー
- 出力: S3バケットへのユーザー別HTML/Parquetファイル

### 3. ビルドスクリプト

#### ユーザー情報取得スクリプト
```javascript
// scripts/fetch-users.js
/**
 * IAM Identity Centerからユーザーとアカウント割り当てを取得し、
 * GitHub Actionsのマトリックス形式で出力
 */
async function fetchUsersAndGenerateMatrix()
```

#### ユーザー専用ビルドスクリプト
```javascript
// scripts/build-user-report.js
/**
 * 特定ユーザーのアカウント一覧に基づいてEvidenceレポートを生成
 * @param {string} userId - ユーザーID
 * @param {string[]} accountIds - アカウントID配列
 */
async function buildUserReport(userId, accountIds)
```

### 4. コンテナイメージビルド

#### Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

**インターフェース:**
- 入力: アプリケーションコード
- 出力: ECRコンテナイメージ

### 5. Fargateアプリケーション

#### サーバーアーキテクチャ
```
server.js
├── middleware/
│   ├── jwtValidator.js    # JWT検証
│   ├── userIdExtractor.js # ユーザーID抽出
│   └── accessControl.js   # アクセス制御
├── routes/
│   └── proxy.js           # S3プロキシ
└── utils/
    ├── s3Client.js        # S3クライアント
    └── logger.js          # ロギング
```

#### 主要インターフェース

**JWTバリデーター**
```javascript
// middleware/jwtValidator.js
/**
 * ALBから渡されたJWTを検証する
 * @param {string} token - x-amzn-oidc-dataヘッダーの値
 * @returns {Object} デコードされたJWTペイロード
 * @throws {Error} JWT検証失敗時
 */
function validateJWT(token)
```

**ユーザーID抽出器**
```javascript
// middleware/userIdExtractor.js
/**
 * JWTからユーザーIDを抽出
 * @param {Object} jwtPayload - デコードされたJWT
 * @returns {string} ユーザーID（subクレーム）
 */
function extractUserId(jwtPayload)
```

**アクセス制御**
```javascript
// middleware/accessControl.js
/**
 * ユーザーIDとリクエストパスを照合
 * @param {string} userId - ユーザーID
 * @param {string} requestPath - リクエストされたパス
 * @returns {boolean} アクセス許可の可否
 */
function checkAccess(userId, requestPath)
```

**S3プロキシ**
```javascript
// routes/proxy.js
/**
 * S3からファイルを取得してクライアントに返す
 * @param {string} userId - ユーザーID
 * @param {string} filePath - ファイルパス
 * @returns {Stream} S3オブジェクトストリーム
 */
async function proxyS3File(userId, filePath)
```

### 6. インフラストラクチャ (Terraform/CDK)

#### リソース定義
- S3バケット (バージョニング、暗号化有効)
- ECRリポジトリ
- ALB (HTTPS、Cognito統合)
- Cognitoユーザープール (IAM Identity Center連携)
- Fargateクラスター、タスク定義、サービス
- IAMロール（IAM Identity Center API読み取り権限含む）
- セキュリティグループ
- CloudWatch Logs
- EventBridge（日次スケジュール）

## データモデル

### JWTペイロード構造
```json
{
  "sub": "user-id-12345",
  "email": "user@example.com",
  "iss": "https://cognito-idp.region.amazonaws.com/poolId",
  "exp": 1234567890,
  "iat": 1234567800
}
```

### IAM Identity Center ユーザー情報
```json
{
  "UserId": "user-id-12345",
  "UserName": "john.doe",
  "DisplayName": "John Doe",
  "Emails": [
    {
      "Value": "john.doe@example.com",
      "Type": "work",
      "Primary": true
    }
  ]
}
```

### アカウント割り当て情報
```json
{
  "AccountId": "123456789012",
  "PermissionSetArn": "arn:aws:sso:::permissionSet/ssoins-xxx/ps-xxx",
  "PrincipalType": "USER",
  "PrincipalId": "user-id-12345"
}
```

### ユーザーアカウントマップ（ビルド時使用）
```json
{
  "user-id-12345": ["123456789012", "234567890123"],
  "user-id-67890": ["123456789012"],
  "user-id-abcde": ["234567890123", "345678901234"]
}
```

### S3バケット構造
```
s3://evidence-reports/
├── user-user-id-12345/
│   ├── index.html
│   ├── data/
│   │   └── report.parquet
│   └── assets/
├── user-user-id-67890/
│   ├── index.html
│   ├── data/
│   │   └── report.parquet
│   └── assets/
└── user-user-id-abcde/
    ├── index.html
    ├── data/
    │   └── report.parquet
    └── assets/
```

### GitHub Actions マトリックス形式
```json
{
  "include": [
    {
      "userId": "user-id-12345",
      "accountIds": "123456789012,234567890123"
    },
    {
      "userId": "user-id-67890",
      "accountIds": "123456789012"
    }
  ]
}
```


## 正確性プロパティ

プロパティとは、システムのすべての有効な実行において真であるべき特性や動作のことです。本質的には、システムが何をすべきかについての形式的な記述です。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。

### プロパティ 1: アカウントリスト生成

*任意の*アカウント割り当て情報の配列に対して、アカウントリスト生成関数は重複のないアカウントIDの配列を返さなければならない

**検証: 要件 1.3**

### プロパティ 2: API エラーハンドリングとリトライ

*任意の*API呼び出しエラーに対して、エラーハンドラーはエラーの詳細をログに記録し、設定された回数までリトライを実行しなければならない

**検証: 要件 1.4**

### プロパティ 3: ビルドジョブ生成

*任意の*ユーザーアカウントマップに対して、ビルドジョブ生成関数は各ユーザーに対して1つのジョブ定義を生成し、ユーザーIDとアカウントIDリストを含まなければならない

**検証: 要件 2.1**

### プロパティ 4: ユーザーデータ分離

*任意の*ユーザーIDとビルド出力に対して、ビルドプロセスが生成するS3キーは「user-{userId}/」プレフィックスで始まらなければならず、他のユーザーのプレフィックスを含んではならない

**検証: 要件 2.4**

### プロパティ 5: ビルドエラーログ記録

*任意の*ビルドエラー条件に対して、エラーハンドラーはエラーの詳細をログに記録し、管理者通知を発行しなければならない

**検証: 要件 2.5**

### プロパティ 6: ビルド完了ログ記録

*任意の*ビルドプロセスの完了に対して、システムはビルド結果（成功/失敗）と処理ユーザー数をログに記録しなければならない

**検証: 要件 3.4**

### プロパティ 7: イメージタグ生成

*任意の*コミットSHAとブランチ名に対して、タグ生成関数は少なくとも2つのタグ（latestとコミットSHA）を生成しなければならない

**検証: 要件 4.3**

### プロパティ 8: JWTヘッダー抽出

*任意の*x-amzn-oidc-dataヘッダーを含むHTTPリクエストに対して、JWT抽出関数はヘッダー値を正しく取得し、デコード可能な文字列を返さなければならない

**検証: 要件 6.1**

### プロパティ 9: JWT署名検証

*任意の*JWTトークンに対して、検証関数は署名が有効な場合のみ成功を返し、無効な署名や改ざんされたトークンに対してはエラーを返さなければならない

**検証: 要件 6.2**

### プロパティ 10: ユーザーID抽出

*任意の*有効なJWTペイロードに対して、ユーザーID抽出関数はsubクレームから文字列を正しく取得しなければならない

**検証: 要件 6.3**

### プロパティ 11: S3プレフィックス生成

*任意の*ユーザーIDに対して、プレフィックス生成関数は「user-{userId}/」の形式で正しいS3プレフィックスを返さなければならない

**検証: 要件 6.4**

### プロパティ 12: S3キー構築

*任意の*ユーザーIDとファイルパスに対して、S3プロキシ関数は「user-{userId}/{ファイルパス}」の形式で正しいS3キーを構築しなければならない

**検証: 要件 6.5, 7.4**

### プロパティ 13: 存在しないフォルダのエラーハンドリング

*任意の*存在しないユーザーフォルダへのアクセスに対して、システムは404エラーと適切なエラーメッセージを返さなければならない

**検証: 要件 6.6**

### プロパティ 14: アクセス制御

*任意の*ユーザーIDとリクエストパスに対して、アクセス制御関数はユーザーIDに対応するリソースへのアクセスのみを許可し、他のユーザーのリソースへのアクセスは403エラーで拒否しなければならない

**検証: 要件 7.1, 7.2**

### プロパティ 15: セキュリティログ記録

*任意の*アクセス拒否イベントに対して、システムはユーザーID、リクエストパス、拒否理由を含む詳細なセキュリティログを記録しなければならない

**検証: 要件 7.3**

### プロパティ 16: ビルドプロセスログ記録

*任意の*ビルドプロセスの状態（開始、成功、失敗）に対して、システムは対応するログエントリと処理ユーザー数を記録しなければならない

**検証: 要件 8.1**

### プロパティ 17: 認証ログ記録

*任意の*認証試行（成功または失敗）に対して、システムはユーザー識別子、タイムスタンプ、結果を含むログエントリを記録しなければならない

**検証: 要件 8.2**

### プロパティ 18: リクエストメタデータログ記録

*任意の*Fargateで処理されるリクエストに対して、システムはユーザーID、リソースパス、レスポンスコードを含むメタデータをログに記録しなければならない

**検証: 要件 8.3**

### プロパティ 19: エラーログとアラート

*任意の*システムエラーに対して、エラーハンドラーは詳細なエラー情報をログに記録し、設定された閾値を超えた場合はアラートを発行しなければならない

**検証: 要件 8.4**

### プロパティ 20: IAM Identity Center APIログ記録

*任意の*IAM Identity Center API呼び出しに対して、システムはAPI呼び出しの結果（成功/失敗）と取得ユーザー数をログに記録しなければならない

**検証: 要件 8.5**

## エラーハンドリング

### エラーカテゴリ

1. **認証エラー**
   - JWT検証失敗
   - 無効なトークン形式
   - 期限切れトークン
   - 対応: 401 Unauthorized

2. **認可エラー**
   - ユーザーID不一致
   - 不正なユーザーリソースアクセス
   - 対応: 403 Forbidden

3. **リソースエラー**
   - S3オブジェクト不存在（ユーザーフォルダなし）
   - S3アクセスエラー
   - 対応: 404 Not Found または 500 Internal Server Error

4. **ビルドエラー**
   - IAM Identity Center API呼び出し失敗
   - ビルドプロセス失敗
   - S3同期失敗
   - 対応: ログ記録、リトライ、管理者通知、ビルドステータス更新

5. **システムエラー**
   - 予期しない例外
   - サービス利用不可
   - 対応: 500 Internal Server Error、詳細ログ、アラート

### エラーレスポンス形式

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "JWT検証に失敗しました",
    "details": "署名が無効です",
    "timestamp": "2024-01-21T12:00:00Z",
    "requestId": "req-12345"
  }
}
```

### リトライ戦略

- **IAM Identity Center API**: 指数バックオフで最大3回リトライ
- **S3アクセス**: 指数バックオフで最大3回リトライ
- **ビルドプロセス**: 一時的なエラーの場合、5分後に1回リトライ
- **ログ送信**: ローカルバッファリング、非同期送信

## テスト戦略

### ユニットテスト

各コンポーネントの個別機能を検証：

1. **IAM Identity Center統合**
   - ユーザー情報のパース
   - アカウント割り当て情報のパース
   - ユーザーアカウントマップの生成
   - エッジケース: 空のアカウント割り当て

2. **JWT処理**
   - 有効なJWTのデコード
   - 無効なJWTの拒否（エッジケース）
   - ユーザーID情報の抽出

3. **アクセス制御**
   - 正当なアクセスの許可
   - 不正なアクセスの拒否
   - エッジケース: ユーザーIDなし、空のユーザーID

4. **S3プロキシ**
   - 正しいS3キーの構築
   - ファイルストリーミング
   - エラーハンドリング（存在しないフォルダ）

5. **ビルドロジック**
   - ビルドジョブ生成
   - S3プレフィックス生成
   - データ分離の検証

6. **ロギング**
   - 各イベントタイプのログ記録
   - ログフォーマットの検証

### プロパティベーステスト

プロパティベーステストライブラリとして**fast-check**（Node.js）を使用します。

**設定要件:**
- 各プロパティテストは最低100回の反復を実行
- 各テストには設計ドキュメントのプロパティ番号を明示的に参照するコメントを含める
- タグ形式: `// Feature: multi-tenant-evidence-deployment, Property X: [プロパティテキスト]`

**テスト対象プロパティ:**

1. **プロパティ 1-20**: 上記の正確性プロパティセクションで定義されたすべてのプロパティ

**ジェネレーター戦略:**

```javascript
// ユーザーIDジェネレーター
const userIdGen = fc.stringOf(
  fc.constantFrom('a-z', '0-9', '-'),
  { minLength: 10, maxLength: 50 }
);

// アカウントIDジェネレーター（12桁の数字）
const accountIdGen = fc.stringOf(
  fc.integer({ min: 0, max: 9 }).map(n => n.toString()),
  { minLength: 12, maxLength: 12 }
);

// JWTペイロードジェネレーター
const jwtPayloadGen = fc.record({
  sub: userIdGen,
  email: fc.emailAddress(),
  exp: fc.integer({ min: Date.now() / 1000 + 3600 }),
  iat: fc.integer({ min: Date.now() / 1000 - 3600 })
});

// ファイルパスジェネレーター
const filePathGen = fc.stringOf(
  fc.constantFrom('a-z', '0-9', '/', '.', '-', '_'),
  { minLength: 1, maxLength: 100 }
);

// アカウント割り当てジェネレーター
const accountAssignmentGen = fc.record({
  accountId: accountIdGen,
  permissionSetArn: fc.constant('arn:aws:sso:::permissionSet/ssoins-xxx/ps-xxx'),
  principalType: fc.constant('USER'),
  principalId: userIdGen
});
```

**テスト例:**

```javascript
// Feature: multi-tenant-evidence-deployment, Property 14: アクセス制御
describe('Property 14: Access Control', () => {
  it('should allow access only to user\'s own resources', () => {
    fc.assert(
      fc.property(
        userIdGen,
        userIdGen,
        filePathGen,
        (authenticatedUserId, requestedUserId, filePath) => {
          const requestPath = `/user-${requestedUserId}/${filePath}`;
          const result = checkAccess(authenticatedUserId, requestPath);
          const shouldAllow = authenticatedUserId === requestedUserId;
          return result === shouldAllow;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 統合テスト

エンドツーエンドのフローを検証：

1. **認証フロー**: ALB → Cognito → Fargate（モック環境）
2. **ビルドパイプライン**: IAM Identity Center API → ビルド → S3同期（テスト環境）
3. **リクエスト処理**: JWT付きリクエスト → アクセス制御 → S3プロキシ → レスポンス

### テスト環境

- **ローカル開発**: LocalStack（S3、ECR）、モックJWT、モックIAM Identity Center API
- **CI/CD**: GitHub Actions、テスト用AWSアカウント
- **ステージング**: 本番同等の環境、実際のCognito統合、実際のIAM Identity Center

## セキュリティ考慮事項

### 認証・認可

- ALBでのCognito統合によるOIDC認証
- JWTの署名検証（ALB公開鍵使用）
- グループベースのアクセス制御
- セッション管理（Cognitoトークン有効期限）

### データ保護

- S3バケット暗号化（SSE-S3またはSSE-KMS）
- 転送中の暗号化（HTTPS/TLS 1.2+）
- 部署間のデータ分離（プレフィックスベース）
- IAMロールによる最小権限の原則

### ネットワークセキュリティ

- VPC内でのFargate実行
- セキュリティグループによるトラフィック制限
- ALBでのWAF統合（オプション）
- プライベートサブネットでのコンテナ実行

### 監査とコンプライアンス

- CloudWatch Logsへのすべてのアクセスログ記録
- セキュリティイベントの詳細ログ
- CloudTrailによるAPI呼び出し追跡
- ログの長期保存（コンプライアンス要件に応じて）

## パフォーマンス考慮事項

### スケーラビリティ

- Fargateの自動スケーリング（CPU/メモリ使用率ベース）
- ALBによる負荷分散
- S3の無制限スケーラビリティ
- CloudFront統合（オプション、静的コンテンツキャッシュ）

### レイテンシ最適化

- S3からのストリーミングレスポンス
- JWT検証のキャッシング（公開鍵）
- 接続プーリング（S3クライアント）
- 適切なタイムアウト設定

### コスト最適化

- Fargate Spotの活用（非本番環境）
- S3ライフサイクルポリシー（古いビルドの削除）
- CloudWatch Logsの保持期間設定
- 不要なログの削減

## デプロイメント戦略

### インフラストラクチャ

**推奨ツール**: AWS CDK（TypeScript）またはTerraform

**デプロイ順序:**
1. ネットワーク（VPC、サブネット、セキュリティグループ）
2. ストレージ（S3バケット、ECR）
3. アイデンティティ（Cognito、IAM Identity Center連携）
4. IAMロール（IAM Identity Center API読み取り権限含む）
5. コンピュート（Fargateクラスター、タスク定義）
6. ロードバランサー（ALB、ターゲットグループ、リスナー）
7. CI/CD（GitHub Actions設定、EventBridge スケジュール）

**IAM権限要件:**
- ビルドプロセス用IAMロール:
  - `identitystore:ListUsers`
  - `sso:ListAccountAssignments`
  - `sso:ListInstances`
  - `s3:PutObject`
  - `s3:PutObjectAcl`

### アプリケーション

**デプロイフロー:**
1. コードプッシュ → GitHub
2. イメージビルド → ECR
3. Fargateサービス更新（ローリングアップデート）
4. ヘルスチェック確認
5. 古いタスク終了

**ビルドスケジュール:**
- EventBridge（CloudWatch Events）で日次スケジュール設定
- GitHub Actions workflow_dispatch で手動トリガー可能

### ロールバック戦略

- ECRイメージタグによるバージョン管理
- Fargateサービスの以前のタスク定義へのロールバック
- S3バージョニングによるビルド成果物の復元
- IaCによるインフラの状態管理

## 監視とアラート

### メトリクス

- **Fargate**: CPU使用率、メモリ使用率、タスク数
- **ALB**: リクエスト数、レスポンスタイム、エラー率
- **S3**: リクエスト数、転送バイト数
- **IAM Identity Center API**: API呼び出し数、エラー率
- **ビルドプロセス**: ビルド成功率、処理ユーザー数、ビルド時間
- **カスタム**: 認証成功/失敗率、ユーザー別アクセス数

### アラート

- Fargateタスク異常終了
- ALBヘルスチェック失敗
- 認証エラー率の急増
- ビルド失敗
- IAM Identity Center API呼び出し失敗
- システムエラー率の閾値超過
- ユーザーフォルダ不存在エラーの急増

### ダッシュボード

- リアルタイムメトリクス表示
- ユーザー別アクセス統計
- エラー率トレンド
- ビルド成功率と処理ユーザー数
- IAM Identity Center API呼び出し統計

## 運用手順

### 新規ユーザーの追加

1. IAM Identity Centerで新規ユーザー作成
2. アカウント割り当てを設定
3. 次回の日次ビルドで自動的にユーザー専用ページが生成される
4. または手動でビルドをトリガー

### ユーザーのアカウント割り当て変更

1. IAM Identity Centerでアカウント割り当てを変更
2. 次回の日次ビルドで自動的に更新される
3. または手動でビルドをトリガー

### トラブルシューティング

- **認証失敗**: CloudWatch LogsでJWT検証ログ確認
- **アクセス拒否**: セキュリティログでユーザーID情報確認
- **ビルド失敗**: GitHub Actions/CodeBuildログ確認、IAM Identity Center API呼び出しログ確認
- **S3エラー**: IAMロール権限、バケットポリシー確認
- **ユーザーフォルダ不存在**: ビルドログ確認、該当ユーザーのビルドが成功しているか確認

### バックアップとリカバリ

- S3バージョニング有効化
- 定期的なインフラ設定のバックアップ（IaCコード）
- Cognitoユーザープールのエクスポート
- IAM Identity Center設定のドキュメント化
- ディザスタリカバリ計画の策定
