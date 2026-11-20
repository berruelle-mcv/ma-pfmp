// Adresse du serveur Immersio (le Raspberry Pi, via le tunnel Cloudflare).
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
export const API = local ? 'http://localhost:3100' : 'https://api.ma-pfmp.fr';
export const VERSION = '1.5.1';
