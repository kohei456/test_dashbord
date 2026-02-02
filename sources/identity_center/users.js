import { IdentitystoreClient, ListUsersCommand } from "@aws-sdk/client-identitystore";
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
        RoleSessionName: 'EvidenceIdentityCenterDataSource',
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
const accountsMap = {};
accountsResponse.Accounts.forEach(account => {
    accountsMap[account.Id] = account.Name;
});

// Permission Sets一覧を取得
const listPermissionSetsCommand = new ListPermissionSetsCommand({
    InstanceArn: SSO_INSTANCE_ARN,
});
const permissionSetsResponse = await ssoAdminClient.send(listPermissionSetsCommand);

// 各ユーザーのアクセス権限を取得
const usersWithAccess = [];

for (const user of usersResponse.Users) {
    const userId = user.UserId;
    const userName = user.UserName;
    const displayName = user.DisplayName || userName;
    const email = user.Emails?.[0]?.Value || '';

    // このユーザーがアクセスできるアカウントを収集
    const accessibleAccounts = [];

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
                    accessibleAccounts.push({
                        account_id: account.Id,
                        account_name: account.Name,
                    });
                }
            } catch (error) {
                // エラーは無視して続行
                console.error(`Error checking assignment for user ${userName}, account ${account.Id}:`, error.message);
            }
        }
    }

    // 重複を削除
    const uniqueAccounts = Array.from(
        new Map(accessibleAccounts.map(acc => [acc.account_id, acc])).values()
    );

    usersWithAccess.push({
        user_id: userId,
        user_name: userName,
        display_name: displayName,
        email: email,
        accessible_accounts_count: uniqueAccounts.length,
        accessible_accounts: uniqueAccounts.map(acc => acc.account_id).join(', '),
    });
}

// 環境変数でユーザーIDが指定されている場合は、そのユーザーのみを返す
const currentUserId = process.env.EVIDENCE_USER_ID;
let filteredUsers = usersWithAccess;

if (currentUserId) {
    filteredUsers = usersWithAccess.filter(user => user.user_id === currentUserId);
    console.log(`ユーザー別ビルド: ユーザーID ${currentUserId} のみを表示`);
}

export const data = filteredUsers;
