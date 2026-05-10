// lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export interface SessionUser {
  access_token: string;
  token_type: string;
  user_id: number;
  full_name: string;
  role: string;
  is_active_monitoring: boolean;
}

const buildUrl = (endpoint: string): string => {
  let cleanPath = endpoint.replace(/^\/+/, '');
  if (!cleanPath.startsWith('api/')) {
    cleanPath = `api/${cleanPath}`;
  }
  return `${BASE}/${cleanPath}`;
};

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = buildUrl(endpoint);
  const session = getSession();

  const isAuthRoute = endpoint.includes('auth') || endpoint.includes('login');
 
  if (!session?.access_token && !isAuthRoute) {
    console.warn('⚠️ No token found. Skipping protected request to:', url);
    throw new Error('UNAUTHORIZED_NO_TOKEN');
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  // Safely merge custom headers
  if (options.headers) {
    const customHeaders = new Headers(options.headers as HeadersInit);
    customHeaders.forEach((value, key) => headers.set(key, value));
  }

  // Set Authorization if we have a token
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const config: RequestInit = {
    ...options,                                          
    method: options.method || 'GET',                     
    headers: Object.fromEntries(headers.entries()),      
    body: options.body,                                 
  };

  try {
    // 2. Pass that config into a SINGLE fetch call
    const response = await fetch(url, config);

    // 3. HANDLE EXPIRED TOKENS (401)
    if (response.status === 401 && !isAuthRoute) {
      console.error('🛑 Session invalid. Clearing data.');
      clearSession();
      if (typeof window !== 'undefined') {
        window.location.replace('/login?error=expired');
      }
      throw new Error('SESSION_EXPIRED');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API Error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}

// Session helpers stay the same
export function saveSession(data: SessionUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ss_user', JSON.stringify(data));
}

export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('ss_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('ss_user');
}