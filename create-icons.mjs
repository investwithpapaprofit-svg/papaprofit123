import fs from 'fs';
import Jimp from 'jimp';

async function createIcons() {
    const icon192 = new Jimp(192, 192, '#0f172a');
    icon192.print(await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE), 20, 80, 'PapaProfit');
    await icon192.writeAsync('public/icon-192x192.png');
    
    const icon512 = new Jimp(512, 512, '#0f172a');
    icon512.print(await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE), 50, 220, 'PapaProfit');
    await icon512.writeAsync('public/icon-512x512.png');
}
createIcons().catch(console.error);
