export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Personal Finance Tracker</h1>
      <p className="text-xl mb-8">Manage your expenses, track budgets, and gain financial insights</p>
      <a href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700">
        Get Started
      </a>
    </main>
  );
}
