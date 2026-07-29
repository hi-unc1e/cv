---
title: "Android 逆向实战：从“电影猎手”破解看 App 状态机的攻防博弈"
slug: vilq1lv0flels5p5
date: 2026-01-14T20:13:43+08:00
source: yuque/penetration
---

LXPOSED 模块：[cc-aligned-debugSigned-xxxxQluvnDtXmttQ-.zip](https://www.yuque.com/attachments/yuque/0/2026/zip/166008/1768392988049-c4b76ec8-dc21-49f7-b06e-bcad8c3225fe.zip)

原软件文件：[DYLS-xxxxX9y9lvWKr5dr-.zip](https://www.yuque.com/attachments/yuque/0/2026/zip/166008/1768393056530-b3417f5e-1491-4c76-b291-d3eaf9f4a9e5.zip)



修改版的无广告文件： [dyls-3.1.2.0-noAd.zip](https://www.yuque.com/attachments/yuque/0/2026/zip/166008/1768393015639-040c33df-72e6-4a3c-a5c3-71114470f31f.zip)







**标签：** Android逆向, Smali, 状态机, 逻辑漏洞

## 前言：当 Hook 遭遇“尸体文件”


在红队安全测试中，我们习惯了用 Frida 或 Xposed 进行 Hook，像外科医生一样精准修改内存。但最近在分析一款名为“电影猎手”的 App 时，我遇到了一次有趣的对抗。这次经历让我重新思考：**最顶级的破解，往往不是对抗代码逻辑，而是重塑数据源头。**

****

本文将以该 App 的去广告与 VIP 破解为例，复盘一次从 Hook 到 Smali 硬改，再到对抗本地持久化标记（Tombstone File）的全过程，并总结一套通用的 Android 逆向“降维打击”方法论。

---

## Part 1. 案例复盘：一场“免费试用”的猫鼠游戏
### 1. 侦察阶段：寻找阿喀琉斯之踵
目标 App 有一个典型的商业逻辑：**“免费试用 7 次，之后强制弹窗要求输入激活码（卡密）”**。



通过 LSPosed 的 Layout Inspector 和 Jadx 的静态分析，我定位到了核心控制类 `p092v0.C0963k`（混淆后）。核心逻辑如下：

```java
// 伪代码还原
public static int getStartCount() {
    // 读取 MMKV 里的启动次数
    return MMKV.decodeInt("startCount");
}

public static void hookLogic() {
    int count = getStartCount();
    if (count >= 7) {
        if (hasValidKami()) {
            // 验证通过
        } else {
            // 试用结束，功能禁用
            disableFeatures();
        }
    } else {
        // 试用期，计数 + 1
        increaseCount();
    }
}

```

### 2. 第一次进攻：Hook 的局限
最初，我尝试写一个 LSPosed 模块去 Hook `getStartCount`，强行让它返回 `0`。  
逻辑上这没问题：永远是第 0 次启动，永远在试用期。

然而，实测发现：**修改不生效**。即使我把返回值改了，App 依然提示“试用已结束”。





### 3. 深入分析：隐蔽的“尸体文件” (Tombstone File)
重新审查 Smali 代码，不难发现了一个极易被忽略的逻辑分支。开发者在检测到试用结束时，不仅在 MMKV 里记录，还在 SD 卡留下了一个文件：

```java
# 逻辑还原：检查 Download 目录下是否存在 WeiXin/dyls.log
new File(Environment.getExternalStoragePublicDirectory(...), "WeiXin/dyls.log").exists()

```

这是一个“**尸体文件**”。只要这个文件存在，哪怕你把内存里的计数器改为 0，App 依然判定你为“过期用户”。

这就像僵尸一样，肉体死了（计数器清零），但墓碑（文件）还在，依然判定死亡。





### 4. 终极绝杀：Smali 手术刀 + 毁尸灭迹
找到了症结，解决方案就变成了“降维打击”：

1. **物理清除**：直接删除 `/storage/emulated/0/Download/WeiXin/dyls.log`，清除持久化标记。
2. **Smali 硬改**：不再依赖 Hook 框架，直接修改 APK 的 DEX 文件。

修改 `C0963k.smali` 中的 `d()` 方法（即获取计数的方法）：

```plain
.method public static final d()I
    .registers 1
    const/4 v0, 0x0  # 强制赋值为 0
    return v0        # 直接返回
.end method

```

**战果：** 重新打包安装后，App 永远认为我是第一次打开，所有 VIP 功能全开，广告全免。





---

## Part 2. 通用方法论：App 状态机的上帝视角
跳出这个 Case，我们如何将这次经验转化为红队的通用能力？我认为核心在于**“状态机控制”**



### 1. 认知模型：App = f(State)
App 的本质是一个状态机。界面（UI）和功能（Function）只是数据（State）的投影。

+ **初级逆向**：修改 `f()`。例如 Hook `checkPassword()`，强制返回 True。这容易被混淆和加固对抗。
+ **高级逆向**：修改 `State`。例如修改 `UserBean`，让数据源头就显示你是 VIP。



### 2. “源头打击”战术三板斧
在修改 Smali 时，不要去纠结复杂的 `if-else` 跳转逻辑，直接去改数据获取的**源头方法 (Getter)**。

| 目标类型 | 典型方法名特征 | 修改策略 (Smali) | 对应场景 |
| --- | --- | --- | --- |
| **布尔值 (Boolean)** | `isVip`, `isAd`, `hasRoot` | `const/4 v0, 0x0` (False)    |  |


  
`const/4 v0, 0x1` (True)  


  
`return v0` | 去广告、过Root检测、开VIP |  
| **数值 (Integer)** | `getVipLevel`, `getTrialCount` | `const/4 v0, 0x0`  


  
`return v0` | 无限试用、跳过倒计时 |

| **空值 (Void)** | `initAdSdk`, `showDialog` | `return-void` | 阻断广告初始化、禁止弹窗 |





### 3. 对抗持久化：寻找“暗桩”
当内存修改（Hook/Smali）失效时，必须检查 App 的**持久化状态检查**。

+ **文件暗桩**：检查 `/sdcard`、`/Download` 下生成的莫名其妙的日志文件、隐藏文件夹。
+ **属性暗桩**：检查 `SharedPreferences`、`MMKV` 或数据库中是否记录了 `is_banned`、`first_run_time` 等字段。
+ **服务端暗桩**：设备指纹（IMEI/Android ID）被拉黑。此时需要 Hook `getDeviceId` 进行伪造。



### 4. 红队工具链推荐
+ **侦察**：LSPosed (Layout Inspector) —— 从 UI 倒推代码类名。
+ **分析**：Jadx-GUI —— 宏观逻辑分析。
+ **手术**：MT管理器 / Apktool —— Smali 字节码级修改。
+ **验证**：Reqable / Frida —— 网络层与动态层的辅助验证。



---

## 结语
技术不仅仅是用来破解的，更是用来理解世界的。



通过这次对“电影猎手”的分析，我们看到的不仅是一个免费看剧的漏洞，更看到了开发者为了保护权益所设下的层层逻辑防线（MMKV、Base64加密、文件标记）。而我们完全可以通过逆

向思维，穿透这些迷雾，找到系统运行的最底层逻辑。



**Keep Hacking, Stay Curious.**

---

### [附录：Smali 修改速查表]
_如果你经常忘记 Smali 语法，这张小卡片值得保存：_

+ **返回 0/False/Null**: `const/4 v0, 0x0` -> `return v0` (或 `return-object v0`)
+ **返回 1/True**: `const/4 v0, 0x1` -> `return v0`
+ **什么都不做**: `return-void`

---

```python
.method public static final d()I
    .registers 1
    const/4 v0, 0x0
    return v0
.end method

```

