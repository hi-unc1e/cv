---
title: "Android Reverse Engineering: LSPatch, the Root-Free Patch Mode"
slug: wph994ticpllgk8x
translationKey: wph994ticpllgk8x
date: 2026-01-14T20:31:56+08:00
source: yuque/penetration
---

::::success
How do you bundle your Hook module together with the App?

The idea is: use LSPatch to embed the LSPosed framework into the APK, so there is no need to modify the App's business code — instead,

::::

### Embedded Hooks (LSPatch / XPatch) —— the most elegant route
+ [https://windysha.github.io/2019/04/18/Xpatch-%E5%85%8DRoot%E5%AE%9E%E7%8E%B0App%E5%8A%A0%E8%BD%BDXposed%E6%8F%92%E4%BB%B6%E7%9A%84%E4%B8%80%E7%A7%8D%E6%96%B9%E6%A1%88/](https://windysha.github.io/2019/04/18/Xpatch-%E5%85%8DRoot%E5%AE%9E%E7%8E%B0App%E5%8A%A0%E8%BD%BDXposed%E6%8F%92%E4%BB%B6%E7%9A%84%E4%B8%80%E7%A7%8D%E6%96%B9%E6%A1%88/)
+ [https://github.com/WindySha/Xpatch?tab=readme-ov-file](https://github.com/WindySha/Xpatch?tab=readme-ov-file)





This route best fits your current situation. If you like writing Hooks (Java/Kotlin) but dislike editing Smali (assembly), then this route is a great fit. The idea

#### Tools
+ **LSPatch** (LSPosed's root-free patch mode)

#### Workflow
1. **Write the module**
    - Write your Hook code, e.g. `HookEntry.kt`.
    - Compile it into an Xposed module APK.
2. **Embed the module**
    - Use the LSPatch tool (desktop or mobile version).
    - Feed in the original "Movie Hunter" APK and your "ad-removal module" APK.
    - Run the command:
3. **How it works**
    - LSPatch inserts a line into the target APK's `AndroidManifest.xml`: `<application android:name="org.lsposed.lspatch.StubApplication" ...>`.
    - When the App starts, LSPatch's micro framework launches first, the framework loads your module, and then your module Hooks the App.

#### Advantages
+ **No need to look at Smali**: you only need to maintain your Kotlin code.
+ **Runs without Root**: the victim's phone doesn't need Root, nor does it need LSPosed installed — installing this APK brings the Hook capability built in.

#### Big Pitfall: Fighting Signature Verification
After you re-sign it, the APK's fingerprint (SHA-1) changes. Many Apps have a self-verification mechanism:

```java
// Code inside the App
if (getSignature() != "Hash of the original official signature") {
    System.exit(0); // crash on launch
}
```

##### Red Team Countermeasures (PMS Killer)
+ **Core idea**: fool the App into believing it still has its original signature.
+ **Techniques**:
    - **Hook PackageManager**: in your Hook module, Hook the `getPackageInfo` method. When the App queries its own signature, return the signature information extracted from the official genuine APK.
    - **Hard-patch the Smali**: search the Smali for `Landroid/content/pm/PackageInfo;->signatures:[Landroid/content/pm/Signature;`, locate the comparison logic, invert the branch instruction (if-eq), or simply make the verification function return true.
    - **One-click removal with MT Manager**: many tools ship with a "remove signature verification" feature, which is essentially an automated version of the Smali modification above.

#### Summary
For your current need (modifying C0963k and making it permanent):

+ **Fastest path**: on the phone, use MT Manager -> view the Dex -> modify the Smali -> save -> auto-sign -> install -> and remember to delete that leftover corpse file.
+ **Most reliable path (red team release)**: on a PC, decompile with Apktool -> modify the Smali -> inject a "kill signature verification" Smali snippet -> rebuild -> sign -> release.
+ **Smoothest path (developer experience)**: use LSPatch to merge your APK with your Hook module, letting the Hook code run parasitically inside the APK.  
With this approach, you can fulfill your need efficiently and elegantly.
