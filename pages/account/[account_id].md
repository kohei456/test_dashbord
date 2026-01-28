# 🔐 アカウント: {params.account_id}

このページでは、アカウント **{params.account_id}** の検出結果を表示します。

[← アカウント一覧に戻る](/accounts)

---

## 📊 概要

```sql overview
select 
    count(*) as total_findings,
    count(distinct severity) as severity_types,
    count(distinct cloud_region) as regions
from opensearch_data.account_findings
where account_id = '${params.account_id}'
```

<BigValue 
    data={overview} 
    value=total_findings
    title="検出結果総数"
/>

<BigValue 
    data={overview} 
    value=severity_types
    title="重要度の種類"
/>

<BigValue 
    data={overview} 
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
where account_id = '${params.account_id}'
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

## 🌍 リージョン別の分布

```sql region_distribution
select 
    cloud_region,
    count(*) as count
from opensearch_data.account_findings
where account_id = '${params.account_id}'
group by cloud_region
order by count desc
```

<DataTable 
    data={region_distribution}
    title="リージョン別の検出結果数"
/>

---

## 🔍 検出結果一覧

```sql findings
select 
    _id,
    severity,
    finding_info_title,
    finding_info_desc,
    cloud_region,
    compliance_status,
    time
from opensearch_data.account_findings
where account_id = '${params.account_id}'
order by severity desc, time desc
limit 100
```

<DataTable 
    data={findings} 
    search=true 
    rows=20
    title="最新の検出結果（最大100件）"
>
    <Column id=severity/>
    <Column id=finding_info_title title="タイトル"/>
    <Column id=finding_info_desc title="説明"/>
    <Column id=cloud_region title="リージョン"/>
    <Column id=compliance_status title="コンプライアンス"/>
    <Column id=time title="検出時刻"/>
</DataTable>

---

## 📋 コンプライアンスステータス

```sql compliance_status
select 
    compliance_status,
    count(*) as count
from opensearch_data.account_findings
where account_id = '${params.account_id}'
group by compliance_status
order by count desc
```

<BarChart 
    data={compliance_status}
    x=compliance_status
    y=count
    title="コンプライアンスステータス別の分布"
/>
