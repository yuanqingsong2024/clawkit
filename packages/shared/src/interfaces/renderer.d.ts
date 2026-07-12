import type { RenderInputMap, RenderTarget, TemplateVariables } from '../types/render';
/**
 * 模板渲染器接口
 * 负责渲染配置模板
 */
export interface TemplateRenderer {
    /**
     * 渲染模板
     * @param templateName 模板名称
     * @param variables 模板变量
     * @returns 渲染后的内容
     */
    render<TTarget extends RenderTarget>(templateName: TTarget, variables: RenderInputMap[TTarget]): Promise<string>;
    /**
     * 渲染字符串模板
     * @param template 模板字符串
     * @param variables 模板变量
     * @returns 渲染后的内容
     */
    renderString(template: string, variables: TemplateVariables): Promise<string>;
}
//# sourceMappingURL=renderer.d.ts.map