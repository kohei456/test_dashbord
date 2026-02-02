# 👥 Identity Centerユーザー一覧

このページでは、AWS Identity Centerに登録されているユーザーと、各ユーザーがアクセスできるアカウントを確認できます。

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

**ユーザー別ダッシュボードにアクセスするには、ユーザーIDを使用して `/user-{userId}/` のURLにアクセスしてください。**

## 📊 ユーザー別のアクセス可能アカウント数

```sql user_access_distribution
select 
    user_name,
    accessible_accounts_count
from identity_center.users
order by accessible_accounts_count desc
```

<BarChart 
    data={user_access_distribution}
    x=user_name
    y=accessible_accounts_count
    title="ユーザー別のアクセス可能アカウント数"
/>
