export type NormalizedPost = {
  reddit_id: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  url: string;
  score: number;
  created_utc: number;
};

export type FetchResult = {
  posts: NormalizedPost[];
  reachedEnd: boolean;      // false = stopped at the page cap, more is waiting
  lastUtc: number | null;   // newest post actually fetched: the next bookmark
};

// Anything that can list a subreddit's posts since a time, oldest first.
export interface PostSource {
  name: string;
  fetchSubreddit(subreddit: string, sinceUtc: number): Promise<FetchResult>;
}
