const axios = require('axios');
const cheerio = require('cheerio');

export default async function handler(req, res) {
    const { url, type } = req.query;
    if (!url) return res.status(400).json({ error: 'URL eksik' });

    try {
        const targetUrl = new URL(url);
        const baseUrl = `${targetUrl.protocol}//${targetUrl.hostname}`;

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Referer': baseUrl,
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);

        // --- VİDEO MODU ---
        if (type === 'video') {
            // 1. Standart iframe
            let videoLink = $('iframe').attr('src') || $('iframe').attr('data-src');

            // 2. Eğer iframe yoksa player seçeneklerine bak (Dizipal klasiği)
            if (!videoLink) {
                videoLink = $('.dooplay_player_option').first().attr('data-url') || 
                            $('li[data-n="0"]').attr('data-url') ||
                            $('.play-video iframe').attr('src');
            }

            if (videoLink) {
                if (videoLink.startsWith('//')) videoLink = 'https:' + videoLink;
                // Bazı linkler base64 olabilir veya parametre içerebilir, temizle
                return res.status(200).json({ videoUrl: videoLink });
            }
            return res.status(404).json({ error: 'Video bulunamadı' });
        }

        // --- DETAY MODU ---
        const title = $('h1').text().trim() || $('.data h1').text().trim();
        let cover = $('.poster img').attr('src') || $('.cover img').attr('src') || $('meta[property="og:image"]').attr('content');
        if (cover && cover.startsWith('/')) cover = baseUrl + cover;

        const episodes = [];

        // Dizipal'ın kullandığı 3 farklı bölüm listesi yapısını tara
        const selectors = [
            'ul.episodios li',     // Yapı 1
            '.se-c .ep-item',      // Yapı 2
            '.bolumler-listesi li', // Yapı 3
            '#episodios a'          // Yapı 4
        ];

        selectors.forEach(selector => {
            $(selector).each((i, el) => {
                const linkWrap = $(el).is('a') ? $(el) : $(el).find('a');
                const href = linkWrap.attr('href');
                if (!href) return;

                const fullUrl = href.startsWith('http') ? href : baseUrl + (href.startsWith('/') ? '' : '/') + href;
                
                // Metinden sezon/bölüm ayıklama
                const text = $(el).text().trim();
                const sMatch = href.match(/sezon-(\d+)/i) || text.match(/(\d+)\.?\s*Sezon/i) || [0, "1"];
                const bMatch = href.match(/bolum-(\d+)/i) || text.match(/(\d+)\.?\s*Bölüm/i) || [0, i + 1];

                episodes.push({
                    url: fullUrl,
                    season: sMatch[1] || "1",
                    episode: bMatch[1] || i + 1,
                    label: text.split('\n')[0].trim() || `Bölüm ${bMatch[1]}`
                });
            });
        });

        // Mükerrerleri sil ve sırala
        const uniqueEpisodes = episodes.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);

        return res.status(200).json({ 
            title, 
            cover, 
            episodes: uniqueEpisodes.sort((a,b) => a.season - b.season || a.episode - b.episode)
        });

    } catch (err) {
        return res.status(500).json({ error: 'Sistem hatası', msg: err.message });
    }
}
