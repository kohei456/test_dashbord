#!/bin/bash

# AWS Systems Manager Parameter Storeに環境変数を保存するスクリプト

set -e

AWS_REGION="${AWS_REGION:-ap-northeast-1}"

echo "Parameter Storeに環境変数を保存します..."

# OpenSearchエンドポイント
aws ssm put-parameter \
  --name "/evidence/opensearch-endpoint" \
  --value "https://search-test-kr-pipeline-0528-x5so4yxiovvvlqofzxqpbx24s4.ap-northeast-1.es.amazonaws.com" \
  --type "String" \
  --region "$AWS_REGION" \
  --overwrite

# OpenSearchインデックス
aws ssm put-parameter \
  --name "/evidence/opensearch-index" \
  --value "config-detection_finding-ocsf-cuid-2004-365day-meta-scan" \
  --type "String" \
  --region "$AWS_REGION" \
  --overwrite

# OpenSearchユーザー名
aws ssm put-parameter \
  --name "/evidence/opensearch-username" \
  --value "test" \
  --type "String" \
  --region "$AWS_REGION" \
  --overwrite

# OpenSearchパスワード（SecureString）
echo "OpenSearchパスワードを入力してください:"
read -s OPENSEARCH_PASSWORD

aws ssm put-parameter \
  --name "/evidence/opensearch-password" \
  --value "$OPENSEARCH_PASSWORD" \
  --type "SecureString" \
  --region "$AWS_REGION" \
  --overwrite

# SSL検証設定
aws ssm put-parameter \
  --name "/evidence/opensearch-ssl-verify" \
  --value "false" \
  --type "String" \
  --region "$AWS_REGION" \
  --overwrite

# Identity Store ID
echo "Identity Store IDを入力してください（例: d-1234567890）:"
read IDENTITY_STORE_ID

aws ssm put-parameter \
  --name "/evidence/identity-store-id" \
  --value "$IDENTITY_STORE_ID" \
  --type "String" \
  --region "$AWS_REGION" \
  --overwrite

# SSO Instance ARN
echo "SSO Instance ARNを入力してください（例: arn:aws:sso:::instance/ssoins-1234567890abcdef）:"
read SSO_INSTANCE_ARN

aws ssm put-parameter \
  --name "/evidence/sso-instance-arn" \
  --value "$SSO_INSTANCE_ARN" \
  --type "String" \
  --region "$AWS_REGION" \
  --overwrite

echo "完了しました！"
echo ""
echo "次に、CloudFormationテンプレートを更新してCodeBuildに環境変数を追加してください。"
