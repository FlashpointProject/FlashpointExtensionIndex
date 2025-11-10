import axios from 'axios';
import fs from 'node:fs';

type RawPackageJson = {
  name: string;
  displayName?: string;
  author: string;
  version: string;
  description?: string;
  icon?: string;
  artifactName?: string;
}

type ExtPackageInfo = {
  id: string;
  author: string;
  title: string;
  description: string;
  newestVersion: string;
  repository: string;
  iconUrl?: string;
  artifactName: string;
}

type ExtensionInfo = ExtPackageInfo & {
  availableVersions: string[];
}

async function getDefaultBranch(owner: string, repoName: string): Promise<string> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`;
  
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    const github_token = process.env.GITHUB_TOKEN;
    if (github_token) {
      headers['Authorization'] = `token ${github_token}`;
    }

    const res = await axios.get(apiUrl, { headers });
    return res.data.default_branch;
    
  } catch (error) {
    console.error(`Failed to fetch default branch: ${error}`);
    return 'main'; // fallback
  }
}

function parsePackageJson(fileContent: string, repo: string): ExtPackageInfo {
  const json: RawPackageJson = JSON.parse(fileContent);

  return {
    id: `${json.author.toLowerCase()}.${json.name.toLowerCase()}`,
    author: json.author,
    description: json.description || '',
    title: json.displayName || json.name,
    repository: repo,
    iconUrl: json.icon,
    newestVersion: json.version,
    artifactName: json.artifactName || 'extension.zip'
  };
}

async function parseRepository(repo: string): Promise<ExtensionInfo> {
  if (repo.includes('github.com')) {
    return parseGithubRepository(repo);
  }
  return parseRawRepository(repo);
}

async function parseRawRepository(repo: string): Promise<ExtensionInfo> {
  if (!repo.endsWith('/')) {
    repo += '/';
  }
  const packageJsonUrl = repo + 'package.json';

  const res = await axios.get<string>(packageJsonUrl);
  const extPackageInfo = parsePackageJson(res.data, repo);

  if (extPackageInfo.iconUrl) {
    extPackageInfo.iconUrl = repo + 'static/' + extPackageInfo.iconUrl;
  }

  return {
    ...extPackageInfo,
    availableVersions: [extPackageInfo.newestVersion]
  };
}

async function parseGithubRepository(repo: string): Promise<ExtensionInfo> {
  // Extract owner and repo name from GitHub URL
  if (!repo.endsWith('/')) {
    repo += '/';
  }
  const match = repo.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    throw `Invalid GitHub repo URL: ${repo}`;
  }
  
  const [, owner, repoName] = match;
  if (owner && repoName) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/package.json`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    // Add auth header if token is available
    const github_token = process.env.GITHUB_TOKEN;
    if (github_token) {
      headers['Authorization'] = `token ${github_token}`;
    }

    const res = await axios.get(apiUrl, { headers });
    
    // GitHub API returns base64 encoded content
    const content = Buffer.from(res.data.content, 'base64').toString('utf-8');
    const extPackageInfo = parsePackageJson(content, repo);
    const defaultBranch = await getDefaultBranch(owner, repoName);
    if (extPackageInfo.iconUrl) {
      extPackageInfo.iconUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/static/${extPackageInfo.iconUrl}`;
    }

    const releaseTags = await getGithubReleaseTags(owner, repoName);

    return {
      ...extPackageInfo,
      availableVersions: releaseTags
    };
  } else {
    throw `No owner and reponame in ${repo}`;
  }
}

async function getGithubReleaseTags(owner: string, repoName: string): Promise<string[]> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/releases`;
  
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    // Add auth header if token is available
    const github_token = process.env.GITHUB_TOKEN;
    if (github_token) {
      headers['Authorization'] = `token ${github_token}`;
    }

    const res = await axios.get(apiUrl, { headers });
    
    // Extract tag names from releases
    const tags = res.data.map((release: any) => release.tag_name);
    return tags;
    
  } catch (error) {
    console.error(`Failed to fetch releases: ${error}`);
    return [];
  }
}

async function update() {
  const parsedRepos: ExtensionInfo[] = [];

  const repos = JSON.parse(fs.readFileSync('./repositories.json', { encoding: 'utf-8' }));
  for (const author in repos['repositories']) {
    console.log('Processing Author: ' + author);
    for (const repo of repos['repositories'][author]) {
      console.log('  Processing Repo: ' + repo);
      parsedRepos.push(await parseRepository(repo));
    }
  }

  fs.writeFileSync('extindex.json', JSON.stringify(parsedRepos, undefined, 2));
  console.log(`Saved info for ${parsedRepos.length} repos`);
}

update();