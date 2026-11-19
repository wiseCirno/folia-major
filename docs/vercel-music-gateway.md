# Vercel 音乐服务器代理

锁定部署只把平台 ID 放入前端构建。曲库、封面、歌词和音频由 `/api/music` 同源代理；Vercel Function 使用服务端环境变量连接上游，不把上游鉴权参数、重定向地址或原始错误返回给浏览器。未锁定的部署仍可在浏览器配置自己的服务器；该模式不是保密代理。

## 配置

在 Vercel 项目的 **Settings → Environment Variables** 中配置同一环境（正式站选 Production；要测试预览则也配置 Preview）。删除旧的 `VITE_FOLIA_ONLINE_*` 项，构建会拒绝这些变量，以免无意将凭据打包。

| 变量 | 值 |
| --- | --- |
| `FOLIA_ONLINE_PLATFORM` | `emby` 或 `navidrome` |
| `FOLIA_ONLINE_SERVER_URL` | Vercel 可访问的上游地址，公网建议 HTTPS，保留已有端口和路径前缀 |
| `FOLIA_ONLINE_API_KEY` | Emby API key 模式使用；与用户名密码同时配置时，Emby 优先用 key |
| `FOLIA_ONLINE_EMBY_USER_ID` | 可选，仅用于 Emby API key 模式。建议明确指定对应的音乐专用用户；未指定时使用第一个启用的用户 |
| `FOLIA_ONLINE_USERNAME`、`FOLIA_ONLINE_PASSWORD` | Emby 密码模式或 Navidrome 使用；测试 Emby 密码模式时删除该环境里的 API key 项 |

使用项目默认的 `npm run build`，不要改成静态导出；产物目录为 `dist`，同时部署仓库中的 `api/music.js`。环境变量变更后重新部署。打开新部署、禁用浏览器缓存，在 Network 里试听、拖动进度、查看封面和歌词；这些请求应使用站点自己的 `/api/music`，不应出现上游地址或 API key。有 Range 的音频请求在上游支持时应返回 `206`。普通 Vite 开发服务器没有 Vercel Function；本地验证锁定模式可用 `vercel dev`。此说明验证范围为 Vercel，不适用于静态托管或 Cloudflare Worker。

## 访问边界

代理是只读的，不提供共享账号的收藏、歌单修改或播放上报。如果部署公开，能访问站点的人也能调用代理读取共享曲库和音频。需要限制听众时，在 **Production** 也启用实际覆盖站点和 API 的访问控制；此外，给上游配置仅能访问目标曲库的专用账号。代理不会关闭源站的对外访问，也不会让历史构建里早已公开的凭据失效：切换成功后轮换旧凭据、停用仍含旧凭据的部署。Vercel 的函数时限和流量配额仍适用。
