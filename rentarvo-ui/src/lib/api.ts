const API_BASE = '/api/v1';

// Entity store is imported lazily to avoid circular dependency
let getEntityId: (() => string | null) | null = null;
export function setEntityIdGetter(fn: () => string | null) {
  getEntityId = fn;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('rentarvo_token', token);
    } else {
      localStorage.removeItem('rentarvo_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('rentarvo_token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Inject entity scope header for write requests
    if (getEntityId) {
      const eid = getEntityId();
      if (eid) {
        headers['X-Entity-Id'] = eid;
      }
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError(0, 'Request timed out. Server may be unreachable.');
      }
      throw new ApiError(0, 'Server is unreachable. Please try again.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 204) return undefined as T;

    let data: any;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else {
      const text = await res.text();
      data = text ? { error: { message: text } } : null;
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new ApiError(401, data?.error?.message || 'Invalid email or password', data?.error);
      }
      if (res.status >= 500) {
        throw new ApiError(res.status, data?.error?.message || 'Server error. Please try again.', data?.error);
      }
      throw new ApiError(res.status, data?.error?.message || 'Request failed', data?.error);
    }

    return data as T;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete(path: string) {
    return this.request(path, { method: 'DELETE' });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public error?: { code: string; message: string; details?: unknown },
  ) {
    super(message);
  }
}

export const api = new ApiClient();
