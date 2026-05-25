// Mock data for demo/development
import { RedditPost, RedditComment, ScanResult, DailyScanReport } from './types';

export const mockPosts: RedditPost[] = [
  {
    id: 'post_1',
    redditUrl: 'https://www.reddit.com/r/4kTV/s/zSirDzGGlD',
    title: 'Hisense U8N - Honest review after 3 months',
    subreddit: '4kTV',
    author: 'TVReviewer2024',
    score: 156,
    commentCount: 89,
    createdAt: '2026-05-15T10:30:00Z',
    lastScanned: '2026-05-21T09:00:00Z',
    alertLevel: 'high',
    alertReasons: ['product_hate', 'negative_sentiment', 'competitor_push'],
  },
  {
    id: 'post_2',
    redditUrl: 'https://www.reddit.com/r/4kTV/s/abc123def',
    title: 'Hisense U7N vs Samsung Q80D - Comparison',
    subreddit: '4kTV',
    author: 'CompareTech',
    score: 243,
    commentCount: 156,
    createdAt: '2026-05-18T14:20:00Z',
    lastScanned: '2026-05-21T09:00:00Z',
    alertLevel: 'critical',
    alertReasons: ['brand_attack', 'call_to_action_negative', 'competitor_push'],
  },
  {
    id: 'post_3',
    redditUrl: 'https://www.reddit.com/r/4kTV/s/xyz789ghi',
    title: 'Just got my Hisense E7K Pro, AMA!',
    subreddit: '4kTV',
    author: 'NewTVOwner',
    score: 78,
    commentCount: 42,
    createdAt: '2026-05-20T08:15:00Z',
    lastScanned: '2026-05-21T09:00:00Z',
    alertLevel: 'medium',
    alertReasons: ['product_hate'],
  },
  {
    id: 'post_4',
    redditUrl: 'https://www.reddit.com/r/hometheater/s/def456jkl',
    title: 'Best budget 65" TV for 2026?',
    subreddit: 'hometheater',
    author: 'BudgetAV',
    score: 312,
    commentCount: 203,
    createdAt: '2026-05-19T16:45:00Z',
    lastScanned: '2026-05-21T09:00:00Z',
    alertLevel: 'low',
    alertReasons: ['negative_sentiment'],
  },
  {
    id: 'post_5',
    redditUrl: 'https://www.reddit.com/r/4kTV/s/mno789pqr',
    title: 'Hisense warranty experience - positive',
    subreddit: '4kTV',
    author: 'HappyCustomer',
    score: 45,
    commentCount: 18,
    createdAt: '2026-05-17T11:00:00Z',
    lastScanned: '2026-05-21T09:00:00Z',
    alertLevel: 'safe',
    alertReasons: [],
  },
  {
    id: 'post_6',
    redditUrl: 'https://www.reddit.com/r/4kTV/s/stu012vwx',
    title: 'Hisense U8N firmware update broke HDR',
    subreddit: '4kTV',
    author: 'HDRfan',
    score: 89,
    commentCount: 67,
    createdAt: '2026-05-16T09:30:00Z',
    lastScanned: '2026-05-21T09:00:00Z',
    alertLevel: 'high',
    alertReasons: ['product_hate', 'negative_sentiment', 'call_to_action_negative'],
  },
  {
    id: 'post_7',
    redditUrl: 'https://www.reddit.com/r/hometheater/s/yza345bcd',
    title: 'Setting up Hisense with Apple TV - tips',
    subreddit: 'hometheater',
    author: 'AppleTVuser',
    score: 23,
    commentCount: 8,
    createdAt: '2026-05-20T15:00:00Z',
    lastScanned: '2026-05-21T09:00:00Z',
    alertLevel: 'safe',
    alertReasons: [],
  },
  {
    id: 'post_8',
    redditUrl: 'https://www.reddit.com/r/4kTV/s/efg678hij',
    title: 'Avoid Hisense - my terrible experience',
    subreddit: '4kTV',
    author: 'UnhappyBuyer',
    score: 445,
    commentCount: 234,
    createdAt: '2026-05-14T13:20:00Z',
    lastScanned: '2026-05-21T09:00:00Z',
    alertLevel: 'critical',
    alertReasons: ['brand_attack', 'product_hate', 'call_to_action_negative', 'competitor_push'],
  },
];

export const mockComments: Record<string, RedditComment[]> = {
  post_1: [
    {
      id: 'c1_1', postId: 'post_1', author: 'DisappointedUser', body: 'This TV is absolute garbage. Worst purchase I ever made. The colors are washed out and the motion handling is terrible. Returning it tomorrow.', score: 34, createdAt: '2026-05-16T12:00:00Z', sentimentScore: -0.8, isFlagged: true, flagReasons: ['product_hate', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/1',
    },
    {
      id: 'c1_2', postId: 'post_1', author: 'SamsungFan99', body: 'Just get a Samsung instead. Seriously, any Samsung model in this price range will give you a much better experience. Hisense is not worth it.', score: 28, createdAt: '2026-05-16T14:30:00Z', sentimentScore: -0.6, isFlagged: true, flagReasons: ['competitor_push', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/2',
    },
    {
      id: 'c1_3', postId: 'post_1', author: 'NeutralViewer', body: 'I think it depends on what you\'re looking for. For the price, the U8N has decent picture quality. Not the best, but not terrible either.', score: 12, createdAt: '2026-05-16T16:00:00Z', sentimentScore: 0.1, isFlagged: false, flagReasons: [], permalink: 'https://reddit.com/r/4kTV/comments/3',
    },
    {
      id: 'c1_4', postId: 'post_1', author: 'AngryCustomer', body: 'Do not buy this TV. It\'s a scam. They advertise 144Hz but it\'s fake. Boycott Hisense until they fix their false advertising.', score: 56, createdAt: '2026-05-17T09:15:00Z', sentimentScore: -0.9, isFlagged: true, flagReasons: ['brand_attack', 'call_to_action_negative'], permalink: 'https://reddit.com/r/4kTV/comments/4',
    },
    {
      id: 'c1_5', postId: 'post_1', author: 'TechEnthusiast', body: 'The local dimming on this TV is actually pretty good for the price point. Sure, it\'s not OLED level, but you can\'t expect that at this price.', score: 8, createdAt: '2026-05-17T11:30:00Z', sentimentScore: 0.3, isFlagged: false, flagReasons: [], permalink: 'https://reddit.com/r/4kTV/comments/5',
    },
    {
      id: 'c1_6', postId: 'post_1', author: 'LGFanboy', body: 'Switch to LG. The C4 is only slightly more expensive and it\'s miles ahead. Seriously, avoid Hisense at all costs.', score: 22, createdAt: '2026-05-18T10:00:00Z', sentimentScore: -0.7, isFlagged: true, flagReasons: ['competitor_push', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/6',
    },
    {
      id: 'c1_7', postId: 'post_1', author: 'SatisfiedUser', body: 'I\'ve had mine for 2 months and I\'m happy with it. Great for gaming with low input lag. No issues so far.', score: 5, createdAt: '2026-05-19T08:45:00Z', sentimentScore: 0.6, isFlagged: false, flagReasons: [], permalink: 'https://reddit.com/r/4kTV/comments/7',
    },
    {
      id: 'c1_8', postId: 'post_1', author: 'FrustratedDude', body: 'Worst brand ever. Their customer service is a joke. Filed a complaint and they just ghosted me. Complete waste of money. Never buying Hisense again.', score: 41, createdAt: '2026-05-20T14:20:00Z', sentimentScore: -0.95, isFlagged: true, flagReasons: ['brand_attack', 'negative_sentiment', 'product_hate'], permalink: 'https://reddit.com/r/4kTV/comments/8',
    },
  ],
  post_2: [
    {
      id: 'c2_1', postId: 'post_2', author: 'AVExpert', body: 'Samsung wins hands down. Better processing, better upscaling, better everything. Don\'t waste your money on Hisense.', score: 89, createdAt: '2026-05-19T08:00:00Z', sentimentScore: -0.7, isFlagged: true, flagReasons: ['competitor_push', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/9',
    },
    {
      id: 'c2_2', postId: 'post_2', author: 'ReviewerPro', body: 'The Hisense is overpriced for what you get. Samsung Q80D is clearly the better choice. Stay away from Hisense - they use cheap panels that fail after a year.', score: 67, createdAt: '2026-05-19T10:30:00Z', sentimentScore: -0.85, isFlagged: true, flagReasons: ['competitor_push', 'brand_attack', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/10',
    },
    {
      id: 'c2_3', postId: 'post_2', author: 'BalancedView', body: 'Both TVs have their pros and cons. Hisense has better value for money, Samsung has better processing. Depends on your priorities.', score: 34, createdAt: '2026-05-19T12:00:00Z', sentimentScore: 0.0, isFlagged: false, flagReasons: [], permalink: 'https://reddit.com/r/4kTV/comments/11',
    },
    {
      id: 'c2_4', postId: 'post_2', author: 'BoycottHisense', body: 'Boycott Hisense! They\'re a fraudulent company that sells defective products. Class action lawsuit when? Don\'t buy their trash.', score: 123, createdAt: '2026-05-19T14:00:00Z', sentimentScore: -1.0, isFlagged: true, flagReasons: ['call_to_action_negative', 'brand_attack'], permalink: 'https://reddit.com/r/4kTV/comments/12',
    },
    {
      id: 'c2_5', postId: 'post_2', author: 'HisenseOwner', body: 'I actually like my Hisense. No problems at all. People are overreacting.', score: 15, createdAt: '2026-05-19T16:30:00Z', sentimentScore: 0.4, isFlagged: false, flagReasons: [], permalink: 'https://reddit.com/r/4kTV/comments/13',
    },
    {
      id: 'c2_6', postId: 'post_2', author: 'RegretBuyer', body: 'I regret buying Hisense. Complete piece of crap. Save yourself the headache and get the Samsung. You\'ve been warned.', score: 78, createdAt: '2026-05-20T09:00:00Z', sentimentScore: -0.9, isFlagged: true, flagReasons: ['product_hate', 'competitor_push', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/14',
    },
  ],
  post_3: [
    {
      id: 'c3_1', postId: 'post_3', author: 'CuriousUser', body: 'How\'s the HDR performance? Considering getting one.', score: 8, createdAt: '2026-05-20T10:00:00Z', sentimentScore: 0.0, isFlagged: false, flagReasons: [], permalink: 'https://reddit.com/r/4kTV/comments/15',
    },
    {
      id: 'c3_2', postId: 'post_3', author: 'PickyViewer', body: 'The HDR is pretty bad honestly. Colors look washed out in Dolby Vision content. Very disappointing.', score: 12, createdAt: '2026-05-20T11:30:00Z', sentimentScore: -0.5, isFlagged: true, flagReasons: ['product_hate'], permalink: 'https://reddit.com/r/4kTV/comments/16',
    },
    {
      id: 'c3_3', postId: 'post_3', author: 'E7KProUser', body: 'I have the same TV, it\'s decent for the price. Not amazing but not bad.', score: 6, createdAt: '2026-05-20T13:00:00Z', sentimentScore: 0.1, isFlagged: false, flagReasons: [], permalink: 'https://reddit.com/r/4kTV/comments/17',
    },
  ],
  post_8: [
    {
      id: 'c8_1', postId: 'post_8', author: 'Victim1', body: 'Same here. Total garbage company. They refused to honor the warranty. Filing a complaint with BBB. Do not buy from Hisense!', score: 156, createdAt: '2026-05-15T08:00:00Z', sentimentScore: -1.0, isFlagged: true, flagReasons: ['brand_attack', 'call_to_action_negative'], permalink: 'https://reddit.com/r/4kTV/comments/20',
    },
    {
      id: 'c8_2', postId: 'post_8', author: 'SwitchAway', body: 'I switched to Sony and couldn\'t be happier. Hisense is the worst TV brand I\'ve ever dealt with. Avoid at all costs.', score: 98, createdAt: '2026-05-15T10:00:00Z', sentimentScore: -0.95, isFlagged: true, flagReasons: ['competitor_push', 'brand_attack', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/21',
    },
    {
      id: 'c8_3', postId: 'post_8', author: 'SpreadTheWord', body: 'Everyone needs to know about this. Share this post! Hisense is a scam operation. Boycott them!', score: 134, createdAt: '2026-05-15T12:00:00Z', sentimentScore: -1.0, isFlagged: true, flagReasons: ['call_to_action_negative', 'brand_attack'], permalink: 'https://reddit.com/r/4kTV/comments/22',
    },
    {
      id: 'c8_4', postId: 'post_8', author: 'ClassActionNow', body: 'We should start a class action lawsuit. This is fraud. Anyone know a good lawyer?', score: 89, createdAt: '2026-05-15T14:00:00Z', sentimentScore: -1.0, isFlagged: true, flagReasons: ['call_to_action_negative', 'brand_attack'], permalink: 'https://reddit.com/r/4kTV/comments/23',
    },
    {
      id: 'c8_5', postId: 'post_8', author: 'Defender', body: 'I think you just got a lemon. My Hisense has been working perfectly for over a year.', score: 23, createdAt: '2026-05-16T09:00:00Z', sentimentScore: 0.5, isFlagged: false, flagReasons: [], permalink: 'https://reddit.com/r/4kTV/comments/24',
    },
    {
      id: 'c8_6', postId: 'post_8', author: 'NeverAgain', body: 'Never buying Hisense again. Overpriced garbage. Their products are defective and they don\'t care about customers. Worst brand ever.', score: 167, createdAt: '2026-05-16T14:00:00Z', sentimentScore: -0.95, isFlagged: true, flagReasons: ['brand_attack', 'product_hate', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/25',
    },
    {
      id: 'c8_7', postId: 'post_8', author: 'ReturnPolicy', body: 'Return it while you can. This TV is not worth keeping. Complete waste of money.', score: 45, createdAt: '2026-05-17T08:00:00Z', sentimentScore: -0.7, isFlagged: true, flagReasons: ['product_hate', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/26',
    },
    {
      id: 'c8_8', postId: 'post_8', author: 'SamsungLover', body: 'Get a Samsung instead. I replaced my Hisense with a Samsung QN90C and the difference is night and day. Don\'t waste your time with Hisense.', score: 56, createdAt: '2026-05-18T11:00:00Z', sentimentScore: -0.8, isFlagged: true, flagReasons: ['competitor_push', 'negative_sentiment'], permalink: 'https://reddit.com/r/4kTV/comments/27',
    },
  ],
};

export const mockScanResults: ScanResult[] = [
  {
    postId: 'post_1', scanTime: '2026-05-21T09:00:00Z', totalComments: 8, flaggedComments: 4,
    alertLevel: 'high', sentimentSummary: { positive: 2, neutral: 1, negative: 5 },
    topFlaggedComments: [],
  },
  {
    postId: 'post_2', scanTime: '2026-05-21T09:00:00Z', totalComments: 6, flaggedComments: 4,
    alertLevel: 'critical', sentimentSummary: { positive: 1, neutral: 1, negative: 4 },
    topFlaggedComments: [],
  },
  {
    postId: 'post_8', scanTime: '2026-05-21T09:00:00Z', totalComments: 8, flaggedComments: 7,
    alertLevel: 'critical', sentimentSummary: { positive: 1, neutral: 0, negative: 7 },
    topFlaggedComments: [],
  },
];

export const mockDailyReports: DailyScanReport[] = [
  {
    date: '2026-05-15', totalPosts: 3, totalComments: 45, flaggedComments: 12, criticalAlerts: 1, highAlerts: 1, mediumAlerts: 1, safePosts: 0,
    sentimentTrend: [{ date: '2026-05-15', positive: 15, neutral: 18, negative: 12 }],
  },
  {
    date: '2026-05-16', totalPosts: 4, totalComments: 67, flaggedComments: 18, criticalAlerts: 1, highAlerts: 1, mediumAlerts: 1, safePosts: 1,
    sentimentTrend: [{ date: '2026-05-16', positive: 22, neutral: 27, negative: 18 }],
  },
  {
    date: '2026-05-17', totalPosts: 5, totalComments: 89, flaggedComments: 23, criticalAlerts: 1, highAlerts: 2, mediumAlerts: 1, safePosts: 1,
    sentimentTrend: [{ date: '2026-05-17', positive: 28, neutral: 38, negative: 23 }],
  },
  {
    date: '2026-05-18', totalPosts: 6, totalComments: 112, flaggedComments: 31, criticalAlerts: 2, highAlerts: 2, mediumAlerts: 1, safePosts: 1,
    sentimentTrend: [{ date: '2026-05-18', positive: 35, neutral: 46, negative: 31 }],
  },
  {
    date: '2026-05-19', totalPosts: 7, totalComments: 145, flaggedComments: 38, criticalAlerts: 2, highAlerts: 2, mediumAlerts: 2, safePosts: 1,
    sentimentTrend: [{ date: '2026-05-19', positive: 42, neutral: 65, negative: 38 }],
  },
  {
    date: '2026-05-20', totalPosts: 7, totalComments: 178, flaggedComments: 45, criticalAlerts: 2, highAlerts: 3, mediumAlerts: 1, safePosts: 1,
    sentimentTrend: [{ date: '2026-05-20', positive: 55, neutral: 78, negative: 45 }],
  },
  {
    date: '2026-05-21', totalPosts: 8, totalComments: 213, flaggedComments: 52, criticalAlerts: 2, highAlerts: 2, mediumAlerts: 1, safePosts: 3,
    sentimentTrend: [{ date: '2026-05-21', positive: 68, neutral: 93, negative: 52 }],
  },
];
