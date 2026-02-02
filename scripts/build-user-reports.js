import { IdentitystoreClient, ListUsersCommand } from "@aws-sdk/client-identitystore";
import { SSOAdminClient, ListAccountAssignmentsCommand, ListPermissionSetsCommand } from "@aws-sdk/client-sso-admin";
import { OrganizationsClient, ListAccountsCommand } from "@aws-sdk/client-organizations";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 環境変数から設定を取得
const IDENTITY_STORE_ID = process.env.EVIDENCE_IDENTITY_STORE_ID;
const SSO_INSTANCE_ARN = process.env.EVIDENCE_SSO_INSTANCE_ARN;
const MANAGEMENT_ACCOUNT_ROLE_ARN = process.env.EVIDENCE_MANAGEMENT_ACCOUNT_ROLE_ARN;
const AWS_REGION = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1';

if (!IDENTITY_STORE_ID || !SSO_INSTANCE_ARN) {
    console.error("環境変数が不足しています: EVIDENCE_IDENTITY_STORE_ID, EVIDENCE_SSO_INSTANCE_ARN");
    process.exit(1);
}

console.log("=== ユーザー別レポートビルドを開始 ===");
console.log(`Identity Store ID: ${IDENTITY_STORE_ID}`);
console.log(`SSO Instance ARN: ${SSO_INSTANCE_ARN}`);
console.log(`Management Account Role ARN: ${MANAGEMENT_ACCOUNT_ROLE_ARN || 'Not set (using current credentials)'}`);
console.log(`AWS Region: ${AWS_REGION}`);

/**
 * 管理アカウントのロールをAssumeして認証情報を取得
 */
async function getManagementAccountCredentials() {
    if (!MANAGEMENT_ACCOUNT_ROLE_ARN) {
        console.log("管理アカウントロールが設定されていません。現在の認証情報を使用します。");
        return undefined;
    }

    console.log("\n--- 管理アカウントのロールをAssumeしています ---");
    const stsClient = new STSClient({ region: AWS_REGION });
    
    try {
        const assumeRoleCommand = new AssumeRoleCommand({
            RoleArn: MANAGEMENT_ACCOUNT_ROLE_ARN,
            RoleSessionName: 'EvidenceUserReportsBuild',
            DurationSeconds: 3600,
        });
        
        const response = await stsClient.send(assumeRoleCommand);
        console.log("✓ ロールのAssumeに成功しました");
        
        return {
            accessKeyId: response.Credentials.AccessKeyId,
            secretAccessKey: response.Credentials.SecretAccessKey,
            sessionToken: response.Credentials.SessionToken,
        };
    } catch (error) {
        console.error("✗ ロールのAssumeに失敗しました:", error.message);
        throw error;
    }
}

// 管理アカウントの認証情報を取得
const managementAccountCredentials = await getManagementAccountCredentials();

// クライアントの初期化（管理アカウントの認証情報を使用）
const clientConfig = {
    region: AWS_REGION,
    ...(managementAccountCredentials && { credentials: managementAccountCredentials }),
};

const identityStoreClient = new IdentitystoreClient(clientConfig);
const ssoAdminClient = new SSOAdminClient(clientConfig);
const organizationsClient = new OrganizationsClient(clientConfig);

/**
 * ユーザーとアカウントマッピングを取得
 */
async function getUserAccountMapping() {
    console.log("\n--- ユーザー情報を取得中 ---");
    
    // ユーザー一覧を取得
    const listUsersCommand = new ListUsersCommand({
        IdentityStoreId: IDENTITY_STORE_ID,
    });
    const usersResponse = await identityStoreClient.send(listUsersCommand);
    console.log(`取得したユーザー数: ${usersResponse.Users.length}`);

    // アカウント一覧を取得
    const listAccountsCommand = new ListAccountsCommand({});
    const accountsResponse = await organizationsClient.send(listAccountsCommand);
    console.log(`取得したアカウント数: ${accountsResponse.Accounts.length}`);

    // Permission Sets一覧を取得
    const listPermissionSetsCommand = new ListPermissionSetsCommand({
        InstanceArn: SSO_INSTANCE_ARN,
    });
    const permissionSetsResponse = await ssoAdminClient.send(listPermissionSetsCommand);
    console.log(`取得したPermission Set数: ${permissionSetsResponse.PermissionSets.length}`);

    // ユーザーとアカウントのマッピングを作成
    const userAccountMap = {};

    for (const user of usersResponse.Users) {
        const userId = user.UserId;
        const userName = user.UserName;
        
        console.log(`\nユーザー ${userName} のアカウント割り当てを確認中...`);
        
        const accessibleAccounts = new Set();

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
                        accessibleAccounts.add(account.Id);
                    }
                } catch (error) {
                    // エラーは無視して続行
                    if (error.name !== 'ResourceNotFoundException') {
                        console.error(`  エラー (アカウント ${account.Id}): ${error.message}`);
                    }
                }
            }
        }

        userAccountMap[userId] = {
            userName: userName,
            displayName: user.DisplayName || userName,
            email: user.Emails?.[0]?.Value || '',
            accountIds: Array.from(accessibleAccounts),
        };

        console.log(`  アクセス可能アカウント数: ${accessibleAccounts.size}`);
    }

    return userAccountMap;
}

/**
 * ユーザー別にEvidenceをビルド
 */
async function buildUserReports(userAccountMap) {
    const buildDir = 'build-users';
    
    // ビルドディレクトリをクリーンアップ
    if (fs.existsSync(buildDir)) {
        fs.rmSync(buildDir, { recursive: true, force: true });
    }
    fs.mkdirSync(buildDir, { recursive: true });

    console.log("\n=== ユーザー別ビルドを開始 ===");
    
    const userIds = Object.keys(userAccountMap);
    console.log(`ビルド対象ユーザー数: ${userIds.length}`);

    for (const userId of userIds) {
        const userInfo = userAccountMap[userId];
        const userName = userInfo.userName;
        
        console.log(`\n--- ユーザー ${userName} (${userId}) のビルド中 ---`);
        console.log(`  アクセス可能アカウント: ${userInfo.accountIds.join(', ')}`);

        try {
            // 環境変数を設定してビルド実行
            const env = {
                ...process.env,
                EVIDENCE_USER_ID: userId,
                EVIDENCE_USER_NAME: userName,
                EVIDENCE_USER_ACCOUNTS: userInfo.accountIds.join(','),
            };

            // Evidenceビルドを実行
            console.log("  Evidenceビルドを実行中...");
            execSync('npm run build', {
                env: env,
                stdio: 'inherit',
            });

            // ビルド結果をユーザー別ディレクトリにコピー
            const userBuildDir = path.join(buildDir, `user-${userId}`);
            fs.mkdirSync(userBuildDir, { recursive: true });
            
            console.log(`  ビルド結果を ${userBuildDir} にコピー中...`);
            execSync(`cp -r build/* ${userBuildDir}/`, { stdio: 'inherit' });

            console.log(`  ✓ ユーザー ${userName} のビルド完了`);
        } catch (error) {
            console.error(`  ✗ ユーザー ${userName} のビルド失敗: ${error.message}`);
            // エラーがあっても続行
        }
    }

    console.log("\n=== すべてのユーザーのビルドが完了 ===");
    console.log(`ビルド出力ディレクトリ: ${buildDir}/`);
    
    return buildDir;
}

/**
 * メイン処理
 */
async function main() {
    try {
        // ユーザーとアカウントマッピングを取得
        const userAccountMap = await getUserAccountMapping();
        
        // ユーザー別にビルド
        const buildDir = await buildUserReports(userAccountMap);
        
        console.log("\n✓ すべての処理が完了しました");
        console.log(`ビルド結果: ${buildDir}/`);
        
        // ビルド結果のサマリーを出力
        console.log("\n=== ビルドサマリー ===");
        const users = Object.keys(userAccountMap);
        users.forEach(userId => {
            const userInfo = userAccountMap[userId];
            console.log(`- ${userInfo.userName}: ${userInfo.accountIds.length} アカウント`);
        });
        
    } catch (error) {
        console.error("\n✗ エラーが発生しました:", error);
        process.exit(1);
    }
}

// 実行
main();
