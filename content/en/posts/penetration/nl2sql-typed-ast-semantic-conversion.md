---
title: "SQL Dialect Conversion: LLMs Make It Easy to Build, Architecture Still Matters"
slug: nl2sql-typed-ast-semantic-conversion
translationKey: nl2sql-typed-ast-semantic-conversion
date: 2026-09-08T01:21:32+08:00
url: /en/26/09/nl2sql-typed-ast-semantic-conversion/
draft: false
codeStyle: tokyonight-night
tags:
  - SQL
  - LLM
  - Compilers
  - Engineering
description: "Starting with a PostgreSQL LIMIT and SQL Server TOP example, this article explains how LLMs, deterministic algorithms, and typed ASTs should divide responsibility in NL2SQL systems."
---

Imagine a reporting product that connects to both PostgreSQL and SQL Server. A user asks for orders over 100 yuan, sorted by ID in descending order, with the first 10 rows returned. The system needs to produce two SQL statements.

Turning this request into two code snippets is easy for an LLM. Making the feature maintainable, and making failures explainable, takes more work. The first decision is simple: which parts belong to the model, and which conversion rules belong in deterministic code where they can be written down and tested.

![The same order query in two SQL dialects: PostgreSQL uses LIMIT 10 at the end, while SQL Server uses TOP (10) after SELECT; the filter and ordering stay the same.](/img/nl2sql-semantic-conversion/sql-dialects.svg)

*Figure 1: One query, two syntaxes. Blue marks the changed position; the rest of the query stays the same.*

Turning natural-language requirements into SQL is commonly called **NL2SQL (Natural Language to SQL)**. When a product connects to multiple databases, it can first settle the query meaning and then express that meaning in each SQL dialect. This article focuses on that second step.

For this example, assume both systems contain the same data: `order_id` is a unique, non-null integer, and `amount` is stored in yuan with the same decimal precision. **A conversion should preserve the query requirement and change only the representation required by the target system.**

<details>
<summary>Expand to copy the SQL example</summary>

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

The unique ordering makes “the first 10” deterministic. See the [PostgreSQL LIMIT documentation](https://www.postgresql.org/docs/current/queries-limit.html) and [SQL Server ORDER BY documentation](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-order-by-clause-transact-sql?view=sql-server-ver17). These are independently constructed teaching examples; I did not run them against both databases.

## A syntax change can change the result

Replacing `LIMIT` with `TOP` is straightforward. If the target stores money as integer cents, `amount > 100` must become `amount_cents > 10000`. That already depends on a data-definition rule: the unit conversion and precision must be known.

Now suppose the target keeps only two categories: “under 200 yuan” and “at least 200 yuan.” Can it still express “over 100 yuan”?

![Five order amounts: 80, 100, 150, 200, and 240 yuan. The original query selects the last three; selecting only at least 200 misses 150, while selecting both categories adds 80 and 100.](/img/nl2sql-semantic-conversion/lossy-results.svg)

*Figure 2: Green means a correct match; red marks an extra or missing row. The target has lost the detail needed to reconstruct the original condition.*

A warning can report this difference. It does not authorize the conversion. If the business accepts approximate filtering, the system should state whether it may over-select or under-select and require the caller to accept that policy. A path that promises exact results should stop.

Missing fields work the same way. The `shop_id = 7` condition in `shop_id = 7 AND amount > 100` cannot simply be removed. Removing it widens the result set; if it enforces access isolation, it can also change the authorization boundary.

That gives us two separate problems: **dialect conversion handles syntax differences; data-model adaptation also needs field meaning, units, and information completeness.** The latter needs business evidence.

## What should the model do?

This kind of feature appears in multi-database reporting, platform migrations, and historical query replay. NL2SQL adds another entry point: understand a user’s language first, then generate a query.

The model can help interpret “recent high-value orders,” but “how recent?” and “how high?” still need clarification or an existing business definition. Once the condition is explicit, dialect conversion should apply rules instead of guessing the meaning a second time.

![Responsibilities of the model, deterministic code, and the database: the model proposes query intent and clarifies ambiguity; code validates structure, applies mappings, and rejects unsupported conversions; the database executes the query and the results are checked.](/img/nl2sql-semantic-conversion/responsibilities.svg)

*Figure 3: The model interprets language, code executes explicit rules, and the target engine executes the query. Each step leaves inspectable inputs and outputs.*

The architecture depends on whether the query shape is fixed, whether the conversion runs repeatedly, and whether someone reviews the result:

| Scenario | Start with | Cost and boundary |
|---|---|---|
| One-off migration with row-by-row review | LLM-assisted rewriting | Humans inspect and validate on the target engine |
| Fixed query shape with changing parameters | Parameterized templates | Simple, but every query shape needs maintenance |
| Repeated support for standard SQL dialects | Existing parsers and conversion tools | Check grammar coverage and unsupported behavior |
| Private query language with business mappings | Small grammar plus explicit rules | You own the grammar, rules, and regression cases |

With only one engine, validating model-generated queries may still be useful, but a separate cross-dialect layer may be unnecessary. The important question is whether the supported scope is clear, not how many abstraction layers the design contains.

## The NL2SQL project I refactored last year

This project converts filter expressions between two restricted query languages. The SQL examples above explain the problem; they do not mean that this project supports PostgreSQL, SQL Server, or the full `SELECT` grammar.

I kept the grammar small and represented the parsed result as a typed AST: a tree whose nodes record fields, values, and the way conditions are combined.

For `A AND (B OR C)`, the tree makes “B or C” a single child expression. The converter parses the structure, applies mappings, renders the target expression, and parses the output once more to check that it is valid. REST and MCP use the same implementation.

An AST preserves structure, but it does not know how yuan relates to cents. Unit conversions, field mappings, and missing-condition policies still need evidence-backed, testable rules.

The current implementation returns warnings for some lossy mappings and rejects unmapped conditions by default. With the explicit `drop_conjuncts` policy enabled, it can remove only independent conditions in a positive AND chain; it rejects removals inside OR and NOT. **Allowing a condition to be dropped does not make the result equivalent.** The caller still decides whether execution is allowed, and an authorization condition should never be released through a generic switch.

## Give the method to an Agent

If you want an Agent to automate query conversion, define an intermediate data format before implementing the converter. **Natural language should become a candidate structure first; only a validated structure should enter the deterministic conversion pipeline.** Valid JSON from a model is not proof that the meaning is correct.

For the order request above, after the table, fields, and units have been confirmed, the query can be represented with this AST. JSON is only the serialization format; node types and composition rules are the contract. This example includes full-query nodes that the current project does not implement.

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

The amount is stored as a decimal string so that a floating-point approximation cannot silently change the value; the implementation should read it with a decimal type. Field names come from an allowed data catalog. More complex conditions can nest `and`, `or`, and `not` nodes while preserving the original structure.

The algorithm can be split into four steps:

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

`extract` can be handled by a model. If the input is already a query, use a grammar parser instead. `confirmed_intent` means that the requirement has a clear basis and ambiguities have been resolved with the user; a model’s self-reported confidence is not a substitute.

`transform_bottom_up` processes child nodes before their parents and applies only registered rules. If the target stores amounts as integer cents, a confirmed unit and precision rule can map `amount` to `amount_cents` and convert decimal `100` exactly to `10000`. The comparison `gt` stays the same, as do the surrounding AND, OR, and NOT nodes. With no rule, the conversion stops.

The renderer handles target syntax only. Identifiers come from an allowlist, and constants are passed as bound parameters. Each conversion records the rule version, the before-and-after nodes, and warnings so an Agent can explain the result and a person can debug it. `READY_FOR_VALIDATION` means that the result may enter execution-policy checks and target-side validation; it is not execution authorization.

You can give an Agent a task like this:

> Define the allowed AST nodes and field types first. Then implement a validator, mapper, and target renderer. Return clarification questions for unresolved requirements and reasons for unknown or lossy mappings; never delete conditions silently. Deliver the source AST, target query, bound parameters, conversion trace, and normal, boundary, and rejection cases.

The local review for this project passed 67 tests, and a 1,000-condition OR chain no longer triggers the original recursion problem. Those tests do not cover the full-query design above. An implementation should still compare rows, duplicate counts, column values, and ordering on the same data, including amounts exactly at 100, null amounts, too few orders, and more than 10 orders.

The same method applies to document extraction and rule normalization: define typed data first, preserve source evidence and unresolved items, then use deterministic code for conversion and validation. Use a tree when nested relationships matter; a fixed schema is enough for simple records.
