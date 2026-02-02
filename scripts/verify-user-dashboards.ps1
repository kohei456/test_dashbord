# ユーザーダッシュボードの確認スクリプト

$S3_BUCKET = "evidence-app-evidence-dashbord-905418291155"
$CLOUDFRONT_ID = "E1YGX36GS1KSH5"
$REGION = "ap-northeast-1"

Write-Host "=== ユーザーダッシュボードの確認 ===" -ForegroundColor Cyan
Write-Host ""

# CloudFrontドメイン名を取得
Write-Host "1. CloudFrontドメイン名を取得中..."
$CLOUDFRONT_DOMAIN = aws cloudfront get-distribution `
  --id $CLOUDFRONT_ID `
  --query 'Distribution.DomainName' `
  --output text `
  --region $REGION

Write-Host "   CloudFrontドメイン: $CLOUDFRONT_DOMAIN"
Write-Host ""

# S3バケット内のユーザーディレクトリを確認
Write-Host "2. S3バケット内のユーザーディレクトリを確認中..."
$S3_OUTPUT = aws s3 ls "s3://$S3_BUCKET/" | Select-String "PRE user-"

if (-not $S3_OUTPUT) {
  Write-Host "   ✗ ユーザーディレクトリが見つかりませんでした" -ForegroundColor Red
  exit 1
}

$USER_DIRS = $S3_OUTPUT | ForEach-Object {
  $_.ToString().Trim() -replace '.*PRE\s+', '' -replace '/', ''
}

$USER_COUNT = $USER_DIRS.Count
Write-Host "   ✓ $USER_COUNT 個のユーザーディレクトリが見つかりました" -ForegroundColor Green
Write-Host ""

# 各ユーザーディレクトリの内容を確認
Write-Host "3. 各ユーザーディレクトリの内容を確認中..."
Write-Host ""

foreach ($USER_DIR in $USER_DIRS) {
  Write-Host "--- $USER_DIR ---" -ForegroundColor Yellow
  
  # index.htmlの存在確認
  $INDEX_CHECK = aws s3 ls "s3://$S3_BUCKET/$USER_DIR/index.html" 2>$null
  if ($INDEX_CHECK) {
    Write-Host "   ✓ index.html が存在します" -ForegroundColor Green
  } else {
    Write-Host "   ✗ index.html が見つかりません" -ForegroundColor Red
  }
  
  # ファイル数を確認
  $FILE_COUNT = (aws s3 ls "s3://$S3_BUCKET/$USER_DIR/" --recursive | Measure-Object).Count
  Write-Host "   ファイル数: $FILE_COUNT"
  
  # アクセスURL
  $ACCESS_URL = "https://$CLOUDFRONT_DOMAIN/$USER_DIR/"
  Write-Host "   アクセスURL: $ACCESS_URL"
  
  # HTTPステータスコードを確認
  try {
    $response = Invoke-WebRequest -Uri $ACCESS_URL -Method Head -UseBasicParsing -ErrorAction SilentlyContinue
    $HTTP_STATUS = $response.StatusCode
    if ($HTTP_STATUS -eq 200) {
      Write-Host "   ✓ HTTPステータス: $HTTP_STATUS (正常にアクセス可能)" -ForegroundColor Green
    } else {
      Write-Host "   ✗ HTTPステータス: $HTTP_STATUS (アクセスできません)" -ForegroundColor Red
    }
  } catch {
    Write-Host "   ✗ HTTPステータス: エラー (アクセスできません)" -ForegroundColor Red
  }
  
  Write-Host ""
}

Write-Host "=== 確認完了 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "ブラウザで以下のURLにアクセスして、ダッシュボードを確認してください："
Write-Host ""

foreach ($USER_DIR in $USER_DIRS) {
  Write-Host "  https://$CLOUDFRONT_DOMAIN/$USER_DIR/" -ForegroundColor White
}

Write-Host ""
Write-Host "注意: CloudFrontのキャッシュにより、最新の内容が反映されるまで時間がかかる場合があります。"
Write-Host "キャッシュをクリアする場合は以下のコマンドを実行してください："
Write-Host ""
Write-Host "  aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths '/*' --region $REGION" -ForegroundColor Yellow
