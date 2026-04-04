import { existsSync, readdirSync, statSync } from "fs";
import { resolve, basename } from "path";
import { resolvePrefix } from "db";

export interface RepoInfo {
  slug: string;
  path: string;
}

export function isGitRepo(dirPath: string): boolean {
  return existsSync(resolve(dirPath, ".git"));
}

/**
 * Detect repos in a workspace directory.
 * - If the workspace itself is a git repo, returns it as the single repo.
 * - Otherwise, scans immediate children for git repos.
 */
export function detectRepos(workspacePath: string): RepoInfo[] {
  if (isGitRepo(workspacePath)) {
    return [{ slug: basename(workspacePath), path: workspacePath }];
  }

  const repos: RepoInfo[] = [];
  let entries: string[];
  try {
    entries = readdirSync(workspacePath);
  } catch {
    return repos;
  }

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = resolve(workspacePath, entry);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }
    if (isGitRepo(fullPath)) {
      repos.push({ slug: entry, path: fullPath });
    }
  }

  return repos.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Compute a unique tmux session prefix for a given directory path.
 * Delegates to the DB package's resolvePrefix which handles abbreviation
 * and tmux session conflict resolution (appending numbers).
 */
export function resolveRepoPrefix(dirPath: string): string {
  return resolvePrefix(dirPath);
}
