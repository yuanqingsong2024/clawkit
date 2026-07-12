import * as readline from 'readline';

/**
 * 命令行交互工具
 * 基于 Node.js 内置 readline，避免引入第三方依赖
 */

/**
 * 选择项
 */
interface SelectOption {
  /** 显示标签 */
  label: string;
  /** 实际值 */
  value: string;
  /** 说明文字（可选） */
  description?: string;
}

/**
 * 创建 readline 接口
 */
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 询问用户输入
 * @param question 问题文本
 * @param defaultValue 默认值
 * @returns 用户输入的内容
 */
export async function askInput(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface();
  const defaultHint = defaultValue ? ` (默认: ${defaultValue})` : '';

  return new Promise<string>((resolve) => {
    rl.question(`${question}${defaultHint}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue || '');
    });
  });
}

/**
 * 让用户从列表中选择一项
 * @param question 问题文本
 * @param options 选项列表
 * @param defaultIndex 默认选中项索引（从 0 开始）
 * @returns 用户选择的值
 */
export async function askSelect(
  question: string,
  options: SelectOption[],
  defaultIndex: number = 0,
): Promise<string> {
  const rl = createInterface();

  console.log(`\n${question}`);
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? '>' : ' ';
    const desc = opt.description ? ` - ${opt.description}` : '';
    console.log(`  ${marker} ${i + 1}. ${opt.label}${desc}`);
  });

  return new Promise<string>((resolve) => {
    rl.question(`请输入序号 (默认: ${defaultIndex + 1}): `, (answer) => {
      rl.close();
      const trimmed = answer.trim();

      if (!trimmed) {
        resolve(options[defaultIndex].value);
        return;
      }

      const index = parseInt(trimmed, 10) - 1;
      if (isNaN(index) || index < 0 || index >= options.length) {
        // 输入无效时使用默认值
        resolve(options[defaultIndex].value);
        return;
      }

      resolve(options[index].value);
    });
  });
}

/**
 * 询问是/否问题
 * @param question 问题文本
 * @param defaultYes 默认是否为"是"
 * @returns 用户的选择
 */
export async function askConfirm(question: string, defaultYes: boolean = true): Promise<boolean> {
  const rl = createInterface();
  const hint = defaultYes ? '(Y/n)' : '(y/N)';

  return new Promise<boolean>((resolve) => {
    rl.question(`${question} ${hint}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();

      if (!trimmed) {
        resolve(defaultYes);
        return;
      }

      resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}
