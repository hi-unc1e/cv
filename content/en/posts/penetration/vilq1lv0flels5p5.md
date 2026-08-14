---
title: "Android Reverse Engineering in Practice: Attack and Defense of App State Machines, Seen Through Cracking \"Movie Hunter\""
slug: vilq1lv0flels5p5
translationKey: vilq1lv0flels5p5
date: 2026-01-14T20:13:43+08:00
source: yuque/penetration
---

LSPosed module: [cc-aligned-debugSigned-xxxxQluvnDtXmttQ-.zip](https://www.yuque.com/attachments/yuque/0/2026/zip/166008/1768392988049-c4b76ec8-dc21-49f7-b06e-bcad8c3225fe.zip)

Original app files: [DYLS-xxxxX9y9lvWKr5dr-.zip](https://www.yuque.com/attachments/yuque/0/2026/zip/166008/1768393056530-b3417f5e-1491-4c76-b291-d3eaf9f4a9e5.zip)



Ad-free modified version: [dyls-3.1.2.0-noAd.zip](https://www.yuque.com/attachments/yuque/0/2026/zip/166008/1768393015639-040c33df-72e6-4a3c-a5c3-71114470f31f.zip)







**Tags:** Android reverse engineering, Smali, state machine, logic vulnerability

## Preface: When Hooking Meets a "Corpse File"


In red team security testing, we are used to hooking with Frida or Xposed, precisely modifying memory like a surgeon. But recently, while analyzing an app called "Movie Hunter" (电影猎手), I ran into an interesting confrontation. This experience made me rethink: **the highest form of cracking is often not fighting the code logic, but reshaping the data source.**

****

Using this app's ad removal and VIP crack as an example, this article walks through the entire process from hooking to hard-patching Smali, to fighting a locally persisted marker (the Tombstone File), and summarizes a general "dimensionality-reduction strike" methodology for Android reverse engineering.

---

## Part 1. Case Review: A Cat-and-Mouse Game Over a "Free Trial"
### 1. Reconnaissance Phase: Finding the Achilles' Heel
The target app has a typical commercial logic: **"7 free trials, after which a popup forcibly demands an activation code (card key)".




Through LSPosed's Layout Inspector and static analysis with Jadx, I located the core control class `p092v0.C0963k` (post-obfuscation). The core logic is as follows:

```java
// Pseudocode reconstruction
public static int getStartCount() {
    // Read the startup count from MMKV
    return MMKV.decodeInt("startCount");
}

public static void hookLogic() {
    int count = getStartCount();
    if (count >= 7) {
        if (hasValidKami()) {
            // Verification passed
        } else {
            // Trial over, features disabled
            disableFeatures();
        }
    } else {
        // Trial period, count + 1
        increaseCount();
    }
}

```

### 2. First Attack: The Limits of Hooking
Initially, I tried writing an LSPosed module to hook `getStartCount` and force it to return `0`.  
Logically this is sound: always the 0th launch, always in the trial period.

In practice, however, I found: **the modification did not take effect**. Even after changing the return value, the app still said "trial has ended."





### 3. Deep Analysis: The Hidden "Corpse File" (Tombstone File)
Re-examining the Smali code, it is not hard to spot an easily missed logic branch. Upon detecting the end of the trial, the developer not only records it in MMKV, but also leaves a file on the SD card:

```java
# Logic reconstruction: check whether WeiXin/dyls.log exists under the Download directory
new File(Environment.getExternalStoragePublicDirectory(...), "WeiXin/dyls.log").exists()

```

This is a "**corpse file**". As long as this file exists, even if you reset the in-memory counter to 0, the app still judges you as an "expired user".

It is like a zombie: the body is dead (the counter reset to zero), but the tombstone (the file) remains, so death is still the verdict.





### 4. Ultimate Kill: Smali Scalpel + Destroying the Evidence
With the root cause found, the solution becomes a "dimensionality-reduction strike":

1. **Physical removal**: directly delete `/storage/emulated/0/Download/WeiXin/dyls.log` to clear the persisted marker.
2. **Hard-patching the Smali**: instead of relying on a hook framework, directly modify the APK's DEX file.

Modify the `d()` method in `C0963k.smali` (the method that fetches the count):

```plain
.method public static final d()I
    .registers 1
    const/4 v0, 0x0  # force assignment to 0
    return v0        # return directly
.end method

```

**Result:** After repackaging and reinstalling, the app forever thinks it is my first launch, all VIP features unlocked, all ads removed.





---

## Part 2. General Methodology: A God's-Eye View of the App State Machine
Stepping back from this case, how do we turn this experience into a general red team capability? I believe the core lies in **"state machine control"**



### 1. Mental Model: App = f(State)
An app is essentially a state machine. The UI and Functions are merely projections of the State.

+ **Beginner reverse engineering**: modify `f()`. For example, hook `checkPassword()` and force it to return True. This is easily countered by obfuscation and hardening.
+ **Advanced reverse engineering**: modify the `State`. For example, modify `UserBean` so the data source itself says you are a VIP.



### 2. The Three Axes of "Source-Strike" Tactics
When modifying Smali, do not wrestle with complex `if-else` branching logic — go straight for the **source methods (Getters)** that fetch the data.

| Target type | Typical method-name signatures | Modification strategy (Smali) | Corresponding scenario |
| --- | --- | --- | --- |
| **Boolean** | `isVip`, `isAd`, `hasRoot` | `const/4 v0, 0x0` (False)    |  |


  
`const/4 v0, 0x1` (True)  


  
`return v0` | Remove ads, bypass root detection, enable VIP |  
| **Integer** | `getVipLevel`, `getTrialCount` | `const/4 v0, 0x0`  


  
`return v0` | Unlimited trial, skip countdowns |

| **Void** | `initAdSdk`, `showDialog` | `return-void` | Block ad SDK initialization, forbid popups |





### 3. Fighting Persistence: Hunting for "Hidden Stakes"
When in-memory modifications (Hook/Smali) fail, you must check the app's **persisted state checks**.

+ **File stakes**: check for inexplicable log files and hidden folders created under `/sdcard` and `/Download`.
+ **Property stakes**: check whether `SharedPreferences`, `MMKV`, or a database records fields such as `is_banned`, `first_run_time`.
+ **Server-side stakes**: the device fingerprint (IMEI/Android ID) has been blacklisted. In that case, hook `getDeviceId` to spoof it.



### 4. Recommended Red Team Toolchain
+ **Reconnaissance**: LSPosed (Layout Inspector) —— trace code class names backward from the UI.
+ **Analysis**: Jadx-GUI —— macro-level logic analysis.
+ **Surgery**: MT Manager / Apktool —— Smali bytecode-level modification.
+ **Verification**: Reqable / Frida —— auxiliary verification at the network and dynamic layers.



---

## Conclusion
Technology is not just for cracking things; it is for understanding the world.



Through this analysis of "Movie Hunter", what we see is not merely a loophole for free streaming, but the layered logical defenses the developer built to protect their interests (MMKV, Base64 encryption, file markers). And through reverse

thinking, we can pierce this fog and find the deepest logic of how the system operates.



**Keep Hacking, Stay Curious.**

---

### [Appendix: Smali Modification Cheat Sheet]
_If you keep forgetting Smali syntax, this little card is worth saving:_

+ **Return 0/False/Null**: `const/4 v0, 0x0` -> `return v0` (or `return-object v0`)
+ **Return 1/True**: `const/4 v0, 0x1` -> `return v0`
+ **Do nothing**: `return-void`

---

```python
.method public static final d()I
    .registers 1
    const/4 v0, 0x0
    return v0
.end method

```
