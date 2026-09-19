# Habit Tracker

## 本机使用

双击 `Start-Habit-Tracker.cmd`，启动后会自动打开：

`http://127.0.0.1:4177/`

本机页面可以添加、删除、调整习惯和完成量。每次修改会自动写入 `data.json`，并尝试提交、推送到 GitHub 仓库。

## 分享链接

`https://z137965-blip.github.io/habit-tracker/`

该地址是只读视图，会自动读取 `data.json` 的最新版本，不显示添加、删除、进度调整或分享按钮。

## 停止同步

关闭启动脚本打开的终端窗口即可停止本机同步服务。
