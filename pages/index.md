---
title: マイダッシュボード
---

# あなたがアクセスできるアカウント

```sql accessible_accounts
select 
    account_id,
    account_name
from identity_center.user_account_mapping
order by account_name
```

<DataTable 
    data={accessible_accounts}
    search=true
>
    <Column id=account_id title="アカウントID"/>
    <Column id=account_name title="アカウント名"/>
</DataTable>
