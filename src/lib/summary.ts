// Generate Chinese summary for a Reddit post based on title, comments and alert info

// Topic keyword mapping (English -> Chinese)
const TOPIC_MAP: Record<string, string> = {
  // TV models
  'u8n': 'U8N系列', 'u7n': 'U7N系列', 'u6n': 'U6N系列', 'u8': 'U8系列', 'u7': 'U7系列', 'u6': 'U6系列',
  'oled': 'OLED电视', 'qled': 'QLED电视', 'miniled': 'Mini LED电视', '4k': '4K电视',
  '85 inch': '85英寸', '75 inch': '75英寸', '65 inch': '65英寸', '55 inch': '55英寸',
  'hisense': '海信', 'samsung': '三星', 'lg': 'LG', 'tcl': 'TCL', 'sony': '索尼',
  // Topics
  'gaming': '游戏体验', 'hdr': 'HDR效果', 'dolby vision': '杜比视界', 'dolby atmos': '杜比全景声',
  'soundbar': '回音壁/音响', 'sound': '音质', 'picture': '画质', 'motion': '运动补偿',
  'input lag': '输入延迟', 'refresh rate': '刷新率', '120hz': '120Hz高刷', '144hz': '144Hz高刷',
  'black friday': '黑五促销', 'deal': '优惠信息', 'price': '价格', 'sale': '促销',
  'review': '评测', 'comparison': '对比', 'vs': '对比', 'recommend': '推荐',
  'warranty': '保修', 'return': '退货', 'customer service': '客服',
  'setup': '安装设置', 'calibration': '校准', 'firmware': '固件更新',
  'ces': 'CES展会', 'world cup': '世界杯', 'sports': '体育赛事', 'soccer': '足球',
  'fire tv': 'Fire TV系统', 'roku': 'Roku系统', 'google tv': 'Google TV系统',
  'costco': 'Costco渠道', 'bestbuy': 'Best Buy渠道', 'walmart': 'Walmart渠道',
  // Issues
  'broken': '故障', 'defective': '缺陷', 'issue': '问题', 'problem': '问题',
  'banding': '色带问题', 'blooming': '光晕问题', 'dse': '屏幕不均匀',
};

const SUBREDDIT_MAP: Record<string, string> = {
  '4ktv': '4K电视', 'hometheater': '家庭影院', 'hisense': '海信专区',
  'bestbuy': 'BestBuy', 'costco': 'Costco', 'walmart': 'Walmart',
  'soundbars': '回音壁', 'audio': '音响', 'gaming': '游戏',
  'tcltvs': 'TCL电视', 'consoles': '主机游戏', 'playstation': 'PlayStation',
  'ces': 'CES展会', 'gamingsetups': '游戏装备',
};

function extractTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const topics: string[] = [];
  const seen = new Set<string>();

  for (const [keyword, label] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(keyword) && !seen.has(label)) {
      topics.push(label);
      seen.add(label);
    }
  }

  return topics.slice(0, 5);
}

function getSubredditLabel(subreddit: string): string {
  return SUBREDDIT_MAP[subreddit.toLowerCase()] || `r/${subreddit}`;
}

// Alert reason descriptions in Chinese
const ALERT_REASON_DESC: Record<string, string> = {
  brand_attack: '存在品牌攻击言论',
  product_hate: '存在产品差评',
  call_to_action_negative: '存在号召抵制言论',
  competitor_push: '存在推荐竞品言论',
  negative_sentiment: '存在负面情绪评论',
};

export function generatePostSummary(post: {
  title: string;
  subreddit: string;
  alertLevel: string;
  alertReasons: string[];
  commentCount: number;
  lastScanned: string | null;
  score?: number;
}): string {
  const parts: string[] = [];

  // Source
  parts.push(`来源: ${getSubredditLabel(post.subreddit)}`);

  // Topics from title
  const topics = extractTopics(post.title);
  if (topics.length > 0) {
    parts.push(`话题: ${topics.join('、')}`);
  }

  // Scan status
  if (!post.lastScanned) {
    parts.push('状态: 待扫描');
  } else {
    // Alert info
    if (post.alertReasons.length > 0) {
      const reasons = post.alertReasons.map(r => ALERT_REASON_DESC[r] || r).join('；');
      parts.push(`风险: ${reasons}`);
    } else {
      parts.push('评论风向: 正常');
    }

    // Comment count
    if (post.commentCount > 0) {
      parts.push(`${post.commentCount}条评论`);
    }
  }

  return parts.join(' | ');
}

// Count all comments including nested replies
function countAllComments(comments: { replies?: any[] }[]): number {
  let count = 0;
  for (const c of comments) {
    count++;
    if (c.replies && Array.isArray(c.replies)) {
      count += countAllComments(c.replies);
    }
  }
  return count;
}

// Flatten all comments including nested replies for sentiment counting
function flattenComments(comments: { body: string; score: number; isFlagged: boolean; replies?: any[] }[]): { body: string; score: number; isFlagged: boolean }[] {
  const result: { body: string; score: number; isFlagged: boolean }[] = [];
  for (const c of comments) {
    result.push({ body: c.body, score: c.score, isFlagged: c.isFlagged });
    if (c.replies && Array.isArray(c.replies)) {
      result.push(...flattenComments(c.replies));
    }
  }
  return result;
}

// Generate a more detailed summary from post title + top comments
export function generateDetailedSummary(
  title: string,
  subreddit: string,
  comments: { body: string; score: number; isFlagged: boolean; replies?: any[] }[]
): string {
  const parts: string[] = [];

  // Platform
  parts.push(`${getSubredditLabel(subreddit)}讨论`);

  // Topics
  const allText = title + ' ' + comments.slice(0, 5).map(c => c.body).join(' ');
  const topics = extractTopics(allText);
  if (topics.length > 0) {
    parts.push(topics.join('、'));
  }

  // Sentiment overview - count ALL comments including replies
  const allComments = flattenComments(comments);
  const flagged = allComments.filter(c => c.isFlagged).length;
  const total = allComments.length;
  if (total > 0) {
    if (flagged === 0) {
      parts.push('评论整体正面/中性');
    } else if (flagged / total > 0.3) {
      parts.push(`评论区${flagged}条负面(占${Math.round(flagged/total*100)}%)`);
    } else {
      parts.push(`少量负面评论(${flagged}/${total})`);
    }
  }

  return parts.join(' · ');
}
