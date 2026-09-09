---
title: "SQL 方言转换：大模型让实现变容易，架构该怎么选"
slug: nl2sql-typed-ast-semantic-conversion
translationKey: nl2sql-typed-ast-semantic-conversion
date: 2026-09-08T01:21:32+08:00
url: /26/09/nl2sql-typed-ast-semantic-conversion/
draft: false
codeStyle: tokyonight-night
tags:
  - SQL
  - 大模型
  - 编译原理
  - 工程实践
description: "从 NL2SQL（自然语言生成 SQL）中的多数据库查询出发，以 PostgreSQL LIMIT 与 SQL Server TOP 为例，讨论大模型、确定性算法与 AST 的分工和语义验收。"
---

一个报表产品同时接入 PostgreSQL 和 SQL Server。用户要查“金额超过 100 元的订单，按编号倒序取前 10 条”，系统就要生成两种 SQL。

把自然语言需求转成 SQL，通常叫 **NL2SQL（Natural Language to SQL）**。当产品接入多个数据库时，可以先确定查询含义，再转换成各自的 SQL 方言。本文关注的就是后一步。

让大模型生成这两段代码很容易——但要把它做成能长期维护、出了错也能查清原因的功能，还得费一番功夫。至少要先决定：哪些工作交给模型，哪些转换规则由确定性算法负责，也就是用代码把规则明确写下来。

![同一订单查询的两种 SQL 写法：PostgreSQL 在末尾使用 LIMIT 10，SQL Server 在 SELECT 后使用 TOP (10)，筛选与排序保持一致。](/img/nl2sql-semantic-conversion/sql-dialects.svg)

*图 1：同一查询，两种语法。蓝色标出变化的位置，其他查询条件保持一致。*

这里假定两边数据相同：订单编号是唯一、非空的整数，金额都按元记录，数值精度一致。**转换要保留查询的要求，只改变目标系统需要的表达方式。**

<details>
<summary>展开并复制 SQL 示例</summary>

```sql
-- PostgreSQL
SELECT order_id, amount
FROM orders
WHERE amount > 100
ORDER BY order_id DESC
LIMIT 10;

-- SQL Server
SELECT TOP (10) order_id, amount
FROM orders
WHERE amount > 100
ORDER BY order_id DESC;
```

</details>

用唯一编号排序，是为了让“前 10 条”有确定顺序。语法依据见 [PostgreSQL LIMIT](https://www.postgresql.org/docs/current/queries-limit.html) 和 [SQL Server ORDER BY](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-order-by-clause-transact-sql?view=sql-server-ver17)。这是独立构造的教学示例，未连接两种数据库实测。

## 换了语法，结果也可能变

`LIMIT` 换成 `TOP` 很直观。如果目标系统把金额存成“分”，`amount > 100` 就需要改成 `amount_cents > 10000`。这一步已经涉及数据定义，得有明确的单位换算规则。

再进一步：目标只保留“低于 200 元”和“至少 200 元”两档，还能表达“超过 100 元”吗？

![五笔订单金额为 80、100、150、200、240 元。原查询命中后三笔；只选至少 200 元会漏掉 150 元，两档全选又会多出 80 和 100 元。](/img/nl2sql-semantic-conversion/lossy-results.svg)

*图 2：绿色表示命中，红色标出多查或漏查。目标丢失了金额细节，转换算法无法凭空补回。*

返回 warning 只能报告这个差异。业务要求精确查询，就应拒绝转换；允许近似查询，也要说明会多查还是漏查，由调用方明确接受。

缺失字段也是一样。`shop_id = 7 AND amount > 100` 里的门店条件不能随手删除。删掉它会扩大范围；如果它承担访问隔离职责，还会影响权限边界。

因此，要分清两个问题：**方言转换解决语法差异，数据模型适配还要解决字段含义、单位和信息缺失。** 后者需要业务依据。

## 哪些事情交给模型

这类功能常见于多数据库报表、平台迁移和历史查询回放。NL2SQL 又多了一个入口：先理解用户的话，再生成查询。

用户说“最近的大额订单”，模型可以帮助识别需求，但“最近多久”“多大金额”仍需澄清或引用业务定义。条件一旦确定，方言转换就应按规则执行，不能再猜一遍。

![模型、确定性代码和数据库的职责：模型提出查询意图并澄清歧义；代码检查结构、应用映射、拒绝不支持的转换；数据库执行查询，再核对结果。](/img/nl2sql-semantic-conversion/responsibilities.svg)

*图 3：模型理解语言，代码执行明确规则，目标引擎执行查询。每一步都留下可检查的输入和输出。*

具体用什么架构，要看查询是否固定、是否重复运行，以及有没有人复核：

| 场景 | 优先考虑 | 代价与边界 |
|---|---|---|
| 一次性迁移，逐条复核 | 模型辅助改写 | 人工检查，并在目标端验证 |
| 查询结构固定，只换参数 | 参数化模板 | 简单，但需要维护每种查询形状 |
| 多种标准 SQL 方言 | 现成解析器与转换工具 | 核对语法覆盖和不支持行为 |
| 私有查询语言、业务映射 | 小范围文法加显式规则 | 自己维护规则与回归样例 |

只有一个引擎时，可能需要校验模型生成的查询，却未必需要额外建设跨方言转换层。我更关心方案的适用范围是否清楚，而不是它用了多少层抽象。

## 我去年重构的 NL2SQL 项目

这个项目处理两种受限查询语言之间的筛选表达式转换。前面的 SQL 用来解释问题，不代表项目已支持 PostgreSQL、SQL Server 或完整的 SELECT 语法。

我保留了小范围文法，把解析结果整理成类型化 AST，也就是用树记录字段、取值和条件之间的关系。

比如 `A AND (B OR C)`，树里会明确记录“B 或 C”是一个整体。转换器依次解析结构、应用映射、生成目标表达式，最后重新解析一次，检查输出是否合法。REST 和 MCP 共用这套实现。

AST 能帮忙保留结构，但它不知道“元”和“分”的关系。单位换算、字段映射以及缺失条件如何处理，仍要写成有依据、可测试的规则。

当前实现对部分有损映射返回告警，对无映射条件默认报错。显式开启 `drop_conjuncts` 后，只允许删正向 AND 链中的独立条件，OR 和 NOT 中拒绝删除。**允许删减也不等于结果等价**；上层仍需决定能否执行，权限隔离条件更不能靠通用开关放行。

## 把这套方法交给 Agent

如果读完想让 Agent 自动转换查询，我建议先约定中间数据格式，再实现转换算法。**自然语言先变成候选结构，经过校验后，才进入确定性的转换流程。** 模型输出了合法 JSON，不代表它已经理解正确。

沿用开篇的订单需求，在表、字段和单位已确认的前提下，可以把查询表示成下面的 AST。JSON 是这棵树的序列化格式；节点类型和组合规则才是它的约束。这是供读者扩展的设计示例，包含当前项目尚未实现的完整查询节点。

```json
{
  "type": "query",
  "source": "orders",
  "select": ["order_id", "amount"],
  "where": {
    "type": "compare",
    "op": "gt",
    "left": {"type": "field", "name": "amount"},
    "right": {"type": "decimal", "value": "100", "unit": "yuan"}
  },
  "order_by": [{"field": "order_id", "direction": "desc"}],
  "limit": 10
}
```

这里把金额保存成十进制字符串，避免用浮点近似值承载金额；代码读取时使用十进制类型。字段名来自允许访问的数据目录。复杂条件再用 `and`、`or`、`not` 节点嵌套，保留原来的组合关系。

算法可以分成四步，下面是流程伪代码：

```text
candidate = extract(text, schema, business_definitions)
if candidate has unresolved meanings:
    return NEEDS_CLARIFICATION(questions)

ast = validate(candidate, node_types, field_types, allowed_fields)
require confirmed_intent(ast, text, business_definitions)

mapped = transform_bottom_up(ast, versioned_mapping_rules)
if mapped contains unknown or lossy mappings:
    return NEEDS_REVIEW(reasons, affected_nodes)

query, parameters = render(mapped, target_dialect)
require target_parse(query) succeeds
return READY_FOR_VALIDATION(query, parameters, mapping_trace)
```

`extract` 可以由模型完成；如果输入已经是查询语句，就交给语法解析器。`confirmed_intent` 表示需求已有明确依据，歧义已向用户澄清，不能用模型自报的置信度代替。

`transform_bottom_up` 从子节点向父节点处理，每一步只应用登记过的规则。例如目标金额字段按整数分存储时，在确认单位和精度后，把 `amount` 映射为 `amount_cents`，把十进制 `100` 精确换算成 `10000`。比较关系 `gt` 保持不变，外层 AND、OR、NOT 也保持原结构；没有规则就停止。

最后，生成器只处理目标语法。字段标识符来自白名单，常量通过参数绑定传递；每次转换记录规则版本、前后节点和告警，方便 Agent 解释结果，也方便人排错。`READY_FOR_VALIDATION` 只表示可进入执行策略检查与目标端验证，不能直接当成执行授权。

给 Agent 的任务可以直接这样写：

> 先定义允许的 AST 节点和字段类型，再实现校验器、映射器与目标生成器。未明确的需求返回待澄清问题，未知或有损映射返回原因；不要静默删除条件。交付源 AST、目标查询、绑定参数、转换记录，以及正常、边界和拒绝案例。

本项目本地复核的 67 个测试通过，1,000 条 OR 条件也不再触发原来的递归问题，但这些测试没有覆盖上面扩展后的完整查询设计。读者实现后，还应在同一份数据上核对返回行、重复次数、列值和排序，覆盖金额恰好为 100、为空，以及订单不足和超过 10 条等边界。

这套思路也适用于文档提取和规则整理：先定义带类型的数据结构，保留原文依据与未决项，再用确定性代码做转换和校验。只有需要表达嵌套关系时才引入树；简单记录用固定 schema 就够了。
