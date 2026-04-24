/// <reference types="vite/client" />

type AutoflowCommand = "init" | "status";

type AutoflowRunResult = {
  ok: boolean;
  command: AutoflowCommand;
  code: number;
  stdout: string;
  stderr: string;
};

type AutoflowFilePreview = {
  filePath: string;
  name: string;
  title: string;
  modifiedAt: string;
};

type AutoflowBoardSnapshot = {
  repoRoot: string;
  boardRoot: string;
  exists: boolean;
  status: Record<string, string>;
  statusResult: AutoflowRunResult | null;
  tickets: Record<string, AutoflowFilePreview[]>;
  logs: AutoflowFilePreview[];
};

interface Window {
  autoflow: {
    selectProject: () => Promise<string>;
    readBoard: (options: {
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowBoardSnapshot>;
    installBoard: (options: {
      projectRoot: string;
      boardDirName: string;
    }) => Promise<AutoflowRunResult>;
  };
}
