# API 接口文档

<cite>
**本文档引用的文件**
- [src/app/api/alerts/route.ts](file://src/app/api/alerts/route.ts)
- [src/app/api/posts/route.ts](file://src/app/api/posts/route.ts)
- [src/app/api/posts/[id]/route.ts](file://src/app/api/posts/[id]/route.ts)
- [src/app/api/subreddits/route.ts](file://src/app/api/subreddits/route.ts)
- [src/app/api/scan/route.ts](file://src/app/api/scan/route.ts)
- [src/app/api/dashboard/route.ts](file://src/app/api/dashboard/route.ts)
- [src/app/api/keywords/route.ts](file://src/app/api/keywords/route.ts)
- [src/app/api/detection-rules/route.ts](file://src/app/api/detection-rules/route.ts)
- [src/app/api/import/route.ts](file://src/app/api/import/route.ts)
- [src/app/api/scan-schedule/route.ts](file://src/app/api/scan-schedule/route.ts)
- [src/app/api/compare/route.ts](file://src/app/api/compare/route.ts)
- [src/app/api/subreddit-detail/route.ts](file://src/app/api/subreddit-detail/route.ts)
- [src/app/api/influencers/route.ts](file://src/app/api/influencers/route.ts)
- [src/app/api/proxy-diag/route.ts](file://src/app/api/proxy-diag/route.ts)
- [src/app/api/connectivity/route.ts](file://src/app/api/connectivity/route.ts)
- [src/app/api/reddit-search/route.ts](file://src/app/api/reddit-search/route.ts)
- [src/lib/apify.ts](file://src/lib/apify.ts)
- [src/lib/store.ts](file://src/lib/store.ts)
- [src/lib/types.ts](file://src/lib/types.ts)
- [src/app/search/search-page.tsx](file://src/app/search/search-page.tsx)
</cite>

## 更新摘要
**变更内容**
- 新增 Reddit 搜索 API 功能模块
- 添加 POST /api/reddit-search 用于关键词搜索
- 添加 PUT /api/reddit-search 用于导入帖子
- **更新** Reddit JSON API 数据增强功能：自动补充搜索结果中的评分和评论计数数据
- **更新** 改进调试基础设施：增强 Apify 调试功能，专门针对 scrape 模式的前6个帖子输出 score 和 commentCount 信息，改进了问题定位能力
- **更新** 优化 Reddit 搜索行为：关键词匹配现仅针对帖子标题，排除已归档和锁定的帖子
- **更新** 新增诊断字段（rawItemCount、filteredPostCount、firstItemKeys、firstItemSample）
- **更新** 改进错误处理和超时控制机制
- 更新外部服务集成说明
- 增强数据存储和缓存机制

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介
本文件为 Reddit 监控系统的完整 RESTful API 文档。该系统基于 Next.js App Router 构建，提供 Reddit 帖子监控、情感分析、关键词统计、告警管理、仪表板展示等功能。API 设计遵循 REST 原则，采用 JSON 格式进行请求和响应，并通过 NextResponse 提供统一的 HTTP 响应处理。

**更新** 新增 Reddit 搜索功能，支持通过关键词和版块进行帖子搜索，并提供搜索结果导入功能。系统现已增强诊断能力，提供详细的搜索过程统计信息，帮助定位搜索问题。**新增 Reddit JSON API 数据增强功能，自动补充搜索结果中的评分和评论计数数据，显著提升了搜索结果的准确性。** **改进的调试基础设施提供了更好的问题定位能力，新增针对 scrape 模式的详细调试输出，专门输出前6个帖子的 score 和 commentCount 信息。** 关键词匹配现在仅针对帖子标题进行精确匹配，排除了已归档和锁定的帖子，显著提升了搜索结果的质量和相关性。

## 项目结构
系统采用模块化设计，API 路由按照功能域组织在 `src/app/api/` 目录下：

```mermaid
graph TB
subgraph "API 路由层"
Alerts[告警管理]
Posts[帖子管理]
Subreddits[板块查询]
Scan[扫描调度]
Dashboard[仪表板]
Keywords[关键词分析]
Import[数据导入]
Config[配置管理]
RedditSearch[Reddit搜索]
end
subgraph "业务逻辑层"
Store[数据存储]
Sentiment[情感分析]
Scheduler[定时任务]
Reddit[Reddit API]
Apify[Apify集成]
end
subgraph "外部服务"
Apify[Apify 代理]
RedditAPI[Reddit API]
end
Alerts --> Store
Posts --> Store
Scan --> Store
Scan --> Sentiment
Scan --> Reddit
Scan --> Scheduler
Dashboard --> Store
Keywords --> Store
Keywords --> Sentiment
Import --> Store
Config --> Store
RedditSearch --> Apify
RedditSearch --> Store
```

**图表来源**
- [src/app/api/alerts/route.ts:1-62](file://src/app/api/alerts/route.ts#L1-L62)
- [src/app/api/scan/route.ts:1-394](file://src/app/api/scan/route.ts#L1-L394)
- [src/app/api/dashboard/route.ts:1-108](file://src/app/api/dashboard/route.ts#L1-L108)
- [src/app/api/reddit-search/route.ts:1-159](file://src/app/api/reddit-search/route.ts#L1-L159)

**章节来源**
- [src/app/api/alerts/route.ts:1-62](file://src/app/api/alerts/route.ts#L1-L62)
- [src/app/api/scan/route.ts:1-394](file://src/app/api/scan/route.ts#L1-L394)
- [src/app/api/dashboard/route.ts:1-108](file://src/app/api/dashboard/route.ts#L1-L108)
- [src/app/api/reddit-search/route.ts:1-159](file://src/app/api/reddit-search/route.ts#L1-L159)

## 核心组件
系统包含以下核心组件：

### 数据存储组件
- **store**: 统一的数据访问层，提供帖子、评论、配置、扫描结果等数据的 CRUD 操作
- **mock-data**: 开发环境下的模拟数据，用于演示和测试

### 分析组件
- **sentiment**: 情感分析引擎，支持关键词匹配和 LLM 分析
- **summary**: 自动摘要生成
- **scheduler**: 定时扫描任务管理

### 外部集成
- **apify**: Apify 代理服务集成，提供 Reddit 数据抓取能力
- **reddit**: Reddit API 客户端封装

**更新** 新增 Reddit 搜索功能，通过 Apify 集成实现关键词搜索和结果导入。系统现在提供详细的诊断信息，帮助用户理解搜索过程和结果质量。**新增 Reddit JSON API 数据增强功能，通过并行请求自动补充搜索结果中的评分和评论计数数据，显著提升了搜索结果的准确性。** **改进的调试基础设施提供了更好的问题定位能力，新增针对 scrape 模式的详细调试输出，专门输出前6个帖子的 score 和 commentCount 信息，优化了调试输出和问题定位能力。** **关键词匹配算法已优化为仅匹配帖子标题，排除了已归档和锁定的帖子，提升了搜索结果的相关性和质量。**

**章节来源**
- [src/app/api/scan/route.ts:1-394](file://src/app/api/scan/route.ts#L1-L394)
- [src/app/api/dashboard/route.ts:1-108](file://src/app/api/dashboard/route.ts#L1-L108)
- [src/lib/apify.ts:1-511](file://src/lib/apify.ts#L1-L511)

## 架构概览
系统采用分层架构设计，各层职责清晰分离：

```mermaid
graph TB
subgraph "表现层"
WebUI[Web 界面]
Mobile[移动端应用]
end
subgraph "API 层"
Router[Next.js 路由器]
Handler[请求处理器]
RedditSearch[Reddit搜索处理器]
end
subgraph "业务逻辑层"
Service[业务服务]
Validator[数据验证]
ApifyService[Apify服务]
StoreService[存储服务]
end
subgraph "数据访问层"
Repository[数据仓库]
Cache[缓存层]
MemoryStore[内存存储]
end
subgraph "外部服务"
Reddit[Reddit API]
Apify[Apify 服务]
LLM[大语言模型]
end
WebUI --> Router
Mobile --> Router
Router --> Handler
Handler --> Service
Service --> Validator
Service --> Repository
Repository --> Cache
Repository --> MemoryStore
Service --> ApifyService
Service --> StoreService
ApifyService --> Apify
StoreService --> Store
Service --> Reddit
Service --> Apify
Service --> LLM
```

**图表来源**
- [src/app/api/scan/route.ts:1-394](file://src/app/api/scan/route.ts#L1-L394)
- [src/app/api/keywords/route.ts:1-156](file://src/app/api/keywords/route.ts#L1-L156)
- [src/app/api/reddit-search/route.ts:1-159](file://src/app/api/reddit-search/route.ts#L1-L159)

## 详细组件分析

### 告警管理 API
提供 Reddit 帖子告警的查询和状态更新功能。

#### 端点定义
- **GET** `/api/alerts` - 查询告警列表
- **PATCH** `/api/alerts` - 更新告警状态

#### 请求参数
**GET 请求参数:**
- `status` (可选): 告警状态过滤器
  - 值: `all` | `pending` | `processing` | `resolved` | `ignored`
  - 默认: `all`

#### 响应格式
```json
{
  "posts": [
    {
      "id": "string",
      "title": "string",
      "alertLevel": "critical" | "medium" | "safe" | "low",
      "alertStatus": "pending" | "processing" | "resolved" | "ignored",
      "handler": "string",
      "handleNote": "string",
      "handleTime": "string",
      "createdAt": "string"
    }
  ],
  "stats": {
    "pending": 0,
    "pendingCritical": 0,
    "pendingMedium": 0,
    "processing": 0,
    "resolved": 0,
    "ignored": 0
  }
}
```

#### 错误处理
- 400 Bad Request: 缺少必需参数
- 404 Not Found: 帖子不存在

**章节来源**
- [src/app/api/alerts/route.ts:1-62](file://src/app/api/alerts/route.ts#L1-L62)

### 帖子管理 API
提供 Reddit 帖子的查询、删除和管理功能。

#### 端点定义
- **GET** `/api/posts` - 查询帖子列表
- **DELETE** `/api/posts` - 删除帖子

#### 请求参数
**GET 请求参数:**
- `level` (可选): 告警级别过滤
  - 值: `all` | `critical` | `medium` | `safe`
- `search` (可选): 搜索关键词
- `sort` (可选): 排序方式
  - 值: `alert` | `date` | `comments` | `influence` | `negative`
- `dateFrom` (可选): 开始日期
- `dateTo` (可选): 结束日期
- `subreddit` (可选): 板块名称

#### 响应格式
```json
{
  "posts": [
    {
      "id": "string",
      "title": "string",
      "subreddit": "string",
      "alertLevel": "critical" | "medium" | "safe" | "low",
      "commentCount": 0,
      "totalCommentsFetched": 0,
      "flaggedComments": 0,
      "flaggedRatio": "string",
      "totalInfluenceScore": 0
    }
  ],
  "total": 0
}
```

#### 删除操作
**DELETE 请求体:**
```json
{
  "postId": "string",
  "deleteAll": true
}
```

**章节来源**
- [src/app/api/posts/route.ts:1-157](file://src/app/api/posts/route.ts#L1-L157)

### 帖子详情 API
提供单个帖子的详细信息和评论分析。

#### 端点定义
- **GET** `/api/posts/[id]` - 获取帖子详情

#### 响应格式
```json
{
  "post": {
    "id": "string",
    "title": "string",
    "subreddit": "string",
    "alertLevel": "critical" | "medium" | "safe" | "low",
    "createdAt": "string"
  },
  "comments": [
    {
      "id": "string",
      "author": "string",
      "body": "string",
      "score": 0,
      "sentimentScore": 0,
      "influenceScore": 0,
      "flagReasons": ["string"],
      "replies": []
    }
  ],
  "summary": {
    "total": 0,
    "flagged": 0,
    "positive": 0,
    "neutral": 0,
    "negative": 0,
    "categories": {},
    "avgSentiment": "string",
    "totalInfluenceScore": 0
  }
}
```

**章节来源**
- [src/app/api/posts/[id]/route.ts](file://src/app/api/posts/[id]/route.ts#L1-L98)

### 板块查询 API
获取所有可用的 Reddit 板块列表。

#### 端点定义
- **GET** `/api/subreddits` - 获取板块列表

#### 响应格式
```json
{
  "subreddits": ["string"]
}
```

**章节来源**
- [src/app/api/subreddits/route.ts:1-14](file://src/app/api/subreddits/route.ts#L1-L14)

### 扫描调度 API
管理 Reddit 帖子的自动扫描功能。

#### 端点定义
- **POST** `/api/scan` - 启动扫描任务
- **GET** `/api/scan` - 获取扫描进度
- **DELETE** `/api/scan` - 停止扫描任务

#### 扫描配置
**POST 请求体:**
```json
{
  "postIds": ["string"],
  "scanAll": true,
  "quickScan": true,
  "skipRecentHours": 0
}
```

#### 扫描进度响应
```json
{
  "isRunning": false,
  "current": 0,
  "total": 0,
  "postTitle": "string",
  "message": "string"
}
```

#### 扫描流程图
```mermaid
flowchart TD
Start([开始扫描]) --> Init[初始化进度]
Init --> CheckEmpty{是否有帖子?}
CheckEmpty --> |否| NoPosts[返回无帖子消息]
CheckEmpty --> |是| Filter[过滤帖子]
Filter --> Fetch[获取 Reddit 数据]
Fetch --> Analyze[情感分析]
Analyze --> Update[更新帖子状态]
Update --> Save[保存结果]
Save --> Next{还有帖子?}
Next --> |是| Fetch
Next --> |否| Report[生成日报]
Report --> Complete[扫描完成]
NoPosts --> End([结束])
Complete --> End
```

**图表来源**
- [src/app/api/scan/route.ts:21-379](file://src/app/api/scan/route.ts#L21-L379)

**章节来源**
- [src/app/api/scan/route.ts:1-394](file://src/app/api/scan/route.ts#L1-L394)

### 仪表板 API
提供系统整体监控数据和统计信息。

#### 端点定义
- **GET** `/api/dashboard` - 获取仪表板数据

#### 响应格式
```json
{
  "stats": {
    "totalPosts": 0,
    "criticalAlerts": 0,
    "mediumAlerts": 0,
    "safePosts": 0,
    "totalComments": 0,
    "flaggedComments": 0,
    "flaggedRatio": "string"
  },
  "sentimentDistribution": {
    "positive": 0,
    "neutral": 0,
    "negative": 0
  },
  "categoryBreakdown": {},
  "topFlaggedPosts": [],
  "recentFlagged": [],
  "trendData": []
}
```

**章节来源**
- [src/app/api/dashboard/route.ts:1-108](file://src/app/api/dashboard/route.ts#L1-L108)

### 关键词分析 API
分析评论中的关键词分布和类别统计。

#### 端点定义
- **GET** `/api/keywords` - 获取关键词统计

#### 请求参数
- `subreddit` (可选): 板块过滤
- `keyword` (可选): 关键词搜索
- `commentDateFrom` (可选): 评论开始日期
- `commentDateTo` (可选): 评论结束日期
- `postDateFrom` (可选): 帖子开始日期
- `postDateTo` (可选): 帖子结束日期
- `brandKeywords` (可选): 品牌关键词过滤
- `sceneKeywords` (可选): 场景关键词过滤
- `modelKeywords` (可选): 模型关键词过滤
- `qualityKeywords` (可选): 质量关键词过滤

#### 响应格式
```json
{
  "keywords": [
    {
      "word": "string",
      "count": 0
    }
  ],
  "total": 0,
  "subreddits": ["string"],
  "categories": {}
}
```

**章节来源**
- [src/app/api/keywords/route.ts:1-156](file://src/app/api/keywords/route.ts#L1-L156)

### 检测规则 API
管理情感分析的检测规则配置。

#### 端点定义
- **GET** `/api/detection-rules` - 获取检测规则
- **POST** `/api/detection-rules` - 更新检测规则

#### 规则配置
```json
{
  "brand_attack": true,
  "product_hate": true,
  "negative_sentiment": true,
  "call_to_action_negative": true,
  "competitor_push": true
}
```

**章节来源**
- [src/app/api/detection-rules/route.ts:1-49](file://src/app/api/detection-rules/route.ts#L1-L49)

### 数据导入 API
支持从 Excel/CSV 文件批量导入 Reddit 帖子数据。

#### 端点定义
- **POST** `/api/import` - 导入数据文件

#### 请求格式
- Content-Type: `multipart/form-data`
- 参数: `file` (Excel/CSV 文件)

#### 响应格式
```json
{
  "success": true,
  "message": "string",
  "totalRows": 0,
  "newPosts": 0,
  "duplicatePosts": 0,
  "skippedRows": 0,
  "existingPostsBefore": 0,
  "totalPostsAfter": 0,
  "detectedColumns": {
    "urlColumn": "string",
    "titleColumn": "string",
    "subredditColumn": "string",
    "authorColumn": "string"
  }
}
```

**章节来源**
- [src/app/api/import/route.ts:1-244](file://src/app/api/import/route.ts#L1-L244)

### 扫描计划 API
管理自动扫描的时间配置。

#### 端点定义
- **GET** `/api/scan-schedule` - 获取扫描配置
- **POST** `/api/scan-schedule` - 更新扫描配置

#### 配置参数
```json
{
  "autoScanEnabled": true,
  "scanTime": "HH:mm",
  "scanSchedule": "cron表达式",
  "sentimentThreshold": 0
}
```

**章节来源**
- [src/app/api/scan-schedule/route.ts:1-53](file://src/app/api/scan-schedule/route.ts#L1-L53)

### 对比分析 API
提供跨板块的情感分析对比。

#### 端点定义
- **GET** `/api/compare` - 获取对比数据

#### 响应格式
```json
{
  "subreddits": [
    {
      "subreddit": "string",
      "totalPosts": 0,
      "totalComments": 0,
      "positiveRate": 0,
      "neutralRate": 0,
      "negativeRate": 0,
      "flaggedComments": 0,
      "criticalPosts": 0,
      "mediumPosts": 0,
      "healthScore": 0
    }
  ]
}
```

**章节来源**
- [src/app/api/compare/route.ts:1-68](file://src/app/api/compare/route.ts#L1-L68)

### 板块详情 API
获取特定板块的恶意评论分析。

#### 端点定义
- **GET** `/api/subreddit-detail` - 获取板块详情

#### 请求参数
- `subreddit` (可选): 板块名称

#### 响应格式
```json
{
  "posts": [
    {
      "id": "string",
      "title": "string",
      "redditUrl": "string",
      "alertLevel": "critical" | "medium" | "safe" | "low",
      "commentCount": 0,
      "flaggedCommentCount": 0,
      "influenceScore": 0,
      "maliciousComments": []
    }
  ]
}
```

**章节来源**
- [src/app/api/subreddit-detail/route.ts:1-63](file://src/app/api/subreddit-detail/route.ts#L1-L63)

### 影响者分析 API
识别具有高影响力的恶意评论作者。

#### 端点定义
- **GET** `/api/influencers` - 获取影响者列表

#### 请求参数
- `subreddit` (可选): 板块过滤
- `keyword` (可选): 关键词过滤
- `author` (可选): 作者过滤
- `commentDateFrom` (可选): 评论时间范围
- `commentDateTo` (可选): 评论时间范围
- `postDateFrom` (可选): 帖子时间范围
- `postDateTo` (可选): 帖子时间范围

#### 响应格式
```json
{
  "comments": [
    {
      "id": "string",
      "author": "string",
      "body": "string",
      "score": 0,
      "sentimentScore": 0,
      "influenceScore": 0,
      "postId": "string",
      "postTitle": "string",
      "subreddit": "string",
      "postCreatedAt": "string",
      "postUrl": "string"
    }
  ],
  "total": 0,
  "subreddits": ["string"]
}
```

**章节来源**
- [src/app/api/influencers/route.ts:1-111](file://src/app/api/influencers/route.ts#L1-L111)

### 连接诊断 API
检查系统连接状态和配置。

#### 端点定义
- **GET** `/api/proxy-diag` - 代理诊断
- **GET** `/api/connectivity` - 连接状态检查

#### 诊断响应
```json
{
  "envCheck": {
    "APIFY_TOKEN": "string",
    "NODE_ENV": "string"
  },
  "apifyStatus": {
    "configured": true,
    "message": "string"
  }
}
```

**章节来源**
- [src/app/api/proxy-diag/route.ts:1-24](file://src/app/api/proxy-diag/route.ts#L1-L24)
- [src/app/api/connectivity/route.ts:1-25](file://src/app/api/connectivity/route.ts#L1-L25)

### Reddit 搜索 API
**新增** 提供基于关键词的 Reddit 帖子搜索功能，并支持将搜索结果导入到帖子管理系统。

#### 端点定义
- **POST** `/api/reddit-search` - 关键词搜索 Reddit 帖子
- **PUT** `/api/reddit-search` - 导入搜索结果到帖子管理

#### POST /api/reddit-search - 关键词搜索

**请求参数:**
```json
{
  "keywords": ["string"],
  "subreddit": "string",
  "limit": 25,
  "timeframe": "hour" | "day" | "week" | "month" | "year" | "all"
}
```

**更新** **关键词匹配优化**: 搜索算法现已优化为仅匹配帖子标题，不再匹配正文或评论内容。这显著提升了搜索结果的相关性和质量。

**更新** **帖子过滤增强**: 搜索结果会自动排除已归档（archived）和锁定（locked）的帖子，确保返回的都是活跃的有效帖子。

**更新** **Reddit JSON API 数据增强**: 新增自动补充评分和评论计数的功能。系统会并行请求 Reddit JSON API，自动补充搜索结果中的 `score` 和 `commentCount` 字段，最多补充前 10 个帖子。

**更新** **调试基础设施改进**: 增强 Apify 调试功能，专门针对 scrape 模式的前6个帖子输出 score 和 commentCount 信息，改进了问题定位能力。系统会在首次处理时输出前 3 个帖子的原始评分和评论计数信息，以及在 scrape 模式下输出前6个帖子的详细调试信息。

**响应格式:**
```json
{
  "success": true,
  "count": 0,
  "posts": [
    {
      "id": "string",
      "title": "string",
      "author": "string",
      "score": 0,
      "commentCount": 0,
      "subreddit": "string",
      "createdAt": "string",
      "permalink": "string",
      "selftext": "string",
      "locked": false,
      "archived": false
    }
  ],
  "warning": "string",
  "rawItemCount": 0,
  "filteredPostCount": 0,
  "firstItemKeys": ["string"],
  "firstItemSample": "string"
}
```

**诊断字段说明:**
- `rawItemCount`: Apify Actor 返回的原始帖子数量
- `filteredPostCount`: 经过关键词过滤后的最终帖子数量
- `firstItemKeys`: 第一个返回项目的字段键列表
- `firstItemSample`: 第一个返回项目的JSON样本

**错误处理:**
- 400 Bad Request: 关键词参数无效
- 502 Bad Gateway: Apify 服务调用失败
- 500 Internal Server Error: 服务器内部错误

#### PUT /api/reddit-search - 导入帖子

**请求参数:**
```json
{
  "posts": [
    {
      "id": "string",
      "title": "string",
      "author": "string",
      "score": 0,
      "commentCount": 0,
      "subreddit": "string",
      "createdAt": "string",
      "permalink": "string",
      "selftext": "string"
    }
  ]
}
```

**响应格式:**
```json
{
  "success": true,
  "imported": 0,
  "skipped": 0,
  "message": "string"
}
```

**错误处理:**
- 400 Bad Request: 搜索结果为空
- 500 Internal Server Error: 导入过程中的服务器错误

#### 搜索流程图
```mermaid
flowchart TD
Start([开始搜索]) --> Validate[验证关键词参数]
Validate --> CleanParams[清理和验证参数]
CleanParams --> CallApify[调用 Apify 搜索]
CallApify --> CheckResult{检查结果}
CheckResult --> |有错误且无结果| ReturnError[返回错误]
CheckResult --> |有结果或警告| ProcessResult[处理搜索结果]
ProcessResult --> FilterArchived[过滤已归档/锁定帖子]
FilterArchived --> MatchTitleOnly[仅匹配标题关键词]
MatchTitleOnly --> EnrichReddit[调用 Reddit JSON API 补充数据]
EnrichReddit --> AddDiagnostics[添加诊断信息]
AddDiagnostics --> ReturnSuccess[返回成功响应]
ReturnError --> End([结束])
ReturnSuccess --> End
```

**图表来源**
- [src/app/api/reddit-search/route.ts:6-87](file://src/app/api/reddit-search/route.ts#L6-L87)

**章节来源**
- [src/app/api/reddit-search/route.ts:1-159](file://src/app/api/reddit-search/route.ts#L1-L159)
- [src/lib/apify.ts:104-137](file://src/lib/apify.ts#L104-L137)
- [src/lib/store.ts:99-103](file://src/lib/store.ts#L99-L103)

## 依赖关系分析

### 外部依赖
```mermaid
graph LR
subgraph "核心依赖"
NextJS[Next.js]
React[React]
Typescript[TypeScript]
ApifyClient[Apify Client]
end
subgraph "数据分析"
XLSX[XLSX]
Lodash[Lodash]
end
subgraph "外部服务"
Apify[Apify]
Reddit[Reddit API]
LLM[大语言模型]
end
subgraph "工具库"
Moment[Moment.js]
Axios[Axios]
end
NextJS --> XLSX
NextJS --> Lodash
NextJS --> ApifyClient
NextJS --> Apify
NextJS --> Reddit
NextJS --> LLM
NextJS --> Moment
NextJS --> Axios
```

**图表来源**
- [src/app/api/import/route.ts:1-244](file://src/app/api/import/route.ts#L1-L244)
- [src/app/api/scan/route.ts:1-394](file://src/app/api/scan/route.ts#L1-L394)
- [src/lib/apify.ts:6-66](file://src/lib/apify.ts#L6-L66)

### 内部依赖关系
```mermaid
graph TB
subgraph "API 层"
Alerts[alerts/route.ts]
Posts[posts/route.ts]
Scan[scan/route.ts]
Dashboard[dashboard/route.ts]
RedditSearch[reddit-search/route.ts]
end
subgraph "服务层"
Store[store.ts]
Sentiment[sentiment.ts]
Scheduler[scheduler.ts]
Reddit[reddit.ts]
Apify[apify.ts]
end
subgraph "工具层"
Utils[utils/*]
Types[types.ts]
end
Alerts --> Store
Posts --> Store
Scan --> Store
Scan --> Sentiment
Scan --> Reddit
Scan --> Scheduler
Dashboard --> Store
RedditSearch --> Apify
RedditSearch --> Store
Store --> Utils
Store --> Types
```

**图表来源**
- [src/app/api/alerts/route.ts:1-62](file://src/app/api/alerts/route.ts#L1-L62)
- [src/app/api/scan/route.ts:1-394](file://src/app/api/scan/route.ts#L1-L394)
- [src/app/api/dashboard/route.ts:1-108](file://src/app/api/dashboard/route.ts#L1-L108)
- [src/app/api/reddit-search/route.ts:1-159](file://src/app/api/reddit-search/route.ts#L1-L159)

**章节来源**
- [src/app/api/scan/route.ts:1-394](file://src/app/api/scan/route.ts#L1-L394)
- [src/app/api/dashboard/route.ts:1-108](file://src/app/api/dashboard/route.ts#L1-L108)
- [src/app/api/reddit-search/route.ts:1-159](file://src/app/api/reddit-search/route.ts#L1-L159)

## 性能考虑

### 扫描性能优化
1. **智能延迟机制**: 3个月内的帖子才进行全量扫描
2. **冷却期控制**: 最近扫描的帖子跳过重复扫描
3. **并发限制**: Reddit 请求间隔3秒避免429错误
4. **LLM 调用限流**: 评论分析间隔300ms

### 数据查询优化
1. **索引字段**: 按 `createdAt` 和 `alertLevel` 建立查询索引
2. **分页查询**: 大数据集采用分页处理
3. **缓存策略**: 频繁访问的数据进行内存缓存

### 存储优化
1. **数据压缩**: 评论数据采用压缩存储
2. **增量更新**: 只更新变化的数据字段
3. **批量操作**: 大量数据操作采用事务处理

### **更新** Reddit 搜索性能优化
1. **Apify 限流**: 搜索请求间隔2秒避免API限制
2. **内存缓存**: 搜索结果缓存10分钟
3. **结果过滤**: 自动过滤评论和无效数据，**新增** 排除已归档和锁定的帖子
4. **批量导入**: 支持批量导入搜索结果，避免重复写入
5. **超时控制**: 前端搜索超时控制在3分钟内
6. **关键词优化**: **新增** 仅匹配帖子标题，提升搜索精度和性能
7. **Reddit JSON API 增强**: **新增** 并行请求最多10个帖子的评分和评论计数数据
8. **调试计数器优化**: **新增** 限制调试输出次数，优化调试输出和问题定位能力

**章节来源**
- [src/lib/apify.ts:37-50](file://src/lib/apify.ts#L37-L50)
- [src/lib/apify.ts:147-149](file://src/lib/apify.ts#L147-L149)
- [src/lib/store.ts:71-87](file://src/lib/store.ts#L71-L87)
- [src/app/search/search-page.tsx:60-78](file://src/app/search/search-page.tsx#L60-L78)

## 故障排除指南

### 常见错误及解决方案

#### 扫描失败
**症状**: 扫描任务报错或部分帖子扫描失败
**原因**: Reddit API 限制、网络问题、代理配置错误
**解决方案**:
1. 检查 `APIFY_TOKEN` 环境变量配置
2. 验证 Reddit API 访问权限
3. 查看扫描日志中的具体错误信息

#### 数据导入失败
**症状**: Excel/CSV 文件导入报错
**原因**: 文件格式不支持、列名不匹配、数据格式错误
**解决方案**:
1. 确保文件包含有效的 Reddit 链接列
2. 检查文件编码格式（UTF-8）
3. 验证列名与系统期望的关键词匹配

#### **更新** Reddit 搜索失败
**症状**: POST /api/reddit-search 返回错误
**原因**: 关键词参数无效、Apify 服务不可用、网络超时
**解决方案**:
1. 确保 `keywords` 数组包含至少一个非空字符串
2. 检查 `APIFY_TOKEN` 环境变量配置
3. 验证 Reddit API 访问权限
4. 查看 Apify 服务状态和配额限制
5. **新增** 检查诊断信息：`rawItemCount` 和 `filteredPostCount` 是否一致
6. **新增** 确认搜索结果中没有包含已归档或锁定的帖子
7. **新增** 验证 Reddit JSON API 数据增强功能是否正常工作
8. **新增** 查看 Apify 调试输出，确认 scrape 模式的前6个帖子的 score 和 commentCount 信息是否正确输出

#### **更新** 搜索结果导入失败
**症状**: PUT /api/reddit-search 返回错误
**原因**: 搜索结果格式不正确、数据库写入失败
**解决方案**:
1. 确保导入的帖子对象包含必需字段（id、title）
2. 检查数据库连接状态
3. 验证帖子ID唯一性

#### **更新** 搜索超时问题
**症状**: 前端搜索长时间无响应
**原因**: Apify Actor 运行时间过长、网络延迟
**解决方案**:
1. 前端已设置3分钟超时控制
2. 减少搜索数量或缩小 subreddit 范围
3. 检查 Apify 服务状态
4. 查看诊断信息中的 `firstItemKeys` 和 `firstItemSample` 了解返回数据结构

#### **更新** 搜索结果质量不佳
**症状**: 搜索结果包含无关内容或已归档帖子
**原因**: 关键词匹配范围过宽或过滤条件不足
**解决方案**:
1. **新增** 使用更精确的关键词组合
2. **新增** 指定具体的 subreddit 以缩小搜索范围
3. **新增** 使用更短的时间范围（如 day 或 week）
4. **新增** 检查诊断信息中的 `rawItemCount` 和 `filteredPostCount` 差异

#### **更新** Reddit JSON API 数据增强失败
**症状**: 搜索结果缺少评分或评论计数数据
**原因**: Reddit API 访问失败、网络超时、权限不足
**解决方案**:
1. **新增** 检查 Reddit API 可访问性
2. **新增** 验证 User-Agent 头设置
3. **新增** 确认 5秒超时设置合理
4. **新增** 查看调试输出中的原始评分和评论计数信息

#### **更新** 调试计数器问题
**症状**: 调试输出过多或过少
**原因**: 调试计数器逻辑错误、日志级别设置不当
**解决方案**:
1. **新增** 检查 `_debugCount` 变量的使用
2. **新增** 确认调试输出限制在前6个帖子
3. **新增** 验证调试日志的输出频率和内容

#### 性能问题
**症状**: API 响应缓慢
**原因**: 数据量过大、查询条件不当、缓存未命中
**解决方案**:
1. 添加适当的查询过滤条件
2. 使用分页参数限制返回数量
3. 检查数据库索引配置

### 调试工具
1. **浏览器开发者工具**: 监控网络请求和响应
2. **日志分析**: 查看服务器端日志输出
3. **性能监控**: 使用浏览器性能面板分析渲染时间
4. ****新增** Apify 调试**: 查看 Apify Actor 日志和搜索结果，特别关注 scrape 模式的前6个帖子调试输出
5. ****新增** 诊断信息监控**: 使用 `rawItemCount`、`filteredPostCount`、`firstItemKeys`、`firstItemSample` 字段进行问题定位
6. ****新增** 关键词匹配调试**: 通过诊断信息确认关键词匹配是否仅针对标题
7. ****新增** Reddit JSON API 调试**: 查看调试输出中的原始评分和评论计数信息
8. ****新增** 调试计数器监控**: 确认调试输出限制在前6个帖子，优化调试输出和问题定位能力

**章节来源**
- [src/app/api/scan/route.ts:1-394](file://src/app/api/scan/route.ts#L1-L394)
- [src/app/api/proxy-diag/route.ts:1-24](file://src/app/api/proxy-diag/route.ts#L1-L24)
- [src/app/api/reddit-search/route.ts:51-57](file://src/app/api/reddit-search/route.ts#L51-L57)
- [src/app/search/search-page.tsx:60-78](file://src/app/search/search-page.tsx#L60-L78)

## 结论
Reddit 监控系统提供了完整的 RESTful API 解决方案，涵盖了从数据采集、情感分析到可视化展示的全流程。系统采用模块化设计，具有良好的扩展性和维护性。通过合理的性能优化和错误处理机制，能够满足生产环境的稳定运行需求。

**更新** 新增的 Reddit 搜索功能进一步增强了系统的数据采集能力，通过 Apify 集成实现了高效的关键词搜索和结果导入功能，为用户提供了更灵活的 Reddit 数据获取方式。**新增 Reddit JSON API 数据增强功能，自动补充搜索结果中的评分和评论计数数据，显著提升了搜索结果的准确性和完整性。** **改进的调试基础设施提供了更好的问题定位能力，新增针对 scrape 模式的详细调试输出，专门输出前6个帖子的 score 和 commentCount 信息，优化了调试输出和问题定位能力。** **关键词匹配算法的优化和帖子过滤机制的增强，显著提升了搜索结果的质量和相关性，为用户提供了更好的搜索体验。** 系统现在提供详细的诊断信息，帮助用户更好地理解和优化搜索过程。

## 附录

### 版本信息
- **当前版本**: 1.0.0
- **最后更新**: 2024
- **兼容性**: Next.js 14+，Node.js 18+

### 安全考虑
1. **认证机制**: 基于环境变量的访问控制
2. **数据加密**: 敏感数据在传输过程中加密
3. **输入验证**: 所有用户输入都经过严格验证
4. **权限控制**: 不同用户角色具有不同的 API 访问权限

### 速率限制
- **扫描请求**: 每帖子至少3秒间隔
- **LLM 调用**: 每评论至少300ms间隔
- ****新增** Apify 搜索**: 每请求至少2秒间隔
- ****新增** Reddit JSON API**: 每请求5秒超时
- ****新增** 前端超时**: 搜索超时控制在3分钟内
- **通用 API**: 建议每分钟不超过100次请求

### 迁移指南
由于系统处于开发阶段，暂无正式的版本迁移文档。如需升级，请备份现有数据并在测试环境中验证后再进行生产部署。

### **更新** Apify 集成配置
为了使用 Reddit 搜索功能，需要配置以下环境变量：
- `APIFY_TOKEN`: Apify 服务访问令牌
- 配置完成后，系统将自动启用 Reddit 搜索功能

### **更新** 诊断字段使用指南
当搜索结果出现异常时，可以通过以下诊断字段进行问题定位：
- `rawItemCount`: 查看 Apify 返回的实际帖子数量
- `filteredPostCount`: 查看经过关键词过滤后的最终数量
- `firstItemKeys`: 查看返回数据的字段结构
- `firstItemSample`: 查看返回数据的示例内容

### **更新** 关键词匹配优化说明
**新增** 系统现已优化关键词匹配行为：
- **仅匹配标题**: 关键词匹配现在仅针对帖子标题进行，不再匹配正文或评论内容
- **排除无效帖子**: 自动排除已归档（archived）和锁定（locked）的帖子
- **提升相关性**: 通过更精确的匹配算法和过滤机制，显著提升搜索结果的相关性和质量

### **更新** Reddit JSON API 数据增强功能说明
**新增** 系统现已增强 Reddit 搜索结果的数据完整性：
- **自动补充评分**: 通过 Reddit JSON API 自动获取并补充帖子的 `score` 字段
- **自动补充评论计数**: 通过 Reddit JSON API 自动获取并补充帖子的 `commentCount` 字段
- **并行请求优化**: 最多并行请求前10个帖子的数据，提升响应速度
- **5秒超时控制**: 防止网络延迟导致的性能问题
- **错误处理**: 请求失败时保留原有数据，不影响整体搜索结果

### **更新** 调试基础设施改进说明
**新增** 系统现已改进调试能力和问题定位能力：
- **增强调试计数器**: 限制调试输出次数至前6个帖子，优化调试输出和问题定位能力
- **优化调试输出**: 输出前3个帖子的原始评分和评论计数信息，以及在 scrape 模式下输出前6个帖子的详细调试信息
- **增强问题定位**: 通过调试输出快速识别数据增强功能的问题
- **性能监控**: 通过调试输出监控搜索性能和数据质量

这些优化使得搜索结果更加精准，减少了无关内容的干扰，为用户提供了更好的搜索体验。

**章节来源**
- [src/lib/apify.ts:64-66](file://src/lib/apify.ts#L64-L66)
- [src/app/api/reddit-search/route.ts:31-38](file://src/app/api/reddit-search/route.ts#L31-L38)
- [src/lib/apify.ts:280-286](file://src/lib/apify.ts#L280-L286)
- [src/app/search/search-page.tsx:36-95](file://src/app/search/search-page.tsx#L36-L95)