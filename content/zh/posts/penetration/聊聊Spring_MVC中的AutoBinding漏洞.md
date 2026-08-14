---
title: "聊聊Spring MVC中的AutoBinding漏洞"
slug: spring_mvc_autobinding
translationKey: spring_mvc_autobinding
date: 2021-10-21T17:35:44+08:00
source: yuque/penetration
---

# 0x01 BackGround 
+ **Spring MVC**，Spring Web model-view-controller (MVC) framework  

软件框架有时允许开发人员自动将 HTTP 请求参数绑定到发起人或对象中，更容易使用框架开发人员开发方法。更新开发人员或者业务实现可以设计到的，而这些新的参数又会影响程序代码中不需要新的变量或对象参数。

Ruby on Rails、NodeJS、Spring MVC中，均有此特性，常常导致漏洞（可理解为`属性注入`）,

+ 由于此漏洞，Rails在Github的仓库，在2012年时被入侵，see：[https://lwn.net/Articles/485675/](https://lwn.net/Articles/485675/)
+ 漏洞名： Spring MVC Data Submission to Non-Editable Fields  
+ 漏洞类型：框架使用不当（业务逻辑缺陷）

以Spring MVC为例，来演示存在漏洞的代码

这是类的定义：

```http
public class User {
     private String userid;
     private String username;
     private String phone;
     private String email;
     private boolean isAdmin;

     //Getters & Setters
   }
```

这是处理请求的控制器：

```python
@RequestMapping(value = "/addUserInfo", method = RequestMethod.POST)
  public String submit(User user) {
     userService.add(user);
     return "successPage";
  }
```

这是典型的请求：

```http
POST /addUser
...
userid=bobbytables&password=hashedpass&email=bobby@tables.com
```



这是我们设置`isAdmin`类实例属性值的漏洞利用`User`：

```http
POST /addUser
...
userid=bobbytables&password=hashedpass&email=bobby@tables.com&isAdmin=true
```



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1634811929280-04d874b2-2e69-486a-ab0c-7d07f0742412.png)

根据场景的不同，将造成越权（IDOR）等漏洞。

当然，为了形成漏洞，中间会有一些辗转，也就是漏洞存在的条件，包括：

1. Views层需要有对应的展示逻辑，如form
2. 实现了对应的`setter`跟`getter`
3. 有原生允许编辑/添加的功能点，且未作校验（或前端校验`client side data validation`）

---

# 0x02 白盒Check
+ 开发者盲目相信他所获得的对象来自可信任的地方，但事实上，攻击者可以任意修改这个对象的值。
+ 很难讲变量绑定漏洞或者和它类似的漏洞到底有多普遍，但是自动绑定漏洞确实是分布很广的（基于它产生的特性）。
+ 同时，变量绑定漏洞并不仅限于HTTP的参数，理论上它可能出现在任何地方（JSON或者XML）,只要这些数据能被转换并用于赋值。
+ 当然，每个变量绑定漏洞的具体危害，还取决于代码的业务逻辑和它使用的各种属性。

## 1）方法参数上的`@ModelAttribute`
```java
@RequestMapping(value="/owners/{ownerId}/pets/{petId}/edit", method = RequestMethod.POST)
	public String processSubmit(@ModelAttribute Pet pet) {//【1】
}
```

### BindingResult 
为了检查data binding中的错误（参数缺失/类型转换），常常会用到用`<font style="color:rgb(0, 0, 0);">BindingResult</font>`，如

```java
@RequestMapping(value="/owners/{ownerId}/pets/{petId}/edit", method = RequestMethod.POST)
public String processSubmit(@ModelAttribute("pet") Pet pet, BindingResult result) {
        
    if (result.hasErrors()) {//【1’】
        return "petForm";
    } 
    // ...       
}
```

### 参数校验
有两种方式，其一是`<font style="color:rgb(0, 0, 0);">@Valid</font>`注解，自动验证，From JSR-303（Java 规范提案，Bean Validation），参考[Java数据校验：JSR-303_xueguchen的博客-CSDN博客_java jsr303](https://blog.csdn.net/xueguchen/article/details/111406671)

```java
@RequestMapping(value="/owners/{ownerId}/pets/{petId}/edit", method = RequestMethod.POST)
public String processSubmit(@Valid @ModelAttribute("pet") Pet pet, BindingResult result) {
							//【！】
    if (result.hasErrors()) {
        return "petForm";
    }
    
    // ...
}
```



```java
Constraint	详细信息
@Null	被注释的元素必须为 null
@NotNull	被注释的元素必须不为 null
@AssertTrue	被注释的元素必须为 true
@AssertFalse	被注释的元素必须为 false
@Min(value)	被注释的元素必须是一个数字，其值必须大于等于指定的最小值
@Max(value)	被注释的元素必须是一个数字，其值必须小于等于指定的最大值
@DecimalMin(value)	被注释的元素必须是一个数字，其值必须大于等于指定的最小值
@DecimalMax(value)	被注释的元素必须是一个数字，其值必须小于等于指定的最大值
@Size(max, min)	被注释的元素的大小必须在指定的范围内
@Digits (integer, fraction)	被注释的元素必须是一个数字，其值必须在可接受的范围内
@Past	被注释的元素必须是一个过去的日期
@Futuret	被注释的元素必须是一个将来的日期
@Pattern(value)	被注释的元素必须符合指定的正则表达式
```

其二，就是[自定义](https://github.com/spring-projects/spring-petclinic/blob/main/src/main/java/org/springframework/samples/petclinic/owner/PetValidator.java#L32)`Validator`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1635147630224-e66c11ac-aaeb-46f3-a68d-d494513faa09.png)

```java
@RequestMapping(value="/owners/{ownerId}/pets/{petId}/edit", method = RequestMethod.POST)
public String processSubmit(@ModelAttribute("pet") Pet pet, BindingResult result) {

    new PetValidator().validate(pet, result);//【1’’】
    if (result.hasErrors()) {
        return "petForm";
    }
    // ...
}
```



## 2）方法的`@ModelAttribute` 注解
```java
// Add one attribute
// The return value of the method is added to the model under the name "account"
// You can customize the name via @ModelAttribute("myAccount")

@ModelAttribute	//【1】
public Account addAccount(@RequestParam String number) {
    return accountManager.findAccount(number);
}

// Add multiple attributes

@ModelAttribute	//【2】
public void populateModel(@RequestParam String number, Model model) {
    model.addAttribute(accountManager.findAccount(number));
    // add more ...
}
```

## 3）类的`@SessionAttribute` 注解
> 域，Scope
>
> 默认情况下Spring MVC将模型中的数据存储到request域中。
>
> 当一个请求结束后，数据就失效了。如果要跨页面使用。那么需要使用到session。而@SessionAttributes注解就可以使得模型中的数据存储一份到session域中。
>

```java
@SessionAttributes(value={"names"},types={Integer.class})
@Controller
public class Test {
    @RequestMapping("/test")
    public String test(Map<String,Object> map){
        map.put("names", Arrays.asList("caoyc","zhh","cjx"));
        map.put("age", 18);
        return "hello";
    }
}
```



## 4）指定重定向和flash属性（RedirectAttributes）


```java
@Controller
public class ControllerOne {
	@RequestMapping(value="mybook", method = RequestMethod.GET)
	public ModelAndView book(){
		return new ModelAndView("book","book",new Book());
	}
    
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public RedirectView  save(@ModelAttribute("book") Book book, RedirectAttributes redirectAttrs) {												//【！】
		redirectAttrs.addAttribute("msg", "Hello World!");
		redirectAttrs.addFlashAttribute("book", book.getBookName());
		redirectAttrs.addFlashAttribute("writer", book.getWriter());
		
		RedirectView redirectView = new RedirectView();
		redirectView.setContextRelative(true);
		redirectView.setUrl("/hello/{msg}");
		return redirectView;
	}
} 
```

`RedirectView`可用作 URI 模板，模板的值将自动在【`Model`或`RedirectAttributes`】的相同键中进行替换。



# 0x03 黑盒Detect
乍一看，使用“黑盒”方法查找自动绑定漏洞似乎是不可能的。但还是有一些方法

1. **通常，参数名称等于对象字段的名称**（但不是必需的，因为它是可配置的）。由于字段通常以特定方式命名，因此我们可以对其进行区分。值得注意的是，自动绑定可以与HashMap和数组一起使用。
2. 在控制器的方法中使用自动绑定，当我们**发送两个同名参数时，对象中的值将是参数的串联**，例如

```basic
# 带参数的请求：
?name=text1&name=text2

# 结果：
ObjectWithNameField.name = text1,text2
```

有点ASPX参数的感觉

> 在 ASPX 中，有一个比较特殊的特性，当 GET/POST/COOKIE 同时提交的参数 id，服务端接收参数 id 的顺序 GET,POST,COOKIE，中间通过逗号链接
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1635154087165-84ef5436-7512-46b4-b9e9-ef18ee3ff2c2.png)

3. **FUZZ**。一旦我们收集了所有参数名称，我们就可以将它们发送到所有入口点（URL），甚至是那些乍一看不接受参数的入口点（例如resetViewQuestionHandler），并检查回复是否不同或与没有参数相同。

# 0x04 修复建议
1. 只有用户可以编辑的字段才包含在`DTO`中

```http
public class UserRegistrationFormDTO {
     private String username;
     private String password;
     private String email;

     //Getters & Setters
   }
```



2. 修改`controller`层，仅接收用户可以修改的参数（显式声明）

```http
@RequestMapping(value = "/addUserInfo", method = RequestMethod.POST)
  public String submit(String username,String phone,String email) {
     userService.add(username,phone,email);
     return "successPage";
  }
```



3. 也可以设置白名单

```java
@Controller
  public class UserController
  {
     @InitBinder
     public void initBinder(WebDataBinder binder, WebRequest request)
     {
        binder.setDisallowedFields(["isAdmin"]);
     }

     ...
  }
```

# Refs
+ [https://code.tutsplus.com/tutorials/mass-assignment-rails-and-you--net-31695](https://code.tutsplus.com/tutorials/mass-assignment-rails-and-you--net-31695)
+ [https://o2platform.files.wordpress.com/2011/07/ounce_springframework_vulnerabilities.pdf](https://o2platform.files.wordpress.com/2011/07/ounce_springframework_vulnerabilities.pdf)
    - 此文还提及了`SPRING MVC MODELVIEW INJECTION`，
+ [https://vulners.com/myhack58/MYHACK58:62201787105](https://vulners.com/myhack58/MYHACK58:62201787105)
+ [https://xz.aliyun.com/t/128](https://xz.aliyun.com/t/128)
+ Github被大量分配漏洞黑了，[https://lwn.net/Articles/485675/](https://lwn.net/Articles/485675/)
    - 有趣的讨论：[https://github.com/rails/rails/issues/5228](https://github.com/rails/rails/issues/5228)
+ [https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html) （recommended）



+ [Java数据校验：JSR-303_xueguchen的博客-CSDN博客_java jsr303](https://blog.csdn.net/xueguchen/article/details/111406671)
+ [https://www.concretepage.com/spring/spring-mvc/spring-mvc-redirectview](https://www.concretepage.com/spring/spring-mvc/spring-mvc-redirectview)



二次更新：

+ 靶场：[https://github.com/GrrrDog/ZeroNights-HackQuest-2016](https://github.com/GrrrDog/ZeroNights-HackQuest-2016)
+ [https://xz.aliyun.com/t/128](https://xz.aliyun.com/t/128?time__1311=CqjhqGx%2Bx0xmxQqGNmW%3D8Qi%3DrBP4oD&alichlgref=https%3A%2F%2Fxz.aliyun.com%2Fu%2F3980)

