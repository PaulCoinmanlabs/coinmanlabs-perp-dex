"use client";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import dynamic from "next/dynamic";
import { useAccount, useBalance } from "wagmi";
import { useState } from "react";

//  架构细节：动态导入 TradingChart
// 因为 lightweight-charts 依赖浏览器的 Canvas 和 DOM API，不能在服务端渲染 (SSR)。
// 我们使用 next/dynamic 将其标记为纯客户端渲染，并添加一个酷炫的加载状态。
const TradingChart = dynamic(() => import("../components/TradingChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950/50">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <span className="text-sm text-muted-foreground animate-pulse">
          连接预言机节点...
        </span>
      </div>
    </div>
  ),
});

export default function Home() {
  const { address, isConnected } = useAccount();

  const { openConnectModal } = useConnectModal();

  const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

  const { data: usdcBalance } = useBalance({
    address: address,
    token: USDC_ADDRESS,
    query: {
      enabled: isConnected,
    },
  });

  const formattedBalance = usdcBalance?.formatted
    ? Number(usdcBalance.formatted).toFixed(2)
    : "0.00";

  const [collateral, setCollateral] = useState<String>("");
  const [leverage, setLeverage] = useState<number[]>([10]);

  const numCollateral = Number(collateral) || 0;
  const balanceNum = Number(formattedBalance) || 0;

  const positionSize = numCollateral * leverage[0];
  const estimateFee = positionSize * 0.001;

  const isInsufficientBalance = numCollateral > balanceNum;
  const isZeroInput = numCollateral <= 0;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* 顶部导航栏 (Navbar) */}
      <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-6 sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          {/* 这里可以放个你自己的 Logo，比如 Coinmanlabs 的标志 */}
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center font-bold text-white">
            C
          </div>
          <span className="text-xl font-bold tracking-tight">Perp DEX MVP</span>
        </div>
        {/* Wagmi / RainbowKit 钱包连接按钮 */}
        <ConnectButton />
      </header>

      {/* 核心交易区域 (Main Content) */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-[1800px] mx-auto w-full">
        {/* 左侧：图表与数据区 (占据 3/4 宽度) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* K线图表容器 */}
          <Card className="flex-1 min-h-[550px] overflow-hidden bg-zinc-950 border-neutral-800 rounded-xl">
            <TradingChart />
          </Card>

          {/* 底部：仓位列表 (Positions) */}
          <Card className="h-72 border-neutral-800 bg-zinc-900/50">
            <CardHeader className="border-b border-neutral-800 pb-3 pt-4">
              <CardTitle className="text-sm font-medium">
                我的仓位 (Positions)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              <div className="flex flex-col items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-50"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <span>暂无持仓，连接钱包后显示链上数据</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：订单操作区 (占据 1/4 宽度) */}
        <div className="lg:col-span-1">
          <Card className="h-full border-neutral-800 bg-zinc-900/80 backdrop-blur-sm">
            <CardHeader className="pb-4 border-b border-neutral-800 mb-4">
              <CardTitle className="text-lg flex flex-col gap-1">
                <span className="text-muted-foreground text-sm font-normal">
                  交易对
                </span>
                <div className="flex justify-between items-center">
                  <span className="font-bold">ETH / USD</span>
                  {/* 这里后续会接入 Pyth 的真实 WebSocket 报价，现在先用静态数据占位 */}
                  <span className="text-green-500 font-mono text-xl">
                    $3,452.00
                  </span>
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent>
              {/* 开多 / 开空 切换卡 */}
              <Tabs defaultValue="long" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-950">
                  <TabsTrigger
                    value="long"
                    className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-bold transition-all"
                  >
                    做多 (Long)
                  </TabsTrigger>
                  <TabsTrigger
                    value="short"
                    className="data-[state=active]:bg-red-600 data-[state=active]:text-white font-bold transition-all"
                  >
                    做空 (Short)
                  </TabsTrigger>
                </TabsList>

                {/* 订单表单 (后续会用 React Hook Form 包裹) */}
                <div className="space-y-6">
                  {/* 金额输入 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="pay" className="text-muted-foreground">
                        抵押金 (USDC)
                      </Label>
                      <span
                        className="text-xs text-muted-foreground cursor-pointer hover:text-white transition-colors"
                        onClick={() => {
                          // 架构细节：点击余额可以直接把全部余额填入输入框 (这里先预留逻辑)
                          console.log("Fill max balance:", formattedBalance);
                        }}
                      >
                        余额: {formattedBalance}
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        id="pay"
                        type="number"
                        placeholder="0.0"
                        className="pr-16 font-mono text-lg bg-zinc-950 border-neutral-700 h-12 focus-visible:ring-blue-600"
                        value={Number(collateral)}
                        onChange={(e) => {
                          setCollateral(e.target.value);
                        }}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-muted-foreground font-semibold">
                        USDC
                      </div>
                    </div>
                  </div>

                  {/* 杠杆滑动条 */}
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-muted-foreground">杠杆倍数</Label>
                      <span className="font-mono text-sm bg-zinc-800 px-2 py-1 rounded text-blue-400 font-bold">
                        {leverage[0].toFixed(1)}x
                      </span>
                    </div>
                    <Slider
                      value={leverage}
                      onValueChange={setLeverage}
                      max={50}
                      step={1}
                      min={2}
                      className="w-full py-2 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-neutral-500 font-mono">
                      <span>2x</span>
                      <span>10x</span>
                      <span>25x</span>
                      <span>50x</span>
                    </div>
                  </div>

                  {/* 核心数据汇总区 */}
                  <div className="border-t border-neutral-800 pt-5 space-y-3 text-sm text-muted-foreground bg-zinc-950/30 p-4 rounded-lg">
                    <div className="flex justify-between">
                      <span>仓位大小 (Size)</span>
                      {/* 🌟 动态展示仓位大小 */}
                      <span className="text-foreground font-mono">
                        {positionSize > 0
                          ? `$${positionSize.toFixed(2)}`
                          : "0.00 USD"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>预估强平价 (Liq. Price)</span>
                      <span className="text-foreground font-mono">-</span>{" "}
                      {/* 这个需要接真实现价才能算，先留空 */}
                    </div>
                    <div className="flex justify-between">
                      <span>开仓手续费 (0.1%)</span>
                      <span className="text-foreground font-mono">
                        {estimateFee > 0 ? `$${estimateFee.toFixed(4)}` : "-"}
                      </span>
                    </div>
                  </div>

                  {!isConnected ? (
                    <Button
                      onClick={openConnectModal}
                      className="w-full font-bold text-md h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20 transition-all"
                    >
                      连接钱包以交易
                    </Button>
                  ) : (
                    <Button
                      disabled={isZeroInput || isInsufficientBalance}
                      className={`w-full font-bold text-md h-12 text-white shadow-lg transition-all disabled:shadow-none
      ${isInsufficientBalance ? "bg-red-600 disabled:bg-red-900/50 disabled:text-red-200" : "bg-green-600 hover:bg-green-700 shadow-green-900/20 disabled:bg-neutral-800 disabled:text-neutral-500"}`}
                      onClick={() => {
                        alert(
                          `准备用 ${collateral} USDC 开 ${leverage[0]}x 杠杆，总仓位 $${positionSize}!`,
                        );
                      }}
                    >
                  
                      {isInsufficientBalance
                        ? "余额不足 (Insufficient Balance)"
                        : isZeroInput
                          ? "输入金额 (Enter Amount)"
                          : "提交订单 (Submit Order)"}
                    </Button>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
