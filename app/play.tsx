import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, BackHandler, AppState, AppStateStatus, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Video, { VideoRef, ResizeMode, OnLoadData, OnProgressData } from "react-native-video";
import { useKeepAwake } from "expo-keep-awake";
import { ThemedView } from "@/components/ThemedView";
import { PlayerControls } from "@/components/PlayerControls";
import { EpisodeSelectionModal } from "@/components/EpisodeSelectionModal";
import { SourceSelectionModal } from "@/components/SourceSelectionModal";
import { SeekingBar } from "@/components/SeekingBar";
// import { NextEpisodeOverlay } from "@/components/NextEpisodeOverlay";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import useDetailStore from "@/stores/detailStore";
import { useTVRemoteHandler } from "@/hooks/useTVRemoteHandler";
import Toast from "react-native-toast-message";
import usePlayerStore, { selectCurrentEpisode } from "@/stores/playerStore";
import { M3U8AdFilterService } from "@/services/m3u8AdFilter";

export default function PlayScreen() {
  const videoRef = useRef<VideoRef>(null);
  const router = useRouter();
  useKeepAwake();
  const [filteredUrl, setFilteredUrl] = useState<string>("");
  const {
    episodeIndex: episodeIndexStr,
    position: positionStr,
    source: sourceStr,
    id: videoId,
    title: videoTitle,
  } = useLocalSearchParams<{
    episodeIndex: string;
    position?: string;
    source?: string;
    id?: string;
    title?: string;
  }>();
  const episodeIndex = parseInt(episodeIndexStr || "0", 10);
  const position = positionStr ? parseInt(positionStr, 10) : undefined;

  const { detail } = useDetailStore();
  const source = sourceStr || detail?.source;
  const id = videoId || detail?.id.toString();
  const title = videoTitle || detail?.title;
  const {
    isLoading,
    showControls,
    // showNextEpisodeOverlay,
    initialPosition,
    introEndTime,
    setVideoRef,
    handlePlaybackStatusUpdate,
    handleLoad,
    setShowControls,
    // setShowNextEpisodeOverlay,
    reset,
    loadVideo,
  } = usePlayerStore();
  const currentEpisode = usePlayerStore(selectCurrentEpisode);

  // M3U8广告过滤效果
  useEffect(() => {
    const processVideoUrl = async () => {
      if (currentEpisode?.url) {
        if (currentEpisode.url.toLowerCase().includes('.m3u8')) {
          try {
            const filtered = await M3U8AdFilterService.filterM3U8(currentEpisode.url, {
              removeAds: true,
              skipIntro: false,
              minSegmentDuration: 3
            });
            
            if (filtered.removedSegments > 0) {
              Toast.show({
                type: "success",
                text1: "广告过滤",
                text2: `已过滤 ${filtered.removedSegments} 个广告片段`,
              });
            }
            
            setFilteredUrl(filtered.filteredUrl);
          } catch (error) {
            console.error('M3U8过滤失败:', error);
            setFilteredUrl(currentEpisode.url);
          }
        } else {
          setFilteredUrl(currentEpisode.url);
        }
      }
    };

    processVideoUrl();
  }, [currentEpisode?.url]);

  useEffect(() => {
    setVideoRef(videoRef);
    if (source && id && title) {
      loadVideo({ source, id, episodeIndex, position, title });
    }

    return () => {
      reset(); // Reset state when component unmounts
    };
  }, [episodeIndex, source, position, setVideoRef, reset, loadVideo, id, title]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        videoRef.current?.pause();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const { onScreenPress } = useTVRemoteHandler();

  useEffect(() => {
    const backAction = () => {
      if (showControls) {
        setShowControls(false);
        return true;
      }
      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, [showControls, setShowControls, router]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (isLoading) {
      timeoutId = setTimeout(() => {
        if (usePlayerStore.getState().isLoading) {
          usePlayerStore.setState({ isLoading: false });
          Toast.show({ type: "error", text1: "播放超时，请重试" });
        }
      }, 60000); // 1 minute
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading]);

  if (!detail) {
    return <VideoLoadingAnimation showProgressBar />;
  }

  return (
    <ThemedView focusable style={styles.container}>
      <TouchableOpacity activeOpacity={1} style={styles.videoContainer} onPress={onScreenPress}>
        <Video
          ref={videoRef}
          style={styles.videoPlayer}
          source={{ uri: filteredUrl || currentEpisode?.url || "" }}
          poster={detail?.poster ?? ""}
          resizeMode="contain"
          onProgress={handlePlaybackStatusUpdate}
          onLoad={handleLoad}
          onLoadStart={() => usePlayerStore.setState({ isLoading: true })}
          onError={(error) => {
            console.error('Video error:', error);
            usePlayerStore.setState({ isLoading: false });
            Toast.show({ type: "error", text1: "播放错误", text2: error.error?.localizedDescription || "未知错误" });
          }}
          onEnd={() => {
            const { currentEpisodeIndex, episodes, playEpisode } = usePlayerStore.getState();
            if (currentEpisodeIndex < episodes.length - 1) {
              playEpisode(currentEpisodeIndex + 1);
            }
          }}
          controls={false}
          paused={false}
        />

        {showControls && <PlayerControls showControls={showControls} setShowControls={setShowControls} />}

        <SeekingBar />

        {isLoading && (
          <View style={styles.videoContainer}>
            <VideoLoadingAnimation showProgressBar />
          </View>
        )}

        {/* <NextEpisodeOverlay visible={showNextEpisodeOverlay} onCancel={() => setShowNextEpisodeOverlay(false)} /> */}
      </TouchableOpacity>

      <EpisodeSelectionModal />
      <SourceSelectionModal />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  videoPlayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
