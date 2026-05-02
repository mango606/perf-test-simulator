import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Server, Database, Activity, Monitor, ArrowRight, ArrowDown, Play, Settings2 } from 'lucide-react';

const testInfo = {
  load: {
    title: "Load Test (부하 테스트)",
    description: "시스템이 예상되는 부하(일반적인 트래픽 또는 최대 트래픽) 하에서 어떻게 동작하는지 확인하는 테스트입니다.",
    metrics: "응답 시간(Response Time), 처리량(TPS), 시스템 리소스(CPU, Memory).",
    vibe: "우리가 예상하는 최대 트래픽인 500 TPS를 예측된 응답 속도로 안정적으로 처리할 수 있는가?"
  },
  stress: {
    title: "Stress Test (스트레스 테스트)",
    description: "시스템의 한계점을 찾기 위해 정상적인 예상 부하를 초과하는 극단적인 부하를 가하는 테스트입니다.",
    metrics: "시스템 병목 지점, 중단 시점의 TPS, 복원력(Graceful Degradation). DB Connection Pool 고갈, CPU 100% 포화 상태 집중 모니터링.",
    vibe: "사용자가 갑자기 폭증해서 서버가 죽을 때, 어떤 리소스(DB 커넥션? CPU?)가 먼저 터지는지 확인해봅시다."
  },
  soak: {
    title: "Soak Test (내구 테스트 / 소크 테스트)",
    description: "평균적인 부하를 장시간 지속해서 시스템에 가하여 메모리 누수나 리소스 고갈 등 시간이 지남에 따라 발생하는 문제를 찾는 테스트입니다.",
    metrics: "메모리 사용량의 지속적인 증가(Memory Leak), GC(Garbage Collection) 빈도 및 수행 시간, 파일 디스크립터 한도.",
    vibe: "서버를 3일 동안 켜놨는데 점점 느려지더니 OOM(Out of Memory)으로 죽었습니다. 메모리 릭(Leak)이 있는지 찾아야 해요!"
  },
  spike: {
    title: "Spike Test (스파이크 테스트)",
    description: "매우 짧은 시간 동안 트래픽이 비정상적으로 급증할 때 시스템 성능과 복원력을 평가하는 테스트입니다.",
    metrics: "급격한 부하 발생 시 시스템 생존 여부, 스파이크 이후 정상 상태로의 회복(Recovery) 속도.",
    vibe: "오늘 밤 12시에 선착순 이벤트가 시작됩니다! 1분 안에 100배의 트래픽이 몰릴 텐데 서버가 버텨줄까요?"
  },
  custom: {
    title: "Custom Test (사용자 정의 테스트)",
    description: "테스트하고자 하는 시나리오(목표 TPS, 임계 TPS, 메모리 누수 등)를 직접 구성하여 시스템의 반응을 확인하는 테스트입니다.",
    metrics: "사용자 설정 트래픽 및 시스템 동작 환경에 따른 TPS, 임계점, 오류 상태 변화.",
    vibe: "우리가 준비한 특별 특가 이벤트나 인프라 스펙 변경 시 서버가 어떻게 동작할지 파라미터 값을 조정하며 예측해봅시다."
  }
};

export default function App() {
  const [data, setData] = useState<any[]>([]);
  const [activeTest, setActiveTest] = useState<keyof typeof testInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCustomConfig, setShowCustomConfig] = useState(false);
  const [customConfig, setCustomConfig] = useState({
    targetTps: 1000,
    crashTps: 2000,
    duration: 50,
    hasMemoryLeak: false
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const generateDataPoint = (type: string, tick: number, maxTicks: number) => {
    let tps = 0, cpu = 0, memory = 0, rt = 0;
    const noise = (scale: number) => (Math.random() - 0.5) * scale;

    if (type === 'load') {
      const targetTps = 500;
      if (tick < 5) tps = (targetTps / 5) * tick;
      else tps = targetTps + noise(50);
      
      cpu = tick < 5 ? (45 / 5) * tick : 45 + noise(10);
      memory = 40 + noise(5);
      rt = tick < 5 ? 50 : 50 + noise(15);
    } 
    else if (type === 'stress') {
      tps = tick * 60 + noise(20);
      cpu = Math.min(100, tick * 4 + noise(5));
      memory = Math.min(100, 30 + tick * 2.5 + noise(5));
      rt = 50 + Math.pow(tick / 5, 2) * 5 + noise(10);
      
      if (tick >= 28) {
        tps = 0;
        cpu = 0;
        memory = 95 + noise(2); 
        rt = Math.min(10000, 8000 + noise(500)); 
      } else if (tick > 23) {
        tps = tps * 0.8 + noise(100);
        rt = rt * 2;
      }
    } 
    else if (type === 'soak') {
      const targetTps = 400;
      tps = targetTps + noise(40);
      cpu = 30 + noise(10);
      memory = 20 + (tick / 50) * 80 + noise(3);
      rt = 40 + noise(10);
      
      if (memory >= 98 || tick > 52) {
        tps = 0;
        cpu = 0;
        rt = 8000;
        memory = 100;
      }
    } 
    else if (type === 'spike') {
      if (tick > 12 && tick < 18) {
        tps = 3000 + noise(300);
        cpu = 95 + noise(5);
        memory = 80 + noise(5);
        rt = 4000 + noise(500);
      } else {
        tps = 150 + noise(20);
        cpu = 15 + noise(5);
        memory = 30 + noise(2);
        rt = 30 + noise(10);
      }
    }
    else if (type === 'custom') {
      const { targetTps, crashTps, hasMemoryLeak } = customConfig;
      
      if (tick < 10) tps = (targetTps / 10) * tick;
      else tps = targetTps + noise(targetTps * 0.05);
      
      cpu = Math.min(100, 20 + (tps / crashTps) * 60 + noise(5));
      memory = Math.min(100, 30 + (hasMemoryLeak ? tick * 1.5 : 0) + noise(5));
      rt = Math.max(0, 30 + (tps / crashTps) * 50 + noise(10));
      
      if (tps >= crashTps || memory >= 98 || cpu >= 98) {
        tps = 0;
        rt = Math.min(10000, 5000 + noise(500));
        if (memory < 98) memory = 95 + noise(2); 
        if (cpu < 98) cpu = 0; 
      }
    }

    return {
      time: `${tick}s`,
      tps: Math.max(0, Math.floor(tps)),
      cpu: Math.max(0, Math.min(100, Math.floor(cpu))),
      memory: Math.max(0, Math.min(100, Math.floor(memory))),
      rt: Math.max(0, Math.floor(rt))
    };
  };

  const startSimulation = (testType: keyof typeof testInfo) => {
    setActiveTest(testType);
    setData([]);
    setIsPlaying(true);
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    let tick = 0;
    const maxTicks = testType === 'soak' ? 60 : (testType === 'custom' ? customConfig.duration : 40);
    
    intervalRef.current = setInterval(() => {
      if (tick > maxTicks) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsPlaying(false);
        return;
      }
      
      setData(prev => [...prev, generateDataPoint(testType, tick, maxTicks)]);
      tick++;
    }, 200);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">성능 테스트 시뮬레이터</h1>
          <p className="text-slate-500 mt-2">백엔드 시스템 안정을 위한 성능 테스트 시각화 도구 (By Performance Engineer)</p>
        </header>

        {/* Architecture Diagram */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center overflow-x-auto">
          <h2 className="text-xl font-bold text-slate-700 mb-8 self-center">테스트 대상 아키텍처 (Conceptual Architecture)</h2>
          <div className="relative flex items-center justify-center min-w-[600px] w-full mt-2">
            
            <div className="flex items-center justify-between w-full z-10 px-12">
              <div className="flex flex-col items-center bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-200 w-36">
                <Activity className="w-10 h-10 text-blue-600 mb-2" />
                <span className="text-sm font-bold text-center text-slate-800">Traffic<br/>Generator</span>
                <span className="text-xs font-normal text-blue-500 mt-1">(JMeter, K6)</span>
              </div>
              
              <ArrowRight className="w-8 h-8 text-slate-300" strokeWidth={3} />
              
              <div className="flex flex-col items-center bg-green-50 p-4 rounded-xl shadow-sm border border-green-400 ring-4 ring-green-100 w-36 relative">
                <Server className="w-10 h-10 text-green-600 mb-2" />
                <span className="text-sm font-bold text-center text-slate-800">Target Server</span>
                <span className="text-xs font-normal text-green-600 mt-1">(Spring Boot)</span>
                
                <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
                  <ArrowDown className="w-6 h-6 text-slate-300" strokeWidth={3} />
                </div>
              </div>
              
              <ArrowRight className="w-8 h-8 text-slate-300" strokeWidth={3} />
              
              <div className="flex flex-col items-center bg-orange-50 p-4 rounded-xl shadow-sm border border-orange-200 w-36">
                <Database className="w-10 h-10 text-orange-600 mb-2" />
                <span className="text-sm font-bold text-center text-slate-800">Database</span>
                <span className="text-xs font-normal text-orange-500 mt-1">(MySQL / Redis)</span>
              </div>
            </div>
          </div>
          
          <div className="mt-12 flex justify-center w-full min-w-[600px]">
            <div className="flex items-center space-x-3 bg-slate-800 text-white p-4 rounded-xl shadow-md border border-slate-700 w-72 justify-center">
              <Monitor className="w-8 h-8 text-cyan-400" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-center text-white">Monitoring System</span>
                <span className="text-xs font-normal text-slate-400 text-center">(Prometheus / Grafana / APM)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-4 items-center justify-center">
          <button 
            disabled={isPlaying}
            onClick={() => startSimulation('load')}
            className="flex items-center justify-center px-6 py-3 w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-full font-bold transition-colors shadow-lg shadow-blue-200"
          >
            <Play className="w-4 h-4 mr-2" /> Load Test (부하)
          </button>
          <button 
            disabled={isPlaying}
            onClick={() => startSimulation('stress')}
            className="flex items-center justify-center px-6 py-3 w-full md:w-auto bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-full font-bold transition-colors shadow-lg shadow-red-200"
          >
            <Play className="w-4 h-4 mr-2" /> Stress Test (스트레스)
          </button>
          <button 
            disabled={isPlaying}
            onClick={() => startSimulation('soak')}
            className="flex items-center justify-center px-6 py-3 w-full md:w-auto bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-full font-bold transition-colors shadow-lg shadow-purple-200"
          >
            <Play className="w-4 h-4 mr-2" /> Soak Test (내구 / 릭)
          </button>
          <button 
            disabled={isPlaying}
            onClick={() => startSimulation('spike')}
            className="flex items-center justify-center px-6 py-3 w-full md:w-auto bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-full font-bold transition-colors shadow-lg shadow-orange-200"
          >
            <Play className="w-4 h-4 mr-2" /> Spike Test (스파이크)
          </button>
          <button 
            onClick={() => setShowCustomConfig(!showCustomConfig)}
            className={`flex items-center justify-center px-6 py-3 w-full md:w-auto ${showCustomConfig ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} rounded-full font-bold transition-colors shadow-sm`}
          >
            <Settings2 className="w-4 h-4 mr-2" /> Custom (사용자 정의)
          </button>
        </section>

        {/* Custom Test Configuration Panel */}
        {showCustomConfig && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6 items-center">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1">목표 TPS</label>
                <input 
                  type="number" 
                  min="100" max="10000" step="100"
                  value={customConfig.targetTps} 
                  onChange={(e) => setCustomConfig({...customConfig, targetTps: Number(e.target.value)})}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isPlaying}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1">임계 (Crash) TPS</label>
                <input 
                  type="number" 
                  min="100" max="10000" step="100"
                  value={customConfig.crashTps} 
                  onChange={(e) => setCustomConfig({...customConfig, crashTps: Number(e.target.value)})}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isPlaying}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1">지속 시간 (단위: Ticks)</label>
                <input 
                  type="number" 
                  min="20" max="200" step="10"
                  value={customConfig.duration} 
                  onChange={(e) => setCustomConfig({...customConfig, duration: Number(e.target.value)})}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isPlaying}
                />
              </div>
              <div className="flex flex-col justify-center mt-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={customConfig.hasMemoryLeak} 
                    onChange={(e) => setCustomConfig({...customConfig, hasMemoryLeak: e.target.checked})}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    disabled={isPlaying}
                  />
                  <span className="text-sm font-bold text-slate-700">메모리 누수 발생 (Memory Leak)</span>
                </label>
              </div>
            </div>
            
            <div className="w-full md:w-auto pt-2 md:pt-0">
              <button 
                disabled={isPlaying}
                onClick={() => startSimulation('custom')}
                className="flex items-center justify-center px-8 py-3 w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg font-bold transition-colors shadow-lg whitespace-nowrap"
              >
                <Play className="w-4 h-4 mr-2" /> 실행 (Run)
              </button>
            </div>
          </section>
        )}

        {/* Chart Visualization */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center justify-between">
            <span>실시간 메트릭 대시보드 (Real-time Metrics)</span>
            <span className="text-sm font-medium px-3 py-1 bg-slate-100 rounded-full text-slate-500">
              {isPlaying ? '🔴 기록 중...' : '대기 상태'}
            </span>
          </h2>
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                
                {/* Left Y Axis 1: TPS */}
                <YAxis 
                  yAxisId="tps" 
                  orientation="left" 
                  tick={{ fill: '#3b82f6' }} 
                  axisLine={{ stroke: '#3b82f6' }} 
                  label={{ value: 'TPS', angle: -90, position: 'insideLeft', fill: '#3b82f6' }} 
                />
                <YAxis 
                  yAxisId="rt" 
                  orientation="left" 
                  tick={{ fill: '#ef4444' }} 
                  axisLine={{ stroke: '#ef4444' }} 
                  label={{ value: '응답시간(ms)', angle: -90, position: 'insideLeft', fill: '#ef4444' }} 
                />
                
                {/* Right Y Axis: System Resource (%) */}
                <YAxis 
                  yAxisId="percent" 
                  orientation="right" 
                  domain={[0, 100]} 
                  tick={{ fill: '#10b981' }} 
                  axisLine={{ stroke: '#10b981' }} 
                  label={{ value: '리소스 (CPU/Mem %)', angle: 90, position: 'insideRight', fill: '#10b981' }} 
                />
                
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                
                <Line yAxisId="tps" type="monotone" dataKey="tps" name="처리량 (TPS)" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line yAxisId="percent" type="monotone" dataKey="cpu" name="CPU 사용률 (%)" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line yAxisId="percent" type="monotone" dataKey="memory" name="메모리 사용률 (%)" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line yAxisId="rt" type="monotone" dataKey="rt" name="응답 시간 (ms)" stroke="#ef4444" strokeWidth={3} strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Theory / Guide Section */}
        {activeTest && (
          <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-700 rounded-full opacity-20 -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-cyan-400 mb-6 border-b border-slate-700 pb-4">
                {testInfo[activeTest].title}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">테스트 정의</h4>
                    <p className="text-slate-200 leading-relaxed text-lg bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                      {testInfo[activeTest].description}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">필수 모니터링 지표 (Metrics)</h4>
                    <p className="text-amber-300 font-medium bg-amber-900/20 p-4 rounded-xl border border-amber-900/50">
                      {testInfo[activeTest].metrics}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">시나리오 (Vibe Coding)</h4>
                  <div className="bg-cyan-900/20 border border-cyan-800/50 p-6 rounded-xl h-full flex items-center justify-center italic text-center text-cyan-100 text-xl font-medium leading-relaxed">
                    "{testInfo[activeTest].vibe}"
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
        
        {!activeTest && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-500">
            상단에서 테스트를 선택하여 시뮬레이션을 실행하고 학습 가이드를 확인하세요.
          </section>
        )}
        
      </div>
    </div>
  );
}
