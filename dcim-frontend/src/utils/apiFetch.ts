export async function apiFetch<T = unknown>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    const token = localStorage.getItem("dcim_token");
    if (token && url.startsWith("/api/")) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as any).message || "Erreur API");
    }

    return response.json() as Promise<T>;
}
