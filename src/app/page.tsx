/**
 * Home page component.
 *
 * @returns The home page
 */
export default function Home(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-4xl font-bold">Coding Arena</h1>
        <p className="text-xl text-gray-600">
          Next.js 15 with Zero-Tolerance Quality Gates
        </p>
        <div className="flex flex-col gap-2 text-sm text-gray-500">
          <div>✅ 100% Type Coverage</div>
          <div>✅ Zero ESLint Warnings</div>
          <div>✅ 90% Test Coverage</div>
          <div>✅ 18 ESLint Plugins</div>
          <div>✅ Husky Pre-Commit Hooks</div>
        </div>
      </div>
    </main>
  )
}
