---
title: "数据清洗篇-doc格式转docx的终极方案"
slug: zeygz3essuxbz7vf
date: 2023-09-21T11:45:01+08:00
source: yuque/penetration
---

# doc -> docx
目标：批量将doc文件，转换为docx文件。

+ `<font style="color:rgb(18, 18, 18);">.doc</font>`<font style="color:rgb(18, 18, 18);">老旧，是word 2003以及之前word保存类型；</font>
+ `<font style="color:rgb(18, 18, 18);">.docx</font>`<font style="color:rgb(18, 18, 18);">新，是 Word 2007之后（如2010、2013、2016等）版本的保存类型。</font>



背景情况：

doc格式很奇葩，是二进制形式的，做大模型微调输入不进去，所以需要转换格式。

那么，网上常见的方案，是**调用win32 api来转换**，只支持windows，不支持mac。而且调用win32 api的方法，涉及到要调用Word软件，在批量执行时，非常容易出错。



所以，我为了探寻格式转换（doc->docx）的简单解决方案，展开了调研。



# 终极解决方案
官网：[http://www.multidoc-converter.com/en/index.html](http://www.multidoc-converter.com/en/index.html)

下载地址：[MultiDoc Converter.zip](https://www.yuque.com/attachments/yuque/0/2023/zip/166008/1695281685957-f18f50d0-38c7-45df-b336-36d5fb1064df.zip)



**介绍**：支持哪些文档格式？

<font style="color:rgb(76, 76, 76);">以下文档格式既可以用作源文件，也可以用作目标文件。</font>

+ <font style="color:rgb(76, 76, 76);">Word 2007 文档 （*.docx）</font>
+ <font style="color:rgb(76, 76, 76);">Word 97 - 2003 文档 （*.doc）</font>
+ <font style="color:rgb(76, 76, 76);">OpenOffice 打开文档 （*.odt）</font>
+ <font style="color:rgb(76, 76, 76);">富文本格式 （*.rtf）</font>
+ <font style="color:rgb(76, 76, 76);">Word XML 文档 （*.xml）</font>
+ <font style="color:rgb(76, 76, 76);">超文本标记语言（*.htm、*.html）</font>
+ <font style="color:rgb(76, 76, 76);">电子出版物 （*.epub）</font>
+ <font style="color:rgb(76, 76, 76);">Web 存档，单个文件 （*.mht）</font>
+ <font style="color:rgb(76, 76, 76);">文本文件 （*.txt）</font>

<font style="color:rgb(76, 76, 76);">  
</font><font style="color:rgb(76, 76, 76);">PDF 只能设置为目标文件。</font>

![](https://cdn.nlark.com/yuque/0/2023/jpeg/166008/1695282397999-9954986a-8410-420a-ba04-c251cb383cbb.jpeg)



![](https://cdn.nlark.com/yuque/0/2023/png/166008/1701758056442-c3065010-da1d-4506-921f-6e90bdb5acf0.png)



```bash
taskkill /F /IM ai.exe
taskkill /F /IM winword.exe
```



# 参考
其他的例如使用vbs，使用python，原理都差不多，都是调用Word。

如果对调研过程感兴趣，可以参考下面的材料

+ [https://stackoverflow.com/questions/6011115/doc-to-pdf-using-python](https://stackoverflow.com/questions/6011115/doc-to-pdf-using-python)
+ [https://github.com/unoconv/unoconv](https://github.com/unoconv/unoconv)
+ [https://github.com/cosmojg/doc2docx/blob/master/doc2docx/__init__.py](https://github.com/cosmojg/doc2docx/blob/master/doc2docx/__init__.py)
+ [https://github.com/bhuiyanmobasshir94/Software-Engineering-Best-Practices/blob/main/scripts/doc_ppt2pdf.py](https://github.com/bhuiyanmobasshir94/Software-Engineering-Best-Practices/blob/main/scripts/doc_ppt2pdf.py)



