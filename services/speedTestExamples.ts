import { testPlaySource, testLatency, testDownloadSpeed, calculateSourceScore, sortSourcesByScore } from './speedTest';

// 使用示例

// 1. 测试单个播放源
async function testSingleSource() {
  const m3u8Url = "https://example.com/video.m3u8";
  
  try {
    const result = await testPlaySource(m3u8Url);
    console.log('测试结果:', result);
    // 输出: { latency: 120, downloadSpeed: 450, isAvailable: true }
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 2. 独立测试延迟
async function testLatencyOnly() {
  const url = "https://example.com/api/endpoint";
  
  try {
    const latency = await testLatency(url);
    console.log('延迟:', latency, 'ms');
  } catch (error) {
    console.error('延迟测试失败:', error);
  }
}

// 3. 独立测试下载速度
async function testDownloadOnly() {
  const m3u8Url = "https://example.com/video.m3u8";
  
  try {
    const speed = await testDownloadSpeed(m3u8Url);
    console.log('下载速度:', speed, 'KB/s');
  } catch (error) {
    console.error('下载测试失败:', error);
  }
}

// 4. 计算综合得分
function calculateScore() {
  const score = calculateSourceScore(
    120,        // 延迟 120ms
    450,        // 下载速度 450KB/s
    "1080p",    // 分辨率 1080p
    24,         // 集数 24集
    true        // 可用
  );
  console.log('综合得分:', score);
  // 输出: 综合得分: 85.5
}

// 5. 对多个播放源进行排序
function sortSources() {
  const sources = [
    {
      source: "source1",
      latency: 150,
      downloadSpeed: 300,
      resolution: "720p",
      episodes: { length: 12 },
      isAvailable: true
    },
    {
      source: "source2", 
      latency: 80,
      downloadSpeed: 600,
      resolution: "1080p",
      episodes: { length: 24 },
      isAvailable: true
    },
    {
      source: "source3",
      latency: 200,
      downloadSpeed: 200,
      resolution: "480p", 
      episodes: { length: 8 },
      isAvailable: true
    }
  ];

  const sortedSources = sortSourcesByScore(sources);
  console.log('排序后的播放源:', sortedSources);
  // 输出按得分降序排列的播放源列表
}

// 6. 批量测试多个播放源
async function batchSpeedTest() {
  const urls = [
    "https://source1.com/video.m3u8",
    "https://source2.com/video.m3u8", 
    "https://source3.com/video.m3u8"
  ];

  console.log('开始批量测速...');
  
  const results = await Promise.all(
    urls.map(async (url, index) => {
      try {
        const result = await testPlaySource(url);
        return {
          source: `source${index + 1}`,
          url,
          ...result
        };
      } catch (error) {
        return {
          source: `source${index + 1}`,
          url,
          latency: -1,
          downloadSpeed: 0,
          isAvailable: false,
          error: error.message
        };
      }
    })
  );

  console.log('批量测速完成:', results);
  
  // 过滤可用的源并排序
  const availableSources = results.filter(r => r.isAvailable);
  const sortedResults = availableSources.sort((a, b) => {
    const scoreA = calculateSourceScore(a.latency, a.downloadSpeed, "1080p", 20, a.isAvailable);
    const scoreB = calculateSourceScore(b.latency, b.downloadSpeed, "1080p", 20, b.isAvailable);
    return scoreB - scoreA;
  });

  console.log('排序后的可用播放源:', sortedResults);
}

// 7. 监控播放源性能变化
async function monitorSources() {
  const url = "https://example.com/video.m3u8";
  
  const monitor = setInterval(async () => {
    try {
      const result = await testPlaySource(url);
      console.log(`[${new Date().toLocaleTimeString()}] 性能监控:`, result);
      
      // 如果延迟过高或下载速度过慢，可以发出警告
      if (result.latency > 1000) {
        console.warn('警告: 延迟过高!', result.latency, 'ms');
      }
      if (result.downloadSpeed < 100) {
        console.warn('警告: 下载速度过慢!', result.downloadSpeed, 'KB/s');
      }
    } catch (error) {
      console.error('监控失败:', error);
    }
  }, 30000); // 每30秒检测一次

  // 5分钟后停止监控
  setTimeout(() => {
    clearInterval(monitor);
    console.log('性能监控已停止');
  }, 5 * 60 * 1000);
}

export {
  testSingleSource,
  testLatencyOnly,
  testDownloadOnly,
  calculateScore,
  sortSources,
  batchSpeedTest,
  monitorSources
};
