---
title: "聊聊PHP中的弱类型"
slug: imddno
translationKey: imddno
date: 2021-01-11T17:31:01+08:00
source: yuque/penetration
---

PHP代码审计中常见的一种技巧：弱类型，英文名叫`type Juggling`，基本的概念如下：

> PHP 8 以前，在使用`==`比较或任何有弱类型转换的情况时，**字符串都会先被转换成数字**，再和数字进行比较。
>

# 使用`==`比较
因此，当一个字符串跟数字进行松散比较时（`loose comparison`），常常会有意想不到的结果，例如：`"1 and 1=1" == 1 `，在PHP中是成立的。

下面是弱类型比较的速查表

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610358129877-bebc4fa6-68a6-416d-bd73-d7e9decedb88.png)

<font style="color:#8C8C8C;">图片参考自：</font>[<font style="color:#8C8C8C;">https://www.php.net/manual/en/types.comparisons.php</font>](https://www.php.net/manual/en/types.comparisons.php)



看到标红的了么？`"php" == 0`居然也是成立的。这是由于，字符串会先被转换成数字，之后再和数字值进行比较。

但事情还更怪：即便是两个字符串相比较，只要它俩看起来都像字符串（如`"0x123"`这种表示十六进制的表示，或者`"0e123"`这种科学计数法的表示），PHP也会将其转换成数字再进行比较。因此下面的关系是成立的

```basic
- TRUE: "0e12345" == "0e54321"
- TRUE: "0e12345" == "0"
- TRUE: "0xF" == "15" 					[php 7.2.24 下为False]
```

下面，我们再进一步：两个字符串，既然有可能在它们本身并不相同的情况下，在松散比较下相等，那么你从它们涉及的`0e`或`0x`中想到了什么？没错，`e`是属于`a-f`的，可以用来表示16进制，而`md5()`函数的返回，不就是16进制的字符串么？

所以有以下结论：对于两个字符串，我们可以在它们本身并不相同的情况下，使它们的md5值相等。

下面几个字符串的md5值在松散比较下，都是相等的。

```basic
QNKCDZO
	0e830400451993494058024219903391

s878926199a
	0e545993274517709034328855841020

s155964671a
	0e342768416822451524974117254469
```

此外，还有输入数组让正则匹配出错返回`false`的方法，也值得一试，当然，不扯远了。

> `sha1()`、`md5()`函数无法处理数组类型，将报错并返回false
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610590658935-18d48d65-d8bf-4fba-a63b-d5bdf8212b9e.png)

毕竟对于正则返回`==0`这种的判断，就属于黑名单嘛。白名单才是永远的神！



# 自动弱类型转换
## in_array
> in_array(_search_,_array_,_type_)
>

| 参数 | 描述 |
| :--- | :--- |
| _search_ | 必需。规定要在数组搜索的值。 |
| _array_ | 必需。规定要搜索的数组。 |
| _type_ | 可选。如果设置该参数为 true，则检查搜索的数据与数组的值的类型是否相同。 |


默认情况下的`_in_array_`函数，是存在弱类型转换的问题滴

```php
<?php
$whitelist = array(1, 2, 3);	//白名单，只允许查询1、2、3
$id = $_GET['id'];	// ?id=1' or 1=1 --

if (in_array($id, $whitelist)) { // 未设置第三参数为True
  // ("1' or 1=1 --" == 1) -> TRUE
  ...
  $sql = "select * from users where userid = '". $id ."'";
  $r = $db->query($sql);
  ...
} else {
	die("你想搞事");
}
?>
SQL注入！
```

## array_search
> array_search(_value_, _array_, _strict_)
>
> 
>
> 技术细节：如果在数组中找到指定的键值，则**返回对应的键名**，否则返回 FALSE。
>

| 参数 | 描述 |
| :--- | :--- |
| _value_ | 必需。规定需要搜素的键值。 |
| _array_ | 必需。规定被搜索的数组。 |
| _strict_ | 可选。如果该参数被设置为 TRUE，则函数在数组中搜索数据类型和值都一致的元素。可能的值：<br/>+ true<br/>+ false - 默认<br/>如果设置为 true，则在数组中检查给定值的类型，数字 5 和字符串 5 是不同的（参见实例 2）。 |


下面这段示例代码，演示了

```php
<?php
$id = "2 and" ;
$whitelist = array(1, 2);
if (array_search($id, $whitelist)) { // 未设置第三参数为True
	echo "你通过了";  
  //SQL注入、命令执行等敏感操作
} else {
	die("你想搞事");
}
?>
```

## switch case ...
`switch`进去的参数，也会进行类型转换，例如下面我就让`"2 and 1=1;--"`进到了`case 2`的分支

```php
<?php
$o = "2 and 1=1;--";
switch ($o) { 
    case 1:
        echo "fail";
        break;
    case 2:
        echo "success";  //结果输出success;
        break;
    default:
        echo "nothing";
}
?>
```

## strcmp
> strcmp() 函数比较两个字符串。
>
> strcmp() 函数是二进制安全的，且对大小写敏感。
>
> **返回值：  **
>
> 0      - 如果两个字符串相等
>
> <0    - 如果 string1 小于 string2
>
> >0    - 如果 string1 大于 string2
>

```php
<?php //php 7.2.24
    $array=[1, 2, 3];
    var_dump(strcmp($array, '123')); //NULL
?>
```

这里的`strcmp`函数，实际上是将两个变量转换成`ascii` 然后做数学减法，返回一个`int`的差值。

也就是说键入`'a'`和`'a'`进行比较得到的结果就是0。

也就是说，我们可以让这个函数出错从而使它恒真，绕过函数的检查。

## 🤡1
下面是“既大于0，又不大于0”的一种现象，要注意的就是第三行，为什么`'1e-1000' == 0`是成立的

```php
<?php 
	var_dump(intval('1e-1000') > 0); //大于0		bool(true)
	var_dump('1e-1000' == 0);  // 等于零				bool(true)
?>
```

## 🤡2
这大概是由于第一个`is_numeric`直接赋值给变量了，并没有经过`and`，这也间接体现了运算符优先级的重要性。

```php
<?php //php 7.2.24
$f = is_numeric(123) and is_numeric();
var_dump($f); //输出 bool(true)
    
?>

# 再试试这一手，就能理解了吧
<?php //php 7.2.24
$a = 1 and 0;
$b = (1 and 0);

var_dump($a); //输出 int(1)
var_dump($b); //输出 bool(false)
?>
```





# 最佳实践
+ 默认情况，统一使用`===`
+ 哈希比较，使用`hash_equals()`
+ 如果涉及敏感函数的使用，最好进行显式的类型转换，如使用`strcmp()`、`switch case`结构体之前，请用强制类型转换，统一比较的类型，demo如下

```python
(int)"0e23812" === (int)"0e48394832"
```

+ 使用`in_array()`、`array_search()`这几个函数时，请在对应参数位置声明`true`，采用严格比较

# 补充知识点
## 关于HTTP请求
HTTP请求无法直接传入数字，传入的一般只是字符串，也可以传入数组。但有时候可以，比如

**利用中间件解析JSON**

```http
POST /?a=123 HTTP/1.1
Host: 127.0.0.1
Content-Type: application/x-www-form-urlencoded

b=456&c[key]=value
```

**利用代码中已有的json_decode()**

```python
<?php 
...
$arr = json_decode($_GET['param'], true); //当第二参数为 TRUE 时，将返回 array 
if ( $arr["key"] == 1 ){
	echo $flag;
} else {
	die();
}
?>
```

## 时序攻击
> Timing Attack
>

通常，字符串比较的实现基于移位匹配，此时只要在匹配中碰到任何不匹配，则直接退出，返回比较结果。

下面这两次比较的时间，是不相等的，这种攻击的原理类似盲注。

```basic
"f447b20a7fcbf53a5d5be013ea0b15af" == "f447b20a7fcbf53a5d5be013ea0bXXXX"
"f447b20a7fcbf53a5d5be013ea0b15af" == "f447bXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

对于不同的输入，代码循环的次数不一样，导致执行耗时也是不一样的，当然由于现代计算机性能的提升，普通开发者很难体会到耗时的差异。不过这种差别的确是存在的。

而采用`hash_equals()`就不一样

> **hash_equals($1, $2)**
>
> (PHP 5 >= 5.6.0, PHP 7)
>
> hash_equals — 可防止时序攻击的字符串比较。
>
> + 比较两个字符串，无论它们是否相等，本函数的**时间消耗是恒定**的。
> + 非常重要的一点是，**用户提供的字符串必须是第二个参数**。
>



# 参考文章
+ [OWASP PHP MagicTricks-TypeJuggling.pdf](https://owasp.org/www-pdf-archive/PHPMagicTricks-TypeJuggling.pdf)
+ [medium PHP Type Juggling Vulnerabilities](https://medium.com/swlh/php-type-juggling-vulnerabilities-3e28c4ed5c09)
+ [https://zhzhdoai.github.io/2019/02/27/PHP%E5%BC%B1%E7%B1%BB%E5%9E%8B/](https://zhzhdoai.github.io/2019/02/27/PHP%E5%BC%B1%E7%B1%BB%E5%9E%8B/)
+ [https://www.dooccn.com/php/#php 5.3.3](https://www.dooccn.com/php/)
+ [https://rextester.com/l/php_online_compiler#php 7.2.24](https://rextester.com/l/php_online_compiler#)



# 
