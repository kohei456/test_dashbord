# 👥 ユーザーダッシュボード一覧

各ユーザー専用のダッシュボードにアクセスできます。

```sql user_list
select 
    user_id,
    user_name,
    display_name,
    email,
    accessible_accounts_count
from identity_center.users
order by user_name
```

## ユーザー一覧

各ユーザーのダッシュボードは、`/user-{userId}/` のURLでアクセスできます。

<DataTable 
    data={user_list}
    search=true
>
    <Column id=user_name title="ユーザー名"/>
    <Column id=display_name title="表示名"/>
    <Column id=email title="メールアドレス"/>
    <Column id=accessible_accounts_count title="アクセス可能アカウント数"/>
    <Column id=user_id title="ユーザーID"/>
</DataTable>

## 📝 アクセス方法

各ユーザーのダッシュボードにアクセスするには、ブラウザのアドレスバーに以下のURL形式を入力してください：

```
https://your-cloudfront-domain.cloudfront.net/user-{userId}/
```

**手順：**
1. 上記のテーブルから、アクセスしたいユーザーの「ユーザーID」をコピー
2. ブラウザのアドレスバーに `https://your-cloudfront-domain.cloudfront.net/user-{コピーしたユーザーID}/` を入力
3. Enterキーを押してアクセス

例：
- ユーザーID `97943a18-7031-7092-f256-e614c146f15d` の場合
- URL: `https://your-cloudfront-domain.cloudfront.net/user-97943a18-7031-7092-f256-e614c146f15d/`

## 🔐 セキュリティについて

現在、認証機能は実装されていません。フェーズ3で以下の機能が追加される予定です：

- ALB + Cognito + IAM Identity Center連携
- JWT検証とユーザーID抽出
- ユーザー別アクセス制御
