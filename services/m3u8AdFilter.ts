import { VideoRef } from 'react-native-video';

// M3U8广告过滤服务
export interface M3U8FilterOptions {
  removeAds?: boolean;
  skipIntro?: boolean;
  skipOutro?: boolean;
  adPatterns?: string[];
  minSegmentDuration?: number;
}

interface M3U8Segment {
  duration: number;
  uri: string;
  isAd?: boolean;
  timestamp?: number;
}

interface FilteredM3U8 {
  originalUrl: string;
  filteredUrl: string;
  removedSegments: number;
  totalDuration: number;
  filteredDuration: number;
}

// 默认广告检测模式
const DEFAULT_AD_PATTERNS = [
  'ad.', 'ads.', 'advertising.',
  'doubleclick.', 'googlesyndication.',
  'amazon-adsystem.', 'adsystem.',
  'adform.', 'adnxs.', 'adsystem.',
  'googletag', 'googleads',
  '/ads/', '/ad/', '/advertising/',
  'preroll', 'midroll', 'postroll'
];

export class M3U8AdFilterService {
  private static cache = new Map<string, FilteredM3U8>();
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10分钟

  /**
   * 预处理M3U8播放列表，移除广告片段
   */
  static async filterM3U8(
    originalUrl: string, 
    options: M3U8FilterOptions = {}
  ): Promise<FilteredM3U8> {
    // 检查缓存
    const cached = this.cache.get(originalUrl);
    if (cached && Date.now() - (cached as any).timestamp < this.CACHE_DURATION) {
      return cached;
    }

    const {
      removeAds = true,
      adPatterns = DEFAULT_AD_PATTERNS,
      minSegmentDuration = 3 // 小于3秒的片段可能是广告
    } = options;

    try {
      // 获取原始M3U8内容
      const response = await fetch(originalUrl);
      const m3u8Content = await response.text();
      
      // 解析M3U8
      const segments = this.parseM3U8(m3u8Content);
      
      // 过滤广告片段
      const filteredSegments = removeAds ? 
        this.filterAdSegments(segments, adPatterns, minSegmentDuration) : 
        segments;

      // 生成新的M3U8内容
      const filteredContent = this.generateM3U8(filteredSegments, m3u8Content);
      
      // 创建Blob URL（在支持的环境中）
      const filteredUrl = this.createBlobUrl(filteredContent) || originalUrl;

      const result: FilteredM3U8 = {
        originalUrl,
        filteredUrl,
        removedSegments: segments.length - filteredSegments.length,
        totalDuration: segments.reduce((sum, seg) => sum + seg.duration, 0),
        filteredDuration: filteredSegments.reduce((sum, seg) => sum + seg.duration, 0)
      };

      // 缓存结果
      (result as any).timestamp = Date.now();
      this.cache.set(originalUrl, result);

      return result;
    } catch (error) {
      console.error('M3U8过滤失败:', error);
      return {
        originalUrl,
        filteredUrl: originalUrl,
        removedSegments: 0,
        totalDuration: 0,
        filteredDuration: 0
      };
    }
  }

  /**
   * 解析M3U8内容为片段数组
   */
  private static parseM3U8(content: string): M3U8Segment[] {
    const lines = content.split('\n');
    const segments: M3U8Segment[] = [];
    let currentDuration = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#EXTINF:')) {
        // 提取时长
        const durationMatch = line.match(/#EXTINF:([0-9.]+)/);
        currentDuration = durationMatch ? parseFloat(durationMatch[1]) : 0;
      } else if (line && !line.startsWith('#')) {
        // 这是一个片段URL
        segments.push({
          duration: currentDuration,
          uri: line,
          timestamp: Date.now()
        });
        currentDuration = 0;
      }
    }

    return segments;
  }

  /**
   * 过滤广告片段
   */
  private static filterAdSegments(
    segments: M3U8Segment[], 
    adPatterns: string[], 
    minDuration: number
  ): M3U8Segment[] {
    return segments.filter(segment => {
      // 检查时长过滤
      if (segment.duration < minDuration) {
        segment.isAd = true;
        return false;
      }

      // 检查URL模式
      const isAdByPattern = adPatterns.some(pattern => 
        segment.uri.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isAdByPattern) {
        segment.isAd = true;
        return false;
      }

      return true;
    });
  }

  /**
   * 生成新的M3U8内容
   */
  private static generateM3U8(segments: M3U8Segment[], originalContent: string): string {
    const lines = originalContent.split('\n');
    const headerLines: string[] = [];
    const filteredLines: string[] = [];

    // 保留头部信息
    let i = 0;
    while (i < lines.length && (lines[i].startsWith('#') || lines[i].trim() === '')) {
      if (!lines[i].startsWith('#EXTINF:') && lines[i].trim() !== '') {
        headerLines.push(lines[i]);
      }
      i++;
    }

    // 添加过滤后的片段
    segments.forEach(segment => {
      filteredLines.push(`#EXTINF:${segment.duration.toFixed(3)},`);
      filteredLines.push(segment.uri);
    });

    // 添加结束标记
    filteredLines.push('#EXT-X-ENDLIST');

    return [...headerLines, ...filteredLines].join('\n');
  }

  /**
   * 创建Blob URL（如果支持）
   */
  private static createBlobUrl(content: string): string | null {
    try {
      // 在React Native中，我们可能需要使用不同的方法
      // 这里是一个占位符实现
      if (typeof Blob !== 'undefined') {
        const blob = new Blob([content], { type: 'application/vnd.apple.mpegurl' });
        return URL.createObjectURL(blob);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 清理缓存
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取过滤统计信息
   */
  static getFilterStats(url: string): FilteredM3U8 | null {
    return this.cache.get(url) || null;
  }
}

// 播放器增强功能
export class EnhancedVideoPlayer {
  private videoRef: React.RefObject<VideoRef>;
  private adFilterEnabled: boolean = true;
  private autoSkipIntro: boolean = false;
  private introEndTime?: number;

  constructor(videoRef: React.RefObject<VideoRef>) {
    this.videoRef = videoRef;
  }

  /**
   * 播放M3U8，自动过滤广告
   */
  async playWithAdFilter(url: string, options?: M3U8FilterOptions): Promise<void> {
    if (!this.adFilterEnabled || !url.toLowerCase().includes('.m3u8')) {
      // 直接播放非M3U8文件或关闭过滤时
      return;
    }

    try {
      // 过滤M3U8
      const filtered = await M3U8AdFilterService.filterM3U8(url, options);
      
      console.log(`M3U8过滤完成: 移除${filtered.removedSegments}个片段, 节省${(filtered.totalDuration - filtered.filteredDuration).toFixed(1)}秒`);
      
      // 使用过滤后的URL播放
      // 注意：在React Native中，我们可能需要通过代理服务器提供过滤后的内容
      
    } catch (error) {
      console.error('M3U8过滤失败，使用原始URL:', error);
    }
  }

  /**
   * 设置自动跳过片头
   */
  setAutoSkipIntro(enabled: boolean, endTime?: number): void {
    this.autoSkipIntro = enabled;
    this.introEndTime = endTime;
  }

  /**
   * 启用/禁用广告过滤
   */
  setAdFilterEnabled(enabled: boolean): void {
    this.adFilterEnabled = enabled;
  }
}

export default M3U8AdFilterService;
