---
title: "手把手教你用Docker搭建CTF靶场环境"
slug: ie51z4
date: 2020-11-07T23:47:08+08:00
source: yuque/penetration
---

# <font style="color:#000000;">安装Docker</font>
<font style="color:#000000;">略，参考CentOS Docker 安装来操作即可</font>

```bash
curl -sSL https://get.daocloud.io/docker | sh
```

<font style="color:#000000;">卸载旧版本</font>

```bash
sudo yum remove docker \
                 docker-client \
                 docker-client-latest \
                 docker-common \
                 docker-latest \
                 docker-latest-logrotate \
                 docker-logrotate \
                 docker-engine
```

<font style="color:#000000;">注意：需要开启</font>`<font style="color:#000000;">iptables</font>`

```shell
service iptables restart
```

<font style="color:#000000;">重启docker</font>

```bash
service docker restart
```

# <font style="color:#000000;">编写Dockerfile</font>
## <font style="color:#000000;">寻找初始环境</font>
<font style="color:#000000;">Dockerfile</font><font style="color:#000000;">里的第一行，就是你CTF题的初始环境。如下所示，</font>

```bash
FROM drupalci/php-5.5.38-apache:dev
```

<font style="color:#000000;">代表的就是从</font>[<font style="color:#000000;">hub.docker.com/r/drupalci/php-5.5.38-apache</font>](https://hub.docker.com/r/drupalci/php-5.5.38-apache)<font style="color:#000000;">拉的镜像作为初始环境。</font>

<font style="color:#000000;">那这个初始环境到哪里去找呢？</font>

<font style="color:#000000;">只需要在</font>[<font style="color:#000000;">https://hub.docker.com</font>](https://hub.docker.com)<font style="color:#000000;">里搜索合适的版本即可。此处要注意必须写出</font>`<font style="color:#000000;">tag</font>`<font style="color:#000000;">，也就是上面冒号后面的</font>`<font style="color:#000000;">dev</font>`<font style="color:#000000;">，它指明了镜像里中间件的版本，常见的</font>`<font style="color:#000000;">tag</font>`<font style="color:#000000;">是</font>`<font style="color:#000000;">latest</font>`<font style="color:#000000;">。</font>

## <font style="color:#000000;">调整环境参数</font>
<font style="color:#000000;">有时候，在不同的环境下，我们需要更改中间件的配置，如Apache的配置文件</font>`<font style="color:#000000;">apache2.conf</font>`<font style="color:#000000;">、PHP的配置文件</font>`<font style="color:#000000;">php.ini</font>`<font style="color:#000000;">，那么就需要在</font><font style="color:#000000;">Dockerfile</font><font style="color:#000000;">里进行相应的编写。</font>

<font style="color:#000000;">下面给出常用的命令写法，更多细节请移步=></font>[<font style="color:#000000;">如何用Dockerfile构建镜像</font>](https://segmentfault.com/a/1190000018210280)

<font style="color:#000000;">Dockerfile样例</font>

```dockerfile
# 第一行写跟第1点中一样的基本镜像
FROM drupalci/php-5.5.38-apache:dev

# 这里可以写上你的姓名/昵称
MAINTAINER unc1e

# 这里可以写上你的制作时间
ENV REFRESHED_AT 2020年8月1日

# 使用utf-8编码
ENV LANG C.UTF-8

# 先写 修改源/更新 【如果必须的话】
# 替换源（这里可用sed或者直接COPY一个完整的sources.list来替换）
RUN sed -i 's/http:\/\/archive.ubuntu.com\/ubuntu\//http:\/\/mirrors.163.com\/ubuntu\//g' /etc/apt/sources.list

# 进行更新
RUN apt-get update -y

# 将环境变量设置为非交互的 【这个看个人】，在运行apt-get命令的时候格外有用，因为它会不停提示用户进行到了哪步并且需要不断确认
# 非交互模式会选择默认的选项并以最快的速度完成构建。
# 注意：ENV命令在整个容器运行过程中都会生效，在你通过BASH和容器进行交互时，可能因此出问题
ENV DEBIAN_FRONTEND noninteractive

# 修改一些配置
# 对于文件中的替换字符串，多使用sed命令
# 例如：去掉php响应头里的X-Powered-By
RUN sed -i 's/expose_php = On/expose_php = Off/' /usr/local/etc/php/php.ini

# 然后才是复制文件
# 不推荐挂载卷，因为常常需要将镜像导出为tar包文件
# ADD会自动解压压缩包，而COPY不会
ADD html.tgz /var/www

# 剩下一些操作（权限要控制好）
# 例如修改某个文件的所有者
RUN chown root:root /var/www/html/x.php

# WORKDIR:设置CMD指明的命令的运行目录。
WORKDIR /var/www/html/

# 最后处理flag以及开机启动项
# flag的规范格式为flag{uuid格式} （如：flag{8ba868f2-71b6-477b-bc7a-255302c881e1}
# 如有特殊情况请说明，但flag的格式至少需要有flag{}，不接受其他类型格式。
# 默认flag的值存在flag.txt，
# 如果flag是在数据库里，请记得把flag所在的字段长度设置为大于42
# 把flag.txt复制到/root/flag.txt
COPY flag.txt /root/flag.txt

# start.sh为开机启动脚本，里面包含容器开启后要启动的命令
COPY start.sh /root/start.sh

# 加上执行权限
RUN chmod +x /root/start.sh

# ENTRYPOINT：配置容器启动时的执行命令（不会被忽略，一定会被执行）
# 建议使用ENTRYPOINT而不使用CMD，因为CMD容易受最后的RUN命令影响
ENTRYPOINT cd /root; ./start.sh

# WEB开放端口默认为80，一般为一个，若有特殊情况，请写明
# 有文章指出：EXPOSE 指令是声明运行时容器提供服务端口，这只是一个声明，在运行时并不会因为这个声明应用就会开启这个端口的服务。文章来源是https://www.jianshu.com/p/78f4591b7ff0
EXPOSE 80
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604764730468-fdd0f5fe-1a8e-414f-930e-50f4f426bea1.png)

> <font style="color:#000000;">图片来自周旭龙的文章：</font>[<font style="color:#000000;">你必须知道的Dockerfile</font>](https://www.cnblogs.com/edisonchou/p/dockerfile_inside_introduction.html)
>

<font style="color:#000000;">为什么需要start.sh呢？这就需要提醒了：Dockerfile只定义了软件开机后需要执行的命令/操作，里面的操作是有限的</font>

<font style="color:#000000;">start.sh样例</font>

```dockerfile
#!/bin/bash
# 第一行默认用bash
# 至少sleep 1，但也不要太久
sleep 1

# 启动服务，例如apache2
# 具体的启动命令，视系统环境而定
# 一般的apache2
/etc/init.d/apache2 start
# 一般的nginx
# 为了适应大多数环境，修改下nginx配置
sed -i 's/listen 80 default_server;/listen 80;/' /etc/nginx/sites-enabled/default
sed -i 's/listen \[::\]:80.*;/#\0/' /etc/nginx/sites-enabled/default
nginx -c /etc/nginx/nginx.conf
/etc/init.d/nginx start
# 为了适应各种docker版本，mysql的启动命令建议如下（mysqld除外）
find /var/lib/mysql -type f -exec touch {} \; && service mysql start

# ctf.sql为数据库的sql文件，在mysql启动后才导入。
# 如果flag不是存在数据库里，那么这里写上存在flag的文件（如flag.php）
# 存在flag的文件里的flag值请用flag{xxxxxx}表示（这里这样的设置是为了动态替换）
flagfile=/var/www/html/ctf.sql
if [ -f $flagfile ]; then
#   这里就是替换flag值为/root/flag.txt里的值（/root/flag.txt为动态flag自动下发的位置）
#   这里的flag{x*}对应了flag{xxxxxx}，因为sed不支持扩展正则语法
#   如果原来文件里的flag值并不是flag{xxxxxx}，那么下面这一句请自己改写
    sed -i "s/flag{x*}/$(cat /root/flag.txt)/" $flagfile
#   修改mysql的root密码（如果有使用mysql且必须修改的话）
    mysqladmin -u root password "newpasswd"
#   mysql导入sql文件（newwpasswd只是示例密码）
    mysql -uroot -pnewpasswd < $flagfile
#   删除sql文件(一般是要删除的) / 如果不是sql文件这里不需要删除
    rm -f $flagfile
fi
/bin/bash
```

## <font style="color:#000000;">配置启动命令</font>
<font style="color:#000000;">有时，由于各种特殊的需要：如实现动态flag，需要在docker外部指定</font>`<font style="color:#000000;">flag</font>`<font style="color:#000000;">，因此就需要了解</font>`<font style="color:#000000;">docker-compose.yml</font>`<font style="color:#000000;">的写法。</font>

<font style="color:#000000;">要实现动态flag，</font>`<font style="color:#000000;">docker-compose.yml</font>`<font style="color:#000000;">必须和</font>`<font style="color:#000000;">Dockerfile</font>`<font style="color:#000000;">相互配合。此处我以赵师傅做的</font>[<font style="color:#000000;">bytectf_2019_babyblog</font>](https://github.com/glzjin/bytectf_2019_babyblog)<font style="color:#000000;">的镜像来做说明。</font>

### <font style="color:#000000;">docker-compose.yml</font>
> docker-compose.yml是 模板文件，其中定义的每个服务都必须通过 image 指令指定镜像或 build 指令（需要 Dockerfile）来自动构建。
>

下面是一个简单的例子——只有1个容器。

```yaml
version: "2"# 表示该 Docker-Compose 文件使用的是 Version 2 file

services:

  web:
    build: .
    image: ctftraining/bytectf_2019_babyblog
    restart: always
    ports:
      - "127.0.0.1:8302:80"
    environment:
      - FLAG=flag{glzjin_wants_a_girl_firend}
```

### <font style="color:#000000;">Dockerfile</font>
```dockerfile
FROM orsolin/docker-php-5.3-apache

LABEL Author="glzjin <i@zhaoj.in>" Blog="https://www.zhaoj.in"

COPY ./files /tmp/files

RUN mv -f /tmp/files/sources.list /etc/apt/sources.list \
    && rm -rf /var/www/html/* \
    && mv -f /tmp/files/init.sql /tmp/db.sql \
    && mv -f /tmp/files/html/* /var/www/html/ \
    && apt update \
    && echo "debconf mysql-server/root_password password root\ndebconf mysql-server/root_password_again password root" >> /tmp/mysql-passwd \
    && debconf-set-selections /tmp/mysql-passwd && apt install mysql-server -y && rm -rf /tmp/mysql-passwd \
    && mysql_install_db --user=mysql --datadir=/var/lib/mysql \
    && sh -c 'mysqld_safe &' \
    && sleep 5s \
    && mysql -e "source /tmp/db.sql;" -uroot -proot \
    && echo "magic_quotes_gpc = Off\nopen_basedir = /var/www/html/:/tmp/:/proc/\ndisable_functions = pcntl_alarm,pcntl_fork,pcntl_waitpid,pcntl_wait,pcntl_wifexited,pcntl_wifstopped,pcntl_wifsignaled,ini_set,pcntl_wifcontinued,pcntl_wexitstatus,pcntl_wtermsig,pcntl_wstopsig,pcntl_signal,pcntl_signal_get_handler,pcntl_signal_dispatch,pcntl_get_last_error,pcntl_strerror,pcntl_sigprocmask,pcntl_sigwaitinfo,pcntl_sigtimedwait,pcntl_exec,pcntl_getpriority,pcntl_setpriority,pcntl_async_signals,system,exec,shell_exec,popen,proc_open,passthru,symlink,link,syslog,imap_open,dl,mail	" >> /etc/php5/apache2/php.ini && \
    touch /flag && \
    mv /tmp/files/readflag /readflag && \
    chmod 555 /readflag && \
    chmod u+s /readflag && \
    chmod 500 /flag

WORKDIR /var/www/html/

CMD echo $FLAG >> /flag && export FLAG=not_flag && FLAG=not_flag && find /var/lib/mysql -type f -exec touch {} \; && service mysql start && apache2-foreground
```

<font style="color:#000000;">关于如何实现动态</font>`<font style="color:#000000;">flag</font>`<font style="color:#000000;">：相信你已经看出来了——两个文件都只需要看最后一行。首先在</font>`<font style="color:#000000;">docker-compose.yml</font>`<font style="color:#000000;"> 里设定一个环境变量(</font>`<font style="color:#000000;">environment</font>`<font style="color:#000000;">)，变量名叫做</font>`<font style="color:#000000;">FLAG</font>`<font style="color:#000000;">，就是我们的动态flag值；而下一步</font>`<font style="color:#000000;">Dockerfile</font>`<font style="color:#000000;">中的命令</font>`<font style="color:#000000;">CMD echo $FLAG >> /flag</font>`<font style="color:#000000;">，将这个FLAG写入了</font>`<font style="color:#000000;">/flag</font>`<font style="color:#000000;">文件。</font>

<font style="color:#000000;">对于运维者来说，要在某个CTF题中实现动态flag的效果，只需要对</font>`<font style="color:#000000;">docker-compose.yml</font>`<font style="color:#000000;">进行调整，再运行</font>`<font style="color:#000000;">docker-compose up -d</font>`<font style="color:#000000;">即可，完全不需要改动</font>`<font style="color:#000000;">Dockerfile</font>`<font style="color:#000000;">. 这在某些场景（CTF靶场、AWD）中是很有用的。</font>

<font style="color:#000000;">不过，如果你还是不明白</font>`<font style="color:#000000;">docker-compose</font>`<font style="color:#000000;">和</font>`<font style="color:#000000;">docker之间</font>`<font style="color:#000000;">的关系，那么请你移步=></font>[<font style="color:#000000;">Docker 微服务教程 - 阮一峰的网络日志</font>](https://ruanyifeng.com/blog/2018/02/docker-wordpress-tutorial.html)<font style="color:#000000;">，我将其总结概括如下：</font>

> [<font style="color:#000000;">Compose</font>](https://docs.docker.com/compose/)<font style="color:#000000;"> 是 Docker 公司推出的一个工具软件，可以管理多个 Docker 容器组成一个应用。你需要定义一个 </font>[<font style="color:#000000;">YAML</font>](https://www.ruanyifeng.com/blog/2016/07/yaml.html)<font style="color:#000000;"> 格式的配置文件</font>`<font style="color:#000000;">docker-compose.yml</font>`<font style="color:#000000;">，写好多个容器之间的调用关系。然后，只要一个命令，就能同时启动/关闭这些容器。</font>
>

<font style="color:#000000;background-color:transparent;">常见的</font><font style="color:#000000;background-color:transparent;">docker-</font>[<font style="color:#000000;">compose</font>](https://docs.docker.com/compose/)<font style="color:#000000;background-color:transparent;">运维命令如下</font>

```bash
# docker-compose 运维命令

# 启动当前目录下docker-compose.yml中的所有服务
$ docker-compose up

# 启动当前目录下docker-compose.yml中的所有服务并【后台运行】
$ docker-compose up -d

# 关闭所有服务
$ docker-compose stop
```

# 测试Docker镜像
打包镜像创建完上面的Dockerfile后，在当前目录执行以下命令进行镜像的构建

```basic
# 构建镜像
docker build -t web_ctf_puzzle:test1 .
```

稍等片刻，运行`docker images`指令，就能看到名为`web_ctf_puzzle`，TAG为`test1`的镜像了。

需要提醒的是：有些机构收题时要求制作者提供可用的docker镜像压缩包（tar包），可能的原因呢，一方面是考虑到安装后的东西不一定跟制作者制作时的东西一模一样，另一方面可能是由于安装时断外网。不过，制作docker镜像压缩包并不复杂，只需要按以下命令来操作即可

```basic
# 导出tar包
docker save web_xxx_name  > web_xxx_name.tar
```

## Docker之间的互通
很多时候，需要不同的docker之间能够相互访问（互通），这就需要进行相应的配置。下面介绍两种个人常用的互通方案



### 法一、docker run --links
在单独的docker运行命令中，加入`--links`选项

> `docker run --link`可以用来链接2个容器，使得 发起链接的容器 和 接收链接的容器 之间可以互相通信。当然`--link`还有其它作用，我们按下不表。
>

例如，我先用下面命令起了一个`redis`的容器：

```bash
$ docker run -p 6379:6379  --name="redis"  -d docker.io/redis:3-alpine
```

接着，我又看向手上一个PHP的容器，想让它跟`redis`互通，只需要运行如下的命令即可

```bash
$ docker container run -p 80:80  --name="web" --link redis:aliasredis  -d  uploadtest
	-p 端口	
	-name 【容器】的名字		
  --link 连接名为redis的容器，并为其设置了别名aliasredis
  -d 后台运行
  uploadtest 【镜像】的名字	
  
```

<font style="color:#24292E;">这样，就实现了：在容器</font>`<font style="color:#24292E;">web</font>`<font style="color:#24292E;">中，通过别名</font>`aliasredis`来访问容器`redis`<font style="color:#24292E;">。它的原理也</font><font style="color:#24292E;">很容易理解</font><font style="color:#24292E;">：</font><font style="color:#24292E;">通过给</font>`/etc/hosts`<font style="color:#24292E;">中加入名称和IP的解析关系来实现。如果你打开</font><font style="color:#24292E;">容器</font>`<font style="color:#24292E;">web</font>`<font style="color:#24292E;">的</font>`/etc/hosts`，就能看到了类似下面的内容

```bash
172.17.0.2 redis
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604815230909-b2422259-2bf8-4525-ac8d-50ee9f0227ed.png)

最后，需要说明的是

> docker官方已不推荐使用docker run --link来链接2个容器互相通信，随后的版本中会删除--link，但了解其原理，对如何使2个容器之间互相通信还是有帮助的。
>



### 法二、docker-compose.yml
在`docker-compose.yml`文件中，指定link选项，即可完成容器的互连，例如下面代码中的16~17行



```dockerfile
version: "2"
services:
  web:
    container_name: web
    image: php/5.6-fpm-alpine
    restart: always
    build:
      dockerfile: Dockerfile
    ports:
      - "80:80"
    environment:
      - FLAG=flag{Upload_Really_Good}

  redis:
    container_name: redis
    links:
     - web
    image: redis/redis:3-alpine
    restart: always
    ports:
    	- "6379:6379"
```

> `docker-compose.yml` 容器互通示例（有删减），完整题目地址[github.com/hi-unc1e/some_scripts/tree/master/puzzles/uploadTest](https://github.com/hi-unc1e/some_scripts/tree/master/puzzles/uploadTest)
>

## 运行测试
下面就开始运行docker

<font style="color:#555555;">启动镜像的命令</font>

```bash
$ docker run -p 8088:80 --name="web_ctf_puzzle_docler" -d web_ctf_puzzle
# 其中可能用到的选项，意义如下：
  # -d: 后台运行容器，并返回容器ID；
  # -P: 随机端口映射
  # -h: 指定容器的hostname
  # --name: 指定容器的名字
  # -p: 指定端口映射, 格式为：外部宿主端口:内部容器端口 
  # -v: 绑定一个卷(--volume)，例如 -v /opt/ctf/src:/var/www/html/ 表示将主机的目录 /opt/ctf/src 映射到容器的 /var/www/html/
```

要想成功构建docker，常需要一次次的测试与修改，这里是一些操作的提示

<font style="color:#000000;">要想控制docker（也就是进</font><font style="color:#555555;">入docker的shell），需要将下面命令中</font>`019dfb3e357b`<font style="color:#555555;">改为你运行</font>`docker ps`<font style="color:#555555;">后 </font>`CONTAINER ID。`相信你一定明白我在说什么 ；）

```bash
# 进入docker的bash shell，如果bash起不来可以尝试sh
docker exec  -it  019dfb3e357b  bash
```



# references
+ 如何用Dockerfile构建镜像[https://segmentfault.com/a/1190000018210280](https://segmentfault.com/a/1190000018210280)
+ CTF丨从零开始搭建WEB Docker靶场[https://zhuanlan.zhihu.com/p/60472331](https://zhuanlan.zhihu.com/p/60472331)
+ ByteCTF 2019 BabyBlog[https://github.com/glzjin/bytectf_2019_babyblog/](https://github.com/glzjin/bytectf_2019_babyblog/)
+ Docker 微服务教程[https://ruanyifeng.com/blog/2018/02/docker-wordpress-tutorial.html](https://ruanyifeng.com/blog/2018/02/docker-wordpress-tutorial.html)
+ YAML 入门教程[https://www.runoob.com/w3cnote/yaml-intro.html](https://www.runoob.com/w3cnote/yaml-intro.html)

