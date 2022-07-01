# webbrowsercloud-worker-exporter

## 📄 说明书
这是集群内 browserless 节点 Pod 的 Sidecar，它将读取当前 Pod 内正在运行的 browserless 的 [运行压力](https://www.browserless.io/docs/pressure) ，并以 pod 自定义指标的形式向外报漏，集群将根据节点压力自动伸缩 browserless 工人节点的数量。
