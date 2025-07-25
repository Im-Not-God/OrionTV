import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { StyledButton } from '@/components/StyledButton';
import { clearSpeedTestCache, getSpeedTestCacheStats } from '@/services/speedTest';

interface SpeedTestSettingsProps {
  autoSpeedTest: boolean;
  onAutoSpeedTestChange: (enabled: boolean) => void;
  speedTestTimeout: number;
  onSpeedTestTimeoutChange: (timeout: number) => void;
}

export const SpeedTestSettingsSection: React.FC<SpeedTestSettingsProps> = ({
  autoSpeedTest,
  onAutoSpeedTestChange,
  speedTestTimeout,
  onSpeedTestTimeoutChange,
}) => {
  const [cacheStats, setCacheStats] = useState<{
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  } | null>(null);

  const handleClearCache = () => {
    Alert.alert(
      "清除缓存",
      "确定要清除所有测速缓存吗？这将导致下次需要重新测速。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定",
          style: "destructive",
          onPress: () => {
            clearSpeedTestCache();
            Alert.alert("成功", "测速缓存已清除");
            updateCacheStats();
          },
        },
      ]
    );
  };

  const updateCacheStats = () => {
    const stats = getSpeedTestCacheStats();
    setCacheStats(stats);
  };

  const timeoutOptions = [3, 5, 8, 10, 15];

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.sectionTitle}>播放源测速设置</ThemedText>
      
      {/* 自动测速开关 */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <ThemedText style={styles.settingLabel}>自动测速</ThemedText>
          <ThemedText style={styles.settingDescription}>
            在详情页面自动对所有播放源进行测速
          </ThemedText>
        </View>
        <Switch
          value={autoSpeedTest}
          onValueChange={onAutoSpeedTestChange}
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={autoSpeedTest ? "#f5dd4b" : "#f4f3f4"}
        />
      </View>

      {/* 测速超时设置 */}
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <ThemedText style={styles.settingLabel}>测速超时</ThemedText>
          <ThemedText style={styles.settingDescription}>
            单个播放源的测速超时时间（秒）
          </ThemedText>
        </View>
      </View>
      
      <View style={styles.timeoutButtons}>
        {timeoutOptions.map((timeout) => (
          <StyledButton
            key={timeout}
            onPress={() => onSpeedTestTimeoutChange(timeout)}
            style={[
              styles.timeoutButton,
              speedTestTimeout === timeout && styles.timeoutButtonSelected
            ]}
            text={`${timeout}秒`}
            textStyle={[
              styles.timeoutButtonText,
              speedTestTimeout === timeout && styles.timeoutButtonTextSelected
            ]}
          />
        ))}
      </View>

      {/* 缓存管理 */}
      <View style={styles.cacheSection}>
        <ThemedText style={styles.settingLabel}>缓存管理</ThemedText>
        <ThemedText style={styles.settingDescription}>
          测速结果会缓存10分钟以提高性能
        </ThemedText>
        
        <View style={styles.cacheButtons}>
          <StyledButton
            onPress={updateCacheStats}
            style={styles.cacheButton}
            text="查看缓存状态"
            textStyle={styles.cacheButtonText}
          />
          <StyledButton
            onPress={handleClearCache}
            style={[styles.cacheButton, styles.clearCacheButton]}
            text="清除缓存"
            textStyle={styles.cacheButtonText}
          />
        </View>

        {cacheStats && (
          <View style={styles.cacheStats}>
            <ThemedText style={styles.cacheStatsText}>
              总条目: {cacheStats.totalEntries}
            </ThemedText>
            <ThemedText style={styles.cacheStatsText}>
              有效条目: {cacheStats.validEntries}
            </ThemedText>
            <ThemedText style={styles.cacheStatsText}>
              过期条目: {cacheStats.expiredEntries}
            </ThemedText>
          </View>
        )}
      </View>

      {/* 测速说明 */}
      <View style={styles.infoSection}>
        <ThemedText style={styles.infoTitle}>测速说明</ThemedText>
        <ThemedText style={styles.infoText}>
          • 延迟测试：测试到播放源的连接延迟{'\n'}
          • 下载测试：测试M3U8文件的下载速度{'\n'}
          • 综合得分：根据清晰度、集数、延迟、下载速度计算{'\n'}
          • 自动排序：按得分高低自动排列播放源
        </ThemedText>
      </View>

      {/* 得分算法说明 */}
      <View style={styles.infoSection}>
        <ThemedText style={styles.infoTitle}>得分算法</ThemedText>
        <ThemedText style={styles.infoText}>
          • 清晰度得分 (40分): 4K=40, 2K=35, 1080p=30, 720p=25{'\n'}
          • 集数得分 (20分): 每集0.5分，最高20分{'\n'}
          • 下载速度得分 (25分): >1MB/s=25分, >500KB/s=20分{'\n'}
          • 延迟得分 (15分): <100ms=15分, <300ms=12分
        </ThemedText>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 10,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 18,
  },
  timeoutButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  timeoutButton: {
    marginRight: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  timeoutButtonSelected: {
    backgroundColor: '#007bff',
  },
  timeoutButtonText: {
    color: '#ccc',
    fontSize: 14,
  },
  timeoutButtonTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  cacheSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  cacheButtons: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 15,
  },
  cacheButton: {
    marginRight: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#28a745',
    borderRadius: 6,
  },
  clearCacheButton: {
    backgroundColor: '#dc3545',
  },
  cacheButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cacheStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 6,
  },
  cacheStatsText: {
    fontSize: 12,
    color: '#ccc',
    marginBottom: 2,
  },
  infoSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#ffd700',
  },
  infoText: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
  },
});
