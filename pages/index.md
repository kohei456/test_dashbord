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

---

## 📋 アクセス可能なアカウント一覧

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

---

## 📊 セキュリティ検出結果の概要

あなたがアクセスできるアカウントのセキュリティ検出結果を表示します。

```sql findings_summary
select 
    count(*) as total_findings,
    count(distinct severity) as severity_types,
    count(distinct cloud_region) as regions
from opensearch_data.account_findings
```

<BigValue 
    data={findings_summary} 
    value=total_findings
    title="検出結果総数"
/>

<BigValue 
    data={findings_summary} 
    value=severity_types
    title="重要度の種類"
/>

<BigValue 
    data={findings_summary} 
    value=regions
    title="リージョン数"
/>

---

## 📈 重要度別の分布

```sql severity_distribution
select 
    severity,
    count(*) as count
from opensearch_data.account_findings
group by severity
order by count desc
```

<BarChart 
    data={severity_distribution}
    x=severity
    y=count
    title="重要度別の検出結果数"
/>

---

## 🏢 アカウント別の検出結果数

```sql account_findings_count
select 
    af.account_id,
    count(*) as finding_count
from opensearch_data.account_findings af
group by af.account_id
order by finding_count desc
```

<BarChart 
    data={account_findings_count}
    x=account_id
    y=finding_count
    title="アカウント別の検出結果数"
/>

---

## 🔍 最新の検出結果

```sql recent_findings
select 
    _id,
    severity,
    finding_info_title,
    finding_info_desc,
    account_id,
    cloud_region,
    compliance_status,
    time
from opensearch_data.account_findings
order by time desc
limit 50
```

<DataTable 
    data={recent_findings} 
    search=true 
    rows=20
>
    <Column id=severity title="重要度"/>
    <Column id=finding_info_title title="タイトル"/>
    <Column id=account_id title="アカウントID"/>
    <Column id=cloud_region title="リージョン"/>
    <Column id=compliance_status title="コンプライアンス"/>
    <Column id=time title="検出時刻"/>
</DataTable>
