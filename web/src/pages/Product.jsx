import React from 'react'

export default function Product() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-4">Product Features</h1>
      <p className="text-[#A3B3AF] max-w-2xl">
        Calendarify helps you schedule meetings, sync your calendars and coordinate with teams. This page is only a demo and does not implement real functionality.
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Automated scheduling powered by AI</li>
        <li>Calendar sync with Google and Outlook</li>
        <li>Shareable booking links</li>
      </ul>
    </div>
  )
}
