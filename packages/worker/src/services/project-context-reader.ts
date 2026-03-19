import fs from 'node:fs/promises';
import path from 'node:path';

export interface ProjectExecutionContext {
  projectKey: string;
  repoPath: string;
  branchBase: string;
  agentsPath: string;
  agentsExists: boolean;
  agentsContent: string | null;
  commandsPath: string;
  commandsExists: boolean;
  commandEntries: string[];
  skillsPath: string;
  skillsExists: boolean;
  skillEntries: string[];
  ohMyOpencodePath: string;
  ohMyOpencodeExists: boolean;
  ohMyOpencodeContent: string | null;
}

export class ProjectContextReader {
  async read(projectKey: string, repoPath: string, branchBase: string): Promise<ProjectExecutionContext> {
    const agentsPath = path.join(repoPath, 'AGENTS.md');
    const commandsPath = path.join(repoPath, '.opencode', 'commands');
    const skillsPath = path.join(repoPath, 'skills');
    const ohMyOpencodePath = path.join(repoPath, '.opencode', 'oh-my-opencode.jsonc');

    const [agentsContent, commandEntries, skillEntries, ohMyOpencodeContent] = await Promise.all([
      this.readOptionalFile(agentsPath),
      this.readOptionalDirectory(commandsPath),
      this.readOptionalDirectory(skillsPath),
      this.readOptionalFile(ohMyOpencodePath),
    ]);

    return {
      projectKey,
      repoPath,
      branchBase,
      agentsPath,
      agentsExists: agentsContent !== null,
      agentsContent,
      commandsPath,
      commandsExists: commandEntries.length > 0,
      commandEntries,
      skillsPath,
      skillsExists: skillEntries.length > 0,
      skillEntries,
      ohMyOpencodePath,
      ohMyOpencodeExists: ohMyOpencodeContent !== null,
      ohMyOpencodeContent,
    };
  }

  private async readOptionalFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  private async readOptionalDirectory(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath);
      return entries.filter((entry) => entry !== '.gitkeep').sort();
    } catch {
      return [];
    }
  }
}
