const axios = require('axios');
const cheerio = require('cheerio');

export default async function handler(req, res) {
    const { url, type } = req.query;
    if (!url) return res.status(400).json({ error: 'URL eksik' });

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'Referer': 'https://google.com'
            }
        });

        const $ = cheerio.load(response.data);

        if (type === 'video') {
            // Video sayfasından iframe linkini çeker
            const iframe = $('iframe').attr('src') || $('iframe').attr('data-src');
            return res.status(200).json({ videoUrl: iframe });
        }

        // Dizi ana sayfasından bilgileri ve bölümleri çeker
        const title = $('h1').first().text().trim() || $('.name').text().trim();
        const cover = $('.cover').css('background-image')?.replace(/url\(["']?|["']?\)/g, '') || $('.poster img').attr('src');
        
        const episodes = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/sezon-') && href.includes('/bolum-')) {
                const match = href.match(/sezon-(\d+)\/bolum-(\d+)/);
                episodes.push({
                    url: href.startsWith('http') ? href : `https://${new URL(url).hostname}${href}`,
                    season: match ? match[1] : "1",
                    episode: match ? match[2] : "1",
                    text: $(el).text().trim()
                });
            }
        });

        return res.status(200).json({ title, cover, episodes });
    } catch (err) {
        return res.status(500).json({ error: 'Veri çekilemedi', msg: err.message });
    }
}
