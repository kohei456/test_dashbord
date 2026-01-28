# クイックスタートガイド

## 簡単デプロイ（推奨）

デプロイスクリプトを使用する場合：

```bash
# スクリプトに実行権限を付与（Linux/Mac）
chmod +x scripts/deploy.sh

# デプロイを実行
./scripts/deploy.sh evidence-deployment my-evidence-app https://github.com/username/repo main
```

## 手動デプロイ

### ステップ1: CloudFormationスタックを作成

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

### ステップ2: スタックの作成完了を待つ

```bash
aws cloudformation wait stack-create-complete \
  --stack-name evidence-deployment \
  --region ap-northeast-1
```

### ステップ3: WebサイトURLを取得

```bash
aws cloudformation describe-stacks \
  --stack-name evidence-deployment \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
  --output text \
  --region ap-northeast-1
```

### ステップ4: ビルドを実行

```bash
# CodeBuildプロジェクト名を取得
PROJECT_NAME=$(aws cloudformation describe-stacks \
  --stack-name evidence-deployment \
  --query 'Stacks[0].Outputs[?OutputKey==`CodeBuildProjectName`].OutputValue' \
  --output text \
  --region ap-northeast-1)

# ビルドを開始
aws codebuild start-build \
  --project-name $PROJECT_NAME \
  --region ap-northeast-1
```

## 作成されるリソース

- **S3バケット**: 静的ファイルの保存
- **CloudFront**: CDN配信（HTTPS対応）
- **CodeBuild**: ビルドパイプライン
- **IAMロール**: CodeBuildの実行権限

## 環境変数の追加

データベース接続情報などを追加する場合：

```bash
# Parameter Storeに保存（機密情報）
aws ssm put-parameter \
  --name "/evidence/opensearch-url" \
  --value "https://your-opensearch-endpoint" \
  --type "SecureString" \
  --region ap-northeast-1

# CodeBuildプロジェクトを更新
aws codebuild update-project \
  --name my-evidence-app-build \
  --environment file://codebuild-env.json \
  --region ap-northeast-1
```

`codebuild-env.json`の例：
```json
{
  "type": "LINUX_CONTAINER",
  "computeType": "BUILD_GENERAL1_SMALL",
  "image": "aws/codebuild/standard:7.0",
  "environmentVariables": [
    {
      "name": "OPENSEARCH_URL",
      "value": "/evidence/opensearch-url",
      "type": "PARAMETER_STORE"
    },
    {
      "name": "NODE_ENV",
      "value": "production",
      "type": "PLAINTEXT"
    }
  ]
}
```

## 自動デプロイの設定

GitHubへのプッシュで自動ビルド：

```bash
aws codebuild create-webhook \
  --project-name my-evidence-app-build \
  --filter-groups "[[{\"type\":\"EVENT\",\"pattern\":\"PUSH\"},{\"type\":\"HEAD_REF\",\"pattern\":\"^refs/heads/main$\"}]]" \
  --region ap-northeast-1
```

## よくある質問

### Q: ビルド時間はどのくらいですか？
A: 通常3-5分程度です。初回は依存関係のインストールに時間がかかります。

### Q: コストはどのくらいですか？
A: 小規模サイトで月額$5-10程度です。主にCloudFrontのデータ転送費用です。

### Q: カスタムドメインは使えますか？
A: はい。Route 53とACMを使用して設定できます。詳細は`DEPLOYMENT.md`を参照してください。

### Q: プライベートリポジトリでも使えますか？
A: はい。GitHub Personal Access Tokenを`GitHubToken`パラメータに指定してください。

## トラブルシューティング

ビルドが失敗する場合：

```bash
# 最新のビルドIDを取得
BUILD_ID=$(aws codebuild list-builds-for-project \
  --project-name my-evidence-app-build \
  --query 'ids[0]' \
  --output text \
  --region ap-northeast-1)

# ビルドログを確認
aws codebuild batch-get-builds \
  --ids $BUILD_ID \
  --region ap-northeast-1
```

## リソースの削除

```bash
# S3バケットを空にする
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name evidence-deployment \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucketName`].OutputValue' \
  --output text \
  --region ap-northeast-1)

aws s3 rm s3://$BUCKET_NAME/ --recursive --region ap-northeast-1

# スタックを削除
aws cloudformation delete-stack \
  --stack-name evidence-deployment \
  --region ap-northeast-1
```

詳細なドキュメントは`DEPLOYMENT.md`を参照してください。
