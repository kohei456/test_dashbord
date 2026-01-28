# 👥 ユーザーダッシュボード一覧

各ユーザー専用のダッシュボードにアクセスできます。

```sql user_list
select 
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
</DataTable>

## 📝 アクセス方法

各ユーザーのダッシュボードにアクセスするには、以下のURL形式を使用してください：

```
https://your-cloudfront-domain.cloudfront.net/user-{userId}/
```

例：
- ユーザーID `12345678-1234-1234-1234-123456789012` の場合
- URL: `https://your-cloudfront-domain.cloudfront.net/user-12345678-1234-1234-1234-123456789012/`

## 🔐 セキュリティについて

現在、認証機能は実装されていません。フェーズ3で以下の機能が追加される予定です：

- ALB + Cognito + IAM Identity Center連携
- JWT検証とユーザーID抽出
- ユーザー別アクセス制御
