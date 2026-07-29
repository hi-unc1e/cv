---
title: "Android 逆向：LSPatch ，免 Root 补丁模式"
slug: wph994ticpllgk8x
date: 2026-01-14T20:31:56+08:00
source: yuque/penetration
---

:::success
如何是将你的 Hook 模块和 App 打包在一起？

思路是：用 LSPatch 将 LSPosed 框架嵌入到 APK 中，这样就不需要修改 App 的业务代码，而是

:::

### 嵌入式 Hook (LSPatch / XPatch) —— 最优雅的路线
+ [https://windysha.github.io/2019/04/18/Xpatch-%E5%85%8DRoot%E5%AE%9E%E7%8E%B0App%E5%8A%A0%E8%BD%BDXposed%E6%8F%92%E4%BB%B6%E7%9A%84%E4%B8%80%E7%A7%8D%E6%96%B9%E6%A1%88/](https://windysha.github.io/2019/04/18/Xpatch-%E5%85%8DRoot%E5%AE%9E%E7%8E%B0App%E5%8A%A0%E8%BD%BDXposed%E6%8F%92%E4%BB%B6%E7%9A%84%E4%B8%80%E7%A7%8D%E6%96%B9%E6%A1%88/)
+ [https://github.com/WindySha/Xpatch?tab=readme-ov-file](https://github.com/WindySha/Xpatch?tab=readme-ov-file)





这个路线最适合你现在的状态。如果你喜欢写 Hook (Java/Kotlin)，但不喜欢改 Smali (汇编)，那么这条路线非常适合你。思路

#### 工具
+ **LSPatch** (LSPosed 的免 Root 补丁模式)

#### 操作流程
1. **编写模块**
    - 编写你的 Hook 代码，例如 `HookEntry.kt`。
    - 将其编译成一个 Xposed 模块 APK。
2. **嵌入模块**
    - 使用 LSPatch 工具（电脑版或手机版）。
    - 输入原始“电影猎手” APK 和你的“去广告模块” APK。
    - 运行命令：
3. **原理**
    - LSPatch 会在目标 APK 的 `AndroidManifest.xml` 里插入一行 `<application android:name="org.lsposed.lspatch.StubApplication" ...>`。
    - 当 App 启动时，先启动 LSPatch 的微型框架，框架加载你的模块，然后你的模块 Hook App。

#### 优点
+ **不用看 Smali**：你只需要维护你的 Kotlin 代码。
+ **无 Root 运行**：受害者手机不需要 Root，也不需要安装 LSPosed，装上这个 APK 自带 Hook 功能。

#### 大坑：对抗签名校验 (Signature Verification)
当你重新签名后，APK 的指纹（SHA-1）会改变。很多 App 会有自校验机制：

```java
// App 内部代码
if (getSignature() != "官方原始签名的Hash") {
    System.exit(0); // 闪退
}
```

##### 红队应对策略 (PMS Killer)
+ **核心思想**：欺骗 App，让它以为自己还是原来的签名。
+ **手段**：
    - **Hook PackageManager**：在你的 Hook 模块里，Hook `getPackageInfo` 方法。当 App 查询自己的签名时，返回由官方正版 APK 提取出来的签名信息。
    - **Smali 硬改**：搜索 Smali 里的 `Landroid/content/pm/PackageInfo;->signatures:[Landroid/content/pm/Signature;`，找到比较逻辑，把跳转指令（if-eq）反转，或者直接让校验函数返回 true。
    - **MT 管理器一键去除**：许多工具自带“去除签名校验”功能，原理就是自动化执行上述的 Smali 修改。

#### 总结
对于你现在的需求（修改 C0963k 并让它永久生效）：

+ **最快路径**：手机上用 MT 管理器 -> 查看 Dex -> 修改 Smali -> 保存 -> 自动签名 -> 安装 -> 记得删掉那个尸体文件。
+ **最稳路径 (红队发布)**：PC 上用 Apktool 反编译 -> 修改 Smali -> 注入一段“Kill 签名校验”的 Smali -> 回编译 -> 签名 -> 发布。
+ **最爽路径 (开发体验)**：使用 LSPatch，将你的 APK 和你的 Hook 模块合并，让 Hook 代码寄生在 APK 里运行。  
通过这种方式，你可以高效且优雅地实现你的需求。

