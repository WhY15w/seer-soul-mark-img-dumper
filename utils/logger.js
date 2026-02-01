const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
};

class Logger {
  constructor(enableColors = true) {
    this.enableColors = enableColors;
  }

  info(message, ...args) {
    const prefix = this.enableColors ? colors.blue("ℹ") : "[INFO]";
    console.log(`${prefix} ${message}`, ...args);
  }

  success(message, ...args) {
    const prefix = this.enableColors ? colors.green("✅") : "[SUCCESS]";
    console.log(`${prefix} ${message}`, ...args);
  }

  warn(message, ...args) {
    const prefix = this.enableColors ? colors.yellow("⚠") : "[WARN]";
    console.warn(`${prefix} ${message}`, ...args);
  }

  error(message, ...args) {
    const prefix = this.enableColors ? colors.red("❌") : "[ERROR]";
    console.error(`${prefix} ${message}`, ...args);
  }

  debug(message, ...args) {
    const prefix = this.enableColors ? colors.gray("🔍") : "[DEBUG]";
    console.log(`${prefix} ${message}`, ...args);
  }
}

module.exports = new Logger();
