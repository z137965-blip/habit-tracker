# Habit Tracker

## 本机使用

1. 确认 GitHub CLI 已登录：`gh auth login`
2. 双击 `Start-Habit-Tracker.cmd`
3. 自动打开：`http://127.0.0.1:4177/`

只有这个本机页面可以添加、删除、调整习惯和完成量。每次修改会先写入本机 `data.json`，再通过 GitHub API 更新线上数据，并发送实时更新通知。

## 分享链接

`https://z137965-blip.github.io/habit-tracker/`

分享页面为纯只读视图：

- 不显示添加、删除或分享按钮
- 不能调整习惯和进度
- 自动接收本机更新，无需手动刷新
- 网络异常时每 5 分钟自动兜底同步一次

## 停止同步

关闭 `Start-Habit-Tracker.cmd` 打开的终端窗口即可停止本机服务。
