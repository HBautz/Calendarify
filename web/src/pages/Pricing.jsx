import React from 'react'

export default function Pricing() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold mb-4">Pricing</h1>
      <p className="text-[#A3B3AF] max-w-2xl">
        This demo does not process payments. In a real application you would see pricing tiers here.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1E3A34] p-6 rounded-xl text-center">
          <h3 className="text-xl font-bold text-white mb-2">Free</h3>
          <p className="text-[#A3B3AF]">Basic scheduling features.</p>
        </div>
        <div className="bg-[#1E3A34] p-6 rounded-xl text-center">
          <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
          <p className="text-[#A3B3AF]">Advanced automation and integrations.</p>
        </div>
        <div className="bg-[#1E3A34] p-6 rounded-xl text-center">
          <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
          <p className="text-[#A3B3AF]">Full suite for large teams.</p>
        </div>
      </div>
    </div>
  )
}
