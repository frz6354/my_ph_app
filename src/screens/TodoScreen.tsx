import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  RefreshControl,
  SafeAreaView,
} from 'react-native';

export interface HNStory {
  id: number;
  title: string;
  by?: string;
  score?: number;
  descendants?: number;
  url?: string;
  time?: number;
  type?: string;
  deleted?: boolean;
  dead?: boolean;
}

const BATCH_SIZE = 15;
const TOP_STORIES_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const getItemUrl = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

export function getDomain(url?: string): string {
  if (!url) return 'news.ycombinator.com';
  try {
    const matches = url.match(/^https?:\/\/(?:www\.)?([^/]+)/i);
    if (matches && matches[1]) {
      return matches[1];
    }
  } catch (e) {
    // fallback
  }
  return 'news.ycombinator.com';
}

async function fetchStoryItems(ids: number[]): Promise<HNStory[]> {
  const promises = ids.map(async (id) => {
    try {
      const res = await fetch(getItemUrl(id));
      if (!res.ok) return null;
      const data: HNStory = await res.json();
      return data && data.type === 'story' && !data.deleted && !data.dead ? data : (data && data.title ? data : null);
    } catch {
      return null;
    }
  });
  const results = await Promise.all(promises);
  return results.filter((item): item is HNStory => item !== null && item !== undefined && typeof item.id === 'number');
}

interface TodoScreenProps {
  route: {
    name: string;
  };
}

export default function TodoScreen({ route }: TodoScreenProps) {
  const tabName = route.name;

  if (tabName !== 'Todo 1') {
    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderTitle}>{tabName}</Text>
        <Text style={styles.placeholderSubtitle}>Coming soon!</Text>
      </View>
    );
  }

  return <HackerNewsFeed />;
}

function HackerNewsFeed() {
  const [storyIds, setStoryIds] = useState<number[]>([]);
  const [stories, setStories] = useState<HNStory[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadingMoreRef = useRef(false);
  const initialLoadingRef = useRef(true);
  const refreshingRef = useRef(false);

  const loadInitialStories = useCallback(async () => {
    try {
      setError(null);
      setInitialLoading(true);
      initialLoadingRef.current = true;

      const res = await fetch(TOP_STORIES_URL);
      if (!res.ok) {
        throw new Error(`Failed to fetch top stories (Status ${res.status})`);
      }
      const ids: number[] = await res.json();
      if (!Array.isArray(ids)) {
        throw new Error('Received invalid data format from Hacker News API');
      }

      setStoryIds(ids);

      const firstBatchIds = ids.slice(0, BATCH_SIZE);
      const fetchedStories = await fetchStoryItems(firstBatchIds);

      setStories(fetchedStories);
    } catch (err: any) {
      console.error('Error fetching initial HN stories:', err);
      setError(err?.message || 'Unable to connect to Hacker News. Please check your network connection.');
    } finally {
      setInitialLoading(false);
      initialLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadInitialStories();
  }, [loadInitialStories]);

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current || initialLoadingRef.current) return;
    try {
      setRefreshing(true);
      refreshingRef.current = true;
      setError(null);

      const res = await fetch(TOP_STORIES_URL);
      if (!res.ok) {
        throw new Error(`Failed to refresh top stories (Status ${res.status})`);
      }
      const ids: number[] = await res.json();
      if (!Array.isArray(ids)) {
        throw new Error('Received invalid data format from Hacker News API');
      }

      setStoryIds(ids);

      const firstBatchIds = ids.slice(0, BATCH_SIZE);
      const fetchedStories = await fetchStoryItems(firstBatchIds);

      setStories(fetchedStories);
    } catch (err: any) {
      console.error('Error refreshing HN stories:', err);
      if (stories.length === 0) {
        setError(err?.message || 'Unable to refresh Hacker News stories.');
      }
    } finally {
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [stories.length]);

  const handleLoadMore = useCallback(async () => {
    if (
      loadingMoreRef.current ||
      initialLoadingRef.current ||
      refreshingRef.current ||
      stories.length >= storyIds.length ||
      storyIds.length === 0
    ) {
      return;
    }

    try {
      loadingMoreRef.current = true;
      setLoadingMore(true);

      const nextBatchIds = storyIds.slice(stories.length, stories.length + BATCH_SIZE);
      if (nextBatchIds.length === 0) return;

      const fetchedStories = await fetchStoryItems(nextBatchIds);

      setStories((prevStories: HNStory[]) => {
        const existingIds = new Set(prevStories.map((s: HNStory) => s.id));
        const uniqueNew = fetchedStories.filter((s: HNStory) => !existingIds.has(s.id));
        return [...prevStories, ...uniqueNew];
      });
    } catch (err) {
      console.error('Error loading more HN stories:', err);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [stories.length, storyIds]);

  const handleOpenStory = useCallback(async (story: HNStory) => {
    const targetUrl = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
    try {
      const supported = await Linking.canOpenURL(targetUrl);
      if (supported) {
        await Linking.openURL(targetUrl);
      } else {
        await Linking.openURL(`https://news.ycombinator.com/item?id=${story.id}`);
      }
    } catch (err) {
      console.error('Failed to open story URL:', err);
      try {
        await Linking.openURL(`https://news.ycombinator.com/item?id=${story.id}`);
      } catch (fallbackErr) {
        console.error('Fallback URL failed:', fallbackErr);
      }
    }
  }, []);

  const renderStoryCard = useCallback(
    ({ item }: { item: HNStory }) => {
      const domain = getDomain(item.url);
      const points = item.score ?? 0;
      const author = item.by || 'anonymous';
      const commentsCount = item.descendants ?? 0;

      return (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => handleOpenStory(item)}
        >
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.domainText}>{domain}</Text>
          <View style={styles.metaRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>▲ {points} pts</Text>
            </View>
            <Text style={styles.metaText}>by {author}</Text>
            <Text style={styles.metaText}>💬 {commentsCount}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleOpenStory]
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#ff6600" />
        <Text style={styles.footerText}>Loading more stories...</Text>
      </View>
    );
  }, [loadingMore]);

  if (initialLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#ff6600" />
        <Text style={styles.loadingText}>Fetching Top Stories...</Text>
      </View>
    );
  }

  if (error && stories.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadInitialStories}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={stories}
        keyExtractor={(item: HNStory) => item.id.toString()}
        renderItem={renderStoryCard}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#ff6600']}
            tintColor="#ff6600"
          />
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !initialLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No stories found.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadInitialStories}>
                <Text style={styles.retryButtonText}>Reload</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  container: {
    flex: 1,
    backgroundColor: '#f4f5f7',
  },
  listContent: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f4f5f7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#495057',
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d63031',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#636e72',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#ff6600',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 22,
    marginBottom: 6,
  },
  domainText: {
    fontSize: 12,
    color: '#ff6600',
    fontWeight: '600',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  badge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  badgeText: {
    fontSize: 12,
    color: '#ea580c',
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
  },
});
