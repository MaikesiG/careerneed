# CareerNeed — AI 驱动的通用职业操作系统

<p align="center">
  <a href="README.md">English</a> | <b>简体中文</b>
</p>

> **CareerNeed 帮助每一位职场人发现优质机会、管理全流程申请、针对性备战面试，并实现持续的职业进阶。**

CareerNeed 是一款 **AI 驱动的通用职业操作系统（Career Operating System）**。其核心目标是**消除求职与职业成长中的机械管理杂务**，服务于涵盖软件工程、数据、人工智能、产品、设计、金融、市场、销售、运营、医疗、法律等所有领域的职场人士。

```text
职业画像与发展方向 (Career Profile & Directions)
  ↳ 机会发现与多渠道职位归集 (Job Discovery & Ingestion)
    ↳ 候选人 ↔ 岗位精准匹配与技能差距分析 (Matching & Gap Analysis)
      ↳ 申请全流程看板与进度追踪 (Application Pipeline)
        ↳ 面试中心与 Fast Capture 智能调度 (Interviews & Prep Notes)
          ↳ AI 职业教练针对性备战 (AI Career Coach)
            ↳ 面试复盘与成败归因分析 (Outcome Analysis)
              ↳ 持续成长与职业智能 (Career Intelligence)
```

---

## 产品核心理念 (Product Philosophy)

> **“帮助用户减少记录的时间，多专注提高，并且给用户提供具有针对性的成长建议。”**

CareerNeed 坚持三大核心原则：
1. **消除一切机械杂务 (Zero Busywork)**：优先采用 *粘贴文本 → 智能提取 → 预览修改 → 一键入库*，彻底告别手动填写十几个表单字段的繁琐流程。
2. **行动指引优于被动记录 (Actionable Intelligence over Passive Records)**：拒绝让数据变成“冷冰冰的归档记录”。每一个职位、每一场面试都必须回答：*我需要准备什么？我缺什么技能？我为什么失败？下一步该做什么？*
3. **用户自主权与数据隐私 (User Agency & Data Privacy)**：所有求职数据与用户自带的 LLM 密钥（BYOK）均严格属于用户私有，数据库行级物理隔离。AI 提供透明可解释的辅助决策，绝不私自做主或静默提交。

---

## 当前已完成的功能 (Completed Features)

- **用户认证与数据隔离**：支持邮箱密码注册、登录、登出、基于安全 Token 的密码找回（`/forgot-password`、`/reset-password`）、安全 Session Cookie 维持，以及数据库层严格的单用户数据行级隔离。
- **简历版本与技能提取**：支持多版本 PDF 简历上传（`pdfplumber` 解析）、基于 LLM（或规则降级）的结构化专业技能提取、自定义标签、默认简历设定以及软归档/恢复。
- **职位数据采集与同步**：内置 Ashby、Greenhouse、Lever 三大主流公用 ATS 招聘系统连接器，支持批量与单公司同步；支持外部来源职位统一手动录入（`POST /jobs/manual`），基于 `(source, external_job_id)` 幂等去重。
- **统一职位检索看板 (`/jobs`)**：支持按标题/公司/地点全文检索、自定义搜索方向（Search Directions）、来源与工作模式多选、匹配分阈值筛选（0–100）、发布时间范围筛选以及 URL 状态持久化。
- **申请全生命周期追踪 (`/applications`)**：
  - 完整状态流转：`saved` → `applied` → `interviewing` → `offer` / `rejected` / `withdrawn`。
  - 双视图模式：表格列表视图与可视化看板视图（Pipeline Kanban Board `/applications/board`）。
  - 申请详情工作台 (`/applications/[applicationId]`)：状态实时更新、跟进日期智能调度（今日到期/已逾期提醒）、Markdown 备注编辑、投递简历版本绑定、联系人管理（HR、猎头、面试官、内推人）。
- **日常重点工作台 (`/todo`)**：聚合展示当前活跃申请量、今日待办与逾期待跟进事项。
- **LLM 密钥与安全管理 (`/settings`)**：支持用户自带密钥（BYOK: OpenAI / Groq / OpenRouter），采用 Fernet（AES-128-CBC）对称加密存储，内置 5 次免费调用额度与使用日志审计。
- **前端设计系统与无障碍主题**：基于 Next.js 15 与 Tailwind CSS 语义化 Token 体系构建，完整支持 System / Light / Dark 三种主题切换，无水合闪烁。

---

## 文档与系统规范 (Documentation)

项目全部技术与产品设计文档已收拢至 [`docs/`](docs/DOC_README.md) 目录中：

- [文档中心总览 (`docs/DOC_README.md`)](docs/DOC_README.md) — 文档目录导航、阅读路径与维护准则。
- [当前进展基线 (`docs/CURRENT_STATUS.md`)](docs/CURRENT_STATUS.md) — 经代码审查确认的已完成功能清单与已知优化项。
- [产品功能规格书 (`docs/PRODUCT_SPEC.md`)](docs/PRODUCT_SPEC.md) — 完整功能规格说明书（v0.2），涵盖面试管理、Fast Capture 与 AI 备考/复盘模块。
- [产品路线图 (`docs/ROADMAP.md`)](docs/ROADMAP.md) — 分阶段工程规划，当前以 Phase 2 面试管理为核心 Sprint。
- [产品需求文档 (`docs/PRODUCT_REQUIREMENT.md`)](docs/PRODUCT_REQUIREMENT.md) — 需求定义、用户故事与验收标准（PRD v0.2）。
- [系统架构设计 (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md) — 前后端分层、数据库模型、连接器采集、LLM 智能管道及架构决策（ADR）。
- [工程规范指南 (`docs/PROJECT_CONVINTIONS.md`)](docs/PROJECT_CONVINTIONS.md) — 前端语义 Token、接口命名规范、路由地图与 Definition of Done。

---

## 环境准备 (Prerequisites)

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Git

---

## 快速上手 (Getting Started)

### 1. 启动数据库

```bash
cp .env.example .env
docker compose up -d db
docker compose ps
```

### 2. 启动 FastAPI 后端服务

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

- API 交互文档：[http://localhost:8000/docs](http://localhost:8000/docs)
- 健康检查：`GET http://localhost:8000/health` → `{"status": "ok", "service": "careerneed-api"}`

### 3. 启动 Next.js 前端应用

```bash
cd apps/web
npm install
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

---

## 运行测试 (Running Tests)

### 后端单元测试
```bash
cd apps/api
source .venv/bin/activate
python -m pytest -q
```

### 前端代码检查与打包
```bash
cd apps/web
npm run lint
npm run build
```

---

## 核心 API 端点一览 (API Overview)

- **认证**：`POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- **简历**：`GET /resumes`, `POST /resumes/upload`, `GET /resumes/{id}`, `PATCH /resumes/{id}`, `DELETE /resumes/{id}`
- **职位**：`GET /jobs`, `GET /jobs/{id}`, `PATCH /jobs/{id}/status`, `POST /jobs/manual`
- **申请**：`GET /applications`, `POST /applications`, `GET /applications/{id}`, `PATCH /applications/{id}`, `DELETE /applications/{id}`, `PUT /applications/by-job/{job_id}`, `GET /applications/me/job-states`
- **联系人**：`GET /applications/{id}/contacts`, `POST /applications/{id}/contacts`, `PATCH /applications/{id}/contacts/{contact_id}`, `DELETE /applications/{id}/contacts/{contact_id}`
- **连接器**：`POST /connectors/{greenhouse|lever|ashby}/sync`, `POST /connectors/{greenhouse|lever|ashby}/sync-all`
- **日常看板**：`GET /dashboard/summary`, `GET /dashboard/follow-ups`
- **模型设置**：`GET /settings/llm-credentials`, `POST /settings/llm-credentials`, `DELETE /settings/llm-credentials/{provider}`, `GET /settings/extraction-mode`
- **面试管理（Phase 2 即将上线）**：`GET /interviews/upcoming`, `GET /applications/{id}/interviews`, `POST /applications/{id}/interviews`, `POST /interviews/fast-capture`, `POST /interviews/{id}/prep-plan`, `POST /interviews/{id}/analyze-outcome`

---

## 下一步工作 (What's Next)

当前团队正在全力推进 **Phase 2: 面试管理与 AI 备战指导**：
1. **面试数据模型与多轮次记录**：排期时间、轮次类型（HR 初筛、编码、系统设计、行为面试）、面试官备注。
2. **近期面试日程时间线**：清晰呈现未来 1–7 天内所有待进行的面试。
3. **Fast Capture 智能快捷录入**：支持直接粘贴邮件或日历邀请文本，AI 自动提取关键信息生成面试记录草稿。
4. **AI 针对性备考与赛后复盘诊断**：个性化生成高频考点、STAR 故事建议，并在失败后进行根因分析与提升指导。
