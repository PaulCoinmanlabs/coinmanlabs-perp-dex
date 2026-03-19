"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, parseEther, formatUnits } from "viem";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const POSITION_MANAGER_ADDRESS = "0xBA5763084722962aACa0e16dED125912491b5C20" as `0x${string}`;
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as `0x${string}`;
const PYTH_ETH_PRICE_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const PositionManagerABI = [
  {
    inputs: [
      { internalType: "uint256", name: "sizeDelta", type: "uint256" },
      { internalType: "uint256", name: "collateralDelta", type: "uint256" },
      { internalType: "bytes[]", name: "pythUpdateData", type: "bytes[]" }
    ],
    name: "increasePosition",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  }
] as const;

const UsdcABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// 动态导入 K 线图 (防 SSR 报错)
const TradingChart = dynamic(() => import("@/components/TradingChart"), { 
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950/50">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <span className="text-sm text-muted-foreground animate-pulse">连接预言机节点...</span>
      </div>
    </div>
  )
});

export default function Home() {

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [collateral, setCollateral] = useState<string>("");
  const [leverage, setLeverage] = useState<number[]>([10]);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [priceColor, setPriceColor] = useState<string>("text-neutral-200");
  const lastPriceRef = useRef<number>(0);

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isApproving, setIsApproving] = useState(false);
  const [isTrading, setIsTrading] = useState(false);

  const { data: usdcBalance } = useBalance({
    address,
    token: USDC_ADDRESS,
    query: { enabled: isConnected && !!address }
  });
  const formattedBalance = usdcBalance?.formatted ? Number(usdcBalance.formatted).toFixed(2) : "0.00";

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: UsdcABI,
    functionName: "allowance",
    args: address ? [address, POSITION_MANAGER_ADDRESS] : undefined,
    query: { enabled: isConnected && !!address }
  });
  const formattedAllowance = allowance ? Number(formatUnits(allowance as bigint, 6)) : 0;


  const { writeContractAsync } = useWriteContract();
  const { isLoading: isMining, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isTxSuccess) {
      if (isApproving) {
        refetchAllowance(); 
        setIsApproving(false);
      }
      if (isTrading) {
        setCollateral(""); 
        setIsTrading(false);
      }
      setTxHash(undefined);
    }
  }, [isTxSuccess, isApproving, isTrading, refetchAllowance]);

  useEffect(() => {
    const connection = new PriceServiceConnection("https://hermes.pyth.network", {
      priceFeedRequestConfig: { binary: true },
    });

    connection.subscribePriceFeedUpdates([PYTH_ETH_PRICE_ID], (priceFeed) => {
      const price = priceFeed.getPriceUnchecked();
      if (price) {
        const currentPrice = Number(price.price) * Math.pow(10, price.expo);
        if (lastPriceRef.current !== 0) {
          if (currentPrice > lastPriceRef.current) setPriceColor("text-green-500");
          else if (currentPrice < lastPriceRef.current) setPriceColor("text-red-500");
        }
        lastPriceRef.current = currentPrice;
        setEthPrice(currentPrice);
      }
    });

    return () => connection.closeWebSocket();
  }, []);


  const numCollateral = Number(collateral) || 0;
  const balanceNum = Number(formattedBalance) || 0;
  
  const positionSize = numCollateral * leverage[0]; 
  const estimatedFee = positionSize * 0.001; 
  
  const needsApproval = numCollateral > formattedAllowance;
  const isInsufficientBalance = numCollateral > balanceNum;
  const isZeroInput = numCollateral <= 0;

  const MMR = 0.01; 
  let estimatedLiqPrice = 0;
  if (ethPrice > 0 && numCollateral > 0) {
    estimatedLiqPrice = ethPrice * (1 - (1 / leverage[0]) + MMR);
  }


  const handleApprove = async () => {
    try {
      setIsApproving(true);
      const scaledAmount = parseUnits(collateral, 6);
      
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: UsdcABI,
        functionName: "approve",
        args: [POSITION_MANAGER_ADDRESS, scaledAmount],
      });
      setTxHash(hash);
    } catch (error) {
      console.error("授权失败:", error);
      setIsApproving(false);
    }
  };

  const handleOpenPosition = async () => {
    try {
      setIsTrading(true);
      

      const pythResponse = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_ETH_PRICE_ID}`);
      const pythData = await pythResponse.json();
      const updateDataBytes = pythData.binary.data.map((hexStr: string) => `0x${hexStr}` as `0x${string}`);

      const scaledCollateral = parseUnits(collateral, 6);
      const scaledSize = parseUnits(positionSize.toString(), 6); // 在生产环境可能要根据合约定义的 1e30 处理精度，这里用 6 位简化

      const hash = await writeContractAsync({
        address: POSITION_MANAGER_ADDRESS,
        abi: PositionManagerABI,
        functionName: "increasePosition",
        args: [scaledSize, scaledCollateral, updateDataBytes],
        value: parseEther("0.0005"), 
      });
      setTxHash(hash);
    } catch (error) {
      console.error("开仓失败:", error);
      setIsTrading(false);
    }
  };


  const isPending = isApproving || isTrading || isMining;
  
  const getButtonState = () => {
    if (!isConnected) return { onClick: openConnectModal, text: "连接钱包以交易", color: "bg-blue-600 hover:bg-blue-700" };
    if (isPending) return { disabled: true, text: isMining ? "链上打包中 (Mining)..." : "钱包确认中 (Confirming)...", color: "bg-neutral-600" };
    if (isZeroInput) return { disabled: true, text: "输入金额 (Enter Amount)", color: "bg-neutral-800 text-neutral-500" };
    if (isInsufficientBalance) return { disabled: true, text: "余额不足 (Insufficient Balance)", color: "bg-red-600 disabled:bg-red-900/50 text-red-200" };
    if (needsApproval) return { onClick: handleApprove, text: "授权 USDC (Approve)", color: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20" };
    return { onClick: handleOpenPosition, text: `提交 ${leverage[0]}x 多单 (Submit)`, color: "bg-green-600 hover:bg-green-700 shadow-green-900/20" };
  };

  const btnState = getButtonState();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">

      <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-6 sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center font-bold text-white">C</div>
          <span className="text-xl font-bold tracking-tight">Perp DEX MVP</span>
        </div>
        <ConnectButton />
      </header>


      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-[1800px] mx-auto w-full">

        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="flex-1 min-h-[550px] overflow-hidden bg-zinc-950 border-neutral-800 rounded-xl relative">
            <TradingChart currentPrice={ethPrice} />
          </Card>
          
          <Card className="h-72 border-neutral-800 bg-zinc-900/50">
            <CardHeader className="border-b border-neutral-800 pb-3 pt-4">
              <CardTitle className="text-sm font-medium">我的仓位 (Positions)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              <div className="flex flex-col items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <span>连接合约读取你的持仓数据...</span>
              </div>
            </CardContent>
          </Card>
        </div>


        <div className="lg:col-span-1">
          <Card className="h-full border-neutral-800 bg-zinc-900/80 backdrop-blur-sm">
            <CardHeader className="pb-4 border-b border-neutral-800 mb-4">
              <CardTitle className="text-lg flex flex-col gap-1">
                <span className="text-muted-foreground text-sm font-normal">交易对</span>
                <div className="flex justify-between items-center">
                  <span className="font-bold">ETH / USD</span>
                  <span className={`${priceColor} font-mono text-xl transition-colors duration-300`}>
                    {ethPrice > 0 ? `$${ethPrice.toFixed(2)}` : "获取报价..."}
                  </span> 
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue="long" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-950">
                  <TabsTrigger value="long" className="data-[state=active]:bg-green-600 data-[state=active]:text-white font-bold transition-all">做多 (Long)</TabsTrigger>
                  <TabsTrigger value="short" className="data-[state=active]:bg-red-600 data-[state=active]:text-white font-bold transition-all">做空 (Short)</TabsTrigger>
                </TabsList>
                
                <div className="space-y-6">
          
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="pay" className="text-muted-foreground">抵押金 (USDC)</Label>
                      <span className="text-xs text-muted-foreground cursor-pointer hover:text-white transition-colors">
                        余额: {formattedBalance}
                      </span>
                    </div>
                    <div className="relative">
                      <Input 
                        id="pay" 
                        type="number"
                        placeholder="0.0" 
                        value={collateral}
                        onChange={(e) => setCollateral(e.target.value)}
                        className={`pr-16 font-mono text-lg bg-zinc-950 h-12 focus-visible:ring-blue-600 ${isInsufficientBalance ? 'border-red-500 text-red-500' : 'border-neutral-700'}`} 
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-muted-foreground font-semibold">
                        USDC
                      </div>
                    </div>
                  </div>

         
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-muted-foreground">杠杆倍数</Label>
                      <span className="font-mono text-sm bg-zinc-800 px-2 py-1 rounded text-blue-400 font-bold">{leverage[0].toFixed(1)}x</span>
                    </div>
                    <Slider 
                      value={leverage} 
                      onValueChange={setLeverage} 
                      max={50} 
                      min={2} 
                      step={1} 
                      className="w-full py-2 cursor-pointer" 
                    />
                    <div className="flex justify-between text-xs text-neutral-500 font-mono">
                      <span>2x</span><span>10x</span><span>25x</span><span>50x</span>
                    </div>
                  </div>

       
                  <div className="border-t border-neutral-800 pt-5 space-y-3 text-sm text-muted-foreground bg-zinc-950/30 p-4 rounded-lg">
                    <div className="flex justify-between">
                      <span>仓位大小 (Size)</span>
                      <span className="text-foreground font-mono">{positionSize > 0 ? `$${positionSize.toFixed(2)}` : "0.00 USD"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>预估强平价 (Liq. Price)</span>
                      <span className="text-foreground font-mono">{estimatedLiqPrice > 0 ? `$${estimatedLiqPrice.toFixed(2)}` : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>开仓手续费 (0.1%)</span>
                      <span className="text-foreground font-mono">{estimatedFee > 0 ? `$${estimatedFee.toFixed(4)}` : "-"}</span>
                    </div>
                  </div>

            
                  <Button 
                    onClick={btnState.onClick}
                    disabled={btnState.disabled}
                    className={`w-full font-bold text-md h-12 text-white shadow-lg transition-all disabled:shadow-none ${btnState.color}`}
                  >
                    {btnState.text}
                  </Button>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}