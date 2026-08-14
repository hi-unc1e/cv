---
title: "Talking About Weak Typing in PHP"
slug: imddno
translationKey: imddno
date: 2021-01-11T17:31:01+08:00
source: yuque/penetration
---

A technique commonly seen in PHP code audits: weak typing, known in English as `type Juggling`. The basic concept is as follows:

> Prior to PHP 8, when using `==` for comparison or in any situation involving weak type conversion, **strings are first converted to numbers**, and only then compared against the number.
>

# Comparison with `==`
Therefore, when a string is loosely compared against a number (`loose comparison`), the result is often unexpected. For example, `"1 and 1=1" == 1 ` evaluates to true in PHP.

Below is a cheat sheet for weak-typed comparisons

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610358129877-bebc4fa6-68a6-416d-bd73-d7e9decedb88.png)

<font style="color:#8C8C8C;">Image referenced from:</font>[<font style="color:#8C8C8C;">https://www.php.net/manual/en/types.comparisons.php</font>](https://www.php.net/manual/en/types.comparisons.php)



See the one highlighted in red? `"php" == 0` actually holds true as well. This is because the string is first converted to a number, and then compared against the numeric value.

But it gets even stranger: even when two strings are compared, as long as both look numeric (such as `"0x123"` for hexadecimal notation, or `"0e123"` for scientific notation), PHP will convert them to numbers before comparing. Therefore the following relations hold

```basic
- TRUE: "0e12345" == "0e54321"
- TRUE: "0e12345" == "0"
- TRUE: "0xF" == "15" 					[php 7.2.24 下为False]
```

Now, let's go one step further: given two strings that are themselves different but compare equal under loose comparison, what do the `0e` or `0x` forms remind you of? That's right — `e` belongs to `a-f` and can be used to represent hexadecimal, and isn't the return value of the `md5()` function precisely a hexadecimal string?

So we have the following conclusion: for two different strings, we can make their md5 values compare equal.

The md5 values of the strings below are all equal under loose comparison.

```basic
QNKCDZO
	0e830400451993494058024219903391

s878926199a
	0e545993274517709034328855841020

s155964671a
	0e342768416822451524974117254469
```

In addition, there is also the technique of passing in an array to make a regex match fail and return `false`, which is also worth trying — but let's not stray too far.

> The `sha1()` and `md5()` functions cannot handle array types; they raise an error and return false
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610590658935-18d48d65-d8bf-4fba-a63b-d5bdf8212b9e.png)

After all, checks like `==0` on a regex result are inherently blacklist-style. Whitelisting is forever the GOAT!



# Automatic Weak Type Conversion
## in_array
> in_array(_search_,_array_,_type_)
>

| Parameter | Description |
| :--- | :--- |
| _search_ | Required. Specifies the value to search for in the array. |
| _array_ | Required. Specifies the array to search. |
| _type_ | Optional. If set to true, the function checks whether the type of the searched value matches the type of the values in the array. |


By default, the `_in_array_` function suffers from the weak type conversion problem

```php
<?php
$whitelist = array(1, 2, 3);	// whitelist, only allows querying 1, 2, 3
$id = $_GET['id'];	// ?id=1' or 1=1 --

if (in_array($id, $whitelist)) { // the third parameter is not set to True
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
> Technical detail: if the specified key value is found in the array, it **returns the corresponding key name**, otherwise it returns FALSE.
>

| Parameter | Description |
| :--- | :--- |
| _value_ | Required. Specifies the key value to search for. |
| _array_ | Required. Specifies the array to be searched. |
| _strict_ | Optional. If set to TRUE, the function searches for elements in the array whose data type and value both match. Possible values:<br/>+ true<br/>+ false - default<br>If set to true, the function checks the type of the given value in the array, so the number 5 and the string 5 are different (see example 2). |


The sample code below demonstrates

```php
<?php
$id = "2 and" ;
$whitelist = array(1, 2);
if (array_search($id, $whitelist)) { // the third parameter is not set to True
	echo "你通过了";  
  // sensitive operations such as SQL injection, command execution
} else {
	die("你想搞事");
}
?>
```

## switch case ...
The parameter passed into a `switch` also undergoes type conversion. For example, below I make `"2 and 1=1;--"` land in the `case 2` branch

```php
<?php
$o = "2 and 1=1;--";
switch ($o) { 
    case 1:
        echo "fail";
        break;
    case 2:
        echo "success";  // the output is success;
        break;
    default:
        echo "nothing";
}
?>
```

## strcmp
> The strcmp() function compares two strings.
>
> The strcmp() function is binary-safe and case-sensitive.
>
> **Return values:  **
>
> 0     - if the two strings are equal
>
> <0    - if string1 is less than string2
>
> >0    - if string1 is greater than string2
>

```php
<?php //php 7.2.24
    $array=[1, 2, 3];
    var_dump(strcmp($array, '123')); //NULL
?>
```

The `strcmp` function here actually converts both variables to `ascii` values and performs a mathematical subtraction, returning the difference as an `int`.

In other words, comparing `'a'` with `'a'` yields the result 0.

That is to say, we can make this function error out so that it always evaluates to true, bypassing the function's check.

## 🤡1
Below is a phenomenon of being "both greater than 0 and not greater than 0". The thing to note is the third line — why does `'1e-1000' == 0` hold true

```php
<?php 
	var_dump(intval('1e-1000') > 0); // greater than 0		bool(true)
	var_dump('1e-1000' == 0);  // equal to zero				bool(true)
?>
```

## 🤡2
This is probably because the first `is_numeric` result is assigned directly to the variable, without going through the `and`. This also indirectly shows how important operator precedence is.

```php
<?php //php 7.2.24
$f = is_numeric(123) and is_numeric();
var_dump($f); // outputs bool(true)
    
?>

# 再试试这一手，就能理解了吧
<?php //php 7.2.24
$a = 1 and 0;
$b = (1 and 0);

var_dump($a); // outputs int(1)
var_dump($b); // outputs bool(false)
?>
```




# Best Practices
+ By default, consistently use `===`
+ For hash comparisons, use `hash_equals()`
+ When sensitive functions are involved, explicit type conversion is best. For example, before using `strcmp()` or a `switch case` construct, force a type cast to unify the types being compared. Demo below

```python
(int)"0e23812" === (int)"0e48394832"
```

+ When using `in_array()` or `array_search()`, declare `true` in the corresponding parameter position to use strict comparison

# Supplementary Knowledge
## About HTTP Requests
HTTP requests cannot directly deliver numbers; what gets passed in is generally only strings — arrays can also be passed in. But sometimes it is possible, for example

**Using middleware to parse JSON**

```http
POST /?a=123 HTTP/1.1
Host: 127.0.0.1
Content-Type: application/x-www-form-urlencoded

b=456&c[key]=value
```

**Using an existing json_decode() in the code**

```python
<?php 
...
$arr = json_decode($_GET['param'], true); // when the second parameter is TRUE, an array is returned
if ( $arr["key"] == 1 ){
	echo $flag;
} else {
	die();
}
?>
```

## Timing Attacks
> Timing Attack
>

Typically, string comparison is implemented with shift-based matching: as soon as any mismatch is encountered during matching, it exits immediately and returns the comparison result.

The two comparisons below take different amounts of time; the principle of this attack is similar to blind injection.

```basic
"f447b20a7fcbf53a5d5be013ea0b15af" == "f447b20a7fcbf53a5d5be013ea0bXXXX"
"f447b20a7fcbf53a5d5be013ea0b15af" == "f447bXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

Different inputs cause the code to loop a different number of times, resulting in different execution times. Of course, with the performance of modern computers, ordinary developers can hardly perceive the difference in elapsed time. Nevertheless, this difference really does exist.

With `hash_equals()`, however, it's a different story

> **hash_equals($1, $2)**
>
> (PHP 5 >= 5.6.0, PHP 7)
>
> hash_equals — A string comparison that guards against timing attacks.
>
> + Compares two strings; the **time consumed by this function is constant**, whether or not they are equal.
> + Very importantly, **the user-supplied string must be the second argument**.
>



# Reference Articles
+ [OWASP PHP MagicTricks-TypeJuggling.pdf](https://owasp.org/www-pdf-archive/PHPMagicTricks-TypeJuggling.pdf)
+ [medium PHP Type Juggling Vulnerabilities](https://medium.com/swlh/php-type-juggling-vulnerabilities-3e28c4ed5c09)
+ [https://zhzhdoai.github.io/2019/02/27/PHP%E5%BC%B1%E7%B1%BB%E5%9E%8B/](https://zhzhdoai.github.io/2019/02/27/PHP%E5%BC%B1%E7%B1%BB%E5%9E%8B/)
+ [https://www.dooccn.com/php/#php 5.3.3](https://www.dooccn.com/php/)
+ [https://rextester.com/l/php_online_compiler#php 7.2.24](https://rextester.com/l/php_online_compiler#)



# 
