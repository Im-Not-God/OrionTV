interface SpeedTestResult {
  latency: number; // 延迟 (ms)
  downloadSpeed: number; // 下载速度 (KB/s)
  isAvailable: boolean; // 是否可用
  error?: string;
}

interface SourceScore {
  source: string;
  score: number;
  latency: number;
  downloadSpeed: number;
  resolution: string | null;
  episodeCount: number;
  isAvailable: boolean;
}

const speedTestCache: { [url: string]: { result: SpeedTestResult; timestamp: number } } = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10分钟缓存

/**
 * 测试连接延迟
 */
export const testLatency = async (url: string, signal?: AbortSignal): Promise<number> => {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
    
    const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    
    const response = await fetch(url, {
      method: 'HEAD', // 只获取头部信息，减少数据传输
      signal: combinedSignal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return Date.now() - startTime;
    } else {
      return Infinity; // 连接失败
    }
  } catch (error) {
    return Infinity; // 连接失败或超时
  }
};

/**
 * 测试M3U8文件下载速度
 */
export const testDownloadSpeed = async (url: string, signal?: AbortSignal): Promise<number> => {
  if (!url.toLowerCase().endsWith('.m3u8')) {
    return 0;
  }

  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
    
    const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    
    const response = await fetch(url, {
      signal: combinedSignal,
      cache: 'no-cache'
    });
    
    if (!response.ok) {
      clearTimeout(timeoutId);
      return 0;
    }
    
    const data = await response.text();
    const endTime = Date.now();
    
    clearTimeout(timeoutId);
    
    // 计算下载速度 (KB/s)
    const duration = (endTime - startTime) / 1000; // 转换为秒
    const sizeInKB = new Blob([data]).size / 1024; // 转换为KB
    
    return duration > 0 ? sizeInKB / duration : 0;
  } catch (error) {
    return 0; // 下载失败
  }
};

/**
 * 综合测试播放源
 */
export const testPlaySource = async (
  url: string, 
  signal?: AbortSignal
): Promise<SpeedTestResult> => {
  // 检查缓存
  const cached = speedTestCache[url];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.result;
  }

  try {
    // 并行测试延迟和下载速度
    const [latency, downloadSpeed] = await Promise.all([
      testLatency(url, signal),
      testDownloadSpeed(url, signal)
    ]);

    const result: SpeedTestResult = {
      latency: latency === Infinity ? -1 : latency,
      downloadSpeed,
      isAvailable: latency !== Infinity,
      error: latency === Infinity ? '连接失败' : undefined
    };

    // 缓存结果
    speedTestCache[url] = {
      result,
      timestamp: Date.now()
    };

    return result;
  } catch (error) {
    const result: SpeedTestResult = {
      latency: -1,
      downloadSpeed: 0,
      isAvailable: false,
      error: error instanceof Error ? error.message : '测试失败'
    };

    return result;
  }
};

/**
 * 计算播放源综合得分
 */
export const calculateSourceScore = (
  latency: number,
  downloadSpeed: number,
  resolution: string | null,
  episodeCount: number,
  isAvailable: boolean
): number => {
  if (!isAvailable || latency < 0) {
    return 0; // 不可用的源得分为0
  }

  let score = 0;

  // 1. 清晰度得分 (最高40分)
  const resolutionScore = (() => {
    if (!resolution) return 10; // 未知分辨率给予基础分
    const height = parseInt(resolution.replace('p', ''));
    if (height >= 2160) return 40; // 4K
    if (height >= 1440) return 35; // 2K
    if (height >= 1080) return 30; // 1080p
    if (height >= 720) return 25;  // 720p
    if (height >= 480) return 15;  // 480p
    return 10; // 其他
  })();

  // 2. 集数得分 (最高20分)
  const episodeScore = Math.min(episodeCount * 0.5, 20);

  // 3. 下载速度得分 (最高25分)
  const speedScore = (() => {
    if (downloadSpeed >= 1000) return 25; // >= 1MB/s
    if (downloadSpeed >= 500) return 20;  // >= 500KB/s
    if (downloadSpeed >= 200) return 15;  // >= 200KB/s
    if (downloadSpeed >= 100) return 10;  // >= 100KB/s
    if (downloadSpeed >= 50) return 5;    // >= 50KB/s
    return 0;
  })();

  // 4. 延迟得分 (最高15分)
  const latencyScore = (() => {
    if (latency <= 100) return 15;   // <= 100ms
    if (latency <= 300) return 12;   // <= 300ms
    if (latency <= 500) return 8;    // <= 500ms
    if (latency <= 1000) return 5;   // <= 1s
    if (latency <= 2000) return 2;   // <= 2s
    return 0;
  })();

  score = resolutionScore + episodeScore + speedScore + latencyScore;
  
  return Math.round(score * 100) / 100; // 保留两位小数
};

/**
 * 对播放源进行排序
 */
export const sortSourcesByScore = (sources: any[]): SourceScore[] => {
  return sources
    .map(source => {
      const score = calculateSourceScore(
        source.latency || -1,
        source.downloadSpeed || 0,
        source.resolution,
        source.episodes?.length || 0,
        source.isAvailable !== false
      );

      return {
        source: source.source,
        score,
        latency: source.latency || -1,
        downloadSpeed: source.downloadSpeed || 0,
        resolution: source.resolution,
        episodeCount: source.episodes?.length || 0,
        isAvailable: source.isAvailable !== false
      };
    })
    .sort((a, b) => b.score - a.score); // 按得分降序排列
};

/**
 * 清除测速缓存
 */
export const clearSpeedTestCache = (): void => {
  Object.keys(speedTestCache).forEach(key => {
    delete speedTestCache[key];
  });
};

/**
 * 获取缓存统计信息
 */
export const getSpeedTestCacheStats = () => {
  const now = Date.now();
  const validEntries = Object.values(speedTestCache).filter(
    entry => now - entry.timestamp < CACHE_DURATION
  );
  
  return {
    totalEntries: Object.keys(speedTestCache).length,
    validEntries: validEntries.length,
    expiredEntries: Object.keys(speedTestCache).length - validEntries.length
  };
};
