# 📋 アカウント一覧

このページでは、各AWSアカウントの検出結果を確認できます。

```sql account_list
select 
    account_id,
    finding_count,
    '/account/' || account_id as dashboard_link
from opensearch_data.accounts
order by finding_count desc
```

## アカウント別の検出結果数

<DataTable 
    data={account_list}
    search=true
    link=dashboard_link
>
    <Column id=account_id title="アカウントID"/>
    <Column id=finding_count title="検出結果数"/>
    <Column id=dashboard_link title="ダッシュボード" contentType=link linkLabel="詳細を見る"/>
</DataTable>

## 📊 アカウント別の分布

```sql account_distribution
select 
    account_id,
    finding_count
from opensearch_data.accounts
order by finding_count desc
limit 10
```

<BarChart 
    data={account_distribution}
    x=account_id
    y=finding_count
    title="検出結果数トップ10アカウント"
/>
