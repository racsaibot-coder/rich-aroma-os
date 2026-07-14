import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const botDir = join(__dirname, '../robinhood-chain-bot');

// Global in-memory cache to make dashboard loads extremely fast
let cachedTrending = null;
let cachedTrendingTime = 0;

let cachedEthPrice = 1780.00;
let cachedEthPriceTime = 0;

// Pure Node.js HTTPS helper to bypass node-fetch decompression bugs
function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error("Failed to parse JSON response"));
                    }
                } else {
                    reject(new Error(`HTTP status code ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

export default async function handler(req, res) {
    const endpoint = req.query.endpoint || '';
    
    // Enable CORS manually
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const host = req.headers.host || '';
    const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('::1');
    if (!isLocal) {
        return res.status(403).json({ error: 'Access Denied: Private Terminal API' });
    }

    if (endpoint === 'status') {
        const statusPath = join(botDir, 'bot_status.json');
        if (!fs.existsSync(statusPath)) {
            return res.status(200).json({ status: 'offline', error: 'Status file not found' });
        }
        try {
            const stats = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            const nowSec = Date.now() / 1000;
            if (nowSec - stats.last_update > 60) {
                stats.status = 'offline';
            }
            
            // Query current ETH price with 1-minute caching
            const nowMs = Date.now();
            if (nowMs - cachedEthPriceTime > 60000) {
                try {
                    const ethData = await httpsGet("https://api.dexscreener.com/latest/dex/search?q=ETH");
                    if (ethData.pairs && ethData.pairs.length > 0) {
                        const matched = ethData.pairs.find(p => 
                            (p.chainId === 'ethereum' || p.chainId === 'arbitrum') && 
                            (p.baseToken?.symbol === 'ETH' || p.baseToken?.symbol === 'WETH')
                        );
                        if (matched) {
                            cachedEthPrice = parseFloat(matched.priceUsd) || 1780.00;
                            cachedEthPriceTime = nowMs;
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch WETH price:", err);
                }
            }
            stats.eth_price_usd = cachedEthPrice;
            
            return res.status(200).json(stats);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    } 
    
    else if (endpoint === 'positions') {
        const registryPath = join(botDir, 'active_positions.json');
        if (!fs.existsSync(registryPath)) {
            return res.status(200).json({});
        }
        try {
            const positions = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
            return res.status(200).json(positions);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    } 
    
    else if (endpoint === 'buy') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const { tokenAddress } = req.body;
        if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
            return res.status(400).json({ error: 'Invalid Ethereum contract address' });
        }
        
        // Execute manual swap buy on-chain via venv/bin/python3 and log to bot.log
        const command = `venv/bin/python3 execute_buy.py ${tokenAddress} >> bot.log 2>&1`;
        
        exec(command, { cwd: botDir }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Manual swap execution error: ${error}`);
            }
        });
        
        return res.status(200).json({ success: true, message: `Swap triggered for ${tokenAddress}` });
    } 
    
    else if (endpoint === 'sell') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const { tokenAddress } = req.body;
        if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
            return res.status(400).json({ error: 'Invalid Ethereum contract address' });
        }
        
        // Execute manual swap sell on-chain via venv/bin/python3 and log to bot.log
        const command = `venv/bin/python3 execute_sell.py ${tokenAddress} >> bot.log 2>&1`;
        
        exec(command, { cwd: botDir }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Manual sell execution error: ${error}`);
            }
        });
        
        return res.status(200).json({ success: true, message: `Sell triggered for ${tokenAddress}` });
    } 
    
    else if (endpoint === 'track') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const { tokenAddress, entryPrice } = req.body;
        if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
            return res.status(400).json({ error: 'Invalid Ethereum contract address' });
        }
        
        // Execute token tracking registration in the background and log output to bot.log
        const command = `venv/bin/python3 track_token.py ${tokenAddress} ${entryPrice || 0} >> bot.log 2>&1`;
        
        exec(command, { cwd: botDir }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Token tracking registration execution error: ${error}`);
            }
        });
        
        return res.status(200).json({ success: true, message: `Tracking initiated for ${tokenAddress}` });
    }
    
    else if (endpoint === 'deploy') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }
        
        const { name, symbol, supply } = req.body;
        if (!name || !symbol || !supply) {
            return res.status(400).json({ error: 'Missing name, symbol, or supply parameters' });
        }
        
        const cleanName = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').trim();
        const cleanSupply = parseInt(supply);
        
        if (isNaN(cleanSupply) || cleanSupply <= 0) {
            return res.status(400).json({ error: 'Supply must be a positive integer' });
        }
        
        // Execute token contract deployment in the background and log output to bot.log
        const command = `venv/bin/python3 token_deployer_run.py "${cleanName}" "${cleanSymbol}" ${cleanSupply} >> bot.log 2>&1`;
        
        exec(command, { cwd: botDir }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Token deployment execution error: ${error}`);
            }
        });
        
        return res.status(200).json({ success: true, message: `Deployment triggered for ${cleanSymbol}` });
    }
    
    else if (endpoint === 'logs') {
        const logPath = join(botDir, 'bot.log');
        if (!fs.existsSync(logPath)) {
            return res.status(200).json({ logs: 'No logs available.' });
        }
        try {
            const content = fs.readFileSync(logPath, 'utf8');
            const lines = content.split('\n');
            const lastLines = lines.slice(-150).join('\n');
            return res.status(200).json({ logs: lastLines });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    } 
    
    else if (endpoint === 'new') {
        const launchPath = join(botDir, 'new_launches.json');
        if (!fs.existsSync(launchPath)) {
            return res.status(200).json([]);
        }
        try {
            const list = JSON.parse(fs.readFileSync(launchPath, 'utf8'));
            return res.status(200).json(list);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }
    
    else if (endpoint === 'history') {
        const historyPath = join(botDir, 'trade_history.json');
        if (!fs.existsSync(historyPath)) {
            return res.status(200).json([]);
        }
        try {
            const list = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            return res.status(200).json(list);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }
    
    else if (endpoint === 'performance') {
        const historyPath = join(botDir, 'trade_history.json');
        if (!fs.existsSync(historyPath)) {
            const empty = { total: 0, wins: 0, losses: 0, winRate: 0, netReturn: 0 };
            return res.status(200).json({ hour: empty, day: empty, week: empty, month: empty, historic: empty });
        }
        try {
            const list = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            const now = Date.now() / 1000;
            
            const calcStats = (trades) => {
                const total = trades.length;
                const wins = trades.filter(t => t.p_l_pct > 0).length;
                const losses = total - wins;
                const winRate = total > 0 ? (wins / total * 100) : 0;
                let netReturn = 0;
                trades.forEach(t => {
                    const size = parseFloat(t.entry_size_eth || 0.005);
                    const pl = parseFloat(t.p_l_pct || 0);
                    netReturn += size * (pl / 100);
                });
                return { total, wins, losses, winRate, netReturn };
            };
            
            const hourTrades = list.filter(t => now - t.timestamp <= 3600);
            const dayTrades = list.filter(t => now - t.timestamp <= 86400);
            const weekTrades = list.filter(t => now - t.timestamp <= 604800);
            const monthTrades = list.filter(t => now - t.timestamp <= 2592000);
            
            return res.status(200).json({
                hour: calcStats(hourTrades),
                day: calcStats(dayTrades),
                week: calcStats(weekTrades),
                month: calcStats(monthTrades),
                historic: calcStats(list)
            });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }
    
    else if (endpoint === 'trending') {
        const nowMs = Date.now();
        if (nowMs - cachedTrendingTime < 15000 && cachedTrending) {
            return res.status(200).json(cachedTrending);
        }
        
        try {
            const data = await httpsGet("https://api.dexscreener.com/latest/dex/search?q=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73");
            const pairs = data.pairs || [];
            
            // Filter strictly for pairs active on the 'robinhood' chain
            const robinhoodPairs = pairs.filter(p => p.chainId === 'robinhood');
            
            // Sort by 24h volume
            const sorted = robinhoodPairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
            
            // Map top 8 trending pairs
            const results = sorted.slice(0, 8).map(p => ({
                address: p.baseToken?.address,
                name: p.baseToken?.name,
                symbol: p.baseToken?.symbol,
                price: p.priceUsd,
                change: p.priceChange?.h1 || p.priceChange?.h24 || 0,
                volume: p.volume?.h24 || 0,
                liquidity: p.liquidity?.usd || 0,
                imageUrl: p.info?.imageUrl || ''
            }));
            
            cachedTrending = results;
            cachedTrendingTime = nowMs;
            
            return res.status(200).json(results);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }
    else if (endpoint === 'watchlist') {
        const watchlistPath = join(botDir, 'watchlist.json');
        
        if (req.method === 'GET') {
            if (!fs.existsSync(watchlistPath)) {
                return res.status(200).json({});
            }
            try {
                const list = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
                return res.status(200).json(list);
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        } 
        
        else if (req.method === 'POST') {
            const { tokenAddress, symbol, name, targetReclaimPrice, action } = req.body;
            
            // Handle delete action routed via POST
            if (action === 'delete') {
                if (!tokenAddress) {
                    return res.status(400).json({ error: 'Token address required' });
                }
                const cleanAddr = tokenAddress.toLowerCase();
                let watchlist = {};
                if (fs.existsSync(watchlistPath)) {
                    try {
                        watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
                    } catch (e) {}
                }
                if (watchlist[cleanAddr]) {
                    delete watchlist[cleanAddr];
                    try {
                        fs.writeFileSync(watchlistPath, JSON.stringify(watchlist, null, 2));
                        return res.status(200).json({ success: true, message: `Removed ${tokenAddress} from watchlist` });
                    } catch (e) {
                        return res.status(500).json({ error: e.message });
                    }
                } else {
                    return res.status(404).json({ error: 'Token not found on watchlist' });
                }
            }

            if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
                return res.status(400).json({ error: 'Invalid Ethereum contract address' });
            }
            
            const cleanAddr = tokenAddress.toLowerCase();
            let watchlist = {};
            if (fs.existsSync(watchlistPath)) {
                try {
                    watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
                } catch (e) {}
            }
            
            const finalSymbol = (symbol || 'UNKNOWN').toUpperCase();
            const finalName = name || 'Unknown Token';
            const finalPrice = parseFloat(targetReclaimPrice) || 0.0;
            
            watchlist[cleanAddr] = {
                symbol: finalSymbol,
                name: finalName,
                target_reclaim_price: finalPrice,
                last_bottom_price: finalPrice > 0 ? finalPrice : 0.0
            };
            
            try {
                fs.writeFileSync(watchlistPath, JSON.stringify(watchlist, null, 2));
                return res.status(200).json({ success: true, message: `Added ${finalSymbol} to watchlist` });
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        } 
        
        else if (req.method === 'DELETE') {
            const tokenAddress = req.body.tokenAddress || req.query.tokenAddress;
            if (!tokenAddress) {
                return res.status(400).json({ error: 'Token address required' });
            }
            
            const cleanAddr = tokenAddress.toLowerCase();
            let watchlist = {};
            if (fs.existsSync(watchlistPath)) {
                try {
                    watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
                } catch (e) {}
            }
            
            if (watchlist[cleanAddr]) {
                delete watchlist[cleanAddr];
                try {
                    fs.writeFileSync(watchlistPath, JSON.stringify(watchlist, null, 2));
                    return res.status(200).json({ success: true, message: `Removed ${tokenAddress} from watchlist` });
                } catch (e) {
                    return res.status(500).json({ error: e.message });
                }
            } else {
                return res.status(404).json({ error: 'Token not found on watchlist' });
            }
        }
        
        else {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }
    }
    
    else {
        return res.status(404).json({ error: 'Endpoint Not Found' });
    }
}
