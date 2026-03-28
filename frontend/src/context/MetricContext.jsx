import { createContext, useContext, useState } from 'react'

const MetricContext = createContext(null)

export function MetricProvider({ children }) {
  const [hoveredMetric, setHoveredMetric] = useState(null)

  return (
    <MetricContext.Provider value={{ hoveredMetric, setHoveredMetric }}>
      {children}
    </MetricContext.Provider>
  )
}

export function useMetric() {
  const ctx = useContext(MetricContext)
  if (!ctx) throw new Error('useMetric must be used inside MetricProvider')
  return ctx
}
