import React from 'react'

export default function Product() {
  return (
    <div className="max-w-[960px] mx-auto space-y-12">
      <section className="@container">
        <div className="@[480px]:p-4">
          <div
            className="flex min-h-[480px] flex-col gap-6 bg-cover bg-center bg-no-repeat @[480px]:gap-8 @[480px]:rounded-xl items-center justify-center p-4 rounded-xl text-center"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.4) 100%), url('https://images.unsplash.com/photo-1522199710521-72d69614c702?auto=format&fit=crop&w=1200&q=80')",
            }}
          >
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] @[480px]:text-5xl @[480px]:font-black @[480px]:leading-tight @[480px]:tracking-[-0.033em]">
                Powerful Features for Modern Teams
              </h1>
              <h2 className="text-white text-sm font-normal leading-normal @[480px]:text-base @[480px]:font-normal @[480px]:leading-normal">
                Discover how Calendarify's innovative features can transform your scheduling experience
              </h2>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
        <div className="bg-[#1E3A34] p-8 rounded-xl">
          <span className="material-icons-outlined text-4xl text-[#34D399] mb-4">smart_toy</span>
          <h3 className="text-2xl font-bold text-white mb-4">AI-Powered Scheduling</h3>
          <p className="text-[#A3B3AF] mb-4">Our advanced AI analyzes team availability, meeting patterns, and preferences to suggest optimal meeting times. No more scheduling conflicts or time zone confusion.</p>
          <ul className="text-[#A3B3AF] space-y-2">
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Smart time slot suggestions</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Time zone optimization</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Meeting pattern learning</li>
          </ul>
        </div>

        <div className="bg-[#1E3A34] p-8 rounded-xl">
          <span className="material-icons-outlined text-4xl text-[#34D399] mb-4">sync</span>
          <h3 className="text-2xl font-bold text-white mb-4">Seamless Integration</h3>
          <p className="text-[#A3B3AF] mb-4">Connect with your favorite tools and platforms. Calendarify works with all major calendar systems and productivity apps.</p>
          <ul className="text-[#A3B3AF] space-y-2">
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Google Calendar & Outlook</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Slack & Microsoft Teams</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Zoom & Google Meet</li>
          </ul>
        </div>

        <div className="bg-[#1E3A34] p-8 rounded-xl">
          <span className="material-icons-outlined text-4xl text-[#34D399] mb-4">groups</span>
          <h3 className="text-2xl font-bold text-white mb-4">Team Collaboration</h3>
          <p className="text-[#A3B3AF] mb-4">Keep your team in sync with powerful collaboration features designed for modern workplaces.</p>
          <ul className="text-[#A3B3AF] space-y-2">
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Shared team calendars</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Resource management</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Meeting analytics</li>
          </ul>
        </div>

        <div className="bg-[#1E3A34] p-8 rounded-xl">
          <span className="material-icons-outlined text-4xl text-[#34D399] mb-4">security</span>
          <h3 className="text-2xl font-bold text-white mb-4">Enterprise Security</h3>
          <p className="text-[#A3B3AF] mb-4">Built with enterprise-grade security to protect your team's data and privacy.</p>
          <ul className="text-[#A3B3AF] space-y-2">
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>End-to-end encryption</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>SSO & MFA support</li>
            <li className="flex items-center"><span className="material-icons-outlined text-[#34D399] mr-2">check_circle</span>Compliance ready</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
