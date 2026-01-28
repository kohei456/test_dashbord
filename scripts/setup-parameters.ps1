# AWS Systems Manager Parameter Storeに環境変数を保存するスクリプト

$ErrorActionPreference = "Stop"

$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-northeast-1" }

Write-Host "Parameter Storeに環境変数を保存します..." -ForegroundColor Green
Write-Host "リージョン: $AWS_REGION" -ForegroundColor Cyan
Write-Host ""

# OpenSearchエンドポイント
Write-Host "OpenSearchエンドポイントを保存中..." -ForegroundColor Yellow
aws ssm put-parameter `
  --name "/evidence/opensearch-endpoint" `
  --value "https://search-test-kr-pipeline-0528-x5so4yxiovvvlqofzxqpbx24s4.ap-northeast-1.es.amazonaws.com" `
  --type "String" `
  --region $AWS_REGION `
  --overwrite

# OpenSearchインデックス
Write-Host "OpenSearchインデックスを保存中..." -ForegroundColor Yellow
aws ssm put-parameter `
  --name "/evidence/opensearch-index" `
  --value "config-detection_finding-ocsf-cuid-2004-365day-meta-scan" `
  --type "String" `
  --region $AWS_REGION `
  --overwrite

# OpenSearchユーザー名
Write-Host "OpenSearchユーザー名を保存中..." -ForegroundColor Yellow
aws ssm put-parameter `
  --name "/evidence/opensearch-username" `
  --value "test" `
  --type "String" `
  --region $AWS_REGION `
  --overwrite

# OpenSearchパスワード（SecureString）
Write-Host "OpenSearchパスワードを保存中..." -ForegroundColor Yellow
$OPENSEARCH_PASSWORD = "71614549Aa&"
aws ssm put-parameter `
  --name "/evidence/opensearch-password" `
  --value $OPENSEARCH_PASSWORD `
  --type "SecureString" `
  --region $AWS_REGION `
  --overwrite

# SSL検証設定
Write-Host "SSL検証設定を保存中..." -ForegroundColor Yellow
aws ssm put-parameter `
  --name "/evidence/opensearch-ssl-verify" `
  --value "false" `
  --type "String" `
  --region $AWS_REGION `
  --overwrite

Write-Host ""
Write-Host "完了しました！" -ForegroundColor Green
Write-Host ""
Write-Host "保存されたパラメータ:" -ForegroundColor Cyan
Write-Host "  - /evidence/opensearch-endpoint"
Write-Host "  - /evidence/opensearch-index"
Write-Host "  - /evidence/opensearch-username"
Write-Host "  - /evidence/opensearch-password (SecureString)"
Write-Host "  - /evidence/opensearch-ssl-verify"
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Yellow
Write-Host "1. 変更をGitにコミット＆プッシュ"
Write-Host "2. CloudFormationスタックを更新"
Write-Host "3. CodeBuildを再実行"
