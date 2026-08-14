---
title: "Stable Packet Capture: Intercepting Traffic from Various Devices via a Transparent Proxy (mitmproxy Usage)"
slug: lsqvp3qo4b2z8ro6
translationKey: lsqvp3qo4b2z8ro6
date: 2023-11-24T23:20:13+08:00
source: yuque/penetration
tags:
  - Red Team
---

Tutorial reference

+ [https://blog.csdn.net/zhuxian1277/article/details/111875951](https://blog.csdn.net/zhuxian1277/article/details/111875951)



# Use Case
**<font style="color:rgb(44, 44, 54);">mitmproxy</font>**<font style="color:rgb(44, 44, 54);"> is a powerful man-in-the-middle proxy tool that lets you intercept, view, and modify traffic between clients and servers. Its transparent proxy mode makes mitmproxy extremely useful in specific scenarios, especially when network traffic needs to be analyzed or tested without changing any settings on the target device.</font>

+ **<font style="color:rgb(44, 44, 54);">No proxy configuration needed</font>**<font style="color:rgb(44, 44, 54);">: Unlike Burp Suite, mitmproxy in transparent mode does not require manually setting an HTTP or HTTPS proxy on the target machine. This means the end user or test subject will not notice the proxy's presence, reducing the chance of human intervention.</font>
+ **<font style="color:rgb(44, 44, 54);">Certificate installation</font>**<font style="color:rgb(44, 44, 54);">: Although no proxy configuration is required in transparent mode, to intercept and decrypt HTTPS traffic you still need to install mitmproxy's root certificate on the target machine. This is similar to Burp Suite, since both must handle the SSL/TLS handshake to view encrypted traffic.</font>
+ <font style="color:rgb(44, 44, 54);">Via MitmWeb, you can view captured packets locally; in terms of usage it is not much different from Burp.</font>



![mitmweb](https://cdn.nlark.com/yuque/0/2024/png/166008/1734491587977-7e5e72eb-8876-42f3-9d76-c20ff914b72d.png)  


# Common Commands
Replace resources

```bash
 mitmproxy --mode reverse:http://xxxx:8888/ -p 8888 -k --map-remote "|https://xxxx:9201|- http://10.100.15.44:8888
```



Replace the body

```bash
mitmproxy --mode reverse:http://xxxx:2881/ -p 2881 -k \
 --modify-body '/13883797080/13866667080' \
 --modify-body '/17784081010/17766661010' \
  --modify-body '/13983240380/13966660380'
```



![](https://cdn.nlark.com/yuque/0/2024/png/166008/1722564229449-d1bdddbf-81a4-417a-bde4-c71cf26263cf.png)

# Gateway Machine
kali

192.168.1.12



![](https://cdn.nlark.com/yuque/0/2023/png/166008/1700839815951-8665732b-b6b6-4f8a-925c-fa468b049b33.png)



## Network Configuration
### Kernel Forwarding
```bash
# Enable kernel routing forwarding
sysctl -w net.ipv4.ip_forward=1
```

Using any of the above methods will not make the change persistent. To ensure the new setting survives a reboot, you need to edit the /etc/sysctl.conf file.

vim /etc/sysctl.conf

Add one of the following lines to the bottom of the file, depending on whether you want to turn Linux IP forwarding off or on. Then, save the changes to this file. The setting will be permanent across reboots.


```bash
net.ipv4.ip_forward = 0
OR
net.ipv4.ip_forward = 1
```

After editing the file, you can run the following command to apply the changes immediately.

```bash
sysctl -p
```



### iptables Forwarding
Only forward traffic on ports 80/443

```bash
# Redirect all TCP traffic arriving on ports 80 and 443 to mitmproxy's port (assuming mitmproxy runs on port 8080)
sudo iptables -t nat -A PREROUTING -i eth1 -p tcp --dport 80 -j REDIRECT --to-port 8080
sudo iptables -t nat -A PREROUTING -i eth1 -p tcp --dport 443 -j REDIRECT --to-port 8080

```




Forward traffic from a specific IP

```bash
 iptables -t nat -A PREROUTING -i eth1 -p tcp -s 192.168.1.112 -j REDIRECT --to-port 8080

```



check iptables rules — confirm the rules

```bash
iptables -t nat -L -n -v=
```

## mitm Recording
```bash
mitmweb -p 8080 --listen-host 0.0.0.0  --web-port 88 --web-host 0.0.0.0 --mode transparent --showhost

```

+ Via "file" in the top-left corner of the web UI, you can save the capture as a flows file for later use



## mitm <font style="color:rgb(54, 54, 54);">server-side</font> replay
Simulate a server side and replay the requests just captured

Another powerful feature of mitmproxy is replaying previous traffic. It supports server-side replay: mitmproxy replays the server responses for requests that match earlier recorded requests.

The `<font style="color:rgb(74, 74, 74);">--server-replay</font>`<font style="color:rgb(74, 74, 74);"> option lets us replay server responses from a saved HTTP conversation.</font>

+ <font style="color:rgb(74, 74, 74);">To do this, we use a set of heuristics to match incoming requests against the saved responses.</font>
+ <font style="color:rgb(74, 74, 74);">By default, when matching incoming requests against responses in the replay file, we exclude the request headers and match only on the</font><font style="color:rgb(74, 74, 74);background-color:#FBDE28;">URL and the request method</font><font style="color:rgb(74, 74, 74);">, which works in most cases and allows replaying server responses when request headers naturally vary, for example with different user agents.</font>

```bash
itmweb -p 8080 --listen-host 0.0.0.0  --web-port 88 --web-host 0.0.0.0 --mode transparent --showhost \
--server-replay-refresh \
--server-replay-nopop \
--server-replay-kill-extra \
--set server_replay_ignore_content=true \
--server-replay ./PrivateServer-Mock-2.flows 
```

Option explanation

Server Replay:

| -server-replay PATH, -S PATH<br/>                        <br/> <br/> <br/>  | Replay server responses from a saved file. Can be passed multiple times. |
| --- | --- |
| ** --server-replay-kill-extra**<br/>** --no-server-replay-kill-extra**                        | During replay, if no replayable response is found, kill the extra requests |
| **  --server-replay-nopop**<br/> --no-server-replay-nopop<br/>**<u></u>**<br/>                        | After replaying a response, do not remove that flow from the server; enable this if you need to replay the same response multiple times.<br/>The meaning of this pair of options is a bit convoluted — a double negative. |
| **  --server-replay-refresh**<br/> --no-server-replay-refresh<br/>**<u></u>**<br/>                         | During replay, automatically adjust the date, expires, and last-modified headers in the response, and adjust cookie expiration times |
| --set server_replay_ignore_content=true | Sets `server_replay_ignore_content`, which stops the body from being used as the basis for replay matching — only the HTTP method + URL are considered<br/>Afterword: how did I find out this option exists?<br/>+ `mitmweb  --options  |grep server_replay`<br/>+ Visible via the options entry in the mitmweb console<br/>![](https://cdn.nlark.com/yuque/0/2023/png/166008/1700883349591-7924e6b1-d589-4a00-a783-12851d21abee.png)<br/>                                    |

 

# Target Device
### Install the Certificate
On the device whose traffic you want to capture, configure the gateway, then visit `http://mitm.it/` to install the certificate file and trust it

1. Change the default gateway:

Open "Network and Sharing Center".

Click "Change adapter settings".

Right-click the network adapter you are using and select "Properties".

Double-click "Internet Protocol Version 4 (TCP/IPv4)".

Select "Use the following IP address" and fill in the corresponding IP information. In the "Default gateway" field, enter the IP address of your Kali Linux machine.

2. Install the mitmproxy certificate:

Obtain the root certificate from mitmproxy. Usually you can visit http://mitm.it to download the certificate.

Install the certificate on Windows: double-click the certificate file, select "Install Certificate", and follow the prompts to install it.

After completing the steps above, all HTTP and HTTPS traffic on your Windows machine will be forwarded and analyzed through mitmproxy on the Kali Linux machine. Remember to restore the Windows network settings to their original state once you finish capture and analysis.

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1700842025259-a03d8298-8385-4be7-890d-e223700a581e.png)




![](https://cdn.nlark.com/yuque/0/2023/png/166008/1700842106491-d32b3f22-3d0b-4a31-9558-55fd26f6604c.png)
