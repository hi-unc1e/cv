---
title: "【转】x86 平台利用 qemu-user-static 实现 arm64 平台 docker 镜像的运行"
slug: ruygk15co23yd7p0
date: 2025-06-08T22:16:54+08:00
source: yuque/penetration
---

## [toc]
> 因为国产化的普及，尤其一些证券和银行行业，已经开始走信创的路线，后期也许会接触到国产 CPU （`arm` 平台，比如华为的鲲鹏处理器）
>
> 自己买 `arm` 平台的 `CPU`，这个成本着实吃不消，于是尝试 `x86` 平台运行 `arm` 平台的容器来降本增效
>

## 关于 docker 版本
> + `docker` 运行其他平台容器，需要使用 `--platform` 参数来指定平台
> + `docker 19.03.9` 及以上的版本才支持 `--platform` 参数
> + 默认没有开启 `--platform` 参数，需要手动开启，直接执行，会有下面的报错
>

```plain
"--platform" is only supported on a Docker daemon with experimental features enabled
```

### 查看是否开启 experimental 功能
> `--platform` 参数需要 `experimental` 为 `true`，通过下面的命令可以验证是否开启
>

```plain
docker info | grep -i 'experimental'
```

### 开启 experimental 功能
> 修改 `daemon.json` 文件，增加下面的参数
>

```plain
"experimental": true
```

> 下面的 `daemon.json` 文件仅供参考
>

```plain
{
  "registry-mirrors": ["https://docker.mirrors.ustc.edu.cn"],
  "exec-opts": ["native.cgroupdriver=systemd"],
  "experimental": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ]
}
```

> 修改完成后，重启 `docker` 来验证
>

```plain
systemctl restart docker
docker info | grep -i 'experimental'
```

## 查看当前环境平台
```plain
uname -m
```

> 我的平台返回下面的内容
>

```plain
x86_64
```

## 拉取一个 arm 平台的容器
```plain
docker pull --platform arm64 debian:11
```

> 查看镜像使用的平台
>

```plain
docker inspect debian:11 | grep -i 'architecture'
```

> 预期返回的结果如下
>

```plain
"Architecture": "arm64",
```

> 如果不加 `--platform` 参数，默认拉取自己当前 CPU 平台的镜像
>
> 如果本地有相同 `tag` 的镜像，只是平台不同的情况下，需要注意区分 `tag` ，不然直接 `docker pull` 就会覆盖掉之前的镜像，之前的镜像 `tag` 会变为 `<none>`
>

## 运行一个 arm 平台的容器
> 在没有 `qemu-user-static` 的帮助下，单靠 `--platform` 参数是无法启动非本机平台的镜像的
>

```plain
docker run --platform arm64 -t debian:11 uname -m
```

> 返回的报错如下，是因为 CPU 平台不同
>

```plain
standard_init_linux.go:211: exec user process caused "exec format error"
```

## 整一个 qemu-user-static
[multiarch/qemu-user-static - github](https://github.com/multiarch/qemu-user-static)

### 注册可支持的架构解释器
> 不指定 CPU 平台，使用 `register` 来注册可支持的架构解析器
>

```plain
docker run --rm \
--privileged \
multiarch/qemu-user-static:register \
--reset
```

> 执行成功后，会返回类似如下的结果来表明支持的架构解析器
>

```plain
Setting /usr/bin/qemu-alpha-static as binfmt interpreter for alpha
Setting /usr/bin/qemu-arm-static as binfmt interpreter for arm
Setting /usr/bin/qemu-armeb-static as binfmt interpreter for armeb
Setting /usr/bin/qemu-sparc-static as binfmt interpreter for sparc
Setting /usr/bin/qemu-sparc32plus-static as binfmt interpreter for sparc32plus
Setting /usr/bin/qemu-sparc64-static as binfmt interpreter for sparc64
Setting /usr/bin/qemu-ppc-static as binfmt interpreter for ppc
Setting /usr/bin/qemu-ppc64-static as binfmt interpreter for ppc64
Setting /usr/bin/qemu-ppc64le-static as binfmt interpreter for ppc64le
Setting /usr/bin/qemu-m68k-static as binfmt interpreter for m68k
Setting /usr/bin/qemu-mips-static as binfmt interpreter for mips
Setting /usr/bin/qemu-mipsel-static as binfmt interpreter for mipsel
Setting /usr/bin/qemu-mipsn32-static as binfmt interpreter for mipsn32
Setting /usr/bin/qemu-mipsn32el-static as binfmt interpreter for mipsn32el
Setting /usr/bin/qemu-mips64-static as binfmt interpreter for mips64
Setting /usr/bin/qemu-mips64el-static as binfmt interpreter for mips64el
Setting /usr/bin/qemu-sh4-static as binfmt interpreter for sh4
Setting /usr/bin/qemu-sh4eb-static as binfmt interpreter for sh4eb
Setting /usr/bin/qemu-s390x-static as binfmt interpreter for s390x
Setting /usr/bin/qemu-aarch64-static as binfmt interpreter for aarch64
Setting /usr/bin/qemu-aarch64_be-static as binfmt interpreter for aarch64_be
Setting /usr/bin/qemu-hppa-static as binfmt interpreter for hppa
Setting /usr/bin/qemu-riscv32-static as binfmt interpreter for riscv32
Setting /usr/bin/qemu-riscv64-static as binfmt interpreter for riscv64
Setting /usr/bin/qemu-xtensa-static as binfmt interpreter for xtensa
Setting /usr/bin/qemu-xtensaeb-static as binfmt interpreter for xtensaeb
Setting /usr/bin/qemu-microblaze-static as binfmt interpreter for microblaze
Setting /usr/bin/qemu-microblazeel-static as binfmt interpreter for microblazeel
Setting /usr/bin/qemu-or1k-static as binfmt interpreter for or1k
Setting /usr/bin/qemu-hexagon-static as binfmt interpreter for hexagon
```

### 尝试启动 arm64 镜像
> 下载 `qemu-aarch64-static`
>

```plain
wget https://github.com/multiarch/qemu-user-static/releases/download/v5.2.0-1/qemu-aarch64-static && \
chmod +x qemu-aarch64-static
```

> 启动容器时将 `qemu-aarch64-static` 带入到容器内
>
> `注意 qemu-aarch64-static 二进制文件的路径，可以自己归纳到指定的路径，只需要带入到容器内的 /usr/bin 目录下就好了`
>

```plain
docker run -t \
--rm \
--platform arm64 \
-v $(pwd)/qemu-aarch64-static:/usr/bin/qemu-aarch64-static \
debian:11 \
uname -m
```

> 正常情况下，返回 `aarch64` 后容器就会被销毁了（`因为加了 --rm 参数`）
>

### 尝试启动 ppc64le 镜像
> 下载 `qemu-ppc64le-static`
>

```plain
wget https://github.com/multiarch/qemu-user-static/releases/download/v5.2.0-1/qemu-ppc64le-static && \
chmod +x qemu-ppc64le-static
```

> 启动 `ppc64le` 平台的镜像
>

```plain
docker run -t \
--rm \
--platform ppc64le \
-v $(pwd)/qemu-ppc64le-static:/usr/bin/qemu-ppc64le-static \
alpine:3.17.2 \
uname -m
```

> 正常情况下，返回 `ppc64le` 后容器就会被销毁了（`因为加了 --rm 参数`）
>

### 后台运行 arm64 容器
> `sleep 315360000` 让容器在后台睡眠 100 年（`因为容器能在后台运行的方法就是要有一个常驻前台的进程`）
>

```plain
docker run -d \
--rm \
--platform arm64 \
-v $(pwd)/qemu-aarch64-static:/usr/bin/qemu-aarch64-static \
--name centos_7.9_arm64 \
centos:7.9.2009 \
sleep 315360000
```

> 进入容器
>

```plain
docker exec -it centos_7.9_arm64 bash
```

> 在容器内执行 yum 命令，可以看到一切都是正常的，并且是 `aarch64` 的
>

```plain
yum install -y vim
```

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1749392205739-01182bf6-d974-460b-b6af-ed9e0b464931.png)

### build 一个 arm64 镜像
> + 准备一个 `Dockerfile`
> + 需要将 `qemu-aarch64-static` 带入到容器内的 `/usr/bin` 目录下才可以实现构建
> + 不然会返回 `standard_init_linux.go:211: exec user process caused "no such file or directory"` 这样的报错
>

```plain
FROM centos:7.9.2009
ADD ./qemu-aarch64-static /usr/bin/qemu-aarch64-static
RUN yum install -y net-tools gcc gcc-c++ make vim && \
    yum clean all
```

> 开始构建
>

```plain
docker build \
--platform arm64 \
-t centos_make:7.9_aarch64 .
```

> 构建完成后会返回两个 `Successfully`
>

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1749392205581-4be7e47c-661b-40a4-a33b-7a366cd53c35.png)

> 构建完成后，可以使用下面的命令验证容器内的平台是否是 `arm64`
>

```plain
docker inspect centos_make:7.9_aarch64 | grep -i 'architecture'
```

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1749392205098-bf34d979-f3f5-45f2-acb7-01636132cf89.png)

> 到这里，`x86` 平台运行和构建其他平台镜像的学习就结束了，下面有一篇关于多架构支持的文章，有兴趣的可以看一看（我是真的看麻了，太难了吧，果然还是开发改变世界）
>

---

## 参考文档
[容器镜像多架构支持介绍](https://www.cnblogs.com/frankming/p/16870285.html)



> 来自: [x86 平台利用 qemu-user-static 实现 arm64 平台 docker 镜像的运行和构建 - 月巴左耳东 - 博客园](https://www.cnblogs.com/chen2ha/p/17180287.html)
>





