import { create } from "zustand";
import Toast from "react-native-toast-message";
import { VideoRef, OnLoadData, OnProgressData } from "react-native-video";
import { RefObject } from "react";
import { PlayRecord, PlayRecordManager } from "@/services/storage";
import useDetailStore, { episodesSelectorBySource } from "./detailStore";

interface Episode {
  url: string;
  title: string;
}

// Custom playback status interface to replace AVPlaybackStatus
interface PlaybackStatus {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis?: number;
  didJustFinish?: boolean;
  error?: string;
}

interface PlayerState {
  videoRef: RefObject<VideoRef> | null;
  currentEpisodeIndex: number;
  episodes: Episode[];
  status: PlaybackStatus | null;
  isLoading: boolean;
  showControls: boolean;
  showEpisodeModal: boolean;
  showSourceModal: boolean;
  showNextEpisodeOverlay: boolean;
  isSeeking: boolean;
  seekPosition: number;
  progressPosition: number;
  initialPosition: number;
  introEndTime?: number;
  outroStartTime?: number;
  setVideoRef: (ref: RefObject<VideoRef>) => void;
  loadVideo: (options: {
    source: string;
    id: string;
    title: string;
    episodeIndex: number;
    position?: number;
  }) => Promise<void>;
  playEpisode: (index: number) => void;
  togglePlayPause: () => void;
  seek: (duration: number) => void;
  handlePlaybackStatusUpdate: (data: OnProgressData) => void;
  handleLoad: (data: OnLoadData) => void;
  setLoading: (loading: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowEpisodeModal: (show: boolean) => void;
  setShowSourceModal: (show: boolean) => void;
  setShowNextEpisodeOverlay: (show: boolean) => void;
  setIntroEndTime: () => void;
  setOutroStartTime: () => void;
  reset: () => void;
  _seekTimeout?: NodeJS.Timeout;
  _isRecordSaveThrottled: boolean;
  // Internal helper
  _savePlayRecord: (updates?: Partial<PlayRecord>, options?: { immediate?: boolean }) => void;
}

const usePlayerStore = create<PlayerState>((set, get) => ({
  videoRef: null,
  episodes: [],
  currentEpisodeIndex: -1,
  status: null,
  isLoading: true,
  showControls: false,
  showEpisodeModal: false,
  showSourceModal: false,
  showNextEpisodeOverlay: false,
  isSeeking: false,
  seekPosition: 0,
  progressPosition: 0,
  initialPosition: 0,
  introEndTime: undefined,
  outroStartTime: undefined,
  _isRecordSaveThrottled: false,

  setVideoRef: (ref) => set({ videoRef: ref }),

  loadVideo: async ({ source, id, episodeIndex, position, title }) => {
    const detail = useDetailStore.getState().detail;
    if (!detail) return;

    set({
      isLoading: true,
      initialPosition: position ? position * 1000 : 0, // Convert to milliseconds
    });

    try {
      const episodes = episodesSelectorBySource(useDetailStore.getState())(source);
      
      const playRecord = await PlayRecordManager.get(source, id);
      
      set({
        episodes,
        currentEpisodeIndex: episodeIndex,
        isLoading: false,
        initialPosition: position ? position * 1000 : (playRecord?.play_time ? playRecord.play_time * 1000 : 0),
        introEndTime: playRecord?.introEndTime,
        outroStartTime: playRecord?.outroStartTime,
      });
    } catch (error) {
      console.info("Failed to load play record", error);
      set({ isLoading: false });
    }
  },

  playEpisode: (index) => {
    const { episodes } = get();
    if (index >= 0 && index < episodes.length) {
      set({ currentEpisodeIndex: index, showEpisodeModal: false });
    }
  },

  togglePlayPause: () => {
    const { videoRef, status } = get();
    if (videoRef?.current && status?.isLoaded) {
      if (status.isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.resume();
      }
    }
  },

  seek: (positionMillis) => {
    const { videoRef, _seekTimeout } = get();
    
    // Clear existing timeout
    if (_seekTimeout) {
      clearTimeout(_seekTimeout);
    }

    set({
      isSeeking: true,
      seekPosition: positionMillis / (get().status?.durationMillis || 1),
    });

    // Seek immediately
    if (videoRef?.current) {
      videoRef.current.seek(positionMillis / 1000); // Convert to seconds
    }

    // Set timeout to end seeking state
    const timeoutId = setTimeout(() => {
      set({ isSeeking: false });
    }, 500);

    set({ _seekTimeout: timeoutId });
  },

  handleLoad: (data: OnLoadData) => {
    const newStatus: PlaybackStatus = {
      isLoaded: true,
      isPlaying: false,
      positionMillis: 0,
      durationMillis: data.duration * 1000, // Convert to milliseconds
      didJustFinish: false,
    };

    set({ status: newStatus, isLoading: false });

    // Handle initial position jump
    const { initialPosition, introEndTime } = get();
    const jumpPosition = initialPosition || introEndTime || 0;
    if (jumpPosition > 0 && get().videoRef?.current) {
      get().videoRef?.current.seek(jumpPosition / 1000); // Convert to seconds
    }
  },

  setIntroEndTime: () => {
    const { status, introEndTime: existingIntroEndTime } = get();
    const detail = useDetailStore.getState().detail;
    if (!status?.isLoaded || !detail) return;

    if (existingIntroEndTime) {
      // Clear the time
      set({ introEndTime: undefined });
      get()._savePlayRecord({ introEndTime: undefined }, { immediate: true });
      Toast.show({
        type: "info",
        text1: "已清除片头时间",
      });
    } else {
      // Set the time
      const newIntroEndTime = status.positionMillis;
      set({ introEndTime: newIntroEndTime });
      get()._savePlayRecord({ introEndTime: newIntroEndTime }, { immediate: true });
      Toast.show({
        type: "success",
        text1: "设置成功",
        text2: "片头时间已记录。",
      });
    }
  },

  setOutroStartTime: () => {
    const { status, outroStartTime: existingOutroStartTime } = get();
    const detail = useDetailStore.getState().detail;
    if (!status?.isLoaded || !detail) return;

    if (existingOutroStartTime) {
      // Clear the time
      set({ outroStartTime: undefined });
      get()._savePlayRecord({ outroStartTime: undefined }, { immediate: true });
      Toast.show({
        type: "info",
        text1: "已清除片尾时间",
      });
    } else {
      // Set the time
      if (!status.durationMillis) return;
      const newOutroStartTime = status.durationMillis - status.positionMillis;
      set({ outroStartTime: newOutroStartTime });
      get()._savePlayRecord({ outroStartTime: newOutroStartTime }, { immediate: true });
      Toast.show({
        type: "success",
        text1: "设置成功",
        text2: "片尾时间已记录。",
      });
    }
  },

  _savePlayRecord: (updates = {}, options = {}) => {
    const { immediate = false } = options;
    if (!immediate) {
      if (get()._isRecordSaveThrottled) {
        return;
      }
      set({ _isRecordSaveThrottled: true });
      setTimeout(() => {
        set({ _isRecordSaveThrottled: false });
      }, 10000); // 10 seconds
    }

    const { detail } = useDetailStore.getState();
    const { currentEpisodeIndex, episodes, status, introEndTime, outroStartTime } = get();
    if (detail && status?.isLoaded) {
      const existingRecord = PlayRecordManager.get(detail.source, detail.id.toString());
      PlayRecordManager.save(detail.source, detail.id.toString(), {
        title: detail.title,
        poster: detail.poster || "",
        cover: detail.poster || "",
        index: currentEpisodeIndex,
        total_episodes: episodes.length,
        play_time: Math.floor(status.positionMillis / 1000),
        total_time: status.durationMillis ? Math.floor(status.durationMillis / 1000) : 0,
        source_name: detail.source_name,
        year: detail.year || "",
        introEndTime,
        outroStartTime,
        ...updates,
      });
    }
  },

  handlePlaybackStatusUpdate: (data: OnProgressData) => {
    const { currentEpisodeIndex, episodes, outroStartTime, playEpisode } = get();
    const detail = useDetailStore.getState().detail;

    const newStatus: PlaybackStatus = {
      isLoaded: true,
      isPlaying: true, // react-native-video progress events only fire when playing
      positionMillis: data.currentTime * 1000, // Convert to milliseconds
      durationMillis: data.seekableDuration * 1000, // Convert to milliseconds
      didJustFinish: false,
    };

    // Check for outro auto-skip
    if (
      outroStartTime &&
      newStatus.durationMillis &&
      newStatus.positionMillis >= newStatus.durationMillis - outroStartTime
    ) {
      if (currentEpisodeIndex < episodes.length - 1) {
        playEpisode(currentEpisodeIndex + 1);
        return; // Stop further processing for this update
      }
    }

    if (detail && newStatus.durationMillis) {
      get()._savePlayRecord();

      const isNearEnd = newStatus.positionMillis / newStatus.durationMillis > 0.95;
      if (isNearEnd && currentEpisodeIndex < episodes.length - 1 && !outroStartTime) {
        set({ showNextEpisodeOverlay: true });
      } else {
        set({ showNextEpisodeOverlay: false });
      }
    }

    const progressPosition = newStatus.durationMillis ? newStatus.positionMillis / newStatus.durationMillis : 0;
    set({ status: newStatus, progressPosition });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setShowControls: (show) => set({ showControls: show }),
  setShowEpisodeModal: (show) => set({ showEpisodeModal: show }),
  setShowSourceModal: (show) => set({ showSourceModal: show }),
  setShowNextEpisodeOverlay: (show) => set({ showNextEpisodeOverlay: show }),

  reset: () => {
    set({
      episodes: [],
      currentEpisodeIndex: 0,
      status: null,
      isLoading: true,
      showControls: false,
      showEpisodeModal: false,
      showSourceModal: false,
      showNextEpisodeOverlay: false,
      initialPosition: 0,
      introEndTime: undefined,
      outroStartTime: undefined,
    });
  },
}));

export default usePlayerStore;

export const selectCurrentEpisode = (state: PlayerState) => {
  if (state.episodes.length > state.currentEpisodeIndex) {
    return state.episodes[state.currentEpisodeIndex];
  }
};
