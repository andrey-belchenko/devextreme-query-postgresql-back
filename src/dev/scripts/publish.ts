import * as fs from 'fs';
import * as path from 'path';
import { execSync, ExecSyncOptions } from 'child_process';

const rootDir = process.cwd();

console.log('Publishing @infoenergo/ie-dx-query-pg...');

// Check for GITLAB_TOKEN
const gitlabToken = process.env.GITLAB_TOKEN;
if (!gitlabToken) {
    console.error('Error: GITLAB_TOKEN environment variable is not set');
    console.error('Please set it with: $env:GITLAB_TOKEN="your-token"');
    process.exit(1);
}

// Read registry URL from root package.json
const packageJsonPath = path.join(rootDir, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
    console.error('Error: package.json not found in root directory');
    process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const registryUrl = packageJson.publishConfig?.['@infoenergo:registry'] || 
    'http://gitlab.infoenergo.loc/api/v4/projects/421/packages/npm/';

const distDir = path.join(rootDir, 'dist');

try {
    // Step 1: Install dependencies
    console.log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit', cwd: rootDir });

    // Step 2: Build package
    console.log('Building package...');
    execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

    // Step 3: Prepare publish (moves dist/lib to dist root and creates dist/package.json)
    console.log('Preparing publish structure...');
    execSync('npm run prepare-publish', { stdio: 'inherit', cwd: rootDir });

    // Verify dist directory exists and has package.json
    const distPackageJsonPath = path.join(distDir, 'package.json');
    if (!fs.existsSync(distPackageJsonPath)) {
        console.error('Error: dist/package.json not found after prepare-publish');
        process.exit(1);
    }

    // Step 4: Configure authentication
    console.log('Configuring GitLab authentication...');
    const npmrcPath = path.join(distDir, '.npmrc');
    
    // Normalize registry URL to ensure it has a trailing slash
    const normalizedRegistryUrl = registryUrl.endsWith('/') ? registryUrl : registryUrl + '/';
    
    // Parse registry URL to construct auth token key
    const registryUrlObj = new URL(normalizedRegistryUrl);
    const registryPath = registryUrlObj.pathname;
    const authTokenKey = `//${registryUrlObj.host}${registryPath}:_authToken`;
    
    // Use npm config set
    console.log(`  - Setting npm config: ${authTokenKey}=***`);
    execSync(`npm config set ${authTokenKey} ${gitlabToken}`, {
        cwd: rootDir,
        stdio: 'inherit',
        shell: true
    } as unknown as ExecSyncOptions);
    
    // Create .npmrc in dist directory
    const npmrcContent = `@infoenergo:registry=${normalizedRegistryUrl}\n`;
    fs.writeFileSync(npmrcPath, npmrcContent);
    
    console.log(`  - Using registry: ${normalizedRegistryUrl}`);
    console.log(`  - Auth token key: ${authTokenKey}`);

    // Step 5: Publish from dist directory
    console.log('Publishing to GitLab npm registry...');
    execSync('npm publish', {
        cwd: distDir,
        stdio: 'inherit',
        shell: true,
        env: {
            ...process.env,
            NPM_TOKEN: gitlabToken
        }
    } as unknown as ExecSyncOptions);

    console.log('✓ Package published successfully!');

    // Step 6: Cleanup
    console.log('Cleaning up...');
    
    // Remove node_modules
    // const nodeModulesPath = path.join(rootDir, 'node_modules');
    // if (fs.existsSync(nodeModulesPath)) {
    //     fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    //     console.log('  - Removed node_modules');
    // }

    // Remove dist
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
        console.log('  - Removed dist');
    }

    // Remove package-lock.json
    // const packageLockPath = path.join(rootDir, 'package-lock.json');
    // if (fs.existsSync(packageLockPath)) {
    //     fs.unlinkSync(packageLockPath);
    //     console.log('  - Removed package-lock.json');
    // }

    // Cleanup: Remove auth token from npm config
    console.log('  - Removing auth token from npm config...');
    try {
        execSync(`npm config delete ${authTokenKey}`, {
            cwd: rootDir,
            stdio: 'pipe',
            shell: true
        } as unknown as ExecSyncOptions);
    } catch (e) {
        // Ignore if config doesn't exist
    }
    
    // Restore root .npmrc (restore original format from package.json)
    const rootNpmrcPath = path.join(rootDir, '.npmrc');
    const originalNpmrc = `@infoenergo:registry=${registryUrl}\n`;
    fs.writeFileSync(rootNpmrcPath, originalNpmrc);
    console.log('  - Restored .npmrc');

    console.log('✓ Cleanup completed!');
} catch (error) {
    console.error('Error publishing package:', error);
    
    // Cleanup on error: Remove auth token from npm config
    try {
        const normalizedRegistryUrl = registryUrl.endsWith('/') ? registryUrl : registryUrl + '/';
        const registryUrlObj = new URL(normalizedRegistryUrl);
        const registryPath = registryUrlObj.pathname;
        const authTokenKey = `//${registryUrlObj.host}${registryPath}:_authToken`;
        execSync(`npm config delete ${authTokenKey}`, {
            cwd: rootDir,
            stdio: 'pipe',
            shell: true
        } as unknown as ExecSyncOptions);
        
        const rootNpmrcPath = path.join(rootDir, '.npmrc');
        const originalNpmrc = `@infoenergo:registry=${registryUrl}\n`;
        fs.writeFileSync(rootNpmrcPath, originalNpmrc);
    } catch (e) {
        // Ignore cleanup errors
    }
    
    process.exit(1);
}
