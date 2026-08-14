---
title: "{{ replace .Name "-" " " | title }}"
slug: {{ .Name }}
url: /web/{{ now.Format "06" }}/{{ now.Format "01" }}/{{ .Name }}/
date: {{ .Date }}
lastmod: {{ .Date }}
draft: true
description: ""
tags: []
categories: []
---

