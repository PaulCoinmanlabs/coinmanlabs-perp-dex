"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries, Time, ISeriesApi } from "lightweight-charts";


interface Props {
  currentPrice?: number;
}

export default function TradingChart({ currentPrice }: Props) {

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);


  const lastCandleRef = useRef<{ time: Time; open: number; high: number; low: number; close: number } | null>(null);


  const [legendData, setLegendData] = useState({
    time: "", open: 0, high: 0, low: 0, close: 0,
  });


  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. 初始化暗黑质感图表实例
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#A3A3A3" },
      watermark: { color: "rgba(255, 255, 255, 0.04)", visible: true, text: "ETH / USD • 15m", fontSize: 48, horzAlign: "center", vertAlign: "center" },
      grid: { vertLines: { color: "#262626" }, horzLines: { color: "#262626" } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "#262626" },
      timeScale: { borderColor: "#262626", timeVisible: true, secondsVisible: false },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    chartRef.current = chart;


    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444", borderVisible: false, wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });

    seriesRef.current = candlestickSeries;


    const fetchHistoricalData = async () => {
      try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - (200 * 15 * 60); // 200 根 15 分钟 K 线

        const response = await fetch(`https://benchmarks.pyth.network/v1/shims/tradingview/history?symbol=Crypto.ETH/USD&resolution=15&from=${from}&to=${to}`);
        const data = await response.json();
        
        if (data.s === "ok" && data.t && data.t.length > 0) {
          const formattedData = data.t.map((timestamp: number, index: number) => ({
            time: timestamp as Time,
            open: data.o[index],
            high: data.h[index],
            low: data.l[index],
            close: data.c[index],
          }));

          candlestickSeries.setData(formattedData);

          const lastCandle = formattedData[formattedData.length - 1];
          lastCandleRef.current = lastCandle;
          updateLegend(lastCandle);
        }
      } catch (error) {
        console.error("无法获取 Pyth K 线数据:", error);
      }
    };

    fetchHistoricalData();


    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.size > 0) {
        const data = param.seriesData.get(candlestickSeries) as any;
        if (data) updateLegend({ ...data, time: param.time });
      }
    });


    function updateLegend(data: any) {
      const date = new Date((data.time as number) * 1000);
      const timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      setLegendData({ time: timeStr, open: data.open, high: data.high, low: data.low, close: data.close });
    }


    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []); 
  useEffect(() => {
  
    if (!currentPrice || currentPrice <= 0 || !seriesRef.current || !lastCandleRef.current) return;

    const currentUnix = Math.floor(Date.now() / 1000);
    const lastCandle = lastCandleRef.current;
    
 
    const period = 15 * 60;
    const currentPeriodStart = Math.floor(currentUnix / period) * period;


    if (currentPeriodStart > (lastCandle.time as number)) {
     
      const newCandle = {
        time: currentPeriodStart as Time,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
      };
      seriesRef.current.update(newCandle);
      lastCandleRef.current = newCandle;
    } else {
      
      const updatedCandle = {
        ...lastCandle,
        high: Math.max(lastCandle.high, currentPrice),
        low: Math.min(lastCandle.low, currentPrice),
        close: currentPrice, // 最新价即为收盘价
      };
      seriesRef.current.update(updatedCandle);
      lastCandleRef.current = updatedCandle;
    }
  }, [currentPrice]); 

  return (
    <div className="relative w-full h-full">

      <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-1.5 bg-zinc-950/40 p-2 rounded-lg backdrop-blur-sm border border-neutral-800/50">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-neutral-200">ETH / USD</span>
          <span className="text-xs font-semibold text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">15m</span>
          <span className="text-sm text-neutral-400 ml-2 tracking-tight">{legendData.time}</span>
        </div>
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
      

      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}