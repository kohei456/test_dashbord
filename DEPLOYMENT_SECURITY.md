# デプロイメントセキュリティガイド

## 🔐 必須のセキュリティ対策

### 1. 環境変数の保護
- `.env`ファイルは絶対にGitにコミットしない
- デプロイ先の環境変数管理機能を使用する
- OpenSearchの認証情報は暗号化して保存

### 2. 静的ビルドの利用
```bash
npm run build
```
- ビルド時にデータを取得して静的化
- 本番環境でOpenSearchに直接接続しない
- 認証情報が含まれない

### 3. アクセス制御
- 認証機能を必ず追加する
- IPアドレス制限を設定する
- VPN経由でのみアクセス可能にする

### 4. データの定期更新
静的ビルドの場合、データを定期的に更新する仕組みが必要：

```yaml
# GitHub Actions例
name: Update Dashboard
on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間ごと
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run sources
        env:
          EVIDENCE_OPENSEARCH_ENDPOINT: ${{ secrets.OPENSEARCH_ENDPOINT }}
          EVIDENCE_OPENSEARCH_INDEX: ${{ secrets.OPENSEARCH_INDEX }}
          EVIDENCE_OPENSEARCH_USERNAME: ${{ secrets.OPENSEARCH_USERNAME }}
          EVIDENCE_OPENSEARCH_PASSWORD: ${{ secrets.OPENSEARCH_PASSWORD }}
      - run: npm run build
      - name: Deploy to S3
        run: aws s3 sync build/ s3://your-bucket-name/
```

## 📋 推奨デプロイ方法の比較

| 方法 | セキュリティ | コスト | 難易度 | 推奨度 |
|------|------------|--------|--------|--------|
| AWS S3 + CloudFront + Cognito | ⭐⭐⭐⭐⭐ | 中 | 中 | ⭐⭐⭐⭐⭐ |
| Evidence Cloud | ⭐⭐⭐⭐⭐ | 高 | 低 | ⭐⭐⭐⭐ |
| Vercel + Auth | ⭐⭐⭐⭐ | 低〜中 | 低 | ⭐⭐⭐⭐ |
| Netlify + Identity | ⭐⭐⭐⭐ | 低 | 低 | ⭐⭐⭐⭐ |
| セルフホスティング | ⭐⭐⭐ | 低 | 高 | ⭐⭐⭐ |

## ⚠️ 注意事項

1. **機密データの確認**
   - ダッシュボードに表示されるデータに機密情報が含まれていないか確認
   - 必要に応じてデータをマスキング

2. **アクセスログの監視**
   - 誰がいつアクセスしたか記録
   - 不正アクセスを検知

3. **定期的なセキュリティレビュー**
   - 認証情報の定期的な更新
   - アクセス権限の見直し
