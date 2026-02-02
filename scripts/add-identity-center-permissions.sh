#!/bin/bash

# 管理アカウント(975050352330)で実行するスクリプト
# IdentityCenterReadOnlyRoleにIdentity Center APIの権限を追加

ROLE_NAME="IdentityCenterReadOnlyRole"
POLICY_NAME="IdentityCenterAPIAccess"

echo "=== Identity Center API権限を追加 ==="
echo "ロール名: ${ROLE_NAME}"
echo "ポリシー名: ${POLICY_NAME}"

# インラインポリシーを作成
aws iam put-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-name ${POLICY_NAME} \
  --policy-document '{
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
  }' \
  --region ap-northeast-1

if [ $? -eq 0 ]; then
  echo "✓ ポリシーの追加に成功しました"
  
  echo ""
  echo "=== ロールに付与されているポリシーを確認 ==="
  
  echo "管理ポリシー:"
  aws iam list-attached-role-policies --role-name ${ROLE_NAME} --region ap-northeast-1
  
  echo ""
  echo "インラインポリシー:"
  aws iam list-role-policies --role-name ${ROLE_NAME} --region ap-northeast-1
  
  echo ""
  echo "インラインポリシーの内容:"
  aws iam get-role-policy --role-name ${ROLE_NAME} --policy-name ${POLICY_NAME} --region ap-northeast-1
else
  echo "✗ ポリシーの追加に失敗しました"
  exit 1
fi
