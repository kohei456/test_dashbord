---
title: Welcome to Evidence
---

# 🎉 Evidenceダッシュボードへようこそ

このサイトは、AWS CodeBuild + S3 + CloudFrontでデプロイされています。

## 📊 利用可能なダッシュボード

- [👥 ユーザーダッシュボード一覧](/user-list) - 各ユーザー専用のダッシュボード（ユーザー別S3プレフィックス）
- [�  ユーザー一覧](/users) - Identity Centerユーザー情報
- [� アカウント一覧]ド(/accounts) - AWSアカウント別のセキュリティ検出結果
- [📊 全体ダッシュボード](/test_data) - すべてのアカウントの検出結果を統合表示

## 🏗️ アーキテクチャ

### フェーズ2（現在）: ユーザー別ビルド

- ✅ Identity Centerからユーザー情報を取得
- ✅ ユーザー毎に専用ディレクトリを作成（`user-{userId}/`）
- ✅ S3にユーザー別プレフィックスでアップロード
- ⏳ 認証・認可機能（フェーズ3で実装予定）

### 次のステップ（フェーズ3）

- ALB + Cognito + IAM Identity Center連携
- JWT検証とユーザーID抽出
- Fargateでのユーザー別ルーティング
- アクセス制御

---

## 👥 Identity Centerユーザー

各ユーザーがアクセスできるアカウントの検出結果のみを表示します。

```sql top_users
select 
    user_id,
    user_name,
    display_name,
    accessible_accounts_count,
    '/user-' || user_id || '/' as dashboard_link
from identity_center.users
order by accessible_accounts_count desc
limit 5
```

### アクセス可能アカウントが多いユーザー（トップ5）

<DataTable 
    data={top_users}
    link=dashboard_link
>
    <Column id=user_name title="ユーザー名"/>
    <Column id=display_name title="表示名"/>
    <Column id=accessible_accounts_count title="アクセス可能アカウント数"/>
    <Column id=dashboard_link title="ダッシュボード" contentType=link linkLabel="詳細を見る"/>
</DataTable>

---

## 🔐 アカウント別ダッシュボード

各AWSアカウントの検出結果を個別に確認できます。

```sql top_accounts
select 
    account_id,
    finding_count,
    '/account/' || account_id as dashboard_link
from opensearch_data.accounts
order by finding_count desc
limit 5
```

### 検出結果が多いアカウント（トップ5）

<DataTable 
    data={top_accounts}
    link=dashboard_link
>
    <Column id=account_id title="アカウントID"/>
    <Column id=finding_count title="検出結果数"/>
    <Column id=dashboard_link title="ダッシュボード" contentType=link linkLabel="詳細を見る"/>
</DataTable>

## What's Next?
- [Connect your data sources](settings)
- Edit/add markdown files in the `pages` folder
- Deploy your project with [Evidence Cloud](https://evidence.dev/cloud)

## Get Support
- Message us on [Slack](https://slack.evidence.dev/)
- Read the [Docs](https://docs.evidence.dev/)
- Open an issue on [Github](https://github.com/evidence-dev/evidence)
