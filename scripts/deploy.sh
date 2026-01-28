#!/bin/bash

# Evidenceアプリケーションのデプロイスクリプト
# 使用方法: ./scripts/deploy.sh [stack-name] [project-name] [github-repo]

set -e

# デフォルト値
STACK_NAME="${1:-evidence-deployment}"
PROJECT_NAME="${2:-evidence-app}"
GITHUB_REPO="${3}"
GITHUB_BRANCH="${4:-main}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"

# 色付きログ
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# GitHubリポジトリのチェック
if [ -z "$GITHUB_REPO" ]; then
    log_error "GitHubリポジトリのURLを指定してください"
    echo "使用方法: $0 [stack-name] [project-name] [github-repo] [branch]"
    echo "例: $0 evidence-deployment my-app https://github.com/username/repo main"
    exit 1
fi

log_info "デプロイを開始します..."
log_info "スタック名: $STACK_NAME"
log_info "プロジェクト名: $PROJECT_NAME"
log_info "GitHubリポジトリ: $GITHUB_REPO"
log_info "ブランチ: $GITHUB_BRANCH"
log_info "リージョン: $AWS_REGION"

# CloudFormationスタックの存在確認
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    log_warn "スタック '$STACK_NAME' は既に存在します。更新しますか? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        ACTION="update-stack"
        log_info "スタックを更新します..."
    else
        log_info "デプロイをキャンセルしました"
        exit 0
    fi
else
    ACTION="create-stack"
    log_info "新しいスタックを作成します..."
fi

# CloudFormationスタックのデプロイ
aws cloudformation "$ACTION" \
    --stack-name "$STACK_NAME" \
    --template-body file://cloudformation/evidence-deployment.yaml \
    --parameters \
        ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
        ParameterKey=GitHubRepo,ParameterValue="$GITHUB_REPO" \
        ParameterKey=GitHubBranch,ParameterValue="$GITHUB_BRANCH" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION"

log_info "CloudFormationスタックの作成/更新を開始しました"
log_info "完了を待っています..."

# スタックの作成/更新完了を待つ
if [ "$ACTION" = "create-stack" ]; then
    aws cloudformation wait stack-create-complete \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION"
else
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" 2>/dev/null || true
fi

log_info "スタックの作成/更新が完了しました"

# 出力値を取得
log_info "デプロイ情報を取得中..."
OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs' \
    --region "$AWS_REGION" \
    --output json)

WEBSITE_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="WebsiteURL") | .OutputValue')
CODEBUILD_PROJECT=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CodeBuildProjectName") | .OutputValue')
S3_BUCKET=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="WebsiteBucketName") | .OutputValue')

echo ""
log_info "=========================================="
log_info "デプロイが完了しました！"
log_info "=========================================="
echo ""
echo "  WebサイトURL: https://$WEBSITE_URL"
echo "  S3バケット: $S3_BUCKET"
echo "  CodeBuildプロジェクト: $CODEBUILD_PROJECT"
echo ""

# 初回ビルドを実行するか確認
log_warn "初回ビルドを実行しますか? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    log_info "ビルドを開始します..."
    BUILD_ID=$(aws codebuild start-build \
        --project-name "$CODEBUILD_PROJECT" \
        --region "$AWS_REGION" \
        --query 'build.id' \
        --output text)
    
    log_info "ビルドID: $BUILD_ID"
    log_info "ビルドステータスはAWSコンソールで確認できます"
    echo "  https://console.aws.amazon.com/codesuite/codebuild/projects/$CODEBUILD_PROJECT/history"
fi

log_info "デプロイスクリプトが完了しました"
