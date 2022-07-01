require("dotenv").config();
const express = require("express");
const prom = require("prom-client");
const axios = require("axios");
const os = require("os");
const logger = require("pino")();
const _ = require("lodash");

// 定义各类指标
const browser_running = new prom.Gauge({
  name: "browser_running",
  help: "正在运行页面数量",
});

const browser_queued = new prom.Gauge({
  name: "browser_queued",
  help: "正在排队数量",
});

const browser_concurrent_utilization = new prom.Gauge({
  name: "browser_concurrent_utilization",
  help: "浏览器并发利用率",
});

const app = express();

// 获取环境变量
const { PORT, BROWSERLESS_HOST, BROWSERLESS_PORT, BROWSERLESS_API_TOKEN } =
  process.env;

// 获取本机 ip 地址
const getLocalIp = () => {
  const ifaces = os.networkInterfaces();
  const ips = [];
  Object.keys(ifaces).forEach((ifname) => {
    ifaces[ifname].forEach((iface) => {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    });
  });

  const [localIp] = ips;

  if (!localIp) {
    logger.error({ ips }, "未获取到本机 ip 地址");
    throw new Error("未找到本机 ip 地址");
  }

  return localIp;
};

// 获取 browserless host
const getBrowserlessHost = () => {
  let browserlessHost = BROWSERLESS_HOST;

  if (!BROWSERLESS_HOST) {
    logger.warn("未配置 BROWSERLESS_HOST 环境变量，将使用本机 ip 地址");
    browserlessHost = getLocalIp();
  }

  return browserlessHost;
};

// 获取 browserless 入口地址
const getBrowserlessEntry = (
  // 额外的路径参数
  extraPath = ""
) => {
  // 检查是否配置了 BROWSERLESS_PORT 环境变量
  if (!BROWSERLESS_PORT) {
    logger.error("未配置 BROWSERLESS_PORT 环境变量");
    throw new Error("未配置 BROWSERLESS_PORT 环境变量");
  }

  const browserlessHost = getBrowserlessHost();

  let token = "";

  // 检查是否配置了 BROWSERLESS_API_TOKEN 环境变量
  if (!BROWSERLESS_API_TOKEN) {
    logger.warn("未配置 BROWSERLESS_TOKEN 环境变量");
  } else {
    token = `?token=${BROWSERLESS_API_TOKEN}`;
  }

  return `http://${browserlessHost}:${BROWSERLESS_PORT}/${extraPath}${token}`;
};

// 请求 browserless 压力接口，并设置指标数值
async function getWorkerPressure(browserlessEntry) {
  try {
    const { data } = await axios.get(browserlessEntry);

    const { pressure } = data;

    browser_running.set(pressure.running);

    browser_queued.set(pressure.queued);

    browser_concurrent_utilization.set(
      _.floor((pressure.running * 100) / pressure.maxConcurrent, 2)
    );
  } catch (err) {
    logger.error("获取 pod 状态失败", { podIp: ip, err });
    throw err;
  }
}

const browserlessEntry = getBrowserlessEntry("pressure");

app.get("/metrics", async function (req, res) {
  await getWorkerPressure(browserlessEntry);

  res.set("Content-Type", prom.register.contentType);
  res.end(await prom.register.metrics());
});

app.listen(PORT || 5000, () => {
  console.log(`Example app listening on port 3000`);
});
