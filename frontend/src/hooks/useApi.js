import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

/**
 * Generic data-fetching hook with 300ms loading delay to avoid flicker.
 *
 * @param {string|null} url - API URL to fetch; null/undefined skips the fetch
 * @param {object} options - axios config options
 * @returns {{ data, loading, error, refetch }}
 */
export function useApi(url, options = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)
  const timerRef = useRef(null)

  const fetchData = async (fetchUrl) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    // Only show loading spinner after 300ms
    timerRef.current = setTimeout(() => setLoading(true), 300)

    setError(null)

    try {
      const res = await axios({
        url: fetchUrl,
        signal: abortRef.current.signal,
        ...options,
      })
      clearTimeout(timerRef.current)
      setLoading(false)
      setData(res.data)
    } catch (err) {
      clearTimeout(timerRef.current)
      setLoading(false)
      if (!axios.isCancel(err)) {
        setError(err?.response?.data?.detail || err.message || 'Request failed')
      }
    }
  }

  useEffect(() => {
    if (!url) return
    fetchData(url)
    return () => {
      clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = () => url && fetchData(url)

  return { data, loading, error, refetch }
}
