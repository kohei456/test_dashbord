# OpenSearchダッシュボード

## 📊 概要

```sql overview
select 
    count(*) as total_findings,
    count(distinct severity) as severity_types,
    count(distinct cloud_region) as regions,
    count(distinct cloud_account_uid) as accounts
from opensearch_data.test_opensearch
```

<BigValue 
    data={overview} 
    value=total_findings
/>

<BigValue 
    data={overview} 
    value=severity_types
/>

<BigValue 
    data={overview} 
    value=regions
/>

<BigValue 
    data={overview} 
    value=accounts
/>

## 📈 重要度別の分布

```sql severity_distribution
select 
    severity,
    count(*) as count
from opensearch_data.test_opensearch
group by severity
order by count desc
```

<BarChart 
    data={severity_distribution}
    x=severity
    y=count
/>

## 🔍 検出結果一覧

```sql findings
select 
    _id,
    severity,
    finding_info_title,
    finding_info_desc,
    cloud_region,
    cloud_account_uid,
    compliance_status
from opensearch_data.test_opensearch
order by severity desc
```

<DataTable data={findings} search=true rows=20/>

## 🌍 リージョン別の分布

```sql region_distribution
select 
    cloud_region,
    count(*) as count
from opensearch_data.test_opensearch
group by cloud_region
order by count desc
```

<DataTable data={region_distribution}/>

## 📋 詳細データ（全カラム）

```sql all_data
select * from opensearch_data.test_opensearch
```

<DataTable data={all_data} search=true rows=10/>
