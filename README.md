# DSH增强

DSH 桌面版插件：侧边栏余额卡片 + Plan-X 计划模式 + 创造模式的本地源码参考。三个功能是三个独立的插件行，在「插件」页分别开关。

```
┌───────────────────────┐
│ 充值余额      ¥80.18  │     赠金为 0 时这一行不显示
│ 赠金 ¥0.47            │     悬停：可用余额 ¥80.65（充值 ¥80.18 · 赠金 ¥0.47）
└───────────────────────┘
```

## 插件行

「DSH增强」是一张 bundle 卡片。卡片右上角的开关控制整个 bundle；卡片里的三行各有自己的开关：

| 行 id | 功能包 | 功能 | 配置 |
|---|---|---|---|
| `escyezi/dsh-enhance-balance` | `@escyezi/dsh-enhance-balance` | 侧边栏余额 | `balanceRefreshMs` |
| `escyezi/dsh-enhance-plan-x` | `@escyezi/dsh-enhance-plan-x` | Plan-X 计划模式 | 无 |
| `escyezi/dsh-enhance-source` | `@escyezi/dsh-enhance-source` | 创造模式源码参考 | `sourcePath` |

行 id 是 profile 里的 Loader 条目键，不是包名；包名始终带 `@`。`escyezi/` 前缀只用于避免和其他插件的行 id 冲突。

- 关掉某一行，该功能的 Host 注册和浏览器 UI 一起卸载，另外两行继续运行。
- 余额行原来的 id 是 `dsh-enhance`，旧的 profile 覆盖需要改成新 id。
- 三个功能包是根 bundle 的 workspace 依赖，不会单独出现在「已安装」列表里。

## 余额卡片

- 侧边栏左下角、设置按钮正上方显示余额；退出登录时整块隐藏。
- 点击刷新，默认每 60 秒自动重读一次。
- 余额读取失败显示“余额不可用”，点击可重试，不会显示成 `¥0.00`。
- 折叠侧边栏（56px 窄栏）时退化为货币符号，数字都在悬停提示里。
- 悬停提示使用原生 `title`，不依赖 Harness 的 UI 包。
- 关掉余额行后，余额卡片和 `__DSH_ENHANCE_BALANCE__` 配置注入一起消失；Plan-X 和源码参考不受影响。

## Plan-X 模式

Plan-X 是自带 plan 模式的替代交互：计划是一组普通 Markdown 文件，模型在正常对话里新增或修改，不弹审批，也不会在每次写完计划后强制在“同意 / 继续计划”里二选一。

- 入口：输入框左侧的 **Plan-X** 开关，或命令 `/plan-x on` / `/plan-x off`。
- 计划位置：当前工作区的 `.dsh/plans/*.plan.md`；路径始终相对工作区根目录解析，不会写到用户主目录的 `~/.dsh`。
- 模型通过 `plan_x_write` 创建或覆盖计划文档；这个工具只在 Plan-X 模式下可用，写文件不需要审批，也不会结束当前对话。
- 需求、范围、约束、验收标准或用户才能决定的事项不明确时，模型会先调用 `ask_user_question` 向你确认细节，给出具体选项和推荐项；答案会并入计划。已有足够信息时不会为了走流程而多问。
- 澄清问题不是审批请求：Plan-X 仍然不弹审批，也不会调用 `exit_plan_mode`。
- 计划写入或修改后，右侧栏会自动打开该 Markdown 文档；文档右上角有 **Build** 按钮。
- 点击 Build：退出 Plan-X，并向当前会话发送一条普通的“按这份计划执行”的用户消息。不会新建会话，也不会切换模型。
- 想离开 Plan-X 但不执行：再点一次开关，或输入 `/plan-x off`。
- Plan-X 与自带 plan 模式互斥：开启 Plan-X 会关闭自带 plan；自带 plan 处于开启状态时，Plan-X 的策略段不会注入。
- 计划文件就是普通 Markdown，可以手动编辑、放进 Git，或作为交付物分享。
- 关掉 Plan-X 行后，输入框开关、Build 按钮、自动打开、`/plan-x` 命令、`plan_x_write` 工具和策略段一起卸载；余额和源码参考不受影响。

### 建议验收流程

1. 在工作区会话里点输入框左侧的 **Plan-X**。
2. 提一个需要计划的需求；模型应把计划写到 `.dsh/plans/<name>.plan.md`，右侧文档自动打开。
3. 继续对话要求修改计划；模型应更新同一份文档，而不是弹审批或要求你选“同意 / 继续计划”。
4. 提一个刻意模糊的需求（例如“帮我加个设置”）；模型应先通过 `ask_user_question` 问清范围/选项，再把答案写进计划。
5. 点文档右上角 **Build**；Plan-X 关闭，聊天里出现一条执行指令，模型开始按计划实现。

## 源码参考

这一行把本地 deepseek-harness 源码目录作为创造模式的只读参考，并提供两个更新按钮。

### 配置

1. 打开「插件」页 →「DSH增强」→「源码参考」→ **Configure**。
2. 在「本地源码目录」填入本机已存在的 deepseek-harness checkout 绝对路径（例如 `/Users/me/deepseek-harness`），或点「选择目录」。
3. 点「保存」后自动检查：
   - 目录是否存在、是否为 DSH 源码 checkout（`packages/client/tsdown.client.ts`）；
   - 源码 `package.json` 的版本；
   - **运行时版本**：优先取 Host 进程的 `DSH_CLIENT_VERSION`（Desktop 启动 Host 时注入），否则回退到本机安装的 `@deepseek-ai/dsh` / `dsh-system-prompt` 包版本；页面显示来源（运行环境 / 安装包）；
   - 当前分支、精确 tag、HEAD、上游、领先/落后、未提交修改、依赖是否安装。
4. 源码版本与运行时版本不一致时，页面会提示可用「更新到当前版本」对齐。

### 两个更新按钮

| 按钮 | 行为 |
|---|---|
| **更新到最新** | `git fetch --prune origin` → 解析 `origin` 默认分支 → 切到该分支 → `git merge --ff-only origin/<branch>`。 |
| **更新到当前版本 (x.y.z)** | 用 Host 检测到的运行时版本构造 `dsh-v<x.y.z>` → `git fetch --tags origin` → 校验 tag → `git checkout --detach refs/tags/dsh-v<x.y.z>`。 |

- 两个按钮都**不会** reset、stash、clean 或强制覆盖；工作区不干净、分叉、未跟踪文件冲突时由 git 自己拒绝，并原样显示输出。
- 「更新到最新」总是更新 `origin` 的默认分支，不是当前所在的 feature 分支；feature 分支不会被删除。
- 「更新到当前版本」检出 tag 后是 detached HEAD；再点「更新到最新」会切回默认分支。两个按钮都只影响这个 checkout，不会自动跑 `pnpm install` 或构建。
- 运行时版本检测不到时，「更新到当前版本」禁用并说明原因；「更新到最新」仍可用。
- 更新只接受 Host 已保存的 `sourcePath`；浏览器不能指定路径，也不能指定版本。

### 创造模式提示词

- 只在 Agent preset 为 **创造模式**（内置 `cordis` preset）的会话中注入。
- 固定说明放在系统提示词段；当前路径和版本放在运行时上下文，路径/版本变化时只追加一条上下文快照，不改写已缓存的系统提示词。
- 说明要求模型把该目录当作只读参考：用它确认插件 API、Loader/Client Slot 契约、locale 与构建工具，并区分运行时安装目录（可能在 `app.asar` 里）。
- 标准模式、Plan-X、PTC、极简模式都不会看到这段源码路径。
- 关掉「源码参考」行后，配置页、提示词注入和三条本地路由（inspect / update / status）一起卸载。

## 包信息

| | |
|---|---|
| bundle 包 | `@escyezi/dsh-enhance` |
| 余额包 | `@escyezi/dsh-enhance-balance` |
| Plan-X 包 | `@escyezi/dsh-enhance-plan-x` |
| 源码参考包 | `@escyezi/dsh-enhance-source` |
| bundle 行 id | `escyezi/dsh-enhance-balance`、`escyezi/dsh-enhance-plan-x`、`escyezi/dsh-enhance-source` |
| 显示名 | 卡片 `DSH增强` / `DSH Enhance`；行 `余额` / `Balance`、`Plan-X 计划模式` / `Plan-X`、`源码参考` / `Source Reference` |
| Host 全局变量 | `__DSH_ENHANCE_BALANCE__` |
| 客户端 locale 命名空间 | `escyezi.enhance.balance` / `escyezi.enhance.planX` / `escyezi.enhance.source` |
| Plan-X 文档目录 | `.dsh/plans/`（后缀 `.plan.md`） |
| 源码参考 tag 约定 | `dsh-v<运行时版本>`，例如 `dsh-v0.2.1-rc.2` |
| 源码参考路由 | `/dsh-enhance/source/inspect`、`/dsh-enhance/source/update`、`/dsh-enhance/source/update/status` |

## 目录

```
package.json                     bundle：patch + 卡片 meta，不含功能代码
cordis.patch.yml                 插入余额、Plan-X、源码参考三行
locale/en.json / zh.json         bundle 卡片的显示名与描述
icon.svg                         bundle 卡片图标
packages/balance/                余额功能包（Host + Client）
  src/index.ts                   Host：配置校验与下发
  src/config.ts                  Host 配置校验（zod）
  src/client-config.ts           浏览器侧配置读取
  src/types.ts                   共享配置类型
  src/client/                    余额卡片、金额换算、locale
packages/plan-x/                 Plan-X 功能包（Host + Client）
  src/index.ts                   Host：投影/命令/策略/工具装配
  src/projection.ts              planX 投影
  src/command.ts                 /plan-x on|off
  src/policy.ts                  Plan-X 系统提示段（含澄清询问要求）
  src/tool.ts                    plan_x_write
  src/types.ts                   共享类型、路径规则、projection 声明
  src/client/                    开关、Build 按钮、自动打开、locale
packages/source/                 源码参考功能包（Host + Client）
  src/index.ts                   Host：Config、提示词、更新管理器、路由装配
  src/config.ts                  Schemastery Config（sourcePath，volatile）
  src/shared.ts                  行/路由常量、共享 wire 类型
  src/policy.ts                  Creator-only 提示词段与运行时上下文
  src/runtime.ts                 运行时版本检测（env / 安装包）
  src/resolve.ts                 源码 checkout 解析与检查
  src/git.ts                     ctx.subprocess 上的 GitRunner
  src/update.ts                  latest / version 两个更新动作
  src/handlers.ts                三条路由的 HTTP handler
  src/route.ts                   路由注册与 connection 鉴权
  src/client/                    配置页、控制器、locale、样式
tests/                           vitest 规格（159 个用例）
build.sh                         循环构建三个功能包
tsconfig.json                    include packages/*/src + tests
pnpm-workspace.yaml              workspace：根包 + packages/*
```

## 构建

需要一份装好依赖的 DSH 源码 checkout。构建脚本不内置任何本机路径，用 `DSH_REPO` 指定：

```sh
export DSH_REPO=/path/to/deepseek-harness
cd /path/to/dsh-enhance
pnpm install      # 首次安装，同时建立 workspace 链接
pnpm check        # tsc --noEmit + vitest（159 个用例）
pnpm build        # 产出 packages/balance/lib、packages/plan-x/lib、packages/source/lib
```

`build.sh` 会为每个功能包在 `$DSH_REPO/packages/client/ui-<包名>` 建一个临时脚手架（复制该包的 `package.json`、`tsdown.config.ts` 与 `src`，依赖从 DSH 仓库自己的 `node_modules` 解析），构建完自动删除，源码仓库里不留文件。产物里的 checkout 绝对路径会被替换成占位符，避免把本机路径带进浏览器包。

根包是纯 bundle，没有 `lib/`；`pnpm build` 只构建三个功能包。

`pnpm check` 的 `tsc` 会带 `NODE_OPTIONS=--max-old-space-size=8192`，因为客户端 Slot 与投影类型图较大。

构建时把 `DSH_CLIENT_VERSION`（默认 `0.2.1-rc.2`）内联进浏览器包，作为调用 Platform 接口时上报的客户端版本。升级 DSH 桌面版后，按需用同名环境变量覆盖：

```sh
DSH_CLIENT_VERSION=0.2.2 pnpm build
```

注意：源码参考的「当前版本」**不是**这个构建时值，而是 Host 运行时检测到的本机 DSH 版本（Desktop 的 `DSH_CLIENT_VERSION` 环境变量或安装包版本）。

## 安装

根包就是一个 **bundle**：`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，后者插入三个功能行。三个功能包是它的 workspace 依赖。

1. 先 `pnpm install` 和 `pnpm build`，`packages/*/lib/index.js` 与 `packages/*/lib/client.js` 必须已经存在。
2. 侧边栏「插件」页 →「安装第三方插件 / 添加插件」→ 填本目录的绝对路径（例如 `/path/to/dsh-enhance`）。
3. 插件页会用 `pnpm add` 把本目录记成 profile 的 `link:` 依赖，并把它追加进 `dsh.profile.bundles`。装完在「已安装」里能看到 **DSH增强** 卡片，卡片里有三行：余额、Plan-X、源码参考。
4. 如果 profile 之前已经把本目录装成旧版两行插件，重建后关掉再打开「DSH增强」，或重启桌面版，让新的依赖和行生效；然后 ⌘R 刷新页面。若「源码参考」行显示为关，单独打开该行开关即可。

本地目录安装是软链，没有中间副本；`lib/` 不入 Git，克隆后必须自己构建一次。根 bundle 通过 workspace 依赖解析三个功能包，所以安装前必须在仓库根跑过 `pnpm install`。

## 配置

余额行只有一项 `balanceRefreshMs`，默认值来自 `cordis.patch.yml`。想改，两种都行：

- 改 `cordis.patch.yml` 后重新构建并重装/切换本 bundle（改的是插件自己的默认值）；
- 在 profile 的 `cordis.patch.yml` 里按行 id 覆盖（profile patch 永远在 bundle 之后应用）：

```yaml
- id: escyezi/dsh-enhance-balance
  config:
    balanceRefreshMs: 0            # 0 = 关闭后台定时刷新，只保留点击刷新
```

源码参考行只有一项 `sourcePath`。推荐在插件页的 Configure 里设置；也可以直接覆盖 profile patch：

```yaml
- id: escyezi/dsh-enhance-source
  config:
    sourcePath: /Users/me/deepseek-harness
```

`escyezi/dsh-enhance-balance` 只代表余额行；Plan-X 行没有配置；源码参考行只有 `sourcePath`。想临时关掉某个功能，直接在插件页切对应行的开关即可，不需要改配置。

从旧版升级时，profile patch 里原来的 `- id: dsh-enhance` 覆盖不会再匹配新行；把它改成 `- id: escyezi/dsh-enhance-balance`，否则旧条目会被忽略并在启动时产生一条 not found warning。

profile 的 `cordis.patch.yml` 默认位于 `~/.dsh/profiles/<profile>/cordis.patch.yml`。

Plan-X 的目录和后缀目前是固定约定（`.dsh/plans/*.plan.md`），没有额外的行配置。

## 更新代码

- 只改浏览器侧（`packages/*/src/client/**`）：`pnpm build` → 在插件页把对应功能的行开关关掉再打开（或重启桌面版）→ ⌘R 刷新页面。
- 改 Host 侧（`packages/*/src/**` 等）：`pnpm build` → 在插件页切换对应行；如果工具/投影没有刷新，重启桌面版。链接进来的插件通过 profile 的 `node_modules` 解析，热重载默认忽略 `**/node_modules` 下的文件。
- 三个功能互不影响：只改余额时可以只切余额行，Plan-X 和源码参考保持运行。

## 已知边界

- 余额只显示第一个钱包的币种（DeepSeek 账号通常只有 CNY）。
- 赠金用完后卡片不再显示赠金行，可用总额仍在悬停提示里。
- 余额读取失败时显示「余额不可用」并支持点击重试，不会显示成 `¥0.00`。
- 折叠侧边栏（窄栏）时余额卡片退化为货币符号，数字都在悬停提示里。
- Plan-X 需要工作区目录；没有工作区的会话可以开关模式，但 `plan_x_write` 会拒绝写入。计划路径始终相对工作区根目录，不是 `~/.dsh`。
- Plan-X 目前靠系统提示约束模型“只改计划、不改源码”，并没有在工具层禁用 `write` / `edit`；计划工具本身只能写 `.dsh/plans/*.plan.md`。
- Plan-X 与自带 plan 互斥；两者都开启时以自带 plan 的策略为准，建议先用 `/plan-x on` 或开关切到 Plan-X。
- 如果未安装右侧文档预览（sidebar document preview），计划仍会写入，但没有自动打开和 Build 按钮。
- 本仓库把 `.dsh/plans/` 加入 `.gitignore`，避免把本机的 Plan-X 计划文档当作插件源码提交；其他工作区是否提交计划由各自仓库决定。
- 三个功能行可以独立开关；profile 行级覆盖使用 `escyezi/dsh-enhance-balance` / `escyezi/dsh-enhance-source`，旧的 `- id: dsh-enhance` 不再匹配。整个插件仍由卡片右上角的总开关控制。
- 如果当前会话没有提供 `ask_user_question` 工具，Plan-X 策略要求模型在回复正文里直接提出同样的澄清问题，而不是猜测。
- 源码参考只在创造模式（`cordis` preset）注入；自定义 preset 不会命中。
- 源码参考的「当前版本」取 Host 检测结果：Desktop 优先用运行中的 `DSH_CLIENT_VERSION`，CLI/Web 回退到安装包版本；两者都不可用时版本按钮禁用，不猜版本。
- 源码参考更新的是当前分支的上游，不切换 release tag、不 reset/stash/force；`dsh-v<version>` tag 不存在时版本按钮会失败，「更新到最新」仍可用。
- 更新只拉源码，不会自动 `pnpm install` 或构建；pull/checkout 后依赖或产物可能需要你自行处理。
- 源码目录的“只读”是提示词约束，不是沙箱；模型仍可能用 `write` / `edit` 写它。
- 源码参考的路由只操作已保存的 `sourcePath`，由 `connection.requestRejection` 保护；行关闭时路由一起卸载。
- 运行时版本检测依赖 `pluginPackages` 的安装包回退；如果 DSH 升级改变该服务结构，Desktop 的 `DSH_CLIENT_VERSION` 路径仍可用。
