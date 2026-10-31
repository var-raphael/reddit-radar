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

// Anything that can list recent posts of a subreddit. Swappable:
// Arctic Shift today, official OAuth API or a bundled snapshot tomorrow.
export interface PostSource {
  name: string;
  fetchSubreddit(subreddit: string, sinceUtc: number): Promise<NormalizedPost[]>;
}
