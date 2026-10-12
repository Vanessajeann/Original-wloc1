<p align="center"><img src="wloc.jpg" width="144" /></p>

# Apple WLOC 定位修改

由 **Vanessajeann** 维护，基于 `samni728/wloc` 保存的版本继续修复。模块、脚本和部署入口均使用本仓库；原项目来源与致谢保留。

修改 Apple 的 WiFi／基站网络定位响应。**不修改 GPS 硬件定位**，不能保证任意 App、室外强 GPS 信号或任意 iOS 版本都采用修改坐标。

## 快速开始

1. 在 iPhone／iPad 安装并开启下列任一代理工具，订阅对应模块。
2. 开启 MITM，安装该代理工具生成的 CA 证书，并在系统中信任它。MITM 主机名包含 `gs-loc.apple.com` 和 `gs-loc-cn.apple.com`。
3. 在 Safari 打开 **[公共选点页面](https://wloc-spoofer.31610766.workers.dev/)**，可添加到主屏幕。普通用户无需注册 Cloudflare。
4. 点击地图、搜索地点或粘贴地图链接，点击「储存到设备」。
5. 在地图 App 中验证位置。如果系统仍使用旧结果，可重新触发定位，必要时重启设备；以你的设备实际结果为准。

「已储存」仅表示代理工具确认写入设置；系统和 App 是否采用该位置需单独验证。

| 代理工具 | 模块订阅 |
| --- | --- |
| Surge | [添加／复制 .sgmodule 地址](https://raw.githubusercontent.com/Vanessajeann/Original-wloc1/refs/heads/main/modules/wloc.sgmodule) |
| Quantumult X | [添加／复制 .conf 地址](https://raw.githubusercontent.com/Vanessajeann/Original-wloc1/refs/heads/main/modules/wloc.conf) |
| Loon | [添加／复制 .lpx 地址](https://raw.githubusercontent.com/Vanessajeann/Original-wloc1/refs/heads/main/modules/wloc.lpx) |
| Stash | [添加／复制 .stoverride 地址](https://raw.githubusercontent.com/Vanessajeann/Original-wloc1/refs/heads/main/modules/wloc.stoverride) |
| Shadowrocket | [添加／复制 .module 地址](https://raw.githubusercontent.com/Vanessajeann/Original-wloc1/refs/heads/main/modules/wloc.module) |

Egern 使用 Surge 模块。Stash 可直接订阅 `.stoverride`。

这些模块不提供代理节点。需要先有可工作的代理工具；模块开关、MITM 和证书信任缺一不可。

## 设置和恢复位置

**设置：** 打开选点页面 → 选择位置 → 储存到设备。

**恢复：** 点击页面上的「恢复真实定位」。新脚本会明确关闭定位覆盖，即使模块参数曾经设置过其他坐标，也不会自动回退到假坐标。下一次保存位置会重新启用覆盖。

清除浏览器收藏不等于恢复定位。收藏保存在浏览器 `localStorage`，定位设置保存在当前代理工具的 `wloc_settings` 中。

若从旧版升级，请更新模块和脚本后再执行恢复。关闭模块也可以停止修改，但系统可能仍使用已有定位缓存。

## 地图链接和快捷指令

- 苹果地图：带 `coordinate`、`ll` 或 `sll` 的选点链接。
- 高德：`position`、`lnglat`、`p`、`q` 等带坐标链接，以及可跳转到上述格式的短链。
- Google Maps：带明确点位坐标、`query`／`q`／`ll` 或 `@纬度,经度` 的链接；`@` 可能表示地图视口中心。
- 百度：带 `location=纬度,经度` 的链接；不声称支持所有 POI／短链格式。
- 坐标文本：**纬度,经度（WGS84）**，例如 `31.2304,121.4737`。

解析失败时，请长按地图选点后重新分享，或输入坐标。网页与快捷指令共用同一解析接口。

**[快捷指令创建与发布指南](docs/shortcut-guide.md)** 包含已填写公共服务地址的完整流程。本版本尚未发布可直接添加的 iCloud 分享链接；选点网页已经提供设置和恢复入口，无需创建快捷指令即可使用。维护者取得分享链接后，应在这里补上两条「添加快捷指令」入口。

公共解析接口：

```text
https://wloc-spoofer.31610766.workers.dev/api/parse?format=json&u=<URL编码后的地图链接>
```

大陆苹果／高德链接默认按 GCJ-02 转 WGS84；百度 location 按 BD-09 转换；纯文本及 Google 坐标默认不转换。若你的苹果链接已是 WGS84，可附加 `cs=none`，避免再次转换。上述自动判定需要结合真实地图链接验证，网页高德底图点击和切换会同步转换显示坐标。

## 储存失败排查

1. 确认使用本仓库的新模块，且定位脚本与设置脚本均已更新。
2. 确认模块已启用、MITM 已开启、CA 证书已安装并信任。
3. MITM 主机名必须包含 Apple 上述两个域名。
4. 确认 Safari 的请求经过代理工具。
5. 页面成功写入后，再区分「设备已保存」和「系统实际采用」。GPS、系统缓存或 App 自身定位方式可能影响结果。

不要把 `https://gs-loc.apple.com/wloc-settings/save` 改成 Worker 域名。这是设备端代理拦截的设置入口，不是原作者的服务器。

## 数据与外部服务

- 设备设置写入当前代理工具，收藏写入当前浏览器。
- 粘贴地图链接会发给本项目公共 Worker，短链必要时由 Worker 访问对应地图服务；应用不将这些链接写入数据库。
- 地图底图、Leaflet 文件及地点搜索使用第三方服务。搜索词直接发送给 Photon 公共演示服务；服务可能限流或不可用，可改用地图选点。
- 浏览器「当前位置」仅在点击按钮并获用户允许后读取。
- 对 Worker／平台日志、地图服务日志不作「绝对没有记录」的承诺。希望自行控制服务的用户可以自部署。

## 自部署（可选）

日常使用无需部署。希望使用自己的解析地址时：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Vanessajeann/Original-wloc1/tree/main/worker)

一键按钮以 `worker/` 为项目根目录，使用该目录内的入口、工具依赖和锁文件。

手动部署（Node.js 22+、pnpm）：

```sh
git clone https://github.com/Vanessajeann/Original-wloc1.git
cd Original-wloc1/worker
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm run deploy
```

部署后检查 `/health` 返回 `{"service":"wloc","version":2}`，并验证 `/api/parse?format=json&u=31.2304%2C121.4737` 返回 JSON。把快捷指令的解析地址换成自己的域名；设备保存地址保持不变。

Cloudflare 控制台粘贴部署：使用 **[worker/wloc-worker.js](worker/wloc-worker.js)** 全文。该单文件由同一源码生成，包含页面、健康检查和解析接口。不要使用旧版仅返回 HTML 的文件。

Pages：在 `worker/` 中执行 `pnpm run pages:deploy`。构建生成 `dist/_worker.js`，与 Workers 使用相同路由，不需要 KV 或数据库。

## 开发和验证

在仓库根目录，使用 Node.js 22+：

```sh
node scripts/build.mjs
node --test tests/*.test.mjs
node scripts/preview.mjs
```

- `src/state.js` 和 `src/settings.js`：设备保存、校验、恢复和参数优先级。
- `src/wloc-core.js`：保留上游 protobuf／gzip 打包核心，接入新的设置解析；不声称恢复了上游原始未压缩源码。
- `worker/src/`：选点页面、坐标转换、链接解析和请求路由。
- `dist/`、`worker/wloc-worker.js`、`worker/dist/_worker.js`：生成产物，请修改源码后构建。
- GitHub Actions 验证测试和生成产物是否同步。

桌面测试覆盖六种代理环境的 API 模拟、WLOC 二进制帧／gzip 修改、零坐标和错误恢复等；**不等同于六种代理工具和真实 iPhone 的实测认证**。

## 致谢

- [samni728/wloc](https://github.com/samni728/wloc)：本仓库备份和继续维护的来源。
- [FFF686868/proxypin-wloc-spoofer](https://github.com/FFF686868/proxypin-wloc-spoofer)：原始 WLOC 修改思路。
- [NSNanoCat/Util](https://github.com/NSNanoCat/util)：上游打包核心中的跨平台代理工具框架。
- [Photon](https://github.com/komoot/photon)、OpenStreetMap 及地图底图提供方。
