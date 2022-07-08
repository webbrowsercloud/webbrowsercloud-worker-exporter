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

const browser_max_concurrent = new prom.Gauge({
  name: "browser_max_concurrent",
  help: "浏览器预设最大并发数量",
});

const browser_max_queued = new prom.Gauge({
  name: "browser_max_queued",
  help: "浏览器预设最大排队数量",
});

const browser_queued_utilization = new prom.Gauge({
  name: "browser_queued_utilization",
  help: "浏览器排队率",
});

const browser_concurrent_utilization = new prom.Gauge({
  name: "browser_concurrent_utilization",
  help: "浏览器并发利用率",
});

const browser_cpu = new prom.Gauge({
  name: "browser_cpu",
  help: "浏览器 cpu 利用率",
});

const browser_memory = new prom.Gauge({
  name: "browser_memory",
  help: "浏览器内存利用率",
});

const browser_recently_rejected = new prom.Gauge({
  name: "browser_recently_rejected",
  help: "浏览器近期拒绝数量",
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

    browser_max_concurrent.set(pressure.maxConcurrent);

    browser_max_queued.set(pressure.maxQueued);

    browser_cpu.set(pressure.cpu);

    browser_memory.set(pressure.memory);

    browser_recently_rejected.set(pressure.recentlyRejected);

    browser_concurrent_utilization.set(
      _.floor((pressure.running * 100) / pressure.maxConcurrent, 2)
    );

    browser_queued_utilization.set(
      _.floor((pressure.queued * 100) / pressure.maxQueued, 2)
    );
  } catch (err) {
    const loggerWithChild = logger.child({ browserPressureEntry, err });
    loggerWithChild.error("获取 pod 状态失败", { browserPressureEntry, err });
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
