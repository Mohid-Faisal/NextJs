import { useState, useEffect } from "react";
import { debounce } from "lodash";

export function useDebouncedSearch(
  query: string,
  fetchUrl: string,
  delay = 300
) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = debounce(async () => {
      if (query.length < 2) return setResults([]);
      setLoading(true);
      try {
        const res = await fetch(`${fetchUrl}?q=${query}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error(err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delay);

    fetchData();

    return () => {
      fetchData.cancel();
    };
  }, [query, fetchUrl, delay]);

  return { results, loading };
}
