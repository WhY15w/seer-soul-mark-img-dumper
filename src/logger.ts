import type { ILogger } from './types.js';

const colors = {
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
};

export class Logger implements ILogger {
  private enableColors: boolean;

  constructor(enableColors = true) {
    this.enableColors = enableColors;
  }

  info(message: string, ...args: unknown[]): void {
    const prefix = this.enableColors ? colors.blue('\u2139') : '[INFO]';
    console.log(`${prefix} ${message}`, ...args);
  }

  success(message: string, ...args: unknown[]): void {
    const prefix = this.enableColors ? colors.green('\u2705') : '[SUCCESS]';
    console.log(`${prefix} ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    const prefix = this.enableColors ? colors.yellow('\u26A0') : '[WARN]';
    console.warn(`${prefix} ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    const prefix = this.enableColors ? colors.red('\u274C') : '[ERROR]';
    console.error(`${prefix} ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    const prefix = this.enableColors ? colors.gray('\uD83D\uDD0D') : '[DEBUG]';
    console.log(`${prefix} ${message}`, ...args);
  }
}

export const logger = new Logger();
