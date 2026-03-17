"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries, Time, ISeriesApi } from "lightweight-charts";

export default function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // 🌟 新增：状态机，用于存储当前悬停的 K 线数据和时间，展示在左上角图例中
  const [legendData, setLegendData] = useState({
    time: "",
    open: 0,
    high: 0,
    low: 0,
    close: 0,
  });

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. 初始化图表实例
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#A3A3A3",
      },
      // 🌟 新增：背景巨型水印
      watermark: {
        color: "rgba(255, 255, 255, 0.04)", // 极淡的白色，融入暗黑背景
        visible: true,
        text: "ETH / USDT • 15m",
        fontSize: 48,
        horzAlign: "center",
        vertAlign: "center",
      },
      grid: {
        vertLines: { color: "#262626" },
        horzLines: { color: "#262626" },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "#262626" },
      timeScale: {
        borderColor: "#262626",
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    chartRef.current = chart;

    // 2. 添加 K 线系列
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    // @ts-ignore
    seriesRef.current = candlestickSeries;

    // 3. 抓取数据并初始化
    const fetchHistoricalData = async () => {
      try {
        const response = await fetch(
          "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=15m&limit=200"
        );
        const data = await response.json();
        
        const formattedData = data.map((d: any) => ({
          time: (d[0] / 1000) as Time,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        candlestickSeries.setData(formattedData);

        // 🌟 新增：数据加载完后，将图例初始化为最新的一根 K 线数据
        const lastCandle = formattedData[formattedData.length - 1];
        updateLegend(lastCandle);

      } catch (error) {
        console.error("无法获取 K 线数据:", error);
      }
    };

    fetchHistoricalData();

    // 🌟 4. 新增：监听鼠标十字线 (Crosshair) 移动事件
    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.size > 0) {
        const data = param.seriesData.get(candlestickSeries) as any;
        if (data) {
          updateLegend({ ...data, time: param.time });
        }
      }
    });

    // 🌟 辅助函数：格式化时间并更新图例状态
    function updateLegend(data: any) {
      const date = new Date((data.time as number) * 1000);
      // 格式化为 YYYY-MM-DD HH:mm
      const timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      
      setLegendData({
        time: timeStr,
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
      });
    }

    // 处理窗口缩放
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* 🌟 核心视觉：绝对定位的左上角动态图例 (Legend) */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-1.5 bg-zinc-950/40 p-2 rounded-lg backdrop-blur-sm border border-neutral-800/50">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-neutral-200">ETH / USDT</span>
          <span className="text-xs font-semibold text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">15m</span>
          <span className="text-sm text-neutral-400 ml-2 tracking-tight">{legendData.time}</span>
        </div>
        
        {/* O-H-L-C (开-高-低-收) 数据展示 */}
        <div className="flex gap-4 text-xs font-mono">
          <div className="flex gap-1">
            <span className="text-neutral-500">O</span>
            <span className={legendData.open > legendData.close ? 'text-red-400' : 'text-green-400'}>
              {legendData.open.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-1">
            <span className="text-neutral-500">H</span>
            <span className="text-neutral-200">{legendData.high.toFixed(2)}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-neutral-500">L</span>
            <span className="text-neutral-200">{legendData.low.toFixed(2)}</span>
          </div>
          <div className="flex gap-1">
            <span className="text-neutral-500">C</span>
            <span className={legendData.close >= legendData.open ? 'text-green-400' : 'text-red-400'}>
              {legendData.close.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      
      {/* 图表真实 Canvas 挂载点 */}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}