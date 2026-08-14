---
title: "LLM| 借助DSpy自动优化大模型的提示词"
slug: mguyyoocikdmzldf
date: 2025-08-07T22:53:22+08:00
source: yuque/penetration
tags:
  - Agent
---

推荐阅读——让LLM自动微调模型：

+ [https://dspy.ai/tutorials/rag/#using-a-dspy-optimizer-to-improve-your-rag-prompt](https://dspy.ai/tutorials/rag/#using-a-dspy-optimizer-to-improve-your-rag-prompt)
+ [https://dspy.ai/tutorials/games/](https://dspy.ai/tutorials/games/)
+ 用mlflow记录微调细节，[https://mlflow.org/docs/latest/genai/flavors/dspy/optimizer/](https://mlflow.org/docs/latest/genai/flavors/dspy/optimizer/)
+ 优化Agent的提示词，让老师模型帮学生模型优化，[https://dspy.ai/tutorials/agents/](https://dspy.ai/tutorials/agents/)





# DSpy 使用笔记
DSpy 是一个开源的 Python 框架，旨在通过模块化和声明式编程来构建语言模型应用程序。它使得与大型语言模型（LLM）的交互更加高效和可靠，避免了传统提示工程中的繁琐和不确定性。



以下是 DSpy 的基本用法和示例，便于日后参考。

## 📦 安装 DSpy
确保你已经安装了 DSpy。可以通过以下命令进行安装：

```bash
pip install dspy
```

## 🛠️ 基本用法
### 1. 导入库
在使用 DSpy 之前，需要导入相关的库：

```python
import dspy
from typing import Literal, Dict
import pydantic
```

### 2. 定义数据模型
使用 Pydantic 定义数据模型，以便结构化输出。以下是一个示例，表示 Webshell 检测的结果：

```python
class SecAnalysisResult(pydantic.BaseModel):
    """根据文件内容，识别文件是否为 WebShell 恶意木马，给出结构化 JSON 输出，包含风险评分、结论、推理路径和建议"""
    content: str = dspy.InputField()

    conclusion: Literal['malicious', 'suspicious', 'benign'] = dspy.OutputField()
    score: conint(ge=0, le=100) = dspy.OutputField(description="风险评分，范围从 0 到 100，分数越高表示越有嫌疑")
    reason: str = dspy.OutputField(description="判断依据，必须大于 50 个字")

    reasoning_steps: Dict[str, str]
    summary: str
    recommendation: str

    @validator('reason')
    def check_reason_length(cls, value):
        if len(value) <= 50:
            raise ValueError('reason 必须大于 50 个字')
        return value

```

### 3. 创建检测模块
使用 DSpy 的 `Signature` 模块定义输入和输出的关系：

```python
webshell_sig = dspy.Signature(
    "content: str -> detection_result: SecAnalysisResult",
)
```

### 4. 使用 Chain-of-Thought 模块进行检测
创建一个 Chain-of-Thought 模块来处理 Webshell 检测：

```python
detection = dspy.ChainOfThought(webshell_sig)

# 示例代码片段
shell = """<?php
if(isset($_REQUEST['cmd'])) {
    system($_REQUEST['cmd']);
}
?>
"""

# 进行检测
r = detection(content=shell)
print(r)
```

### 5. 输出结果
检测结果将以结构化的 JSON 格式输出，包含结论、评分、推理步骤、总结和建议。



![](https://cdn.nlark.com/yuque/0/2025/png/166008/1754578930486-1e12b4a8-9476-4835-acb2-2f0c205e679b.png)

```python
    detection_result=SecAnalysisResult(
        content="<?php\nif(isset($_REQUEST['cmd'])) {\n    system($_REQUEST['cmd']);\n}\n?>", 
        conclusion='malicious', 
        score=100, 
        reason="这段PHP代码是一个典型的WebShell后门，它允许任何人通过HTTP请求参数'cmd'执行任意系统命令，没有任何安全限制或身份验证机制。攻击者可以利用此代码完全控制服务器，执行危险操作如查看、修改、删除文件，窃取敏感信息等。", 
        reasoning_steps={'步骤1': "代码检查是否存在'cmd'请求参数", 
                         '步骤2': '如果参数存在，直接将其值传递给system()函数执行', 
                         '步骤3': 'system()函数会执行任意系统命令', 
                         '步骤4': '没有任何身份验证或输入过滤机制', '步骤5': '这是典型的WebShell特征，允许远程命令执行'}, 
        summary='这是一个典型的PHP WebShell后门，允许攻击者通过HTTP请求参数执行任意系统命令', 
        recommendation='立即删除此文件，检查服务器是否有其他被入侵的痕迹，审查所有文件完整性，并加强服务器安全措施，如禁用危险函数、实施文件完整性监控、加强访问控制等。')

```





## 📋 示例代码
以下是完整的示例代码，展示了如何使用 DSpy 进行 Webshell 检测：



```python
import dspy
from typing import Literal, Dict
from pydantic import BaseModel, conint
class SecAnalysisResult(BaseModel):
    """
    根据文件内容，识别文件是否为 WebShell 恶意木马，以下是各个字段的详细说明：
    
    content: str
        输入字段，代表待检测的文件内容。
        
    conclusion: Literal['malicious', 'suspicious', 'benign']
        输出字段，表示检测结果的结论，包括：
        - 'malicious': 恶意文件
        - 'suspicious': 可疑文件
        - 'benign': 安全文件
        
    score: conint(ge=0, le=100)
        输出字段，风险评分，范围从 0 到 100，分数越高表示文件是恶意文件的可能性越大。
        
    reason: str
        输出字段，对结论的直接解释，简要描述为什么文件被判定为恶意、可疑或安全。
        
    reasoning_steps: Dict[str, str]
        输出字段，推理路径，为一个字典，包含检测过程中各个步骤的详细描述。
        
    summary: str
        输出字段，对检测结果的概要描述，总结文件的主要可疑或恶意行为。
        
    recommendation: str
        输出字段，提出针对检测结果的推荐操作或建议，比如隔离文件、进一步分析等。
    """
    content: str = dspy.InputField()
    conclusion: Literal['malicious', 'suspicious', 'benign'] = dspy.OutputField()
    score: conint(ge=0, le=100) = dspy.OutputField(description="风险评分，范围从 0 到 100，分数越高表示越有嫌疑")
    reason: str
    reasoning_steps: Dict[str, str]
    summary: str
    recommendation: str
# 示例代码片段
shell = """<?php
if(isset($_REQUEST['cmd'])) {
    system($_REQUEST['cmd']);
}
?>
"""
webshell_sig = dspy.Signature(
    "content: str -> detection_result: SecAnalysisResult",
)
detection = dspy.ChainOfThought(webshell_sig)
r = detection(content=shell)
print(r)
```





# 原理
<font style="color:rgb(34, 34, 34);">DSpy 的工作原理基于以下几个关键点：</font>

1. **<font style="color:rgb(34, 34, 34);">模块化设计</font>**<font style="color:rgb(34, 34, 34);">：DSpy 允许用户定义不同的模块，例如输入字段、输出字段和推理步骤。这种设计使得用户可以清晰地组织和管理与模型的交互。</font>
2. **<font style="color:rgb(34, 34, 34);">结构化输入输出</font>**<font style="color:rgb(34, 34, 34);">：通过定义输入和输出的字段，DSpy 确保所有交互都遵循一致的格式。这种结构化的方式有助于提高模型的理解能力和输出的准确性。</font>
3. **<font style="color:rgb(34, 34, 34);">提示词模板</font>**<font style="color:rgb(34, 34, 34);">：DSpy 使用提示词模板来指导模型生成所需的输出。模板中包含了输入内容、推理过程和最终结果的结构，确保模型能够按照预期的方式进行推理和输出。</font>

### <font style="color:rgb(34, 34, 34);"></font>
### <font style="color:rgb(34, 34, 34);">提示词模板示例</font>
<font style="color:rgb(34, 34, 34);">以下是一个 DSpy 提示词模板的示例，展示了如何组织输入和输出字段：</font>

```basic
Your input fields are:
1. `content` (str):

Your output fields are:
1. `reasoning` (str): 
2. `detection_result` (SecAnalysisResult):

All interactions will be structured in the following way, with the appropriate values filled in.

  [[ ## content ## ]]
  {content}

  [[ ## reasoning ## ]]
  {reasoning}

  [[ ## detection_result ## ]]
  {detection_result}        # note: the value you produce must adhere to the JSON schema: {"type": "object", "description": "根据文件内容，识别文件是否为 WebShell 恶意木马，给出结构化 JSON 输出，包含风险评分、结论、推理路径和建议", "properties": {"conclusion": {"type": "string", "__dspy_field_type": "output", "enum": ["malicious", "suspicious", "benign"], "title": "Conclusion"}, "content": {"type": "string", "__dspy_field_type": "input", "title": "Content"}, "reason": {"type": "string", "__dspy_field_type": "output", "desc": "判断依据，必须大于 50 个字", "description": "判断依据，必须大于 50 个字", "title": "Reason"}, "reasoning_steps": {"type": "object", "additionalProperties": {"type": "string"}, "title": "Reasoning Steps"}, "recommendation": {"type": "string", "title": "Recommendation"}, "score": {"type": "integer", "__dspy_field_type": "output", "desc": "风险评分，范围从 0 到 100，分数越高表示越有嫌疑", "description": "风险评分，范围从 0 到 100，分数越高表示越有嫌疑", "maximum": 100, "minimum": 0, "title": "Score"}, "summary": {"type": "string", "title": "Summary"}}, "required": ["content", "conclusion", "score", "reason", "reasoning_steps", "summary", "recommendation"], "title": "SecAnalysisResult"}

  [[ ## completed ## ]]
  In adhering to this structure, your objective is: 
  回答时，用中文回答。
```

### <font style="color:rgb(34, 34, 34);">模板字段说明</font>
+ **<font style="color:rgb(34, 34, 34);">输入字段</font>**<font style="color:rgb(34, 34, 34);">：</font>
    - `content`<font style="color:rgb(34, 34, 34);">：待检测的代码内容，类型为字符串。</font>
+ **<font style="color:rgb(34, 34, 34);">输出字段</font>**<font style="color:rgb(34, 34, 34);">：</font>
    - `reasoning`<font style="color:rgb(34, 34, 34);">：推理过程的描述，类型为字符串。</font>
    - `detection_result`<font style="color:rgb(34, 34, 34);">：包含检测结果的结构化 JSON 对象，遵循</font><font style="color:rgb(34, 34, 34);"> </font>`SecAnalysisResult`<font style="color:rgb(34, 34, 34);"> </font><font style="color:rgb(34, 34, 34);">的定义。</font>
+ **<font style="color:rgb(34, 34, 34);">结构化 JSON</font>**<font style="color:rgb(34, 34, 34);">：</font>`detection_result`<font style="color:rgb(34, 34, 34);"> 必须符合特定的 JSON 架构，包含结论、评分、推理步骤、总结和建议等字段。</font>





## 📖 参考文档
+ DSpy 官方文档：[dspy.ai](https://dspy.ai)
+ Pydantic 文档：[pydantic-docs](https://pydantic-docs.helpmanual.io/)

通过以上笔记，你可以快速上手 DSpy，并在未来的项目中高效地使用它进行语言模型的构建和优化。

