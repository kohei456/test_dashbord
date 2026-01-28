# フェーズ2実装ガイド: ユーザー別ビルド

## 概要

フェーズ2では、Identity Centerのユーザー情報に基づいて、ユーザー毎に専用の静的ページを生成し、S3の`user-{userId}/`プレフィックスに格納します。

## アーキテクチャ

```
[Identity Center API]
    ↓ (ユーザー情報とアカウント割り当て取得)
[CodeBuild]
    ↓ (ユーザー毎にビルド)
[S3: user-{userId1}/, user-{userId2}/, ...]
    ↓
[CloudFront]
    ↓
[ユーザー]
```

## 実装内容

### 1. ユーザー別ビルドスクリプト

`scripts/build-user-reports.js`が以下を実行します：

1. Identity Center APIからユーザー一覧を取得
2. 各ユーザーのアカウント割り当てを取得
3. ユーザー毎にEvidenceをビルド
4. `build-users/user-{userId}/`にビルド結果を保存

### 2. buildspec.yml の更新

- `npm run build:users`でユーザー別ビルドを実行
- 各ユーザーディレクトリを`s3://{bucket}/user-{userId}/`にアップロード

### 3. S3バケット構造

```
s3://evidence-app-website-{account-id}/
├── user-12345678-1234-1234-1234-123456789012/
│   ├── index.html
│   ├── user/
│   │   └── john.doe/
│   │       └── index.html
│   └── _app/
├── user-87654321-4321-4321-4321-210987654321/
│   ├── index.html
│   ├── user/
│   │   └── jane.smith/
│   │       └── index.html
│   └── _app/
└── index.html (共通ホームページ)
```

## デプロイ手順

### 前提条件

- Identity Store IDとSSO Instance ARNがParameter Storeに保存されていること
- CodeBuildのIAMロールにIdentity Center API読み取り権限があること

### 1. 変更をコミット＆プッシュ

```bash
git add .
git commit -m "Implement Phase 2: User-specific builds"
git push origin main
```

### 2. CodeBuildのIAMロールに権限を追加

CloudFormationテンプレートに以下の権限が含まれていることを確認：

```yaml
- Effect: Allow
  Action:
    - 'identitystore:ListUsers'
    - 'sso:ListAccountAssignments'
    - 'sso:ListInstances'
    - 'sso:ListPermissionSets'
    - 'organizations:ListAccounts'
  Resource: '*'
```

### 3. CloudFormationスタックを更新

```bash
aws cloudformation update-stack \
  --stack-name evidence-deployment \
  --template-body file://cloudformation/evidence-deployment.yaml \
  --parameters \
    ParameterKey=ProjectName,ParameterValue=evidence-app \
    ParameterKey=GitHubRepo,ParameterValue=https://github.com/kohei456/test_dashbord \
    ParameterKey=GitHubBranch,ParameterValue=main \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-northeast-1
```

### 4. CodeBuildを実行

```bash
aws codebuild start-build \
  --project-name evidence-app-build \
  --region ap-northeast-1
```

## アクセス方法

### ユーザー別ダッシュボード

各ユーザーのダッシュボードは以下のURLでアクセスできます：

```
https://{cloudfront-domain}/user-{userId}/
```

例：
```
https://d1234567890abc.cloudfront.net/user-12345678-1234-1234-1234-123456789012/
```

### ユーザーIDの確認方法

1. ホームページにアクセス: `https://{cloudfront-domain}/`
2. 「ユーザーダッシュボード一覧」をクリック
3. ユーザー一覧からユーザーIDを確認

または、CloudShellで以下のコマンドを実行：

```bash
aws identitystore list-users \
  --identity-store-id d-xxxxxxxxxx \
  --region ap-northeast-1
```

## トラブルシューティング

### ビルドが失敗する

**症状**: CodeBuildでビルドが失敗する

**原因と対処**:

1. **Identity Center API権限不足**
   ```bash
   # IAMロールに権限を追加
   aws iam attach-role-policy \
     --role-name evidence-app-codebuild-role \
     --policy-arn arn:aws:iam::aws:policy/AWSSSOReadOnly
   ```

2. **Parameter Store設定不足**
   ```bash
   # 設定を確認
   aws ssm get-parameter --name /evidence/identity-store-id --region ap-northeast-1
   aws ssm get-parameter --name /evidence/sso-instance-arn --region ap-northeast-1
   ```

3. **メモリ不足**
   - CloudFormationテンプレートで`BUILD_GENERAL1_LARGE`に変更

### ユーザーディレクトリが作成されない

**症状**: S3にユーザーディレクトリが作成されない

**原因と対処**:

1. **ユーザーにアカウント割り当てがない**
   - Identity Centerでアカウント割り当てを確認

2. **ビルドスクリプトのエラー**
   - CodeBuildログを確認
   - `npm run build:users`をローカルで実行してテスト

### CloudFrontで404エラー

**症状**: ユーザーディレクトリにアクセスすると404エラー

**原因と対処**:

1. **S3にファイルがアップロードされていない**
   ```bash
   # S3バケットの内容を確認
   aws s3 ls s3://evidence-app-website-{account-id}/user- --recursive
   ```

2. **CloudFrontのキャッシュ**
   ```bash
   # キャッシュを無効化
   aws cloudfront create-invalidation \
     --distribution-id {distribution-id} \
     --paths "/*"
   ```

## 次のステップ（フェーズ3）

フェーズ3では、認証・認可機能を実装します：

1. **ALB + Cognito統合**
   - Cognitoユーザープール作成
   - Identity Center連携設定
   - ALBでOIDC認証設定

2. **Fargateコンテナ**
   - JWT検証ミドルウェア
   - ユーザーID抽出
   - S3プロキシ機能
   - アクセス制御

3. **ECRコンテナイメージ**
   - Dockerfileの作成
   - イメージビルドパイプライン
   - Fargateへのデプロイ

## 参考資料

- [AWS Identity Center API Reference](https://docs.aws.amazon.com/singlesignon/latest/APIReference/)
- [Evidence Documentation](https://docs.evidence.dev/)
- [AWS CodeBuild Documentation](https://docs.aws.amazon.com/codebuild/)
