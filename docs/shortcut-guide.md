# 快捷指令：创建、验证和发布

公共选点页面：https://wloc-spoofer.31610766.workers.dev/
公共解析服务：https://wloc-spoofer.31610766.workers.dev/api/parse

网页已经有「储存到设备」和「恢复真实定位」入口。快捷指令是可选的地图分享入口。
已发布 **[「WLOC 选点」快捷指令](https://www.icloud.com/shortcuts/3acda8b3d366475bb65fb04a664ce276)**，可一键打开公共选点网页；设置和恢复通过网页按钮完成。
下列完整的「设置地理位置」「恢复真实定位」指令尚未发布 iCloud 链接，可以在维护者自己的 iPhone／iPad 上创建，再分享给访客。
GitHub 仓库复制不会复制 iCloud 分享记录，Windows 上也不能直接执行 Apple 的快捷指令签名工具。

## 维护者创建「WLOC 设置地理位置」

在「快捷指令」中新建，名称设为「WLOC 设置地理位置」。

1. 打开详情，启用「在共享表单中显示」，接收「URL」和「文本」。
2. 添加「从输入中获取文本」，输入选「快捷指令输入」。
3. 如果文本没有值，使用「询问输入」，提示「粘贴地图分享链接，或输入纬度,经度」。
4. 添加「URL 编码」，对上一步的文本编码。
5. 添加「URL」，填写下列前缀，并在最后插入「URL 编码」的结果变量：
   `https://wloc-spoofer.31610766.workers.dev/api/parse?format=json&u=`
6. 添加「获取 URL 内容」，方法 GET。
7. 添加「获取字典值」，读取解析结果中的 `error`。如果有值，显示错误提醒并「停止此快捷指令」。
8. 分别读取解析字典的 `lat`、`lon`，保存为「纬度」「经度」变量。检查是否有值；**0 是有效坐标，不应当作无值**。
9. 添加「URL」，用变量构造：
   `https://gs-loc.apple.com/wloc-settings/save?lat=<纬度变量>&lon=<经度变量>&acc=25`
10. 添加「获取 URL 内容」，方法 GET。
11. 从返回字典读取 `success`。仅当其为 true／是时显示通知「位置已保存，请在地图中验证」；否则显示返回的 `error`。
12. 代理未开启、MITM 未配置或请求返回的不是 JSON 时应显示错误，不能继续显示保存成功。

若系统将「获取 URL 内容」结果识别为文本，在其后添加「从输入中获取字典」再读字段。不要把「解析接口返回了坐标」等同于「保存成功」。

大陆苹果／高德链接默认转换坐标；若确定输入已是 WGS84，可将解析 URL 改为：
`https://wloc-spoofer.31610766.workers.dev/api/parse?format=json&cs=none&u=<编码结果>`

## 维护者创建「WLOC 恢复真实定位」

1. 新建快捷指令，命名「WLOC 恢复真实定位」。
2. 添加「URL」：
   `https://gs-loc.apple.com/wloc-settings/save?action=clear`
3. 添加「获取 URL 内容」，方法 GET。
4. 从返回字典读取 `success`。为 true／是时显示通知「定位覆盖已关闭，请在地图中验证」；否则显示 `error`。
5. 请求或 JSON 解析失败时显示错误，不显示成功。

新设置脚本在恢复时保存 `enabled:false`。它覆盖模块手动坐标；下一次设置位置会保存 `enabled:true` 重新启用。
请先更新本仓库的模块和两个脚本，再使用恢复功能。
系统已有定位缓存不会因通知出现而自动清除，必要时重新触发定位或重启设备。

## 可选的最简入口

只想一键打开选点网页时，可直接 **[添加「WLOC 选点」](https://www.icloud.com/shortcuts/3acda8b3d366475bb65fb04a664ce276)**，或自行新建：
「URL」填写 `https://wloc-spoofer.31610766.workers.dev/` → 「打开 URL」。
这条指令只打开网页，设置和恢复由网页按钮完成。

## 发布给访客

1. 在自己的设备上测试地图分享、保存、查询、恢复及代理关闭时的失败提示。
2. 打开每条快捷指令的共享菜单 →「复制 iCloud 链接」。
3. 将两条链接添加到 README「地图链接和快捷指令」部分，标为「添加设置指令」「添加恢复指令」。
4. 导出文件另作备份；修改动作后重新发布并更新链接。
5. 用另一台未安装旧指令的设备打开链接并导入，检查公共服务地址是否正确。

分享操作由 Apple 快捷指令应用生成真实链接。没有链接前，不应在 README 放虚构的 iCloud URL 或将未经签名的模板标为可直接安装。

官方说明：https://support.apple.com/guide/shortcuts/share-shortcuts-apdf01f8c054/ios

## 自部署者

只替换设置指令中的公共解析服务域名。以下设备端地址保持原样：
- 保存：`https://gs-loc.apple.com/wloc-settings/save?lat=...&lon=...&acc=25`
- 查询：`https://gs-loc.apple.com/wloc-settings/save?action=query`
- 恢复：`https://gs-loc.apple.com/wloc-settings/save?action=clear`

这些请求由代理工具本地拦截，要求代理连接、模块启用、MITM 和证书信任均已完成。
