import { IdentitystoreClient, ListUsersCommand } from "@aws-sdk/client-identitystore";
import { SSOAdminClient, ListAccountAssignmentsCommand, ListPermissionSetsCommand } from "@aws-sdk/client-sso-admin";
import { OrganizationsClient, ListAccountsCommand } from "@aws-sdk/client-organizations";

// 環境変数から設定を取得
const IDENTITY_STORE_ID = process.env.EVIDENCE_IDENTITY_STORE_ID;
const SSO_INSTANCE_ARN = process.env.EVIDENCE_SSO_INSTANCE_ARN;
const AWS_REGION = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1';

if (!IDENTITY_STORE_ID || !SSO_INSTANCE_ARN) {
    throw new Error(
        "環境変数が不足しています: EVIDENCE_IDENTITY_STORE_ID, EVIDENCE_SSO_INSTANCE_ARN"
    );
}

// クライアントの初期化
const identityStoreClient = new IdentitystoreClient({ region: AWS_REGION });
const ssoAdminClient = new SSOAdminClient({ region: AWS_REGION });
const organizationsClient = new OrganizationsClient({ region: AWS_REGION });

// ユーザー一覧を取得
const listUsersCommand = new ListUsersCommand({
    IdentityStoreId: IDENTITY_STORE_ID,
});
const usersResponse = await identityStoreClient.send(listUsersCommand);

// アカウント一覧を取得
const listAccountsCommand = new ListAccountsCommand({});
const accountsResponse = await organizationsClient.send(listAccountsCommand);

// Permission Sets一覧を取得
const listPermissionSetsCommand = new ListPermissionSetsCommand({
    InstanceArn: SSO_INSTANCE_ARN,
});
const permissionSetsResponse = await ssoAdminClient.send(listPermissionSetsCommand);

// ユーザーとアカウントのマッピングを作成
const mappings = [];

for (const user of usersResponse.Users) {
    const userId = user.UserId;
    const userName = user.UserName;
    const displayName = user.DisplayName || userName;

    // 各Permission Setについて、このユーザーの割り当てを確認
    for (const permissionSetArn of permissionSetsResponse.PermissionSets) {
        // 各アカウントについて確認
        for (const account of accountsResponse.Accounts) {
            try {
                const listAssignmentsCommand = new ListAccountAssignmentsCommand({
                    InstanceArn: SSO_INSTANCE_ARN,
                    AccountId: account.Id,
                    PermissionSetArn: permissionSetArn,
                });
                const assignmentsResponse = await ssoAdminClient.send(listAssignmentsCommand);

                // このユーザーへの割り当てがあるか確認
                const userAssignment = assignmentsResponse.AccountAssignments?.find(
                    assignment => assignment.PrincipalId === userId && assignment.PrincipalType === 'USER'
                );

                if (userAssignment) {
                    mappings.push({
                        user_id: userId,
                        user_name: userName,
                        display_name: displayName,
                        account_id: account.Id,
                        account_name: account.Name,
                        permission_set_arn: permissionSetArn,
                    });
                }
            } catch (error) {
                // エラーは無視して続行
                console.error(`Error checking assignment for user ${userName}, account ${account.Id}:`, error.message);
            }
        }
    }
}

export const data = mappings;
