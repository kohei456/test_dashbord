# 👤 ユーザーダッシュボード: {params.user_name}

[← ユーザー一覧に戻る](/users)

---

## 📋 ユーザー情報

```sql user_info
select 
    user_name,
    display_name,
    email,
    accessible_accounts_count
from identity_center.users
where user_name = '${params.user_name}'
```

<BigValue 
    data={user_info} 
    value=display_name
    title="表示名"
/>

<BigValue 
    data={user_info} 
    value=email
    title="メールアドレス"
/>

<BigValue 
    data={user_info} 
    value=accessible_accounts_count
    title="アクセス可能アカウント数"
/>

---

## 🔐 アクセス可能なアカウント

```sql accessible_accounts
select 
    account_id,
    account_name
from identity_center.user_account_mapping
where user_name = '${params.user_name}'
group by account_id, account_name
order by account_name
```

<DataTable 
    data={accessible_accounts}
    title="このユーザーがアクセスできるAWSアカウント"
>
    <Column id=account_id title="アカウントID"/>
    <Column id=account_name title="アカウント名"/>
</DataTable>

---

## 📊 セキュリティ検出結果の概要

このユーザーがアクセスできるアカウントの検出結果を表示します。

```sql user_findings_overview
select 
    count(*) as total_findings,
    count(distinct severity) as severity_types,
    count(distinct cloud_region) as regions
from opensearch_data.account_findings
where account_id in (
    select account_id 
    from identity_center.user_account_mapping 
    where user_name = '${params.user_name}'
)
```

<BigValue 
    data={user_findings_overview} 
    value=total_findings
    title="検出結果総数"
/>

<BigValue 
    data={user_findings_overview} 
    value=severity_types
    title="重要度の種類"
/>

<BigValue 
    data={user_findings_overview} 
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
where account_id in (
    select account_id 
    from identity_center.user_account_mapping 
    where user_name = '${params.user_name}'
)
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
    uam.account_name,
    count(*) as finding_count
from opensearch_data.account_findings af
join identity_center.user_account_mapping uam 
    on af.account_id = uam.account_id
where uam.user_name = '${params.user_name}'
group by af.account_id, uam.account_name
order by finding_count desc
```

<BarChart 
    data={account_findings_count}
    x=account_name
    y=finding_count
    title="アカウント別の検出結果数"
/>

---

## 🔍 最新の検出結果

```sql recent_findings
select 
    af._id,
    af.severity,
    af.finding_info_title,
    af.finding_info_desc,
    af.account_id,
    uam.account_name,
    af.cloud_region,
    af.compliance_status,
    af.time
from opensearch_data.account_findings af
join identity_center.user_account_mapping uam 
    on af.account_id = uam.account_id
where uam.user_name = '${params.user_name}'
order by af.time desc
limit 50
```

<DataTable 
    data={recent_findings} 
    search=true 
    rows=20
    title="最新の検出結果（最大50件）"
>
    <Column id=severity title="重要度"/>
    <Column id=finding_info_title title="タイトル"/>
    <Column id=account_name title="アカウント"/>
    <Column id=cloud_region title="リージョン"/>
    <Column id=compliance_status title="コンプライアンス"/>
    <Column id=time title="検出時刻"/>
</DataTable>
