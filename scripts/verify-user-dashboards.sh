#!/bin/bash

# ユーザーダッシュボードの確認スクリプト

S3_BUCKET="evidence-app-evidence-dashbord-905418291155"
CLOUDFRONT_ID="E1YGX36GS1KSH5"
REGION="ap-northeast-1"

echo "=== ユーザーダッシュボードの確認 ==="
echo ""

# CloudFrontドメイン名を取得
echo "1. CloudFrontドメイン名を取得中..."
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
  --id ${CLOUDFRONT_ID} \
  --query 'Distribution.DomainName' \
  --output text \
  --region ${REGION})

echo "   CloudFrontドメイン: ${CLOUDFRONT_DOMAIN}"
echo ""

# S3バケット内のユーザーディレクトリを確認
echo "2. S3バケット内のユーザーディレクトリを確認中..."
USER_DIRS=$(aws s3 ls s3://${S3_BUCKET}/ | grep "PRE user-" | awk '{print $2}' | sed 's/\///')

if [ -z "$USER_DIRS" ]; then
  echo "   ✗ ユーザーディレクトリが見つかりませんでした"
  exit 1
fi

USER_COUNT=$(echo "$USER_DIRS" | wc -l)
echo "   ✓ ${USER_COUNT}個のユーザーディレクトリが見つかりました"
echo ""

# 各ユーザーディレクトリの内容を確認
echo "3. 各ユーザーディレクトリの内容を確認中..."
echo ""

for USER_DIR in $USER_DIRS; do
  echo "--- ${USER_DIR} ---"
  
  # index.htmlの存在確認
  if aws s3 ls s3://${S3_BUCKET}/${USER_DIR}/index.html > /dev/null 2>&1; then
    echo "   ✓ index.html が存在します"
  else
    echo "   ✗ index.html が見つかりません"
  fi
  
  # ファイル数を確認
  FILE_COUNT=$(aws s3 ls s3://${S3_BUCKET}/${USER_DIR}/ --recursive | wc -l)
  echo "   ファイル数: ${FILE_COUNT}"
  
  # アクセスURL
  echo "   アクセスURL: https://${CLOUDFRONT_DOMAIN}/${USER_DIR}/"
  
  # HTTPステータスコードを確認
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${CLOUDFRONT_DOMAIN}/${USER_DIR}/")
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✓ HTTPステータス: ${HTTP_STATUS} (正常にアクセス可能)"
  else
    echo "   ✗ HTTPステータス: ${HTTP_STATUS} (アクセスできません)"
  fi
  
  echo ""
done

echo "=== 確認完了 ==="
echo ""
echo "ブラウザで以下のURLにアクセスして、ダッシュボードを確認してください："
echo ""

for USER_DIR in $USER_DIRS; do
  echo "  https://${CLOUDFRONT_DOMAIN}/${USER_DIR}/"
done

echo ""
echo "注意: CloudFrontのキャッシュにより、最新の内容が反映されるまで時間がかかる場合があります。"
echo "キャッシュをクリアする場合は以下のコマンドを実行してください："
echo ""
echo "  aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_ID} --paths '/*' --region ${REGION}"
