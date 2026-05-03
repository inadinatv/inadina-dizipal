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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                'Referer': baseUrl
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);

        // --- VİDEO MODU (Bölüm Sayfası) ---
        if (type === 'video') {
            let iframeSrc = $('iframe').attr('src') || $('iframe').attr('data-src') || $('iframe[src*="video"]').attr('src');
            
            if (!iframeSrc) {
                // Alternatif: Sayfa içindeki scriptlerde iframe arayalım
                const scripts = $('script').text();
                const match = scripts.match(/src="([^"]+)"/);
                if (match && match[1].includes('player')) iframeSrc = match[1];
            }

            if (iframeSrc && iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
            return res.status(200).json({ videoUrl: iframeSrc });
        }

        // --- DETAY MODU (Dizi Ana Sayfası) ---
        const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim();
        let cover = $('meta[property="og:image"]').attr('content') || $('.poster img').attr('src') || $('.cover').css('background-image')?.replace(/url\(["']?|["']?\)/g, '');

        // Resim URL'sini tam hale getir
        if (cover && cover.startsWith('/')) cover = baseUrl + cover;

        const episodes = [];
        
        // Sitedeki tüm linkleri tara
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();

            if (href) {
                const isEpisode = href.includes('bolum') || href.includes('sezon') || /s\d+e\d+/i.test(href);
                
                if (isEpisode && text.length < 50) { // Çok uzun metinler bölüm adı olamaz
                    const fullUrl = href.startsWith('http') ? href : (href.startsWith('/') ? baseUrl + href : baseUrl + '/' + href);
                    
                    // Sezon ve Bölüm numarasını metinden veya linkten çıkar
                    const sMatch = href.match(/sezon-(\d+)/i) || text.match(/(\d+)\.?\s*Sezon/i);
                    const bMatch = href.match(/bolum-(\d+)/i) || text.match(/(\d+)\.?\s*Bölüm/i);

                    episodes.push({
                        url: fullUrl,
                        season: sMatch ? sMatch[1] : "1",
                        episode: bMatch ? bMatch[1] : "??",
                        text: text || `Bölüm ${bMatch ? bMatch[1] : i}`
                    });
                }
            }
        });

        // Mükerrer bölümleri temizle (URL'ye göre)
        const uniqueEpisodes = episodes.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);

        return res.status(200).json({ 
            title, 
            cover, 
            episodes: uniqueEpisodes.sort((a,b) => parseInt(a.season) - parseInt(b.season) || parseInt(a.episode) - parseInt(b.episode))
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Hata oluştu', details: err.message });
    }
}
