import { IdentitystoreClient, ListUsersCommand, ListGroupMembershipsForMemberCommand } from "@aws-sdk/client-identitystore";
import { SSOAdminClient, ListAccountAssignmentsCommand, ListPermissionSetsCommand } from "@aws-sdk/client-sso-admin";
import { OrganizationsClient, ListAccountsCommand } from "@aws-sdk/client-organizations";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

// 環境変数から設定を取得
const IDENTITY_STORE_ID = process.env.EVIDENCE_IDENTITY_STORE_ID;
const SSO_INSTANCE_ARN = process.env.EVIDENCE_SSO_INSTANCE_ARN;
const MANAGEMENT_ACCOUNT_ROLE_ARN = process.env.EVIDENCE_MANAGEMENT_ACCOUNT_ROLE_ARN;
const AWS_REGION = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1';

if (!IDENTITY_STORE_ID || !SSO_INSTANCE_ARN) {
    throw new Error(
        "環境変数が不足しています: EVIDENCE_IDENTITY_STORE_ID, EVIDENCE_SSO_INSTANCE_ARN"
    );
}

/**
 * 管理アカウントのロールをAssumeして認証情報を取得
 */
async function getManagementAccountCredentials() {
    if (!MANAGEMENT_ACCOUNT_ROLE_ARN) {
        return undefined;
    }

    const stsClient = new STSClient({ region: AWS_REGION });
    
    const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: MANAGEMENT_ACCOUNT_ROLE_ARN,
        RoleSessionName: 'EvidenceUserAccountMappingDataSource',
        DurationSeconds: 3600,
    });
    
    const response = await stsClient.send(assumeRoleCommand);
    
    return {
        accessKeyId: response.Credentials.AccessKeyId,
        secretAccessKey: response.Credentials.SecretAccessKey,
        sessionToken: response.Credentials.SessionToken,
    };
}

// 管理アカウントの認証情報を取得
const managementAccountCredentials = await getManagementAccountCredentials();

// クライアントの初期化
const clientConfig = {
    region: AWS_REGION,
    ...(managementAccountCredentials && { credentials: managementAccountCredentials }),
};

const identityStoreClient = new IdentitystoreClient(clientConfig);
const ssoAdminClient = new SSOAdminClient(clientConfig);
const organizationsClient = new OrganizationsClient(clientConfig);

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

    // ユーザーが所属するグループを取得
    const userGroupIds = new Set();
    try {
        const listGroupMembershipsCommand = new ListGroupMembershipsForMemberCommand({
            IdentityStoreId: IDENTITY_STORE_ID,
            MemberId: {
                UserId: userId,
            },
        });
        const groupMembershipsResponse = await identityStoreClient.send(listGroupMembershipsCommand);
        
        for (const membership of groupMembershipsResponse.GroupMemberships || []) {
            userGroupIds.add(membership.GroupId);
        }
    } catch (error) {
        console.error(`Error getting group memberships for user ${userName}:`, error.message);
    }

    // 各Permission Setについて、このユーザーとグループの割り当てを確認
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

                // ユーザー直接の割り当てをチェック
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

                // グループ経由の割り当てをチェック
                for (const groupId of userGroupIds) {
                    const groupAssignment = assignmentsResponse.AccountAssignments?.find(
                        assignment => assignment.PrincipalId === groupId && assignment.PrincipalType === 'GROUP'
                    );

                    if (groupAssignment) {
                        mappings.push({
                            user_id: userId,
                            user_name: userName,
                            display_name: displayName,
                            account_id: account.Id,
                            account_name: account.Name,
                            permission_set_arn: permissionSetArn,
                        });
                    }
                }
            } catch (error) {
                // エラーは無視して続行
                console.error(`Error checking assignment for user ${userName}, account ${account.Id}:`, error.message);
            }
        }
    }
}

// 環境変数でユーザーアカウントが指定されている場合はフィルタリング
const userAccounts = process.env.EVIDENCE_USER_ACCOUNTS;
let filteredMappings = mappings;

if (userAccounts) {
    const accountIds = userAccounts.split(',').map(id => id.trim());
    filteredMappings = mappings.filter(mapping => accountIds.includes(mapping.account_id));
    console.log(`ユーザー別ビルド: ${accountIds.length}個のアカウントにフィルタリング`);
}

export const data = filteredMappings;
