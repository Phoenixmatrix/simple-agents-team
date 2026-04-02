export interface Command {
  name: string;
  description: string;
  run: (args: string[]) => Promise<void> | void;
}
