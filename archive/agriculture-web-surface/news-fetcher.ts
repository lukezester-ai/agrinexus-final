import Parser from 'rss-parser';

const parser = new Parser();

export type AgriNewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
};

export async function fetchAgriNews(): Promise<AgriNewsItem[]> {
  try {
    // Използваме Google News RSS за изключителна надеждност и винаги актуални новини
    // Търсим специфични термини за пазарите на зърно: пшеница, царевица, соя, цени
    const feedUrl = 'https://news.google.com/rss/search?q=wheat+corn+soybeans+market+prices+export+crop&hl=en-US&gl=US&ceid=US:en';
    
    // В Next.js сървърни компоненти fetch работи идеално за външни API-та
    const feed = await parser.parseURL(feedUrl);
    
    if (!feed.items || feed.items.length === 0) {
      return [];
    }

    // Взимаме само първите 10 новини, за да не претоварваме контекста на AI-а
    return feed.items.slice(0, 10).map((item) => {
      // Опитваме да извлечем източника от заглавието (Google News слага източника накрая след ' - ')
      let source = 'News';
      let cleanTitle = item.title || '';
      
      if (cleanTitle.includes(' - ')) {
        const parts = cleanTitle.split(' - ');
        source = parts.pop() || 'News';
        cleanTitle = parts.join(' - ');
      }

      return {
        title: cleanTitle,
        link: item.link || '',
        pubDate: item.pubDate || new Date().toISOString(),
        source: source
      };
    });
  } catch (error) {
    console.error('[news-fetcher] Error fetching RSS:', error);
    return [];
  }
}
