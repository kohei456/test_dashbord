---
title: マイダッシュボード
---

# 👤 あなたのダッシュボード

このダッシュボードには、あなたがアクセス権限を持つアカウントの情報のみが表示されます。

---

## 🔐 あなたがアクセスできるアカウント

```sql my_accounts
select 
    user_id,
    user_name,
    display_name,
    email,
    accessible_accounts_count
from identity_center.users
limit 1
```

<BigValue 
    data={my_accounts} 
    value=display_name
    title="ユーザー名"
/>

<BigValue 
    data={my_accounts} 
    value=email
    title="メールアドレス"
/>

<BigValue 
    data={my_accounts} 
    value=accessible_accounts_count
    title="アクセス可能アカウント数"
/>
