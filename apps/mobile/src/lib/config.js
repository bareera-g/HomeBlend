import { Platform } from 'react-native';
import Constants from 'expo-constants';

// HomeBlend Mobile — API base URL
// Automatically selects the right host per platform:
//   - Android emulator: 10.0.2.2 (special alias for host loopback)
//   - iOS simulator: localhost
//   - Physical device: extracts LAN IP from Expo dev server hostUri

const SERVER_PORT = 3000;

const getApiUrl = () => {
  // Physical device: use the debuggerHost / hostUri provided by Expo
  // (e.g. "192.168.1.42:8081" — we take just the IP)
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const lanIp = debuggerHost.split(':')[0];
    // If it's a real LAN IP (not localhost), use it
    if (lanIp && lanIp !== 'localhost' && lanIp !== '127.0.0.1') {
      return `http://${lanIp}:${SERVER_PORT}`;
    }
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${SERVER_PORT}`;
  }

  // iOS simulator, Expo web
  return `http://localhost:${SERVER_PORT}`;
};

const API_URL = getApiUrl();

export default API_URL;
