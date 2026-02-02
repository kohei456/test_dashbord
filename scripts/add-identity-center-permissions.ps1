# 管理アカウント(975050352330)で実行するスクリプト
# IdentityCenterReadOnlyRoleにIdentity Center APIの権限を追加

$ROLE_NAME = "IdentityCenterReadOnlyRole"
$POLICY_NAME = "IdentityCenterAPIAccess"

Write-Host "=== Identity Center API権限を追加 ==="
Write-Host "ロール名: $ROLE_NAME"
Write-Host "ポリシー名: $POLICY_NAME"

# ポリシードキュメントを作成
$policyDocument = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "identitystore:ListUsers",
        "identitystore:DescribeUser",
        "identitystore:ListGroups",
        "identitystore:DescribeGroup",
        "identitystore:ListGroupMemberships",
        "sso:ListInstances",
        "sso:ListAccountAssignments",
        "sso:ListPermissionSets",
        "sso:DescribePermissionSet",
        "sso-directory:SearchUsers",
        "sso-directory:SearchGroups",
        "organizations:ListAccounts",
        "organizations:DescribeAccount",
        "organizations:DescribeOrganization"
      ],
      "Resource": "*"
    }
  ]
}
"@

# インラインポリシーを作成
try {
    Write-RolePolicyCommand -RoleName $ROLE_NAME -PolicyName $POLICY_NAME -PolicyDocument $policyDocument -Region ap-northeast-1
    Write-Host "✓ ポリシーの追加に成功しました" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "=== ロールに付与されているポリシーを確認 ==="
    
    Write-Host "管理ポリシー:"
    Get-IAMAttachedRolePolicyList -RoleName $ROLE_NAME -Region ap-northeast-1
    
    Write-Host ""
    Write-Host "インラインポリシー:"
    Get-IAMRolePolicyList -RoleName $ROLE_NAME -Region ap-northeast-1
    
    Write-Host ""
    Write-Host "インラインポリシーの内容:"
    Get-IAMRolePolicy -RoleName $ROLE_NAME -PolicyName $POLICY_NAME -Region ap-northeast-1
}
catch {
    Write-Host "✗ ポリシーの追加に失敗しました: $_" -ForegroundColor Red
    exit 1
}
