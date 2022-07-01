require("dotenv").config();
const express = require("express");
const prom = require("prom-client");
const axios = require("axios");
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
const { PORT, BROWSER_URL, BROWSER_TOKEN } = process.env;

// 获取 browser 压力入口地址
const getBrowserPressureEntry = () => {
  // 检查是否配置了 BROWSER_URL 环境变量
  if (!BROWSER_URL) {
    throw new Error("未配置 BROWSER_URL 环境变量");
  }

  const url = new URL(BROWSER_URL);

  url.pathname = "/pressure";

  // 检查是否配置了 BROWSER_TOKEN 环境变量
  if (!BROWSER_TOKEN) {
    logger.warn("未配置 BROWSER_TOKEN 环境变量");
  } else {
    url.searchParams.set("token", BROWSER_TOKEN);
  }

  return url.toString();
};

// 请求 browser 压力接口，并设置指标数值
async function getWorkerPressure(browserEntry) {
  try {
    const { data } = await axios.get(browserEntry);

    const { pressure } = data;

    browser_running.set(pressure.running);

    browser_queued.set(pressure.queued);

    browser_concurrent_utilization.set(
      _.floor((pressure.running * 100) / pressure.maxConcurrent, 2)
    );
  } catch (err) {
    logger.error("获取 pod 状态失败", { browserPressureEntry, err });
  }
}

const browserPressureEntry = getBrowserPressureEntry();

app.get("/metrics", async function (req, res) {
  await getWorkerPressure(browserPressureEntry);

  res.set("Content-Type", prom.register.contentType);
  res.end(await prom.register.metrics());
});

const port = PORT || 5000;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
