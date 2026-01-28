# Evidenceアプリケーションのデプロイメントガイド

このガイドでは、EvidenceアプリケーションをAWS CodeBuildを使用してビルドし、S3 + CloudFrontで静的サイトとしてホスティングする方法を説明します。

## アーキテクチャ概要

```
GitHub → CodeBuild → S3 → CloudFront → ユーザー
```

- **CodeBuild**: Evidenceアプリケーションをビルド
- **S3**: 静的ファイルを保存
- **CloudFront**: CDNとして配信（HTTPS対応）

## 前提条件

- AWSアカウント
- AWS CLI設定済み
- GitHubリポジトリ（コードがプッシュされている）
- GitHub Personal Access Token（プライベートリポジトリの場合）

## デプロイ手順

### 1. CloudFormationスタックのデプロイ

```bash
aws cloudformation create-stack \
  --stack-name evidence-deployment \
  --template-body file://cloudformation/evidence-deployment.yaml \
  --parameters \
    ParameterKey=ProjectName,ParameterValue=my-evidence-app \
    ParameterKey=GitHubRepo,ParameterValue=https://github.com/username/repo \
    ParameterKey=GitHubBranch,ParameterValue=main \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-northeast-1
```

プライベートリポジトリの場合：

```bash
aws cloudformation create-stack \
  --stack-name evidence-deployment \
  --template-body file://cloudformation/evidence-deployment.yaml \
  --parameters \
    ParameterKey=ProjectName,ParameterValue=my-evidence-app \
    ParameterKey=GitHubRepo,ParameterValue=https://github.com/username/repo \
    ParameterKey=GitHubBranch,ParameterValue=main \
    ParameterKey=GitHubToken,ParameterValue=ghp_xxxxxxxxxxxx \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-northeast-1
```

### 2. スタックの作成を確認

```bash
aws cloudformation describe-stacks \
  --stack-name evidence-deployment \
  --query 'Stacks[0].StackStatus' \
  --region ap-northeast-1
```

`CREATE_COMPLETE`になるまで待ちます（約5-10分）。

### 3. 出力値を取得

```bash
aws cloudformation describe-stacks \
  --stack-name evidence-deployment \
  --query 'Stacks[0].Outputs' \
  --region ap-northeast-1
```

以下の情報が表示されます：
- **WebsiteURL**: CloudFrontのURL（これがあなたのサイトのURL）
- **CodeBuildProjectName**: CodeBuildプロジェクト名
- **WebsiteBucketName**: S3バケット名

### 4. 初回ビルドの実行

```bash
aws codebuild start-build \
  --project-name my-evidence-app-build \
  --region ap-northeast-1
```

### 5. ビルドステータスの確認

```bash
aws codebuild batch-get-builds \
  --ids <build-id> \
  --region ap-northeast-1
```

または、AWSコンソールのCodeBuildページで確認できます。

## 環境変数の設定

データソース接続情報などの環境変数が必要な場合、CodeBuildプロジェクトに追加します：

```bash
aws codebuild update-project \
  --name my-evidence-app-build \
  --environment "type=LINUX_CONTAINER,computeType=BUILD_GENERAL1_SMALL,image=aws/codebuild/standard:7.0,environmentVariables=[{name=DATABASE_URL,value=your-value,type=PLAINTEXT}]" \
  --region ap-northeast-1
```

機密情報の場合は、AWS Systems Manager Parameter Storeを使用：

```bash
# Parameter Storeに保存
aws ssm put-parameter \
  --name "/evidence/database-url" \
  --value "your-secret-value" \
  --type "SecureString" \
  --region ap-northeast-1

# CodeBuildで参照
aws codebuild update-project \
  --name my-evidence-app-build \
  --environment "type=LINUX_CONTAINER,computeType=BUILD_GENERAL1_SMALL,image=aws/codebuild/standard:7.0,environmentVariables=[{name=DATABASE_URL,value=/evidence/database-url,type=PARAMETER_STORE}]" \
  --region ap-northeast-1
```

## 自動デプロイの設定（オプション）

GitHubにプッシュしたときに自動的にビルドするには、CodeBuildのWebhookを設定します：

```bash
aws codebuild create-webhook \
  --project-name my-evidence-app-build \
  --filter-groups "[[{\"type\":\"EVENT\",\"pattern\":\"PUSH\"},{\"type\":\"HEAD_REF\",\"pattern\":\"^refs/heads/main$\"}]]" \
  --region ap-northeast-1
```

## カスタムドメインの設定（オプション）

Route 53とACMを使用してカスタムドメインを設定できます：

1. ACMで証明書を作成（us-east-1リージョン）
2. CloudFrontディストリビューションに証明書を追加
3. Route 53でAレコード（エイリアス）を作成

## トラブルシューティング

### ビルドが失敗する場合

1. CodeBuildのログを確認：
   ```bash
   aws codebuild batch-get-builds --ids <build-id> --region ap-northeast-1
   ```

2. CloudWatch Logsで詳細を確認

### S3にファイルがアップロードされない場合

- CodeBuildのIAMロールにS3への書き込み権限があるか確認
- buildspec.ymlの`S3_BUCKET`環境変数が正しく設定されているか確認

### CloudFrontで404エラーが出る場合

- S3バケットにファイルがアップロードされているか確認
- CloudFrontのキャッシュを無効化してみる

## コスト見積もり

- **S3**: 約$0.023/GB/月（ストレージ）
- **CloudFront**: 約$0.085/GB（データ転送）
- **CodeBuild**: 約$0.005/分（ビルド時間）

小規模なサイトの場合、月額$5-10程度です。

## クリーンアップ

リソースを削除する場合：

```bash
# S3バケットを空にする
aws s3 rm s3://my-evidence-app-website-<account-id>/ --recursive --region ap-northeast-1

# CloudFormationスタックを削除
aws cloudformation delete-stack \
  --stack-name evidence-deployment \
  --region ap-northeast-1
```

## 参考リンク

- [Evidence Documentation](https://docs.evidence.dev/)
- [AWS CodeBuild Documentation](https://docs.aws.amazon.com/codebuild/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
