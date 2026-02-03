# Evidence ユーザー別ダッシュボード アーキテクチャ

## システム構成図

```mermaid
graph TB
    subgraph "GitHub"
        REPO[GitHub Repository<br/>kohei456/test_dashbord]
    end

    subgraph "CodeBuild Account (905418291155)"
        subgraph "AWS CodeBuild"
            CB[CodeBuild Project<br/>evidence-app-build]
            PS[Parameter Store<br/>/evidence/*]
        end
        
        subgraph "Build Process"
            B1[1. npm ci]
            B2[2. npm run sources]
            B3[3. npm run build:users<br/>各ユーザー別にビルド]
            B4[4. S3アップロード]
            B5[5. CloudFrontキャッシュ無効化]
        end
        
        S3[S3 Bucket<br/>evidence-app-evidence-dashbord-905418291155<br/>├─ user-userId1/<br/>├─ user-userId2/<br/>├─ user-userId3/<br/>├─ user-userId4/<br/>└─ user-userId5/]
        
        CF[CloudFront Distribution<br/>E1YGX36GS1KSH5<br/>d1lxxyn94blelj.cloudfront.net]
    end

    subgraph "Management Account (975050352330)"
        ROLE[IAM Role<br/>IdentityCenterReadOnlyRole]
        IC[Identity Center<br/>ユーザー情報<br/>アカウント割当]
        ORG[Organizations<br/>アカウント一覧]
    end

    subgraph "Data Sources"
        OS[OpenSearch<br/>config-ocsf-sqs-alias<br/>セキュリティ検出結果]
    end

    USER[エンドユーザー<br/>https://d1lxxyn94blelj.cloudfront.net/<br/>user-userId/index.html]

    REPO -->|git push| CB
    CB -->|読み取り| PS
    CB --> B1 --> B2 --> B3 --> B4 --> B5
    CB -->|AssumeRole| ROLE
    ROLE --> IC
    ROLE --> ORG
    CB -->|データ取得| OS
    B4 -->|アップロード| S3
    B5 -->|キャッシュ無効化| CF
    S3 -->|Origin Access Control| CF
    CF -->|HTTPS| USER

    style CB fill:#FF9900
    style S3 fill:#569A31
    style CF fill:#FF9900
    style IC fill:#FF9900
    style ORG fill:#FF9900
    style OS fill:#FF9900
```

## データフロー

### ビルド時のデータ取得フロー

```mermaid
sequenceDiagram
    participant CB as CodeBuild
    participant STS as AWS STS
    participant MA as 管理アカウント<br/>(975050352330)
    participant IC as Identity Center
    participant ORG as Organizations
    participant OS as OpenSearch

    CB->>STS: AssumeRole Request
    STS->>MA: Assume IdentityCenterReadOnlyRole
    MA-->>CB: Temporary Credentials
    
    CB->>IC: ListUsers
    IC-->>CB: ユーザー一覧
    
    CB->>IC: ListAccountAssignments
    IC-->>CB: ユーザー・アカウント割当
    
    CB->>ORG: ListAccounts
    ORG-->>CB: アカウント一覧
    
    CB->>OS: Search (config-ocsf-sqs-alias)
    OS-->>CB: セキュリティ検出結果
```

### ユーザー別ビルドフロー

```mermaid
flowchart TD
    START[ユーザー別ビルド開始] --> LOOP{各ユーザーについて}
    
    LOOP -->|ユーザー1| ENV1[環境変数設定<br/>EVIDENCE_USER_ID<br/>EVIDENCE_USER_ACCOUNTS]
    LOOP -->|ユーザー2| ENV2[環境変数設定]
    LOOP -->|ユーザー3| ENV3[環境変数設定]
    LOOP -->|ユーザー4| ENV4[環境変数設定]
    LOOP -->|ユーザー5| ENV5[環境変数設定]
    
    ENV1 --> SRC1[npm run sources<br/>データソース生成]
    ENV2 --> SRC2[npm run sources]
    ENV3 --> SRC3[npm run sources]
    ENV4 --> SRC4[npm run sources]
    ENV5 --> SRC5[npm run sources]
    
    SRC1 --> FILTER1[データフィルタリング<br/>users.js<br/>user_account_mapping.js<br/>account_findings.js]
    SRC2 --> FILTER2[データフィルタリング]
    SRC3 --> FILTER3[データフィルタリング]
    SRC4 --> FILTER4[データフィルタリング]
    SRC5 --> FILTER5[データフィルタリング]
    
    FILTER1 --> BUILD1[npm run build<br/>静的HTML生成]
    FILTER2 --> BUILD2[npm run build]
    FILTER3 --> BUILD3[npm run build]
    FILTER4 --> BUILD4[npm run build]
    FILTER5 --> BUILD5[npm run build]
    
    BUILD1 --> COPY1[S3へコピー<br/>user-userId1/]
    BUILD2 --> COPY2[S3へコピー<br/>user-userId2/]
    BUILD3 --> COPY3[S3へコピー<br/>user-userId3/]
    BUILD4 --> COPY4[S3へコピー<br/>user-userId4/]
    BUILD5 --> COPY5[S3へコピー<br/>user-userId5/]
    
    COPY1 --> END[ビルド完了]
    COPY2 --> END
    COPY3 --> END
    COPY4 --> END
    COPY5 --> END
    
    END --> INVALIDATE[CloudFrontキャッシュ無効化]
```

## アカウント構成

### CodeBuildアカウント (905418291155)
- **リソース:**
  - CodeBuild プロジェクト: `evidence-app-build`
  - S3 バケット: `evidence-app-evidence-dashbord-905418291155`
  - CloudFront ディストリビューション: `E1YGX36GS1KSH5`
  - Parameter Store: `/evidence/*`

- **IAMロール:** `evidence-app-codebuild-role`
  - S3への読み書き権限
  - CloudFrontキャッシュ無効化権限
  - Parameter Store読み取り権限
  - 管理アカウントロールへのAssumeRole権限

### 管理アカウント (975050352330)
- **リソース:**
  - Identity Center
  - AWS Organizations

- **IAMロール:** `IdentityCenterReadOnlyRole`
  - Identity Center読み取り権限
  - Organizations読み取り権限
  - CodeBuildアカウントからのAssumeRoleを許可

## セキュリティ

### 認証・認可
- **現在 (Phase 2):**
  - URLを知っていれば誰でもアクセス可能
  - ユーザー別にデータはフィルタリング済み

- **将来 (Phase 3):**
  - ALB + Cognito + Fargate による認証
  - ユーザーは自分のダッシュボードのみアクセス可能

### データアクセス制御
- CodeBuildは管理アカウントのロールをAssumeして、Identity Center情報を取得
- 各ユーザーのダッシュボードには、そのユーザーがアクセス可能なアカウントのデータのみ含まれる
- OpenSearchデータはアカウントIDでフィルタリング

## ユーザー一覧

| ユーザー | ユーザーID | アカウント数 |
|---------|-----------|------------|
| securitylake-tic@serverworks.co.jp | 77649a08-10d1-7078-949d-bd8494e0e727 | 1 |
| org-tic@serverworks.co.jp | 7774dae8-a0a1-703c-0ccd-784e72d6239b | 0 |
| TIC-kasika@serverworks.co.jp | 97349a58-9011-70b7-88d6-a7a8913a53f8 | 1 |
| user-kuwahara-ryosuke | 97943a18-7031-7092-f256-e614c146f15d | 5 |
| member01-tic@serverworks.co.jp | 87441aa8-a0c1-70a7-ef07-35f97ededda9 | 1 |

## デプロイ方法

### 初回デプロイ
1. CloudFormationスタック作成
2. Parameter Store設定
3. 管理アカウントでIAMロール作成
4. CodeBuildビルド実行

### 更新デプロイ
1. コード変更をGitHubにプッシュ
2. CodeBuildビルドを手動実行
   ```bash
   aws codebuild start-build \
     --project-name evidence-app-build \
     --region ap-northeast-1
   ```

## 技術スタック

- **フロントエンド:** Evidence (Svelte ベース)
- **ビルド:** Node.js 18, npm
- **CI/CD:** AWS CodeBuild
- **ストレージ:** Amazon S3
- **CDN:** Amazon CloudFront
- **データソース:**
  - AWS Identity Center (ユーザー・アカウント情報)
  - AWS Organizations (アカウント一覧)
  - Amazon OpenSearch (セキュリティ検出結果)
- **認証情報管理:** AWS Systems Manager Parameter Store
- **クロスアカウントアクセス:** AWS STS AssumeRole

## 今後の拡張 (Phase 3)

```mermaid
graph TB
    USER[エンドユーザー]
    
    subgraph "Phase 3 アーキテクチャ"
        ALB[Application Load Balancer<br/>認証ゲートウェイ]
        COGNITO[Amazon Cognito<br/>ユーザー認証<br/>Identity Center連携]
        
        subgraph "ECS Fargate"
            APP[Evidenceアプリケーション<br/>動的ダッシュボード生成]
        end
        
        S3_P3[S3 Bucket<br/>ユーザー別データ]
    end
    
    IC_P3[Identity Center<br/>ユーザー情報]
    
    USER -->|HTTPS| ALB
    ALB -->|認証チェック| COGNITO
    COGNITO -->|ユーザー情報| IC_P3
    ALB -->|認証済みリクエスト| APP
    APP -->|データ取得| S3_P3
    APP -->|ユーザー情報取得| IC_P3
    
    style ALB fill:#FF9900
    style COGNITO fill:#FF9900
    style APP fill:#FF9900
    style S3_P3 fill:#569A31
```
