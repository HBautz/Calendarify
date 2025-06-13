import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="space-y-12">
      <section
        className="flex flex-col items-center justify-center text-center gap-6 py-20 rounded-xl bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&w=1200&q=80')" }}
      >
        <h1 className="text-white text-4xl md:text-5xl font-black tracking-tight">Easy scheduling ahead</h1>
        <p className="text-white max-w-xl">
          Calendarify is the modern scheduling platform that makes scheduling easy. Say goodbye to phone and email tag for finding the perfect time.
        </p>
        <Link to="/signup" className="bg-[#34D399] text-[#1A2E29] px-6 py-3 rounded-lg hover:bg-[#2C4A43] text-sm font-bold">
          Get started
        </Link>
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
