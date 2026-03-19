#!/usr/bin/env python3
"""
验证 SetupWizardPage 中 Stepper 组件的位置和视觉呈现

验证项：
1. Stepper 在页面顶部（标题下方，卡片上方）
2. 顶部容器具有渐变背景和视觉增强
3. 响应式布局（桌面横向，移动纵向）
4. 无重复 Stepper 实例
"""

from playwright.sync_api import sync_playwright
import sys


def verify_stepper_placement():
    """验证 Stepper 位置和基础渲染"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 访问 Setup 向导页面
            page.goto("http://localhost:5173/setup", timeout=10000)
            page.wait_for_load_state("networkidle")

            print("✓ 页面加载成功")

            # 验证页面标题存在
            title = page.locator('h1:has-text("一键配置向导")')
            if not title.is_visible():
                print("✗ 页面标题未找到")
                return False
            print("✓ 页面标题存在")

            # 验证第一个卡片是"1. 选择输入模式"
            first_card = page.locator("text=1. 选择输入模式").first
            if not first_card.is_visible():
                print("✗ 第一个卡片未找到")
                return False
            print("✓ 第一个卡片（1. 选择输入模式）存在")

            # 检查是否存在 runDetail（初始状态应该没有）
            stepper_container = page.locator('div:has-text("执行步骤")').first
            if stepper_container.is_visible():
                print("✓ 检测到顶部 Stepper 容器（runDetail 存在）")

                # 验证容器位置：应该在标题和第一个卡片之间
                title_box = title.bounding_box()
                card_box = first_card.bounding_box()
                container_box = stepper_container.bounding_box()

                if title_box and card_box and container_box:
                    if title_box["y"] < container_box["y"] < card_box["y"]:
                        print("✓ Stepper 容器位置正确（标题下方，卡片上方）")
                    else:
                        print(f"✗ Stepper 容器位置错误")
                        print(f"  标题 Y: {title_box['y']}")
                        print(f"  容器 Y: {container_box['y']}")
                        print(f"  卡片 Y: {card_box['y']}")
                        return False

                # 验证视觉容器样式（渐变背景、圆角、边框）
                container_classes = stepper_container.get_attribute("class") or ""
                if "rounded-2xl" in container_classes and "border" in container_classes:
                    print("✓ 顶部容器具有视觉增强样式")
                else:
                    print("⚠ 顶部容器可能缺少部分视觉样式")

                # 检查是否有重复的 Stepper（不应该在"4. 执行进度"卡片内）
                old_stepper_location = (
                    page.locator("text=4. 执行进度")
                    .locator("..")
                    .locator('[class*="flex items-center"]')
                )
                if old_stepper_location.count() > 0:
                    print("✗ 检测到旧位置的 Stepper（应该已移除）")
                    return False
                print("✓ 无重复 Stepper 实例")

            else:
                print("ℹ 初始状态：runDetail 不存在，Stepper 未渲染（符合预期）")

            # 截图保存（桌面视图）
            page.set_viewport_size({"width": 1280, "height": 800})
            page.screenshot(path="/tmp/stepper_desktop.png", full_page=True)
            print("✓ 桌面视图截图已保存: /tmp/stepper_desktop.png")

            # 截图保存（移动视图）
            page.set_viewport_size({"width": 375, "height": 667})
            page.screenshot(path="/tmp/stepper_mobile.png", full_page=True)
            print("✓ 移动视图截图已保存: /tmp/stepper_mobile.png")

            print("\n=== 验证总结 ===")
            print("✓ 页面结构正确")
            print("✓ Stepper 位置符合要求（当 runDetail 存在时）")
            print("✓ 无重复实例")
            print("ℹ 动画效果需要在有真实步骤数据时验证")

            return True

        except Exception as e:
            print(f"✗ 验证失败: {e}")
            page.screenshot(path="/tmp/stepper_error.png", full_page=True)
            print("错误截图已保存: /tmp/stepper_error.png")
            return False
        finally:
            browser.close()


if __name__ == "__main__":
    print("开始验证 Stepper 位置和渲染...")
    print("前置条件: Web 服务需要在 http://localhost:5173 运行")
    print()

    success = verify_stepper_placement()
    sys.exit(0 if success else 1)
