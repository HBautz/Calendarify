import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="max-w-[960px] mx-auto space-y-12">
      <section className="@container">
        <div className="@[480px]:p-4">
          <div
            className="flex min-h-[480px] flex-col gap-6 bg-cover bg-center bg-no-repeat @[480px]:gap-8 @[480px]:rounded-xl items-center justify-center p-4 rounded-xl text-center"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.4) 100%), url('https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&w=1200&q=80')",
            }}
          >
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] @[480px]:text-5xl @[480px]:font-black @[480px]:leading-tight @[480px]:tracking-[-0.033em]">
                Easy scheduling ahead
              </h1>
              <h2 className="text-white text-sm font-normal leading-normal @[480px]:text-base @[480px]:font-normal @[480px]:leading-normal">
                Calendarify is the modern scheduling platform that makes scheduling easy. Say goodbye to phone and email tag for finding the perfect time.
              </h2>
            </div>
            <Link
              to="/signup"
              className="bg-[#34D399] text-[#1A2E29] px-6 py-3 rounded-lg hover:bg-[#2C4A43] transition-colors text-sm font-bold"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1E3A34] p-6 rounded-xl">
          <span className="material-icons-outlined text-3xl text-[#34D399] mb-4">schedule</span>
          <h3 className="text-xl font-bold text-white mb-2">Smart Scheduling</h3>
          <p className="text-[#A3B3AF]">Let AI find the perfect meeting time for everyone. No more back-and-forth emails.</p>
        </div>
        <div className="bg-[#1E3A34] p-6 rounded-xl">
          <span className="material-icons-outlined text-3xl text-[#34D399] mb-4">sync</span>
          <h3 className="text-xl font-bold text-white mb-2">Calendar Sync</h3>
          <p className="text-[#A3B3AF]">Seamlessly sync with Google Calendar, Outlook, and other popular calendar apps.</p>
        </div>
        <div className="bg-[#1E3A34] p-6 rounded-xl">
          <span className="material-icons-outlined text-3xl text-[#34D399] mb-4">groups</span>
          <h3 className="text-xl font-bold text-white mb-2">Team Collaboration</h3>
          <p className="text-[#A3B3AF]">Coordinate team schedules, manage resources, and keep everyone in sync.</p>
        </div>
      </section>

      <section className="text-center">
        <h2 className="text-2xl font-bold text-white mb-6">Trusted by teams worldwide</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
          <div className="text-[#A3B3AF]">TechCorp</div>
          <div className="text-[#A3B3AF]">Global Solutions</div>
          <div className="text-[#A3B3AF]">Innovate Inc</div>
          <div className="text-[#A3B3AF]">Future Systems</div>
        </div>
      </section>
    </div>
  )
}
