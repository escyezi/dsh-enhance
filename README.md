# DSH增强

DSH 桌面版插件：侧边栏余额卡片 + Plan-X 计划模式。两个功能是两个独立的插件行，在「插件」页分别开关。

```
┌───────────────────────┐
│ 充值余额      ¥80.18  │     赠金为 0 时这一行不显示
│ 赠金 ¥0.47            │     悬停：可用余额 ¥80.65（充值 ¥80.18 · 赠金 ¥0.47）
└───────────────────────┘
```

## 插件行

「DSH增强」是一张 bundle 卡片。卡片右上角的开关控制整个 bundle；卡片里的两行各有自己的开关：

| 行 id | 功能包 | 功能 | 配置 |
|---|---|---|---|
| `escyezi/dsh-enhance-balance` | `@escyezi/dsh-enhance-balance` | 侧边栏余额 | `balanceRefreshMs` |
| `escyezi/dsh-enhance-plan-x` | `@escyezi/dsh-enhance-plan-x` | Plan-X 计划模式 | 无 |

行 id 是 profile 里的 Loader 条目键，不是包名；包名始终带 `@`。`escyezi/` 前缀只用于避免和其他插件的行 id 冲突。

- 关掉某一行，该功能的 Host 注册和浏览器 UI 一起卸载，另一行继续运行。
- 余额行原来的 id 是 `dsh-enhance`，旧的 profile 覆盖需要改成新 id。
- 两个功能包是根 bundle 的 workspace 依赖，不会单独出现在「已安装」列表里。

## 余额卡片

- 侧边栏左下角、设置按钮正上方显示余额；退出登录时整块隐藏。
- 点击刷新，默认每 60 秒自动重读一次。
- 余额读取失败显示“余额不可用”，点击可重试，不会显示成 `¥0.00`。
- 折叠侧边栏（56px 窄栏）时退化为货币符号，数字都在悬停提示里。
- 悬停提示使用原生 `title`，不依赖 Harness 的 UI 包。
- 关掉余额行后，余额卡片和 `__DSH_ENHANCE_BALANCE__` 配置注入一起消失；Plan-X 不受影响。

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
- 关掉 Plan-X 行后，输入框开关、Build 按钮、自动打开、`/plan-x` 命令、`plan_x_write` 工具和策略段一起卸载；余额不受影响。

### 建议验收流程

1. 在工作区会话里点输入框左侧的 **Plan-X**。
2. 提一个需要计划的需求；模型应把计划写到 `.dsh/plans/<name>.plan.md`，右侧文档自动打开。
3. 继续对话要求修改计划；模型应更新同一份文档，而不是弹审批或要求你选“同意 / 继续计划”。
4. 提一个刻意模糊的需求（例如“帮我加个设置”）；模型应先通过 `ask_user_question` 问清范围/选项，再把答案写进计划。
5. 点文档右上角 **Build**；Plan-X 关闭，聊天里出现一条执行指令，模型开始按计划实现。

## 包信息

| | |
|---|---|
| bundle 包 | `@escyezi/dsh-enhance` |
| 余额包 | `@escyezi/dsh-enhance-balance` |
| Plan-X 包 | `@escyezi/dsh-enhance-plan-x` |
| bundle 行 id | `escyezi/dsh-enhance-balance`（余额）、`escyezi/dsh-enhance-plan-x`（Plan-X） |
| 显示名 | 卡片 `DSH增强` / `DSH Enhance`；行 `余额` / `Balance`、`Plan-X 计划模式` / `Plan-X` |
| Host 全局变量 | `__DSH_ENHANCE_BALANCE__` |
| 客户端 locale 命名空间 | `escyezi.enhance.balance` / `escyezi.enhance.planX` |
| Plan-X 文档目录 | `.dsh/plans/`（后缀 `.plan.md`） |

## 目录

```
package.json                     bundle：patch + 卡片 meta，不含功能代码
cordis.patch.yml                 插入余额行和 Plan-X 行
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
tests/                           vitest 规格（83 个用例）
build.sh                         循环构建两个功能包
tsconfig.json                    include packages/*/src + tests
pnpm-workspace.yaml              workspace：根包 + packages/*
```

## 构建

需要一份装好依赖的 DSH 源码 checkout。构建脚本不内置任何本机路径，用 `DSH_REPO` 指定：

```sh
export DSH_REPO=/path/to/deepseek-harness
cd /path/to/dsh-enhance
pnpm install      # 首次安装，同时建立 workspace 链接
pnpm check        # tsc --noEmit + vitest（83 个用例）
pnpm build        # 产出 packages/balance/lib 与 packages/plan-x/lib
```

`build.sh` 会为每个功能包在 `$DSH_REPO/packages/client/ui-<包名>` 建一个临时脚手架（复制该包的 `package.json`、`tsdown.config.ts` 与 `src`，依赖从 DSH 仓库自己的 `node_modules` 解析），构建完自动删除，源码仓库里不留文件。产物里的 checkout 绝对路径会被替换成占位符，避免把本机路径带进浏览器包。

根包是纯 bundle，没有 `lib/`；`pnpm build` 只构建两个功能包。

`pnpm check` 的 `tsc` 会带 `NODE_OPTIONS=--max-old-space-size=8192`，因为客户端 Slot 与投影类型图较大。

构建时把 `DSH_CLIENT_VERSION`（默认 `0.2.1-rc.2`）内联进浏览器包，作为调用 Platform 接口时上报的客户端版本。升级 DSH 桌面版后，按需用同名环境变量覆盖：

```sh
DSH_CLIENT_VERSION=0.2.2 pnpm build
```

## 安装

根包就是一个 **bundle**：`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，后者插入两个功能行。两个功能包是它的 workspace 依赖。

1. 先 `pnpm install` 和 `pnpm build`，`packages/*/lib/index.js` 与 `packages/*/lib/client.js` 必须已经存在。
2. 侧边栏「插件」页 →「安装第三方插件 / 添加插件」→ 填本目录的绝对路径（例如 `/path/to/dsh-enhance`）。
3. 插件页会用 `pnpm add` 把本目录记成 profile 的 `link:` 依赖，并把它追加进 `dsh.profile.bundles`。装完在「已安装」里能看到 **DSH增强** 卡片，卡片里有两行：余额、Plan-X。
4. 如果 profile 之前已经把本目录装成旧版单行插件，重建后关掉再打开「DSH增强」，或重启桌面版，让新的依赖和行生效；然后 ⌘R 刷新页面。

本地目录安装是软链，没有中间副本；`lib/` 不入 Git，克隆后必须自己构建一次。根 bundle 通过 workspace 依赖解析两个功能包，所以安装前必须在仓库根跑过 `pnpm install`。

## 配置

余额行只有一项 `balanceRefreshMs`，默认值来自 `cordis.patch.yml`。想改，两种都行：

- 改 `cordis.patch.yml` 后重新构建并重装/切换本 bundle（改的是插件自己的默认值）；
- 在 profile 的 `cordis.patch.yml` 里按行 id 覆盖（profile patch 永远在 bundle 之后应用）：

```yaml
- id: escyezi/dsh-enhance-balance
  config:
    balanceRefreshMs: 0            # 0 = 关闭后台定时刷新，只保留点击刷新
```

`escyezi/dsh-enhance-balance` 现在只代表余额行；Plan-X 行没有配置。想临时关掉某个功能，直接在插件页切对应行的开关即可，不需要改配置。

从旧版升级时，profile patch 里原来的 `- id: dsh-enhance` 覆盖不会再匹配新行；把它改成 `- id: escyezi/dsh-enhance-balance`，否则旧条目会被忽略并在启动时产生一条 not found warning。

profile 的 `cordis.patch.yml` 默认位于 `~/.dsh/profiles/<profile>/cordis.patch.yml`。

Plan-X 的目录和后缀目前是固定约定（`.dsh/plans/*.plan.md`），没有额外的行配置。

## 更新代码

- 只改浏览器侧（`packages/*/src/client/**`）：`pnpm build` → 在插件页把对应功能的行开关关掉再打开（或重启桌面版）→ ⌘R 刷新页面。
- 改 Host 侧（`packages/*/src/**` 等）：`pnpm build` → 在插件页切换对应行；如果工具/投影没有刷新，重启桌面版。链接进来的插件通过 profile 的 `node_modules` 解析，热重载默认忽略 `**/node_modules` 下的文件。
- 两个功能互不影响：只改余额时可以只切余额行，Plan-X 保持运行。

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
- 两个功能行可以独立开关；profile 行级覆盖使用 `escyezi/dsh-enhance-balance`，旧的 `- id: dsh-enhance` 不再匹配。整个插件仍由卡片右上角的总开关控制。
- 如果当前会话没有提供 `ask_user_question` 工具，Plan-X 策略要求模型在回复正文里直接提出同样的澄清问题，而不是猜测。
