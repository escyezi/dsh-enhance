# DSH增强

DSH 桌面版插件。当前版本提供侧边栏余额卡片，后续增强功能会继续加在这个包里。

```
┌───────────────────────┐
│ 充值余额      ¥80.18  │     赠金为 0 时这一行不显示
│ 赠金 ¥0.47            │     悬停：可用余额 ¥80.65（充值 ¥80.18 · 赠金 ¥0.47）
└───────────────────────┘
```

- 侧边栏左下角、设置按钮正上方显示余额；退出登录时整块隐藏。
- 点击刷新，默认每 60 秒自动重读一次。
- 余额读取失败显示“余额不可用”，点击可重试，不会显示成 `¥0.00`。
- 折叠侧边栏（56px 窄栏）时退化为货币符号，数字都在悬停提示里。
- 悬停提示使用原生 `title`，不依赖 Harness 的 UI 包；唯一的浏览器运行时外部依赖是 `react/jsx-runtime`。

## 包信息

| | |
|---|---|
| 包名 | `@escyezi/dsh-enhance` |
| bundle 行 id | `dsh-enhance` |
| 显示名 | `DSH增强` / `DSH Enhance` |
| Host 全局变量 | `__DSH_ENHANCE__` |
| 客户端 locale 命名空间 | `escyezi.enhance` |

## 目录

```
src/index.ts                    Host 面：校验配置、下发浏览器配置
src/config.ts                   Host 侧配置校验（zod）
src/client-config.ts            浏览器侧配置读取（无运行时依赖）
src/types.ts                    共享配置类型
src/client/index.ts             浏览器面：注册余额卡片，后续功能也在这里挂载
src/client/locales.ts           插件文案（en / zh）
src/client/balance/             余额功能：账号流、金额换算、卡片与样式
locale/en.json / zh.json        插件页与插件列表里的显示名（meta.title / meta.description）
cordis.patch.yml                本 bundle 贡献的行 + 默认配置
tests/                          vitest 规格（35 个用例）
build.sh                        构建（借用 DSH 源码仓库的客户端打包预设）
icon.svg                        插件图标（原创 SVG）
```

## 构建

需要一份装好依赖的 DSH 源码 checkout。构建脚本不内置任何本机路径，用 `DSH_REPO` 指定：

```sh
export DSH_REPO=/path/to/deepseek-harness
cd /path/to/dsh-enhance
pnpm install      # 仅首次
pnpm check        # tsc --noEmit + vitest（35 个用例）
pnpm build        # 产出 lib/index.js（Host）与 lib/client.js（浏览器）
```

`build.sh` 会在 `$DSH_REPO/packages/client/ui-dsh-enhance` 建一个临时脚手架（复制 `src` 与两个配置文件，依赖从 DSH 仓库自己的 `node_modules` 解析），构建完自动删除，源码仓库里不留文件。产物里的 checkout 绝对路径会被替换成占位符，避免把本机路径带进浏览器包。

构建时把 `DSH_CLIENT_VERSION`（默认 `0.2.1-rc.2`）内联进浏览器包，作为调用 Platform 接口时上报的客户端版本。升级 DSH 桌面版后，按需用同名环境变量覆盖：

```sh
DSH_CLIENT_VERSION=0.2.2 pnpm build
```

## 安装

本包就是一个 **bundle**：`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，后者插入 `dsh-enhance` 行并带出默认配置。

1. 先 `pnpm build`，`lib/index.js` 与 `lib/client.js` 必须已经存在。
2. 侧边栏「插件」页 →「安装第三方插件 / 添加插件」→ 填本目录的绝对路径（例如 `/path/to/dsh-enhance`）。
3. 插件页会用 `pnpm add` 把本目录记成 profile 的 `link:` 依赖，并把它追加进 `dsh.profile.bundles`。装完在「已安装」里能看到 **DSH增强** 的开关。

本地目录安装是软链，没有中间副本；`lib/` 不入 Git，克隆后必须自己构建一次。

## 配置

行配置只有一项 `balanceRefreshMs`，默认值来自 `cordis.patch.yml`。想改，两种都行：

- 改 `cordis.patch.yml` 后重新构建并重装/切换本 bundle（改的是插件自己的默认值）；
- 在 profile 的 `cordis.patch.yml` 里按 id 覆盖（profile patch 永远在 bundle 之后应用）：

```yaml
- id: dsh-enhance
  config:
    balanceRefreshMs: 0            # 0 = 关闭后台定时刷新，只保留点击刷新
```

profile 的 `cordis.patch.yml` 默认位于 `~/.dsh/profiles/<profile>/cordis.patch.yml`。

## 更新代码

- 只改浏览器侧（`src/client/**`）：`pnpm build` → 在插件页把开关关掉再打开（或重启桌面版）→ ⌘R 刷新页面。
- 改 Host 侧（`src/index.ts` 等）：`pnpm build` 后通常要重启桌面版；链接进来的插件通过 profile 的 `node_modules` 解析，热重载默认忽略 `**/node_modules` 下的文件。

## 已知边界

- 余额只显示第一个钱包的币种（DeepSeek 账号通常只有 CNY）。
- 赠金用完后卡片不再显示赠金行，可用总额仍在悬停提示里。
- 余额读取失败时显示「余额不可用」并支持点击重试，不会显示成 `¥0.00`。
- 折叠侧边栏（窄栏）时余额卡片退化为货币符号，数字都在悬停提示里。
