import { useState, useEffect } from 'react'
import { categorizeMessage } from '../utils/llmHelper'
import { getRecommendedAction } from '../utils/templates'

// Urgency badge colours — now includes Critical
const urgencyStyles = {
  Critical: 'bg-red-600 text-white',
  High:     'bg-red-200 text-red-900',
  Medium:   'bg-yellow-200 text-yellow-900',
  Low:      'bg-green-200 text-green-900',
}

function AnalyzePage() {
  const [message, setMessage] = useState('')
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const exampleMessage = localStorage.getItem('exampleMessage')
    if (exampleMessage) {
      setMessage(exampleMessage)
      localStorage.removeItem('exampleMessage')
    }
  }, [])

  const handleAnalyze = async () => {
    if (!message.trim()) {
      alert('Please enter a message to analyze')
      return
    }

    setIsLoading(true)
    setResults(null)

    try {
      // Single structured LLM call — returns category, urgency, routing_team,
      // reasoning, urgency_reason, routing_reason, suggested_reply, confidence
      const analysis = await categorizeMessage(message)

      // Template-based recommended action uses both category AND urgency (fix #3)
      const recommendedAction = getRecommendedAction(analysis.category, analysis.urgency)

      const analysisResult = {
        message,
        ...analysis,
        recommendedAction,
        timestamp: new Date().toISOString(),
      }

      setResults(analysisResult)

      const history = JSON.parse(localStorage.getItem('triageHistory') || '[]')
      history.push(analysisResult)
      localStorage.setItem('triageHistory', JSON.stringify(history))
    } catch (error) {
      console.error('Error analyzing message:', error)
      alert('Error analyzing message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setMessage('')
    setResults(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analyze Customer Message</h1>
          <p className="text-gray-600 mb-6">
            Paste a customer support message below to automatically categorize, prioritize, and route.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Paste customer message here..."
              className="w-full border border-gray-300 rounded-lg p-3 h-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            <div className="text-sm text-gray-500 mt-1">{message.length} characters</div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className={`flex-1 py-3 rounded-lg font-semibold ${
                isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing with Claude...
                </span>
              ) : (
                'Analyze Message'
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        {results && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Analysis Results</h2>

            {/* Category + Urgency + Routing row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Category</div>
                <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold text-sm">
                  {results.category}
                </span>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Urgency</div>
                <span className={`inline-block px-3 py-1 rounded-full font-semibold text-sm ${urgencyStyles[results.urgency] || urgencyStyles.Medium}`}>
                  {results.urgency}
                </span>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Route To</div>
                <span className="inline-block bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-semibold text-sm">
                  {results.routing_team}
                </span>
              </div>
            </div>

            {/* Confidence */}
            {results.confidence !== undefined && (
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  AI Confidence — {Math.round(results.confidence * 100)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.round(results.confidence * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Suggested Reply */}
            {results.suggested_reply && (
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Suggested Reply Draft</div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-gray-800 whitespace-pre-wrap text-sm">{results.suggested_reply}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(results.suggested_reply)
                      alert('Reply draft copied!')
                    }}
                    className="mt-2 text-xs text-green-700 hover:underline"
                  >
                    Copy reply
                  </button>
                </div>
              </div>
            )}

            {/* Recommended Action */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Recommended Agent Action</div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-gray-800 text-sm">{results.recommendedAction}</p>
              </div>
            </div>

            {/* AI Reasoning */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">AI Reasoning</div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm text-gray-700">
                {results.reasoning && <p><span className="font-semibold">Category:</span> {results.reasoning}</p>}
                {results.urgency_reason && <p><span className="font-semibold">Urgency:</span> {results.urgency_reason}</p>}
                {results.routing_reason && <p><span className="font-semibold">Routing:</span> {results.routing_reason}</p>}
              </div>
            </div>

            {/* Urgency Signals */}
            {results.urgency_signals && (
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Urgency Signals Detected</div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      results.urgency_signals.tone === 'panicked' || results.urgency_signals.tone === 'angry' || results.urgency_signals.tone === 'frustrated'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      Tone: {results.urgency_signals.tone}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      results.urgency_signals.business_impact_mentioned ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      Business impact: {results.urgency_signals.business_impact_mentioned ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {results.urgency_signals.critical_keywords_found?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {results.urgency_signals.critical_keywords_found.map((kw, i) => (
                        <span key={i} className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-mono">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  const text = [
                    `Category: ${results.category}`,
                    `Urgency: ${results.urgency}`,
                    `Route To: ${results.routing_team}`,
                    `\nRecommended Action: ${results.recommendedAction}`,
                    results.suggested_reply ? `\nSuggested Reply:\n${results.suggested_reply}` : '',
                    `\nReasoning: ${results.reasoning}`,
                  ].filter(Boolean).join('\n')
                  navigator.clipboard.writeText(text)
                  alert('Results copied to clipboard!')
                }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-semibold text-sm"
              >
                Copy Full Results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyzePage
