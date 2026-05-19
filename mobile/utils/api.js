import API_URL from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_HOSTS = [
    API_URL,
    'http://10.0.2.2:8000',
    'http://127.0.0.1:8000',
    'http://localhost:8000',
];

const tryFetch = async (fullUrl, options) => {
    const token = await AsyncStorage.getItem('jwt_token');
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const response = await fetch(fullUrl, {
        headers,
        ...options,
    });
    const text = await response.text();
    if (!response.ok) {
        let message = text;
        try {
            const json = JSON.parse(text || '{}');
            message = json.message || JSON.stringify(json);
        } catch (_error) {
            
        }
        const err = new Error(`${response.status} ${response.statusText}: ${message}`);
        err.http = true;
        err.status = response.status;
        throw err;
    }

    try {
        return text ? JSON.parse(text) : {};
    } catch (err) {
        throw new Error(`Invalid JSON response from ${fullUrl}: ${text.slice(0, 240)}`);
    }
};

export const fetchJson = async (urlOrPath, options = {}) => {
    
    if (typeof urlOrPath === 'string' && /^https?:\/\//i.test(urlOrPath)) {
        return tryFetch(urlOrPath, options);
    }

    
    const tried = [];
    let lastError = null;
    for (const host of DEFAULT_HOSTS) {
        if (!host) continue;
        const full = host.replace(/\/$/, '') + '/' + String(urlOrPath).replace(/^\//, '');
        tried.push(full);
        try {
            return await tryFetch(full, options);
        } catch (err) {
            if (err.http) {
                throw err;
                }
                lastError = err;
                continue;
            }
        }

    // If we get here nothing succeeded — throw a detailed error
    const message = lastError ? lastError.message : 'Unknown network error.';
    throw new Error(`Network request failed. Tried: ${tried.join(', ')}. Last error: ${message}`);
};

export default fetchJson;
