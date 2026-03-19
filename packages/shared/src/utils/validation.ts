import type { ZodIssue } from 'zod';

export function formatValidationIssue(issue: ZodIssue): string {
  if (issue.message && !issue.message.startsWith('Invalid input')) {
    return issue.message;
  }

  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined ? '必填字段缺失' : '字段类型不正确';

    case 'invalid_value':
      return '字段值不在允许范围内';

    case 'unrecognized_keys':
      return `存在未识别字段：${issue.keys.join('、')}`;

    case 'invalid_format':
      return '字段格式不正确';

    case 'invalid_union':
      return '字段结构不符合预期';

    case 'too_small':
      return '字段值过小或内容过短';

    case 'too_big':
      return '字段值过大或内容过长';

    default:
      return issue.message || '配置校验失败';
  }
}
