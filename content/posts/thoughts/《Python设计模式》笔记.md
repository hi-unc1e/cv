---
title: "《Python设计模式》笔记"
slug: iym6po54b7ow44ar
date: 2023-05-01T09:21:43+08:00
source: yuque/thoughts
---

![画板](https://cdn.nlark.com/yuque/0/2023/jpeg/166008/1684026860830-3b1e2001-72fa-4010-a92d-2f0cdff5a8a5.jpeg)



# 一、其书
| **书名** | 《精通Python设计模式》 |
| --- | --- |
| **作者** | [荷] Sakis Kasampalis |
| **出版社** | 人民邮电出版社 |
| **出版时间** | 2016年7月 |




![](https://cdn.nlark.com/yuque/0/2023/png/166008/1682904597389-56caee0b-ed98-49fd-8e01-4131197a8563.png)





---

# 二、摘录
+ 控制软件的复杂度
    - 设计模式是被发现，而不是被发明出来的
    - 不要随处使用
        * 多思考：You Aren't Gonna Need It
    - KISS
+ 应该在积累了一定的开发经验之后，再系统地学习设计模式



---

# 三、番外
想读：2020-12-24

在读：2023-05-01

读过：2023-05-14

## 对代码审计的启示
虽然这本书的示例代码是Python， 但是其中设计的设计模式，却在各种框架上有所体现，例如：

1. 常用的web框架-Spring，使用了哪些设计模式？——决定代码审计的视野。
2. 这些设计模式，本身是良好的实践，但如果错位使用，是否会导致安全风险？
3. 有让软件架构更轻巧的【设计模式】，那么有让软件更安全的【安全模式】吗？——有，SDL那一套走起来。另有一本2013年书《Security Patterns in Practice》。



简例

| **模式名** | **实践** |
| --- | --- |
| MVC | Spring MVC<br/>ThinkPHP |
| Facade（门面） | laravel |
| 责任链模式 | DispatcherServlet-doDispatch |
| 建造者模式 | QuerBuilder |






## 常用python装饰器
Python 的 functools 模块提供了一些常用的装饰器，可以用来改变函数的行为，包括：

`functools.lru_cache`：用于缓存函数的结果，以提高函数的执行效率。

`functools.wraps`：用于更新被装饰函数的元信息（如函数名、文档字符串等），以便在调用时更容易识别和调试被装饰函数。

`functools.partial`：用于创建一个带有固定参数的新函数，从而简化函数的调用。



### 装饰器是否带括号
> <font style="color:rgba(52,53,65,var(--tw-text-opacity));">带括号，有三层def语句。</font>
>
> <font style="color:rgba(52,53,65,var(--tw-text-opacity));">不带括号，有两层def语句</font>
>

```python
def log_function_call(func):
    def wrapper(*args, **kwargs):
        print(f"Function '{func.__name__}' was called.")
        return func(*args, **kwargs)
    return wrapper

@log_function_call
def say_hello(name):
    print(f"Hello, {name}!")

say_hello("John")

```



```python
def repeat(n):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for _ in range(n):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator

@repeat(3)
def say_hello(name):
    print(f"Hello, {name}!")

say_hello("Jane")

```



### 可选执行
以下是一个示例，其中定义了一个 `conditional_decorator` 装饰器，它接受一个 condition 参数，该参数是一个函数，用于判断是否应该应用装饰器。如果 condition 函数返回 True，则应用装饰器，否则不应用装饰器。

```python
def conditional_decorator(condition):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if condition():
                return func(*args, **kwargs)
            else:
                return None
        return wrapper
    return decorator


@conditional_decorator(lambda: True)
def hello():
    print("Hello, world!")

```

### functools.partial
> **<font style="background-color:rgb(247, 247, 248);">functools.partial</font>**<font style="color:rgb(55, 65, 81);background-color:rgb(247, 247, 248);"> 的作用是将函数的部分参数固定下来，从而创建一个新的函数。这可以使得函数的调用更加简单和直观，特别是当有一些参数是常量时。</font>
>

functools.partial 可以用于创建一个带有固定参数的新函数，从而简化函数的调用。下面是一个示例，其中定义了一个计算两个数之和的函数，并使用 functools.partial 创建了一个新函数 add2，它会将 2 作为第一个参数传递给 add 函数：



```python
import functools

def add(x, y):
    return x + y

add2 = functools.partial(add, 2)

result = add2(3)
print(result)  # 输出 5

```



### functools.lru_cache


下面是一个使用 `functools.lru_cache` 装饰器的示例：

```python
import functools

@functools.lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n-1) + fib(n-2)

```

