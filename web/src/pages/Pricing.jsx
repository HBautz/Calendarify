import React from 'react'

export default function Pricing() {
  return (
    <div className="space-y-12">
      <section className="@container">
        <div className="@[480px]:p-4">
          <div
            className="flex min-h-[480px] flex-col gap-6 bg-cover bg-center bg-no-repeat @[480px]:gap-8 @[480px]:rounded-xl items-center justify-center p-4 rounded-xl text-center"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.4) 100%), url('https://images.unsplash.com/photo-1556742031-c6961e8560b0?auto=format&fit=crop&w=1200&q=80')",
            }}
          >
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] @[480px]:text-5xl @[480px]:font-black @[480px]:leading-tight @[480px]:tracking-[-0.033em]">
                Simple, Transparent Pricing
              </h1>
              <h2 className="text-white text-sm font-normal leading-normal @[480px]:text-base @[480px]:font-normal @[480px]:leading-normal">
                Choose the plan that's right for your team
              </h2>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
        <div className="bg-[#1E3A34] p-8 rounded-xl">
          <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
          <p className="text-[#A3B3AF] mb-6">Perfect for individuals</p>
          <div className="text-4xl font-bold text-white mb-6">$0<span className="text-lg text-[#A3B3AF]">/month</span></div>
          <ul className="text-[#A3B3AF] space-y-3 mb-8">
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Basic scheduling</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Calendar sync</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Email notifications</li>
          </ul>
          <a href="/signup" className="block text-center bg-[#34D399] text-[#1A2E29] px-6 py-3 rounded-lg hover:bg-[#2C4A43] transition-colors font-bold">Get Started</a>
        </div>

        <div className="bg-[#1E3A34] p-8 rounded-xl border-2 border-[#34D399]">
          <div className="bg-[#34D399] text-[#1A2E29] text-sm font-bold px-3 py-1 rounded-full inline-block mb-4">Most Popular</div>
          <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
          <p className="text-[#A3B3AF] mb-6">For growing teams</p>
          <div className="text-4xl font-bold text-white mb-6">$12<span className="text-lg text-[#A3B3AF]">/month</span></div>
          <ul className="text-[#A3B3AF] space-y-3 mb-8">
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Everything in Free</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Team scheduling</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Advanced analytics</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Priority support</li>
          </ul>
          <a href="/signup" className="block text-center bg-[#34D399] text-[#1A2E29] px-6 py-3 rounded-lg hover:bg-[#2C4A43] transition-colors font-bold">Get Started</a>
        </div>

        <div className="bg-[#1E3A34] p-8 rounded-xl">
          <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
          <p className="text-[#A3B3AF] mb-6">For large organizations</p>
          <div className="text-4xl font-bold text-white mb-6">Custom</div>
          <ul className="text-[#A3B3AF] space-y-3 mb-8">
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Everything in Pro</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Custom integrations</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Dedicated support</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Advanced security</li>
          </ul>
          <a href="/contact" className="block text-center bg-[#34D399] text-[#1A2E29] px-6 py-3 rounded-lg hover:bg-[#2C4A43] transition-colors font-bold">Contact Sales</a>
        </div>
      </section>

      <section className="mt-12 px-4 text-center">
        <h2 className="text-2xl font-bold text-white mb-6">All plans include</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#1E3A34] p-6 rounded-xl">
            <span className="material-icons-outlined text-3xl text-[#34D399] mb-4">security</span>
            <h3 className="text-xl font-bold text-white mb-2">Security</h3>
            <p className="text-[#A3B3AF]">Enterprise-grade security and data protection</p>
          </div>
          <div className="bg-[#1E3A34] p-6 rounded-xl">
            <span className="material-icons-outlined text-3xl text-[#34D399] mb-4">support_agent</span>
            <h3 className="text-xl font-bold text-white mb-2">Support</h3>
            <p className="text-[#A3B3AF]">24/7 customer support and documentation</p>
          </div>
          <div className="bg-[#1E3A34] p-6 rounded-xl">
            <span className="material-icons-outlined text-3xl text-[#34D399] mb-4">update</span>
            <h3 className="text-xl font-bold text-white mb-2">Updates</h3>
            <p className="text-[#A3B3AF]">Regular feature updates and improvements</p>
          </div>
        </div>
      </section>
    </div>
  )
}
